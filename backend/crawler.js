import * as cheerio from 'cheerio';
import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

// Domain cookie jar for bypassing Cloudflare stateless bot controls
const cookieJar = new Map();

/**
 * Recursively extracts and formats readable text from Cheerio DOM nodes.
 * Preserves structural block separation (headings, paragraphs, lists).
 */
function toFormattedText(node, $) {
  if (!node) return '';
  let text = '';
  
  const tagName = node.name ? node.name.toLowerCase() : '';
  if (/^(script|style|noscript|iframe|svg|header|footer|nav|aside|select|option)$/.test(tagName)) {
    return '';
  }

  if (node.type === 'text') {
    return node.data || '';
  }

  if (node.children && node.children.length > 0) {
    node.children.forEach(child => {
      text += toFormattedText(child, $);
    });
  }

  const trimmed = text.trim();
  if (!trimmed) return '';

  if (/^(p|div|blockquote|pre|tr|ul|ol)$/.test(tagName)) {
    return '\n\n' + trimmed + '\n\n';
  } else if (/^(h1|h2|h3|h4|h5|h6)$/.test(tagName)) {
    return '\n\n### ' + trimmed + ' ###\n\n';
  } else if (tagName === 'li') {
    return '\n* ' + trimmed;
  } else if (tagName === 'br') {
    return '\n';
  }

  return text;
}

/**
 * Normalizes a URL by removing trailing slashes, fragments, and queries.
 */
function normalizeUrl(urlString, baseUrl) {
  try {
    const url = new URL(urlString, baseUrl);
    url.hash = ''; // Remove fragments
    let normalized = url.toString();
    if (normalized.endsWith('/') && url.pathname !== '/') {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch (e) {
    return null;
  }
}

/**
 * Formulates browser headers and appends cookies for the domain to bypass CDN challenge checks.
 */
function getHeadersForUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname;
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    };

    const cookies = cookieJar.get(host);
    if (cookies && cookies.size > 0) {
      headers['Cookie'] = [...cookies].join('; ');
    }

    return headers;
  } catch (e) {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
  }
}

/**
 * Extracts set-cookie values from responses to maintain stateful crawling.
 */
function storeCookiesFromResponse(targetUrl, response) {
  try {
    const setCookieHeader = response.headers.get('set-cookie');
    if (!setCookieHeader) return;

    const parsed = new URL(targetUrl);
    const host = parsed.hostname;

    if (!cookieJar.has(host)) {
      cookieJar.set(host, new Set());
    }

    const hostCookies = cookieJar.get(host);
    const cookieEntries = setCookieHeader.split(/,(?=[^;]*=)/);
    cookieEntries.forEach(entry => {
      const cookieKV = entry.split(';')[0].trim();
      if (cookieKV && cookieKV.includes('=')) {
        hostCookies.add(cookieKV);
      }
    });
  } catch (e) {
    // Ignore cookie store errors
  }
}

/**
 * Security Add-on: Validates protocol and resolves host DNS to block SSRF requests.
 */
