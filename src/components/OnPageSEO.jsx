import { useState, useMemo } from 'react';

/**
 * The 9 technical SEO categories audited per page (mirrors the claude-seo
 * skill's technical framework, restricted to what is measurable from crawled HTML).
 */
export const TECH_CATEGORIES = [
  { key: 'Crawlability', icon: '🕷️' },
  { key: 'Indexability', icon: '🗂️' },
  { key: 'Security', icon: '🔒' },
  { key: 'URL Structure', icon: '🔗' },
  { key: 'Mobile', icon: '📱' },
  { key: 'Performance', icon: '⚡' },
  { key: 'Structured Data', icon: '🏷️' },
  { key: 'Content Structure', icon: '📝' },
  { key: 'Images', icon: '🖼️' }
];

/**
 * Calculates page-level technical SEO compliance score and feedback logs.
 * Every audit entry is tagged with one of the 9 technical categories.
 */
export function calculateOnPageSEO(page) {
  if (!page) page = {};
  const url = page.url || '';
  const title = page.title || '';
  const description = page.metaDescription || '';
  const h1Count = page.h1Count || 0;
  const h2Count = page.h2Count || 0;
  const h3Count = page.h3Count || 0;
  const imageCount = page.imageCount || 0;
  const missingAltCount = page.missingAltCount || 0;
  const hasViewport = page.hasViewport !== undefined ? page.hasViewport : true;
  const schemas = page.schemas || [];
  const loadTimeMs = page.loadTimeMs || 0;
  const sizeBytes = page.sizeBytes || 0;
  const robots = page.robots || '';
  const canonicalUrl = page.canonicalUrl || '';
  const httpStatus = page.status !== undefined ? page.status : 200;
  const wordCount = page.wordCount || 0;

  let score = 100;
  const audits = [];

  // --- Category 1: Crawlability ---
  if (httpStatus >= 200 && httpStatus < 300) {
    audits.push({
      category: 'Crawlability',
      item: 'HTTP Status',
      status: 'optimal',
      message: `Page reachable (HTTP ${httpStatus})`,
      actual: `HTTP ${httpStatus}`,
      recommended: 'Optimal'
    });
  } else {
    score -= 25;
    audits.push({
      category: 'Crawlability',
      item: 'HTTP Status',
      status: 'critical',
      message: httpStatus === 0 ? 'Page failed to load (network error)' : `Page returned HTTP ${httpStatus}`,
      actual: httpStatus === 0 ? 'Network error' : `HTTP ${httpStatus}`,
      recommended: 'Fix the response so the page returns HTTP 200 for crawlers.'
    });
  }

  // robots "none" is shorthand for "noindex, nofollow"
  const hasNoindex = /noindex|\bnone\b/i.test(robots);
  const hasNofollow = /nofollow|\bnone\b/i.test(robots);
  if (hasNoindex) {
    score -= 20;
    audits.push({
      category: 'Indexability',
      item: 'Robots Meta Directives',
      status: 'critical',
      message: 'Meta robots blocks indexing (noindex) — page is excluded from search results',
      actual: `robots="${robots}"`,
      recommended: 'Remove noindex unless exclusion is intentional.'
    });
  } else if (hasNofollow) {
    score -= 5;
    audits.push({
      category: 'Indexability',
      item: 'Robots Meta Directives',
      status: 'warning',
      message: 'Meta robots contains nofollow — link equity does not flow from this page',
      actual: `robots="${robots}"`,
      recommended: 'Remove nofollow unless intentional; it stops PageRank distribution.'
    });
  } else {
    audits.push({
      category: 'Indexability',
      item: 'Robots Meta Directives',
      status: 'optimal',
      message: robots ? `Robots directives allow indexing ("${robots}")` : 'No restrictive robots directives',
      actual: robots || 'not set',
      recommended: 'Optimal'
    });
  }

  // --- Category 2: Indexability ---
  if (!canonicalUrl) {
    score -= 5;
    audits.push({
      category: 'Indexability',
      item: 'Canonical URL',
      status: 'warning',
      message: 'No canonical URL declared',
      actual: 'None',
      recommended: 'Add <link rel="canonical"> to consolidate duplicate/parameter URL variants.'
    });
  } else {
    audits.push({
      category: 'Indexability',
      item: 'Canonical URL',
      status: 'optimal',
      message: 'Canonical URL declared',
      actual: canonicalUrl,
      recommended: 'Optimal'
    });
  }

  // --- Category 4: URL Structure ---
  const urlIssues = [];
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (url.length > 115) urlIssues.push(`URL is long (${url.length} chars)`);
    if (/[A-Z]/.test(path)) urlIssues.push('uppercase letters in path');
    if (/_/.test(path)) urlIssues.push('underscores in path (use hyphens)');
    if (parsed.search) urlIssues.push('query parameters in indexed URL');
    const depth = path.split('/').filter(Boolean).length;
    if (depth > 4) urlIssues.push(`deep nesting (${depth} levels)`);
  } catch (e) { /* unparseable URL — skip structural checks */ }

  if (urlIssues.length > 0) {
    score -= Math.min(8, urlIssues.length * 4);
    audits.push({
      category: 'URL Structure',
      item: 'URL Structure',
      status: 'warning',
      message: `URL issues: ${urlIssues.join('; ')}`,
      actual: url,
      recommended: 'Prefer short, lowercase, hyphenated paths under 4 levels without query strings.'
    });
  } else {
    audits.push({
      category: 'URL Structure',
      item: 'URL Structure',
      status: 'optimal',
      message: 'Clean, crawlable URL structure',
      actual: url,
      recommended: 'Optimal'
    });
  }

  // --- Category 6: Performance ---
  if (loadTimeMs > 2000) {
    score -= 10;
    audits.push({
      category: 'Performance',
      item: 'Page Performance',
      status: 'critical',
      message: `Slow server response (${loadTimeMs} ms)`,
      actual: `${loadTimeMs} ms / ${(sizeBytes / 1024).toFixed(0)} KB`,
      recommended: 'Target <800 ms TTFB: enable caching/CDN and compress payloads.'
    });
  } else if (loadTimeMs > 1000 || sizeBytes > 1572864) {
    score -= 5;
    audits.push({
      category: 'Performance',
      item: 'Page Performance',
      status: 'warning',
      message: loadTimeMs > 1000 ? `Server response is sluggish (${loadTimeMs} ms)` : `Heavy HTML payload (${(sizeBytes / 1048576).toFixed(1)} MB)`,
      actual: `${loadTimeMs} ms / ${(sizeBytes / 1024).toFixed(0)} KB`,
      recommended: 'Aim for <800 ms response and <1.5 MB HTML for healthy Core Web Vitals (LCP/INP).'
    });
  } else {
    audits.push({
      category: 'Performance',
      item: 'Page Performance',
      status: 'optimal',
      message: `Fast response (${loadTimeMs} ms)`,
      actual: `${loadTimeMs} ms / ${(sizeBytes / 1024).toFixed(0)} KB`,
      recommended: 'Optimal'
    });
  }

  // --- Category 7: Structured Data ---
  if (schemas.length === 0) {
    score -= 8;
    audits.push({
      category: 'Structured Data',
      item: 'Structured Data Schema',
      status: 'warning',
      message: 'No JSON-LD structured data detected',
      actual: 'None',
      recommended: 'Add Organization/WebSite/BreadcrumbList JSON-LD to strengthen entity signals.'
    });
  } else {
    audits.push({
      category: 'Structured Data',
      item: 'Structured Data Schema',
      status: 'optimal',
      message: `Structured data present (${schemas.slice(0, 4).join(', ')}${schemas.length > 4 ? '…' : ''})`,
      actual: `${schemas.length} schema type(s)`,
      recommended: 'Optimal'
    });
  }

  // --- Category 8: Content Structure (depth + hierarchy) ---
  if (httpStatus >= 200 && httpStatus < 300 && wordCount > 0 && wordCount < 150) {
    score -= 8;
    audits.push({
      category: 'Content Structure',
      item: 'Content Depth',
      status: 'warning',
      message: `Thin content (${wordCount} words)`,
      actual: `${wordCount} words`,
      recommended: 'Expand to 300+ words of unique, useful copy or consolidate with a stronger page.'
    });
  }
  if (wordCount >= 300 && h2Count === 0) {
    score -= 3;
    audits.push({
      category: 'Content Structure',
      item: 'Heading Hierarchy (H2)',
      status: 'warning',
      message: 'No H2 subheadings on a long-form page',
      actual: `0 H2 / ${h3Count} H3`,
      recommended: 'Break content into scannable H2 sections — helps users, crawlers, and AI extraction.'
    });
  }

  // 1. Title Audit (Optimal: 50 - 60 chars)
  const titleLen = title.length;
  if (titleLen === 0 || title === 'Untitled Page') {
    score -= 20;
    audits.push({
      category: 'Content Structure',
      item: 'Title Tag',
      status: 'critical',
      message: 'Missing title tag entirely',
      actual: 'None',
      recommended: '50-60 characters with primary keyword at the front.'
    });
  } else if (titleLen < 40) {
    score -= 10;
    audits.push({
      category: 'Content Structure',
      item: 'Title Tag',
      status: 'warning',
      message: `Title is too short (${titleLen} chars)`,
      actual: `"${title}"`,
      recommended: 'Increase length to 50-60 characters for optimal visibility.'
    });
  } else if (titleLen > 65) {
    score -= 10;
    audits.push({
      category: 'Content Structure',
      item: 'Title Tag',
      status: 'warning',
      message: `Title is too long (${titleLen} chars - will truncate)`,
      actual: `"${title}"`,
      recommended: 'Reduce length to under 60 characters to avoid SERP truncation.'
    });
  } else {
    audits.push({
      category: 'Content Structure',
      item: 'Title Tag',
      status: 'optimal',
      message: 'Optimal Title Tag length',
      actual: `"${title}" (${titleLen} chars)`,
      recommended: 'Optimal'
    });
  }

  // 2. Meta Description Audit (Optimal: 120 - 158 chars)
  const descLen = description.length;
  if (descLen === 0) {
    score -= 20;
    audits.push({
      category: 'Content Structure',
      item: 'Meta Description',
      status: 'critical',
      message: 'Missing meta description entirely',
      actual: 'None',
      recommended: '120-158 characters including a clear Call to Action (CTA).'
    });
  } else if (descLen < 100) {
    score -= 10;
    audits.push({
      category: 'Content Structure',
      item: 'Meta Description',
      status: 'warning',
      message: `Description is too short (${descLen} chars)`,
      actual: `"${description}"`,
      recommended: 'Increase length to 120-158 characters to maximize click-through rate.'
    });
  } else if (descLen > 165) {
    score -= 10;
    audits.push({
      category: 'Content Structure',
      item: 'Meta Description',
      status: 'warning',
      message: `Description is too long (${descLen} chars - will truncate)`,
      actual: `"${description}"`,
      recommended: 'Reduce length to under 158 characters to avoid search truncation.'
    });
  } else {
    audits.push({
      category: 'Content Structure',
      item: 'Meta Description',
      status: 'optimal',
      message: 'Optimal Meta Description length',
      actual: `"${description}" (${descLen} chars)`,
      recommended: 'Optimal'
    });
  }

  // 3. H1 Headings Audit (Optimal: exactly 1 H1)
  if (h1Count === 0) {
    score -= 20;
    audits.push({
      category: 'Content Structure',
      item: 'H1 Header tag',
      status: 'critical',
      message: 'Missing H1 heading tag entirely',
      actual: '0 found',
      recommended: 'Add exactly one descriptive H1 tag per page to establish main topic.'
    });
  } else if (h1Count > 1) {
    score -= 10;
    audits.push({
      category: 'Content Structure',
      item: 'H1 Header tag',
      status: 'warning',
      message: `Multiple H1 tags detected (${h1Count} found)`,
      actual: `${h1Count} tags`,
      recommended: 'Consolidate headings to a single primary H1 tag for crawler clarity.'
    });
  } else {
    audits.push({
      category: 'Content Structure',
      item: 'H1 Header tag',
      status: 'optimal',
      message: 'Proper single H1 heading layout',
      actual: '1 tag found',
      recommended: 'Optimal'
    });
  }

  // 4. Image Alt Text Audit
  if (imageCount > 0 && missingAltCount > 0) {
    const missingPercent = Math.round((missingAltCount / imageCount) * 100);
    score -= Math.min(15, Math.ceil(missingPercent / 5));
    audits.push({
      category: 'Images',
      item: 'Image Alt Attributes',
      status: missingPercent > 50 ? 'critical' : 'warning',
      message: `${missingAltCount} out of ${imageCount} images lack alt attributes (${missingPercent}%)`,
      actual: `${missingAltCount} missing alt tags`,
      recommended: 'Add descriptive alt text to all img tags to support search indexing and accessibility.'
    });
  } else if (imageCount > 0) {
    audits.push({
      category: 'Images',
      item: 'Image Alt Attributes',
      status: 'optimal',
      message: 'All images have descriptive alt text tags',
      actual: `${imageCount} images audited`,
      recommended: 'Optimal'
    });
  }

  // 5. Mobile Responsiveness Check (Viewport tag)
  if (!hasViewport) {
    score -= 15;
    audits.push({
      category: 'Mobile',
      item: 'Mobile Viewport Meta',
      status: 'critical',
      message: 'Missing viewport meta tag entirely',
      actual: 'None',
      recommended: 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0">'
    });
  } else {
    audits.push({
      category: 'Mobile',
      item: 'Mobile Viewport Meta',
      status: 'optimal',
      message: 'Viewport viewport responsive meta tag exists',
      actual: 'Found',
      recommended: 'Optimal'
    });
  }

  // 6. SSL Security (HTTPS)
  const isHttps = url.startsWith('https:');
  if (!isHttps) {
    score -= 15;
    audits.push({
      category: 'Security',
      item: 'SSL Certificate (HTTPS)',
      status: 'critical',
      message: 'Page is served over insecure HTTP connection',
      actual: 'HTTP protocol',
      recommended: 'Install an SSL certificate and redirect all traffic to HTTPS.'
    });
  } else {
    audits.push({
      category: 'Security',
      item: 'SSL Certificate (HTTPS)',
      status: 'optimal',
      message: 'Page served over secure HTTPS protocol',
      actual: 'HTTPS Secure',
      recommended: 'Optimal'
    });
  }

  score = Math.max(0, score);

  let qualityClass = 'badge-success';
  let rating = 'Excellent';
  if (score < 50) {
    qualityClass = 'badge-danger';
    rating = 'Critical';
  } else if (score < 75) {
    qualityClass = 'badge-warning';
    rating = 'Moderate';
  }

  return {
    url,
    title,
    score,
    rating,
    qualityClass,
    h1Count,
    h2Count,
    h3Count,
    imageCount,
    missingAltCount,
    hasViewport,
    schemas,
    loadTimeMs,
    sizeBytes,
    audits
  };
}

