import express from 'express';
import cors from 'cors';
import { discoverSitemapUrls, crawlWebsite, validateExternalLinks } from './crawler.js';
import { analyzeDuplicates } from './analyzer.js';

const app = express();
const PORT = process.env.PORT || 3051;

app.use(cors());
app.use(express.json());

// Global crawl state
let crawlState = {
  status: 'idle', // idle, crawling, completed, error
  targetUrl: '',
  progress: {
    currentUrl: '',
    crawledCount: 0,
    queueLength: 0,
    pagesFoundCount: 0
  },
  pagesRaw: [],
  pagesAnalyzed: [],
  nearDuplicates: [],
  summary: null,
  error: null
};

// SSE client connections
let clients = [];

// Helper to broadcast update to all connected clients
function broadcastUpdate(type, data) {
  clients.forEach(client => {
    client.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  });
}

// Start crawl endpoint
app.post('/api/crawl/start', async (req, res) => {
  const { url, maxPages = 100, checkExternal = true } = req.body;
  const limit = Number(maxPages) || 100;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (crawlState.status === 'crawling') {
    return res.status(400).json({ error: 'A crawl is already in progress', state: getSanitizedState() });
  }

  // Initialize crawl state
  crawlState = {
    status: 'crawling',
    targetUrl: url,
    progress: {
      currentUrl: url,
      crawledCount: 0,
      queueLength: 0,
      pagesFoundCount: 0
    },
    pagesRaw: [],
    pagesAnalyzed: [],
    nearDuplicates: [],
    summary: null,
    error: null
  };

  // Start crawl
  broadcastUpdate('started', getSanitizedState());
  broadcastUpdate('progress_log', { message: `Crawl session started: scanning up to ${limit} pages.` });

  try {
    const sitemapLogCallback = (logEvent) => {
      broadcastUpdate('progress_log', { message: logEvent.message });
    };

    // Step 1: Discover sitemap URLs
    const sitemapUrls = await discoverSitemapUrls(url, sitemapLogCallback, () => crawlState.status === 'idle');
    if (crawlState.status === 'idle') return;

    // Step 2: Internal Crawler
    broadcastUpdate('progress_log', { message: 'Starting internal page crawler...' });
    const rawPages = await crawlWebsite(url, limit, sitemapUrls, (progressEvent) => {
      if (progressEvent.type === 'progress') {
        crawlState.progress = progressEvent.data;
        broadcastUpdate('progress', progressEvent.data);
      } else if (progressEvent.type === 'page_crawled') {
        broadcastUpdate('page_crawled', progressEvent.data);
      } else if (progressEvent.type === 'progress_log') {
        broadcastUpdate('progress_log', { message: progressEvent.message });
      }
    }, () => crawlState.status === 'idle');

    if (crawlState.status === 'idle') return;
    crawlState.pagesRaw = rawPages;

    // Step 3: Validate External Outbound Links
    const externalUrls = [];
    rawPages.forEach(p => {
      p.links.forEach(lnk => {
        if (lnk.isExternal) {
          externalUrls.push(lnk.resolved);
        }
      });
    });

    const uniqueExternalUrls = [...new Set(externalUrls)];
    let externalValidationResults = [];
    
    if (checkExternal && uniqueExternalUrls.length > 0) {
      if (crawlState.status === 'idle') return;
      // Cap at 100 links to prevent extremely long delays
      const slicedExternalUrls = uniqueExternalUrls.slice(0, 100);
      broadcastUpdate('progress_log', { message: `Found ${uniqueExternalUrls.length} unique external links. Verifying top ${slicedExternalUrls.length}...` });
      externalValidationResults = await validateExternalLinks(slicedExternalUrls, sitemapLogCallback, () => crawlState.status === 'idle');
    } else if (!checkExternal) {
      broadcastUpdate('progress_log', { message: 'Outbound external links verification skipped.' });
    } else {
      broadcastUpdate('progress_log', { message: 'No external outbound links found to verify.' });
    }

    if (crawlState.status === 'idle') return;

    // Step 4: Perform Content Analysis
    crawlState.status = 'analyzing';
    broadcastUpdate('analyzing', { message: 'Performing duplicate & common boilerplate analysis...' });

    const analysisResults = analyzeDuplicates(rawPages, { shingleSize: 10, minBlockWords: 15 });
    crawlState.pagesAnalyzed = analysisResults.pages;
    crawlState.nearDuplicates = analysisResults.nearDuplicates;

    // Step 5: Compile Final Summary Metrics
    const totalPages = analysisResults.pages.length;
    const successfulPages = analysisResults.pages.filter(p => p.status >= 200 && p.status < 300);
    const skippedPages = analysisResults.pages.filter(p => p.status === 0 || p.status >= 300);

    const totalWords = successfulPages.reduce((sum, p) => sum + p.wordCount, 0);
    const totalDuplicateWords = successfulPages.reduce((sum, p) => sum + p.duplicateWordCount, 0);
    const totalCommonWords = successfulPages.reduce((sum, p) => sum + p.commonWordCount, 0);

    const avgDuplicatePercent = totalWords > 0 ? Math.round((totalDuplicateWords / totalWords) * 100) : 0;
    const avgCommonPercent = totalWords > 0 ? Math.round((totalCommonWords / totalWords) * 100) : 0;
    const avgUniquePercent = Math.max(0, 100 - avgDuplicatePercent - avgCommonPercent);

    const avgLoadTime = totalPages > 0 
      ? Math.round(analysisResults.pages.reduce((sum, p) => sum + p.loadTimeMs, 0) / totalPages) 
      : 0;

    // Detect Broken Internal Links
    const urlStatuses = new Map(analysisResults.pages.map(p => [p.url, p.status]));
    const brokenInternalLinks = [];

    analysisResults.pages.forEach(p => {
      p.links.forEach(lnk => {
        if (!lnk.isExternal) {
          const status = urlStatuses.get(lnk.resolved);
          if (status !== undefined && (status === 0 || status >= 400)) {
            const exists = brokenInternalLinks.some(b => b.sourceUrl === p.url && b.targetUrl === lnk.resolved);
            if (!exists) {
              brokenInternalLinks.push({
                sourceUrl: p.url,
                sourceTitle: p.title,
                targetUrl: lnk.resolved,
                rawHref: lnk.raw,
                status
              });
            }
          }
        }
      });
    });

    // Detect Broken External Links
    const externalStatusMap = new Map(externalValidationResults.map(r => [r.url, r]));
    const brokenExternalLinks = [];

    rawPages.forEach(p => {
      p.links.forEach(lnk => {
        if (lnk.isExternal) {
          const validation = externalStatusMap.get(lnk.resolved);
          if (validation && !validation.ok) {
            const exists = brokenExternalLinks.some(b => b.sourceUrl === p.url && b.targetUrl === lnk.resolved);
            if (!exists) {
              brokenExternalLinks.push({
                sourceUrl: p.url,
                sourceTitle: p.title,
                targetUrl: lnk.resolved,
                rawHref: lnk.raw,
                status: validation.status,
                error: validation.error || 'Connection Failed'
              });
            }
          }
        }
      });
    });

    crawlState.summary = {
      totalPages,
      successfulPagesCount: successfulPages.length,
      skippedPagesCount: skippedPages.length,
      totalWords,
      totalDuplicateWords,
      totalCommonWords,
      avgDuplicatePercent,
      avgCommonPercent,
      avgUniquePercent,
      avgLoadTimeMs: avgLoadTime,
      brokenInternalLinksCount: brokenInternalLinks.length,
      brokenInternalLinks,
      brokenExternalLinksCount: brokenExternalLinks.length,
      brokenExternalLinks
    };

    crawlState.status = 'completed';
    broadcastUpdate('completed', { summary: crawlState.summary });

    if (!res.headersSent) {
      res.json({ message: 'Crawl completed', state: getSanitizedState(true) });
    }
  } catch (err) {
    crawlState.status = 'error';
    crawlState.error = err.message;
    broadcastUpdate('error', { error: err.message });

    if (!res.headersSent) {
      res.status(500).json({ error: err.message, state: getSanitizedState() });
    }
  }
});