export async function validateUrlSafety(urlString) {
  try {
    const url = new URL(urlString);
    
    // 1. Protocol Restriction (Prevents file://, dict://, gopher:// local attacks)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Unsupported protocol. Only http: and https: targets are allowed.');
    }

    // 2. Private IP SSRF Prevention
    const host = url.hostname;
    const { address } = await dnsLookup(host);

    const privateIPRegex = /^(127\.)|(192\.168\.)|(10\.)|(172\.(1[6-9]|2[0-9]|3[0-1])\.)|(169\.254\.)|(::1)|(fe80:)/i;
    
    if (privateIPRegex.test(address)) {
      // Loopback allowed for local debugging, block internal corporate scopes (e.g. 10.0.0.1)
      if (host !== 'localhost' && host !== '127.0.0.1' && host !== 'site.local') {
        throw new Error(`SSRF Blocked: Resolving local address range '${address}' is prohibited.`);
      }
    }
    return { ok: true, address };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * AI crawlers whose robots.txt access is analyzed for the AI SEO report.
 * Kept to the bots that matter for AI-search visibility and LLM training.
 */
const AI_CRAWLERS = [
  { bot: 'GPTBot', vendor: 'OpenAI — ChatGPT training' },
  { bot: 'OAI-SearchBot', vendor: 'OpenAI — ChatGPT Search' },
  { bot: 'ChatGPT-User', vendor: 'OpenAI — user-initiated fetches' },
  { bot: 'ClaudeBot', vendor: 'Anthropic — Claude' },
  { bot: 'Claude-User', vendor: 'Anthropic — user-initiated fetches' },
  { bot: 'PerplexityBot', vendor: 'Perplexity — search index' },
  { bot: 'Google-Extended', vendor: 'Google — Gemini training' },
  { bot: 'CCBot', vendor: 'Common Crawl — many AI models' },
  { bot: 'Bytespider', vendor: 'ByteDance — Doubao' },
  { bot: 'Applebot-Extended', vendor: 'Apple Intelligence' },
  { bot: 'meta-externalagent', vendor: 'Meta AI' }
];

/**
 * Parses robots.txt into user-agent groups with their allow/disallow rules.
 * Per RFC 9309: blank lines and comment lines carry no meaning (they never
 * split a run of consecutive User-agent lines), and a group runs until the
 * next User-agent line that follows at least one rule line.
 */
export function parseRobotsGroups(text) {
  // Strip a potential UTF-8 BOM so the first "User-agent" line parses.
  const clean = text.replace(/^﻿/, '');
  const groups = [];
  let current = null;
  let lastWasAgent = false;

  clean.split(/\r?\n/).forEach(rawLine => {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) return; // blank/comment lines are ignored entirely (no state change)

    const match = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!match) return;

    const key = match[1].toLowerCase();
    const value = match[2].trim();

    if (key === 'user-agent') {
      if (!lastWasAgent || !current) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      if ((key === 'disallow' || key === 'allow') && current) {
        current.rules.push({ type: key, path: value });
      }
      lastWasAgent = false;
    }
  });

  return groups;
}

/**
 * Resolves effective site-root access for a bot from parsed robots.txt groups.
 * RFC 9309 semantics implemented here:
 *  - exact user-agent token match beats the '*' group (no substring matching,
 *    so Applebot-Extended never inherits Applebot's rules)
 *  - ALL groups naming the same agent are merged (concatenated robots.txt files)
 *  - an Allow of the site root overrides Disallow: / (allow wins on tie)
 *  - 'Disallow: /*' is equivalent to a full block
 */
export function resolveBotAccess(groups, botName) {
  const botLower = botName.toLowerCase();

  let matched = groups.filter(g => g.agents.some(a => a === botLower));
  let matchedVia = 'specific rule';

  if (matched.length === 0) {
    matched = groups.filter(g => g.agents.includes('*'));
    matchedVia = 'wildcard (*) rule';
  }

  if (matched.length === 0) {
    return { status: 'allowed', detail: 'No robots.txt rules apply' };
  }

  const rules = matched.flatMap(g => g.rules);
  const isRootPath = (p) => p === '/' || p === '/*';
  const disallows = rules.filter(r => r.type === 'disallow' && r.path);
  const rootDisallowed = disallows.some(r => isRootPath(r.path));
  const rootAllowed = rules.some(r => r.type === 'allow' && isRootPath(r.path));

  if (rootDisallowed && !rootAllowed) {
    return { status: 'blocked', detail: `Disallow: / via ${matchedVia}` };
  }
  const partialDisallows = disallows.filter(r => !isRootPath(r.path));
  if (partialDisallows.length > 0) {
    return { status: 'partial', detail: `${partialDisallows.length} path(s) disallowed via ${matchedVia}` };
  }
  return { status: 'allowed', detail: `Allowed via ${matchedVia}` };
}

/**
 * Fetch with a timeout, retrying once on failure. The retry absorbs Node's
 * slow first-connection path (IPv6 attempt falling back to IPv4), which can
 * consume the entire first timeout on some hosts.
 * On serverless (Vercel) the function time budget is tight and the crawl
 * itself dominates it, so probes get one attempt with a shorter timeout.
 */
