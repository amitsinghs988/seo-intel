/**
 * Tokenizes text into a list of alphanumeric tokens with their indices in the original text.
 */
function tokenize(text) {
  const tokens = [];
  const regex = /[a-zA-Z0-9]+/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      text: match[0],
      normalized: match[0].toLowerCase(),
      index: match.index,
      length: match[0].length
    });
  }
  return tokens;
}

/**
 * Extracts continuous blocks of active tokens of a specific type.
 */
function extractBlocks(tokens, activeIndices, minBlockWords, type, pageUrl, originalText, shingleSize, shingleUrlsMap) {
  const blocks = [];
  let inBlock = false;
  let blockStart = -1;

  for (let i = 0; i < tokens.length; i++) {
    const isActive = activeIndices.has(i);

    if (isActive && !inBlock) {
      inBlock = true;
      blockStart = i;
    } else if (!isActive && inBlock) {
      const blockEnd = i - 1;
      const wordLength = blockEnd - blockStart + 1;
      if (wordLength >= minBlockWords) {
        blocks.push({ start: blockStart, end: blockEnd, wordCount: wordLength });
      }
      inBlock = false;
    }
  }
  
  if (inBlock) {
    const blockEnd = tokens.length - 1;
    const wordLength = blockEnd - blockStart + 1;
    if (wordLength >= minBlockWords) {
      blocks.push({ start: blockStart, end: blockEnd, wordCount: wordLength });
    }
  }

  // Hydrate blocks with characters indices and other matching URLs
  return blocks.map(block => {
    const startCharIdx = tokens[block.start].index;
    const endToken = tokens[block.end];
    const text = originalText.substring(startCharIdx, endToken.index + endToken.length);

    // Find other pages sharing the shingles in this block
    const matchingUrls = new Set();
    if (tokens.length >= shingleSize) {
      for (let i = block.start; i <= block.end - shingleSize + 1; i++) {
        const shingleTokens = tokens.slice(i, i + shingleSize);
        const shingleKey = shingleTokens.map(t => t.normalized).join(' ');
        const urls = shingleUrlsMap.get(shingleKey) || [];
        urls.forEach(url => {
          if (url !== pageUrl) {
            matchingUrls.add(url);
          }
        });
      }
    }

    return {
      type,
      text,
      wordCount: block.wordCount,
      charStart: startCharIdx,
      charEnd: endToken.index + endToken.length,
      matches: [...matchingUrls]
    };
  });
}

/**
 * Performs duplicate and common content analysis across crawled pages.
 */