// SSE progress stream
app.get('/api/crawl/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.write(`event: init\ndata: ${JSON.stringify(getSanitizedState())}\n\n`);

  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(c => c !== res);
  });
});

// Get current state / results endpoint
app.get('/api/crawl/results', (req, res) => {
  if (crawlState.status === 'idle') {
    return res.json({ status: 'idle' });
  }

  res.json(getSanitizedState(true));
});

// Cancel active crawl
app.post('/api/crawl/cancel', (req, res) => {
  if (crawlState.status === 'crawling') {
    crawlState.status = 'idle';
    crawlState.error = 'Crawl cancelled by user';
    broadcastUpdate('cancelled', { message: 'Crawl cancelled by user' });
    return res.json({ message: 'Crawl cancellation requested' });
  }
  res.status(400).json({ error: 'No active crawl to cancel' });
});

// Get single page details & comparison
app.get('/api/crawl/page', (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  const page = crawlState.pagesAnalyzed.find(p => p.url === url);
  if (!page) {
    return res.status(404).json({ error: 'Page not found in crawled results' });
  }

  const rawPage = crawlState.pagesRaw.find(p => p.url === url);

  res.json({
    ...page,
    text: rawPage ? rawPage.text : ''
  });
});

// Serve live HTML replica page proxy with DOM-injected duplicate highlights
app.get('/api/crawl/view-html', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send('URL parameter is required');
  }

  try {
    const page = crawlState.pagesAnalyzed.find(p => p.url === url);
    if (!page) {
      return res.status(404).send('Page not found in active crawl session');
    }

    // Fetch the live site HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(response.status).send(`Failed to fetch live page layout: ${response.statusText}`);
    }

    let html = await response.text();

    // 1. Inject <base> tag to resolve relative paths for styles and images to the target website origin
    const baseTag = `<base href="${url}">`;
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${baseTag}`);
    } else {
      html = baseTag + html;
    }

    // 2. Inject in-DOM highlight traversal script and duplicate blocks payload
    const injectedScript = `
      <script>
        (function() {
          const blocks = ${JSON.stringify(page.blocks)};
          
          function highlightTextInDOM(element, text, type) {
            const normalizedText = text.replace(/\\s+/g, ' ').trim().toLowerCase();
            if (!normalizedText || normalizedText.length < 15) return;

            function traverse(node) {
              if (node.nodeType === Node.TEXT_NODE) {
                const nodeVal = node.nodeValue.replace(/\\s+/g, ' ');
                const normalizedNodeVal = nodeVal.toLowerCase();
                const matchIdx = normalizedNodeVal.indexOf(normalizedText);

                if (matchIdx !== -1) {
                  const parent = node.parentNode;
                  if (!parent) return;
                  const parentTag = parent.tagName.toLowerCase();
                  if (
                    parentTag === 'script' || 
                    parentTag === 'style' || 
                    parentTag === 'textarea' || 
                    parentTag === 'noscript' || 
                    parent.classList.contains('dup-highlight-span') || 
                    parent.classList.contains('common-highlight-span')
                  ) {
                    return;
                  }

                  const beforeText = node.nodeValue.substring(0, matchIdx);
                  const matchText = node.nodeValue.substring(matchIdx, matchIdx + text.length);
                  const afterText = node.nodeValue.substring(matchIdx + text.length);

                  const beforeNode = document.createTextNode(beforeText);
                  const afterNode = document.createTextNode(afterText);

                  const span = document.createElement('span');
                  span.className = type === 'common' ? 'common-highlight-span' : 'dup-highlight-span';
                  span.textContent = matchText;

                  parent.insertBefore(beforeNode, node);
                  parent.insertBefore(span, node);
                  parent.insertBefore(afterNode, node);
                  parent.removeChild(node);
                }
              } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName.toLowerCase();
                if (tag !== 'script' && tag !== 'style' && tag !== 'noscript' && tag !== 'iframe') {
                  const children = Array.from(node.childNodes);
                  children.forEach(child => traverse(child));
                }
              }
            }
            traverse(element);
          }

          window.addEventListener('DOMContentLoaded', () => {
            // Inject highlight CSS
            const style = document.createElement('style');
            style.textContent = \`
              .dup-highlight-span {
                background: #ffebe6 !important;
                border-bottom: 2px solid #ea580c !important;
                color: #9a2b06 !important;
                padding: 0.1rem 0 !important;
                font-weight: inherit !important;
              }
              .common-highlight-span {
                background: #f1f5f9 !important;
                border-bottom: 2px solid #64748b !important;
                color: #334155 !important;
                padding: 0.1rem 0 !important;
                font-weight: inherit !important;
              }
            \`;
            document.head.appendChild(style);

            // Execute highlight rules
            blocks.forEach(block => {
              highlightTextInDOM(document.body, block.text, block.type);
            });
          });
        })();
      </script>
    `;

    // Append script at end of document body
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${injectedScript}</body>`);
    } else {
      html += injectedScript;
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    res.status(500).send('Error rendering page replica: ' + err.message);
  }
});

// Helper to sanitize state
function getSanitizedState(includeDetails = false) {
  const state = {
    status: crawlState.status,
    targetUrl: crawlState.targetUrl,
    progress: crawlState.progress,
    error: crawlState.error,
    summary: crawlState.summary,
    nearDuplicates: crawlState.nearDuplicates
  };

  if (includeDetails) {
    state.pages = crawlState.pagesAnalyzed.map(p => {
      const rawPage = crawlState.pagesRaw.find(rp => rp.url === p.url);
      return {
        url: p.url,
        title: p.title,
        wordCount: p.wordCount,
        duplicateWordCount: p.duplicateWordCount,
        commonWordCount: p.commonWordCount,
        duplicatePercent: p.duplicatePercent,
        commonPercent: p.commonPercent,
        uniquePercent: p.uniquePercent,
        status: p.status,
        loadTimeMs: p.loadTimeMs,
        sizeBytes: p.sizeBytes,
        error: p.error,
        blocksCount: p.blocks ? p.blocks.length : 0,
        blocks: p.blocks || [],
        text: rawPage ? rawPage.text : (p.text || ''),
        links: p.links || [],
        pagePower: p.pagePower || 10,
        metaDescription: p.metaDescription || '',
        canonicalUrl: p.canonicalUrl || '',
        h1Count: p.h1Count || 0,
        h2Count: p.h2Count || 0,
        h3Count: p.h3Count || 0,
        robots: p.robots || '',
        schemas: p.schemas || [],
        imageCount: p.imageCount || 0,
        missingAltCount: p.missingAltCount || 0,
        hasViewport: p.hasViewport !== undefined ? p.hasViewport : true
      };
    });
  }

  return state;
}

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

export default app;