async function fetchWithRetry(url, options = {}, timeoutMs = 8000) {
  const attempts = process.env.VERCEL ? 1 : 2;
  const budget = process.env.VERCEL ? Math.min(timeoutMs, 5000) : timeoutMs;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fetch(url, { ...options, signal: AbortSignal.timeout(budget) });
    } catch (e) {
      if (attempt === attempts - 1) throw e;
    }
  }
}

/**
 * Fetches site-wide SEO signals in one pass:
 *  - robots.txt: presence, sitemap directive, per-AI-crawler access analysis
 *  - llms.txt / llms-full.txt: presence (AI content discovery standard)
 *  - homepage security headers (HSTS, CSP, X-Content-Type-Options, ...)
 */
export async function fetchSiteSignals(seedUrl, onUpdate) {
  const signals = {
    origin: '',
    robotsTxt: { found: false, sitemapDeclared: false, aiBots: [] },
    llmsTxt: { found: false },
    llmsFullTxt: { found: false },
    securityHeaders: null
  };

  let origin;
  try {
    origin = new URL(seedUrl).origin;
    signals.origin = origin;
  } catch (e) {
    return signals;
  }

  if (onUpdate) {
    onUpdate({ type: 'progress_log', message: 'Collecting site signals: robots.txt, llms.txt, security headers...' });
  }

  // All four probes run concurrently so the signals phase costs one fetch
  // budget (≤5s on Vercel, ≤16s locally), not the sum of all probes.
  const robotsProbe = (async () => {
    try {
      const res = await fetchWithRetry(origin + '/robots.txt', {
        headers: getHeadersForUrl(origin + '/robots.txt')
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && !contentType.includes('text/html')) {
        const text = (await res.text()).slice(0, 100000);
        signals.robotsTxt.found = true;
        signals.robotsTxt.sitemapDeclared = /^\s*sitemap\s*:/im.test(text);
        const groups = parseRobotsGroups(text);
        signals.robotsTxt.aiBots = AI_CRAWLERS.map(c => ({
          bot: c.bot,
          vendor: c.vendor,
          ...resolveBotAccess(groups, c.bot)
        }));
        return;
      }
      if (res.status >= 500) {
        // RFC 9309: a 5xx robots.txt means access rules are UNKNOWN, not open
        signals.robotsTxt.aiBots = AI_CRAWLERS.map(c => ({
          bot: c.bot,
          vendor: c.vendor,
          status: 'unknown',
          detail: `robots.txt returned HTTP ${res.status} — access rules unknown`
        }));
        return;
      }
      // 4xx / HTML soft-404: no robots.txt => everything allowed by default
      signals.robotsTxt.aiBots = AI_CRAWLERS.map(c => ({
        bot: c.bot,
        vendor: c.vendor,
        status: 'allowed',
        detail: 'No robots.txt — all crawlers allowed by default'
      }));
    } catch (e) {
      signals.robotsTxt.aiBots = AI_CRAWLERS.map(c => ({
        bot: c.bot,
        vendor: c.vendor,
        status: 'unknown',
        detail: 'robots.txt unreachable — access rules unknown'
      }));
    }
  })();

  const llmsProbes = [{ file: '/llms.txt', key: 'llmsTxt' }, { file: '/llms-full.txt', key: 'llmsFullTxt' }].map(({ file, key }) =>
    (async () => {
      try {
        const res = await fetchWithRetry(origin + file, {
          headers: getHeadersForUrl(origin + file)
        }, 6000);
        const contentType = res.headers.get('content-type') || '';
        // Many sites serve a soft-404 HTML page; only count non-HTML 200s
        signals[key].found = res.ok && !contentType.includes('text/html');
      } catch (e) {
        // unreachable — leave found=false
      }
    })()
  );

  const headersProbe = (async () => {
    try {
      const res = await fetchWithRetry(seedUrl, {
        headers: getHeadersForUrl(seedUrl),
        redirect: 'follow'
      }, 10000);
      const h = (name) => res.headers.get(name) || '';
      signals.securityHeaders = {
        strictTransportSecurity: h('strict-transport-security'),
        contentSecurityPolicy: h('content-security-policy'),
        xContentTypeOptions: h('x-content-type-options'),
        xFrameOptions: h('x-frame-options'),
        referrerPolicy: h('referrer-policy'),
        permissionsPolicy: h('permissions-policy')
      };
    } catch (e) {
      // homepage unreachable for header probe — leave null
    }
  })();

  await Promise.all([robotsProbe, ...llmsProbes, headersProbe]);

  if (onUpdate) {
    const blocked = signals.robotsTxt.aiBots.filter(b => b.status === 'blocked').length;
    onUpdate({
      type: 'progress_log',
      message: `Site signals collected: robots.txt ${signals.robotsTxt.found ? 'found' : 'missing'}, llms.txt ${signals.llmsTxt.found ? 'found' : 'missing'}, ${blocked} AI crawler(s) blocked.`
    });
  }

  return signals;
}

/**
 * Recursively parses sitemap XML files starting from /sitemap.xml to discover pages.
 */
export async function discoverSitemapUrls(seedUrl, onUpdate, checkCancelled) {
  const urls = [];
  const visitedSitemaps = new Set();
  
  let hostOrigin;
  try {
    hostOrigin = new URL(seedUrl).origin;
  } catch (e) {
    return [];
  }

  const queue = [new URL('/sitemap.xml', hostOrigin).toString()];
  onUpdate({
    type: 'progress_log',
    message: 'Initiating XML sitemap discovery...'
  });

  while (queue.length > 0) {
    if (checkCancelled && checkCancelled()) break;
    const currentSitemap = queue.shift();
    if (visitedSitemaps.has(currentSitemap)) continue;
    visitedSitemaps.add(currentSitemap);

    try {
      const response = await fetch(currentSitemap, {
        headers: getHeadersForUrl(currentSitemap),
        signal: AbortSignal.timeout(6000)
      });
      storeCookiesFromResponse(currentSitemap, response);

      if (!response.ok) continue;

      const text = await response.text();
      const $ = cheerio.load(text, { xmlMode: true });

      $('loc').each((_, el) => {
        const locUrl = $(el).text().trim();
        if (locUrl.endsWith('.xml') || locUrl.includes('/sitemap')) {
          queue.push(locUrl);
        } else {
          try {
            const locParsed = new URL(locUrl);
            if (locParsed.origin === hostOrigin) {
              const normalized = normalizeUrl(locUrl);
              if (normalized) urls.push(normalized);
            }
          } catch (e) {}
        }
      });
    } catch (e) {
      // Ignore sitemap fetch warnings
    }
  }

  const uniqueUrls = [...new Set(urls)];
  if (uniqueUrls.length > 0) {
    onUpdate({
      type: 'progress_log',
      message: `Sitemap scanning successful: Found ${uniqueUrls.length} pages`
    });
  } else {
    onUpdate({
      type: 'progress_log',
      message: 'No sitemap.xml found or sitemap was empty.'
    });
  }

  return uniqueUrls;
}

/**
 * Concurrently validates external URLs using HEAD requests (falling back to GET).
 */
export async function validateExternalLinks(externalUrls, onUpdate, checkCancelled) {
  const uniqueUrls = [...new Set(externalUrls)];
  const results = [];
  const concurrencyLimit = 5;
  let activeCount = 0;
  let index = 0;

  if (uniqueUrls.length === 0) return [];

  onUpdate({
    type: 'progress_log',
    message: `Starting verification of ${uniqueUrls.length} unique external links...`
  });

  return new Promise((resolve) => {
    async function checkNext() {
      if (checkCancelled && checkCancelled()) {
        resolve(results);
        return;
      }
      if (index >= uniqueUrls.length) {
        if (activeCount === 0) {
          resolve(results);
        }
        return;
      }

      const currentUrl = uniqueUrls[index++];
      
      // Safety guard: skip invalid/unsupported protocols
      if (!currentUrl.startsWith('http://') && !currentUrl.startsWith('https://')) {
        results.push({
          url: currentUrl,
          status: 0,
          ok: false,
          error: 'Unsupported Protocol'
        });
        checkNext();
        return;
      }

      activeCount++;

      (async () => {
        let status = 0;
        let ok = false;
        let error = null;

        try {
          // 1. Try HEAD request first
          const headHeaders = { ...getHeadersForUrl(currentUrl), method: 'HEAD' };
          let response = await fetch(currentUrl, {
            method: 'HEAD',
            headers: headHeaders,
            signal: AbortSignal.timeout(5000)
          });
          storeCookiesFromResponse(currentUrl, response);

          // 2. Fall back to GET if HEAD failed/is not allowed
          if (!response.ok || response.status === 405 || response.status === 403) {
            const getHeaders = getHeadersForUrl(currentUrl);
            response = await fetch(currentUrl, {
              method: 'GET',
              headers: getHeaders,
              signal: AbortSignal.timeout(5000)
            });
            storeCookiesFromResponse(currentUrl, response);
          }

          status = response.status;
          ok = response.ok;
        } catch (err) {
          error = err.message;
        }

        results.push({
          url: currentUrl,
          status,
          ok,
          error
        });

        if (results.length % 5 === 0 || results.length === uniqueUrls.length) {
          onUpdate({
            type: 'progress_log',
            message: `External links validation: ${results.length}/${uniqueUrls.length} checked`
          });
        }

        activeCount--;
        checkNext();
      })();
    }

    for (let i = 0; i < Math.min(concurrencyLimit, uniqueUrls.length); i++) {
      checkNext();
    }
  });
}

/**
 * Crawls a website starting from seedUrl up to maxPages.
 */
export async function crawlWebsite(seedUrl, maxPages = 100, preDiscoveredUrls = [], onUpdate, checkCancelled) {
  let normalizedSeed = normalizeUrl(seedUrl);
  if (!normalizedSeed) {
    throw new Error('Invalid seed URL');
  }

  // Security Add-on: Validate URL safety against SSRF and unsupported protocols
  const safety = await validateUrlSafety(normalizedSeed);
  if (!safety.ok) {
    throw new Error(safety.error);
  }

  // Clear cookie jar for the new session crawl
  cookieJar.clear();

  const seedParsed = new URL(normalizedSeed);
  const domain = seedParsed.hostname;

  const visited = new Set();
  const queue = [normalizedSeed];
  const pages = [];
  
  let crawledCount = 0;

  const discovered = new Set([normalizedSeed]);

  for (const url of preDiscoveredUrls) {
    if (discovered.size >= maxPages) break;
    const norm = normalizeUrl(url);
    if (norm && !discovered.has(norm)) {
      discovered.add(norm);
      queue.push(norm);
    }
  }

  onUpdate({
    type: 'progress_log',
    message: `Crawler queue initialized with ${queue.length} pages.`
  });

  while (queue.length > 0 && crawledCount < maxPages) {
    if (checkCancelled && checkCancelled()) {
      break;
    }
    const currentUrl = queue.shift();
    visited.add(currentUrl);

    onUpdate({
      type: 'progress',
      data: {
        currentUrl,
        crawledCount,
        queueLength: queue.length,
        pagesFoundCount: discovered.size
      }
    });

    const startTime = Date.now();
    try {
      const response = await fetch(currentUrl, {
        headers: getHeadersForUrl(currentUrl),
        redirect: 'follow'
      });
      storeCookiesFromResponse(currentUrl, response);

      if (crawledCount === 0 && response.url && response.url !== currentUrl) {
        try {
          const finalParsed = new URL(response.url);
          if (finalParsed.hostname.endsWith(domain)) {
            seedParsed.protocol = finalParsed.protocol;
          }
        } catch (e) {}
      }

      const loadTimeMs = Date.now() - startTime;
      const status = response.status;

      if (!response.ok) {
        pages.push({
          url: currentUrl,
          title: `Error ${status}`,
          text: '',
          wordCount: 0,
          loadTimeMs,
          status,
          sizeBytes: 0,
          links: [],
          error: `HTTP status ${status}`
        });
        crawledCount++;
        onUpdate({
          type: 'page_crawled',
          data: { url: currentUrl, title: `Error ${status}`, status, wordCount: 0, loadTimeMs }
        });
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        pages.push({
          url: currentUrl,
          title: contentType.split(';')[0] || 'Non-HTML Resource',
          text: '',
          wordCount: 0,
          loadTimeMs,
          status,
          sizeBytes: parseInt(response.headers.get('content-length') || '0', 10),
          links: [],
          error: null
        });
        crawledCount++;
        continue;
      }

      const html = await response.text();
      const sizeBytes = Buffer.byteLength(html, 'utf8');
      const $ = cheerio.load(html);

      const title = $('title').text().trim() || 'Untitled Page';
      const metaDescription = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
      const canonicalUrl = $('link[rel="canonical"]').attr('href') || '';
      const h1Count = $('h1').length;
      const h2Count = $('h2').length;
      const h3Count = $('h3').length;
      const robots = $('meta[name="robots"]').attr('content') || '';
      const imageCount = $('img').length;
      const missingAltCount = $('img:not([alt]), img[alt=""]').length;
      const hasViewport = $('meta[name="viewport"]').length > 0;

      // Extract JSON-LD schema markup types
      const schemas = [];
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const jsonText = $(el).html();
          if (jsonText) {
            const parsed = JSON.parse(jsonText.trim());
            if (Array.isArray(parsed)) {
              parsed.forEach(item => {
                if (item['@type']) schemas.push(item['@type']);
              });
            } else if (parsed && parsed['@type']) {
              schemas.push(parsed['@type']);
            }
          }
        } catch (e) {}
      });

      const pageLinks = [];
      $('a[href]').each((_, el) => {
        const rawHref = $(el).attr('href');
        if (!rawHref || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
          return;
        }

        let resolved = normalizeUrl(rawHref, currentUrl);
        if (resolved) {
          try {
            const resolvedParsed = new URL(resolved);
            const isExternal = resolvedParsed.hostname !== domain;

            // Enforce unified protocol for internal links to prevent duplicate crawls
            if (!isExternal) {
              resolvedParsed.protocol = seedParsed.protocol;
              resolved = resolvedParsed.toString();
              if (resolved.endsWith('/') && resolvedParsed.pathname !== '/') {
                resolved = resolved.slice(0, -1);
              }
            }

            pageLinks.push({
              raw: rawHref,
              resolved,
              isExternal
            });

            if (!isExternal && !discovered.has(resolved)) {
              if (discovered.size < maxPages) {
                discovered.add(resolved);
                queue.push(resolved);
              }
            }
          } catch (e) {}
        }
      });

      const contentDom = cheerio.load(html);
      contentDom('script, style, noscript, iframe, svg, header, footer, nav, aside, [role="banner"], [role="navigation"], [role="contentinfo"]').remove();
      contentDom('#header, .header, #footer, .footer, #navigation, .navigation, #sidebar, .sidebar, #menu, .menu').remove();

      let formattedText = toFormattedText(contentDom('body')[0], cheerio);
      const cleanText = formattedText
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
      const wordCount = cleanText ? cleanText.split(/\s+/).length : 0;

      pages.push({
        url: currentUrl,
        title,
        text: cleanText,
        wordCount,
        loadTimeMs,
        status,
        sizeBytes,
        links: pageLinks,
        error: null,
        metaDescription,
        canonicalUrl,
        h1Count,
        h2Count,
        h3Count,
        robots,
        schemas,
        imageCount,
        missingAltCount,
        hasViewport
      });

      crawledCount++;

      onUpdate({
        type: 'page_crawled',
        data: {
          url: currentUrl,
          title,
          status,
          wordCount,
          loadTimeMs
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (err) {
      const loadTimeMs = Date.now() - startTime;
      pages.push({
        url: currentUrl,
        title: 'Network Error',
        text: '',
        wordCount: 0,
        loadTimeMs,
        status: 0,
        sizeBytes: 0,
        links: [],
        error: err.message
      });
      crawledCount++;

      onUpdate({
        type: 'page_crawled',
        data: {
          url: currentUrl,
          title: 'Network Error',
          status: 0,
          wordCount: 0,
          loadTimeMs,
          error: err.message
        }
      });
    }
  }

  // Emit a final progress snapshot so the UI reflects the true crawled count
  // (per-iteration progress is emitted before the page is processed, lagging by one).
  onUpdate({
    type: 'progress',
    data: {
      currentUrl: '',
      crawledCount,
      queueLength: queue.length,
      pagesFoundCount: discovered.size
    }
  });

  return pages;
}