export function analyzeDuplicates(pages, options = {}) {
  const shingleSize = options.shingleSize || 10;
  const minBlockWords = options.minBlockWords || 15;
  const commonThreshold = 0.30; // Shingles on >= 30% of pages are classified as "Common"

  const totalPagesCount = pages.length;

  // Step 1: Tokenize all pages
  const pageTokens = new Map();
  const pageShingles = new Map(); // url -> Set of shingleKeys for Jaccard Similarity

  pages.forEach(page => {
    const tokens = page.text ? tokenize(page.text) : [];
    pageTokens.set(page.url, tokens);

    const shingles = new Set();
    if (tokens.length >= shingleSize) {
      for (let i = 0; i <= tokens.length - shingleSize; i++) {
        const shingleKey = tokens.slice(i, i + shingleSize).map(t => t.normalized).join(' ');
        shingles.add(shingleKey);
      }
    }
    pageShingles.set(page.url, shingles);
  });

  // Step 2: Index all shingles globally
  const shingleMap = new Map(); // shingleKey -> Array of { url, tokenIndex }

  pages.forEach(page => {
    const tokens = pageTokens.get(page.url);
    if (tokens.length < shingleSize) return;

    for (let i = 0; i <= tokens.length - shingleSize; i++) {
      const shingleKey = tokens.slice(i, i + shingleSize).map(t => t.normalized).join(' ');

      if (!shingleMap.has(shingleKey)) {
        shingleMap.set(shingleKey, []);
      }
      shingleMap.get(shingleKey).push({
        url: page.url,
        tokenIndex: i
      });
    }
  });

  // Step 3: Classify shingles as duplicate, common, or unique
  const duplicateTokenIndices = new Map(); // url -> Set of token indices
  const commonTokenIndices = new Map();    // url -> Set of token indices
  const shingleUrlsMap = new Map();        // shingleKey -> List of unique URLs sharing it

  pages.forEach(page => {
    duplicateTokenIndices.set(page.url, new Set());
    commonTokenIndices.set(page.url, new Set());
  });

  shingleMap.forEach((occurrences, shingleKey) => {
    const uniqueUrls = [...new Set(occurrences.map(o => o.url))];
    shingleUrlsMap.set(shingleKey, uniqueUrls);

    if (uniqueUrls.length > 1) {
      // Determine if it is site-wide boilerplate (Common) or actual duplication
      const frequency = uniqueUrls.length / totalPagesCount;
      // Boilerplate requires appearing on at least 3 pages AND crossing the frequency threshold
      const isCommon = uniqueUrls.length > 2 && frequency >= commonThreshold;

      occurrences.forEach(occ => {
        if (isCommon) {
          const commonSet = commonTokenIndices.get(occ.url);
          for (let i = 0; i < shingleSize; i++) {
            commonSet.add(occ.tokenIndex + i);
          }
        } else {
          const dupSet = duplicateTokenIndices.get(occ.url);
          for (let i = 0; i < shingleSize; i++) {
            dupSet.add(occ.tokenIndex + i);
          }
        }
      });
    }
  });

  // Step 4: Page report compilation and block generation
  const pageReports = pages.map(page => {
    const tokens = pageTokens.get(page.url);
    const rawCommonIndices = commonTokenIndices.get(page.url);
    const rawDupIndices = duplicateTokenIndices.get(page.url);

    // Resolve overlaps: Common boilerplate takes precedence over duplicate content
    const commonIndices = new Set();
    const dupIndices = new Set();

    for (let i = 0; i < tokens.length; i++) {
      if (rawCommonIndices.has(i)) {
        commonIndices.add(i);
      } else if (rawDupIndices.has(i)) {
        dupIndices.add(i);
      }
    }

    // Extract blocks
    const duplicateBlocks = extractBlocks(
      tokens, dupIndices, minBlockWords, 'duplicate', page.url, page.text, shingleSize, shingleUrlsMap
    );
    const commonBlocks = extractBlocks(
      tokens, commonIndices, minBlockWords, 'common', page.url, page.text, shingleSize, shingleUrlsMap
    );

    // Calculate word tallies
    const duplicateWordCount = duplicateBlocks.reduce((sum, b) => sum + b.wordCount, 0);
    const commonWordCount = commonBlocks.reduce((sum, b) => sum + b.wordCount, 0);

    const duplicatePercent = tokens.length > 0 
      ? Math.round((duplicateWordCount / tokens.length) * 100) 
      : 0;
    const commonPercent = tokens.length > 0
      ? Math.round((commonWordCount / tokens.length) * 100)
      : 0;
    const uniquePercent = Math.max(0, 100 - duplicatePercent - commonPercent);

    return {
      url: page.url,
      title: page.title,
      wordCount: tokens.length,
      duplicateWordCount,
      commonWordCount,
      duplicatePercent,
      commonPercent,
      uniquePercent,
      blocks: [...duplicateBlocks, ...commonBlocks],
      status: page.status,
      loadTimeMs: page.loadTimeMs,
      sizeBytes: page.sizeBytes,
      error: page.error,
      links: page.links || [],
      // Forward parsed SEO tags
      metaDescription: page.metaDescription || '',
      canonicalUrl: page.canonicalUrl || '',
      h1Count: page.h1Count || 0,
      h2Count: page.h2Count || 0,
      h3Count: page.h3Count || 0,
      robots: page.robots || '',
      schemas: page.schemas || [],
      imageCount: page.imageCount || 0,
      missingAltCount: page.missingAltCount || 0,
      hasViewport: page.hasViewport !== undefined ? page.hasViewport : true
    };
  });

  // --- PageRank (Page Power Score 10-100) Simulation ---
  const numPages = pageReports.length;
  if (numPages > 0) {
    const ranks = {};
    pageReports.forEach(p => {
      ranks[p.url] = 1.0;
    });

    const damping = 0.85;
    const iterations = 10;

    for (let iter = 0; iter < iterations; iter++) {
      const nextRanks = {};
      pageReports.forEach(p => {
        nextRanks[p.url] = 1.0 - damping;
      });

      pageReports.forEach(p => {
        const outbound = (p.links || []).filter(lnk => !lnk.isExternal);
        const uniqueOutboundUrls = [...new Set(outbound.map(lnk => lnk.resolved))].filter(u => ranks[u] !== undefined);

        if (uniqueOutboundUrls.length > 0) {
          const share = (ranks[p.url] * damping) / uniqueOutboundUrls.length;
          uniqueOutboundUrls.forEach(url => {
            nextRanks[url] += share;
          });
        } else {
          const share = (ranks[p.url] * damping) / numPages;
          pageReports.forEach(allP => {
            nextRanks[allP.url] += share;
          });
        }
      });

      pageReports.forEach(p => {
        ranks[p.url] = nextRanks[p.url];
      });
    }

    let maxRank = 0;
    let minRank = Infinity;
    pageReports.forEach(p => {
      const r = ranks[p.url];
      if (r > maxRank) maxRank = r;
      if (r < minRank) minRank = r;
    });

    const rankRange = maxRank - minRank;

    pageReports.forEach(p => {
      let pagePower = 10;
      if (rankRange > 0) {
        pagePower = Math.round(10 + ((ranks[p.url] - minRank) / rankRange) * 90);
      }
      p.pagePower = pagePower;
    });
  }

  // Step 5: Near-Duplicate Similarity Matrix Analysis
  const nearDuplicates = [];
  const pageUrls = pages.filter(p => p.status >= 200 && p.status < 300).map(p => p.url);

  for (let i = 0; i < pageUrls.length; i++) {
    const urlA = pageUrls[i];
    const shinglesA = pageShingles.get(urlA) || new Set();
    if (shinglesA.size === 0) continue;

    for (let j = i + 1; j < pageUrls.length; j++) {
      const urlB = pageUrls[j];
      const shinglesB = pageShingles.get(urlB) || new Set();
      if (shinglesB.size === 0) continue;

      // Jaccard similarity: Intersection / Union
      let intersection = 0;
      shinglesA.forEach(s => {
        if (shinglesB.has(s)) intersection++;
      });

      const union = shinglesA.size + shinglesB.size - intersection;
      const similarity = union > 0 ? intersection / union : 0;

      // Flag pairs with >= 85% overlap as near-duplicates (canonical warning candidate)
      if (similarity >= 0.85) {
        nearDuplicates.push({
          urlA,
          titleA: pages.find(p => p.url === urlA).title,
          urlB,
          titleB: pages.find(p => p.url === urlB).title,
          similarityPercent: Math.round(similarity * 100)
        });
      }
    }
  }

  return {
    pages: pageReports,
    nearDuplicates
  };
}