export function generateOnPageFixCode(itemName, url, title) {
  let host = 'example.com';
  try {
    host = new URL(url).hostname;
  } catch(e) {}

  switch (itemName) {
    case 'Title Tag':
      return {
        lang: 'html',
        code: `<!-- Add inside your page's <head> tags -->
<title>Optimized Title for ${title.split(' - ')[0]} | BrandName</title>`
      };
    case 'Meta Description':
      return {
        lang: 'html',
        code: `<!-- Add inside your page's <head> tags -->
<meta name="description" content="Discover professional insights and solutions at ${host}. Learn how to optimize your web rankings now. Get started today!"/>`
      };
    case 'H1 Header tag':
      return {
        lang: 'html',
        code: `<!-- Add at the top of your page body content -->
<h1 class="page-title">${title.split(' - ')[0] || 'Page Headline'}</h1>`
      };
    case 'Image Alt Attributes':
      return {
        lang: 'html',
        code: `<!-- Add descriptive, keyword-rich alt tags to your HTML images -->
<img src="/images/banner.webp" alt="Detailed description of the page topic at ${host}" width="800" height="400" />`
      };
    case 'Mobile Viewport Meta':
      return {
        lang: 'html',
        code: `<!-- Add inside your page's <head> tags to enable mobile-first scaling -->
<meta name="viewport" content="width=device-width, initial-scale=1.0" />`
      };
    case 'SSL Certificate (HTTPS)':
      return {
        lang: 'nginx',
        code: `# Add this redirection server block to your Nginx configurations
server {
    listen 80;
    server_name ${host};
    return 301 https://$host$request_uri;
}`
      };
    case 'Robots Meta Directives':
      return {
        lang: 'html',
        code: `<!-- Replace any restrictive robots meta with an indexable directive -->
<meta name="robots" content="index, follow, max-image-preview:large" />`
      };
    case 'Canonical URL':
      return {
        lang: 'html',
        code: `<!-- Add inside your page's <head> to consolidate duplicate URL variants -->
<link rel="canonical" href="${url || `https://${host}/`}" />`
      };
    case 'URL Structure':
      return {
        lang: 'nginx',
        code: `# Normalize URLs: lowercase, hyphenated, no query strings for indexable pages
# Example 301 redirect from a messy URL to a clean slug:
rewrite ^/Old_Path/(.*)$ /old-path/$1 permanent;`
      };
    case 'Page Performance':
      return {
        lang: 'nginx',
        code: `# Enable compression + caching for faster TTFB and better Core Web Vitals (LCP/INP)
gzip on;
gzip_types text/html text/css application/javascript application/json image/svg+xml;
location ~* \\.(css|js|webp|avif|woff2)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}`
      };
    case 'Structured Data Schema':
      return {
        lang: 'json',
        code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "${host}",
  "url": "https://${host}/"
}
</script>`
      };
    case 'Heading Hierarchy (H2)':
      return {
        lang: 'html',
        code: `<!-- Break long content into scannable sections -->
<h2>Key Section Topic</h2>
<p>Section content...</p>
<h2>Next Section Topic</h2>
<p>More content...</p>`
      };
    case 'Content Depth':
      return {
        lang: 'text',
        code: `Expand ${url} to 300+ words of unique, useful copy:
1. Answer the page's core question in the first 2 sentences.
2. Add an H2-structured section per subtopic.
3. Include one original data point, example, or first-hand insight.
If the topic cannot support that depth, 301-redirect or consolidate it into a stronger page.`
      };
    default:
      return {
        lang: 'text',
        code: `Inspect page ${url} HTML layout to verify all elements align with standards.`
      };
  }
}

export default function OnPageSEO({ pages = [], onSelectPage }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [complianceFilter, setComplianceFilter] = useState('all'); // all, optimal, warning, critical
  const [selectedPage, setSelectedPage] = useState(null);
  const [fixIndex, setFixIndex] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Parse all pages
  const auditedPages = useMemo(() => {
    return pages.map(page => calculateOnPageSEO(page));
  }, [pages]);

  // Aggregate stats
  const stats = useMemo(() => {
    if (auditedPages.length === 0) return { avg: 0, optimal: 0, warning: 0, critical: 0 };
    let sum = 0;
    let optimal = 0;
    let warning = 0;
    let critical = 0;

    auditedPages.forEach(p => {
      sum += p.score;
      if (p.score >= 85) optimal++;
      else if (p.score >= 60) warning++;
      else critical++;
    });

    return {
      avg: Math.round(sum / auditedPages.length),
      optimal,
      warning,
      critical
    };
  }, [auditedPages]);

  // Per-category site-wide breakdown: for each of the 9 technical categories,
  // classify every page by its worst audit status in that category.
  const categoryStats = useMemo(() => {
    return TECH_CATEGORIES.map(cat => {
      let criticalPages = 0;
      let warningPages = 0;
      let cleanPages = 0;

      auditedPages.forEach(p => {
        const catAudits = (p.audits || []).filter(a => a.category === cat.key);
        if (catAudits.some(a => a.status === 'critical')) criticalPages++;
        else if (catAudits.some(a => a.status === 'warning')) warningPages++;
        else cleanPages++;
      });

      const total = auditedPages.length || 1;
      return {
        ...cat,
        criticalPages,
        warningPages,
        cleanPages,
        passPercent: Math.round((cleanPages / total) * 100)
      };
    });
  }, [auditedPages]);

  // Filtered list
  const filteredPages = useMemo(() => {
    return auditedPages.filter(p => {
      const matchesSearch = p.url.toLowerCase().includes(searchTerm.toLowerCase()) || p.title.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (complianceFilter === 'optimal') return p.score >= 85;
      if (complianceFilter === 'warning') return p.score >= 60 && p.score < 85;
      if (complianceFilter === 'critical') return p.score < 60;
      return true;
    });
  }, [auditedPages, searchTerm, complianceFilter]);

  return (
    <div className="onpage-seo-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Overview stats cards */}
      <div className="eeat-dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        
        <div className="eeat-card glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem' }}>
          <div className="eeat-dial" style={{
            position: 'relative',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: `conic-gradient(${stats.avg >= 75 ? 'var(--color-success)' : 'var(--color-warning)'} ${stats.avg * 3.6}deg, rgba(0,0,0,0.1) 0deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.3rem'
            }}>
              {stats.avg}%
            </div>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Site-Wide Score</h3>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-dark)' }}>
              {stats.avg >= 85 ? 'Highly Compliant' : stats.avg >= 65 ? 'Moderate Issues' : 'Critical Fixes Needed'}
            </span>
          </div>
        </div>

        <div className="eeat-card glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Compliance Distribution</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span>Optimal Pages (85-100):</span>
              <strong className="text-success">{stats.optimal} pages</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span>Warning Pages (60-84):</span>
              <strong className="text-warning">{stats.warning} pages</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span>Critical Pages (&lt;60):</span>
              <strong className="text-danger">{stats.critical} pages</strong>
            </div>
          </div>
        </div>

        <div className="eeat-card glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Heading & Image Audits</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem' }}>
            <div>📄 Pages with H1 violations: <strong>{pages.filter(p => (p.h1Count || 0) !== 1).length}</strong></div>
            <div>🖼️ Images missing alt tags: <strong>{pages.reduce((acc, p) => acc + (p.missingAltCount || 0), 0)}</strong></div>
            <div>📱 Pages missing Viewport meta: <strong>{pages.filter(p => p.hasViewport === false).length}</strong></div>
          </div>
        </div>

      </div>

      {/* 9-Category Technical Breakdown */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>🧪 9-Category Technical Breakdown</h2>
        <p className="subtitle" style={{ marginTop: '0.25rem' }}>
          Site-wide pass rate per technical SEO category across all {auditedPages.length} audited pages.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))', gap: '0.7rem', marginTop: '0.75rem' }}>
          {categoryStats.map(cat => (
            <div key={cat.key} title={`${cat.criticalPages} page(s) critical, ${cat.warningPages} page(s) warning`} style={{
              padding: '0.8rem 0.95rem', borderRadius: '12px',
              border: '1px solid var(--border-light)', background: 'var(--bg-main)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{cat.icon} {cat.key}</span>
                <span className={`status-badge ${cat.criticalPages > 0 ? 'status-error' : cat.warningPages > 0 ? 'status-redirect' : 'status-success'}`}>
                  {cat.passPercent}%
                </span>
              </div>
              <div style={{ height: '6px', borderRadius: '9999px', background: 'var(--border-light)', overflow: 'hidden' }}>
                <div style={{
                  width: `${cat.passPercent}%`, height: '100%', borderRadius: '9999px',
                  background: cat.criticalPages > 0 ? 'var(--color-danger)' : cat.warningPages > 0 ? 'var(--color-warning)' : 'var(--color-success)'
                }}></div>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                {cat.criticalPages > 0 ? `${cat.criticalPages} critical` : ''}
                {cat.criticalPages > 0 && cat.warningPages > 0 ? ' · ' : ''}
                {cat.warningPages > 0 ? `${cat.warningPages} warning` : ''}
                {cat.criticalPages === 0 && cat.warningPages === 0 ? 'All pages pass' : ` · ${cat.cleanPages} clean`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Filter & search controls */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          
          <div className="search-box" style={{ flex: 1, minWidth: '250px' }}>
            <input
              type="text"
              placeholder="Search page url or titles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 1rem',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
                background: 'var(--bg-card)',
                color: 'var(--text-main)',
                fontSize: '0.9rem'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setComplianceFilter('all')}
              className={`nav-tab-btn ${complianceFilter === 'all' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              All Pages ({auditedPages.length})
            </button>
            <button
              onClick={() => setComplianceFilter('optimal')}
              className={`nav-tab-btn ${complianceFilter === 'optimal' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              🟢 Optimal ({stats.optimal})
            </button>
            <button
              onClick={() => setComplianceFilter('warning')}
              className={`nav-tab-btn ${complianceFilter === 'warning' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              🟡 Warning ({stats.warning})
            </button>
            <button
              onClick={() => setComplianceFilter('critical')}
              className={`nav-tab-btn ${complianceFilter === 'critical' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              🔴 Critical ({stats.critical})
            </button>
          </div>

        </div>

        {/* Audit list table */}
        <div className="table-responsive" style={{ marginTop: '1.25rem' }}>
          <table className="pages-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Page URL & Title</th>
                <th style={{ textAlign: 'center', padding: '0.75rem', width: '130px' }}>Compliance Score</th>
                <th style={{ textAlign: 'center', padding: '0.75rem', width: '150px' }}>Viewport & SSL</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', width: '220px' }}>Schemas Detected</th>
                <th style={{ textAlign: 'center', padding: '0.75rem', width: '110px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPages.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No pages matched your criteria.
                  </td>
                </tr>
              ) : (
                filteredPages.map(page => (
                  <tr key={page.url} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '0.75rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)' }}>{page.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{page.url}</div>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                        <div style={{ flex: 1, height: '6px', background: 'rgba(0,0,0,0.1)', borderRadius: '3px', maxWidth: '60px' }}>
                          <div style={{
                            width: `${page.score}%`,
                            height: '100%',
                            background: page.score >= 85 ? 'var(--color-success)' : page.score >= 60 ? '#f59e0b' : '#ef4444',
                            borderRadius: '3px'
                          }}></div>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{page.score}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem' }}>
                      <span style={{ marginRight: '0.5rem' }}>📱 {page.hasViewport ? '🟢' : '🔴'}</span>
                      <span>🔒 {page.url.startsWith('https:') ? '🟢' : '🔴'}</span>
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.8rem' }}>
                      {page.schemas.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None found</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {page.schemas.map((s, idx) => (
                            <span key={idx} style={{
                              background: 'rgba(0, 102, 204, 0.08)',
                              color: '#0066cc',
                              padding: '0.15rem 0.35rem',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              border: '1px solid rgba(0, 102, 204, 0.15)'
                            }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <button
                        onClick={() => onSelectPage(page.url, 'onpage')}
                        style={{
                          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Technical Audit 🔍
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Detail Modal */}
      {selectedPage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15,23,42,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '680px',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            maxHeight: '85vh',
            overflowY: 'auto',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            padding: '2rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)'
          }}>
            <button
              onClick={() => {
                setSelectedPage(null);
                setFixIndex(null);
                setCopiedIndex(null);
              }}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'none',
                border: 'none',
                fontSize: '1.4rem',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>

            <div>
              <h2 style={{ fontSize: '1.3rem', margin: 0, color: 'var(--text-dark)', paddingRight: '2rem' }}>
                On-Page Technical Audit
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedPage.url}
              </p>
            </div>

            {/* Performance Header summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', background: 'rgba(0,0,0,0.03)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: selectedPage.score >= 85 ? 'var(--color-success)' : selectedPage.score >= 60 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                  {selectedPage.score}%
                </span>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Compliance</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', justifyContent: 'center' }}>
                <div>⏱️ Server Response Time: <strong>{selectedPage.loadTimeMs} ms</strong></div>
                <div>📦 Page Size: <strong>{Math.round(selectedPage.sizeBytes / 1024 * 10) / 10} KB</strong></div>
                <div>🏷️ H1/H2/H3 Layout: <strong>H1: {selectedPage.h1Count} | H2: {selectedPage.h2Count} | H3: {selectedPage.h3Count}</strong></div>
              </div>
            </div>

            {/* Schemas section - Vetted no hallucinations */}
            <div style={{ background: 'rgba(0,102,204,0.02)', border: '1px solid rgba(0,102,204,0.1)', padding: '1rem', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.5rem 0', color: 'var(--text-dark)' }}>
                Schemas Found (Actual Page Metadata)
              </h3>
              {selectedPage.schemas.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No structured JSON-LD schema objects were detected on this page.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {selectedPage.schemas.map((s, idx) => (
                    <span key={idx} style={{
                      background: '#eff6ff',
                      color: '#1e40af',
                      border: '1px solid #bfdbfe',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}>
                      🏷️ {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Checklist results */}
            <div>
              <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem 0', color: 'var(--text-dark)' }}>
                Audited Elements Checklists
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(selectedPage.audits || []).map((audit, index) => {
                  const isFixOpen = fixIndex === index;
                  const isCopied = copiedIndex === index;
                  const isOptimal = audit.status === 'optimal';
                  const codeFix = isOptimal ? null : generateOnPageFixCode(audit.item, selectedPage.url, selectedPage.title);

                  return (
                    <div key={index} style={{
                      padding: '0.75rem 1rem',
                      background: isOptimal ? 'rgba(16, 185, 129, 0.02)' : 'rgba(0,0,0,0.01)',
                      border: `1px solid ${isOptimal ? 'rgba(16, 185, 129, 0.15)' : 'var(--border-light)'}`,
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1rem', marginTop: '-0.1rem' }}>
                          {isOptimal ? '✅' : audit.status === 'critical' ? '❌' : '⚠️'}
                        </span>
                        
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>
                            {audit.item}: <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{audit.message}</span>
                          </div>
                          
                          <div style={{ fontSize: '0.75rem', marginTop: '0.2rem', color: 'var(--text-muted)' }}>
                            <strong>Found:</strong> <code style={{ color: 'var(--text-dark)' }}>{audit.actual}</code>
                          </div>
                          
                          {!isOptimal && (
                            <div style={{ fontSize: '0.75rem', marginTop: '0.15rem', color: 'var(--text-muted)' }}>
                              <strong>Recommendation:</strong> {audit.recommended}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Display fix generator button if not optimal */}
                      {!isOptimal && codeFix && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-light)', paddingTop: '0.4rem', marginTop: '0.15rem' }}>
                          <button
                            onClick={() => setFixIndex(isFixOpen ? null : index)}
                            style={{
                              background: isFixOpen ? 'rgba(0, 0, 0, 0.05)' : 'rgba(59, 130, 246, 0.1)',
                              color: isFixOpen ? 'var(--text-main)' : '#2563eb',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '0.2rem 0.5rem',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {isFixOpen ? 'Hide Solution' : '⚡ View Code Solution'}
                          </button>
                        </div>
                      )}

                      {isFixOpen && codeFix && (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'var(--bg-terminal)', color: '#a7f3d0', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border-light)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', overflowX: 'auto' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.25rem', marginBottom: '0.25rem' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>SUGGESTED META/TAG CODE:</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(codeFix.code);
                                setCopiedIndex(index);
                                setTimeout(() => setCopiedIndex(null), 2000);
                              }}
                              style={{
                                background: isCopied ? '#10b981' : '#2563eb',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                padding: '0.15rem 0.35rem',
                                fontSize: '0.6rem',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              {isCopied ? '✓ Copied' : 'Copy Snippet'}
                            </button>
                          </div>
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#e2e8f0', lineHeight: 1.35 }}>
                            {codeFix.code}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                onClick={() => {
                  setSelectedPage(null);
                  setFixIndex(null);
                  setCopiedIndex(null);
                }}
                style={{
                  background: 'var(--border-light)',
                  color: 'var(--text-main)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close Audit
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
