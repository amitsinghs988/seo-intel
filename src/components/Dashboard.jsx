import { useMemo } from 'react';
import { calculatePageEEAT } from './EEATAudit';
import { calculateOnPageSEO } from './OnPageSEO';
import { calculatePageAEO } from './AEOAudit';
import { calculatePageAISEO } from './AISEO';

// Overall SEO Health Score — weighted synthesis of every audit module (0-100).
// Inspired by the /seo skill's scoring methodology, adapted to the dimensions this
// tool measures directly from crawled HTML.
function healthColor(s) {
  if (s >= 80) return 'var(--color-success)';
  if (s >= 60) return 'var(--color-primary)';
  if (s >= 40) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

function healthRating(s) {
  if (s >= 80) return 'Strong — Well Optimized';
  if (s >= 60) return 'Good — Room to Improve';
  if (s >= 40) return 'Needs Optimization';
  return 'Critical — Priority Fixes Needed';
}

export default function Dashboard({ summary, nearDuplicates = [], pages = [], onTabChange }) {
  // --- Overall SEO Health Score (weighted across all audit modules) ---
  // Declared before any early return so the hook order stays stable.
  const health = useMemo(() => {
    if (!summary) return null;
    const scored = (pages || []).filter(p => p && p.status >= 200 && p.status < 300);
    if (scored.length === 0) return null;

    const avg = (fn) => Math.round(scored.reduce((s, p) => s + (fn(p).score || 0), 0) / scored.length);
    const onPage = avg(calculateOnPageSEO);
    const eeat = avg(calculatePageEEAT);
    const aeo = avg(calculatePageAEO);
    const ai = avg(calculatePageAISEO);
    const uniqueness = Math.round(summary.avgUniquePercent || 0);
    const brokenTotal = (summary.brokenInternalLinksCount || 0) + (summary.brokenExternalLinksCount || 0);
    const linkHealth = Math.max(0, 100 - Math.min(100, brokenTotal * 4));

    const categories = [
      { label: 'On-Page Technical', score: onPage, weight: 25, tab: 'onpage' },
      { label: 'Content & E-E-A-T', score: eeat, weight: 25, tab: 'eeat' },
      { label: 'Answer Engine (AEO)', score: aeo, weight: 15, tab: 'aeo' },
      { label: 'AI SEO / LLM Citations', score: ai, weight: 15, tab: 'aiseo' },
      { label: 'Content Uniqueness', score: uniqueness, weight: 10, tab: 'duplicate' },
      { label: 'Link Health', score: linkHealth, weight: 10, tab: 'broken' }
    ];

    const overall = Math.round(
      categories.reduce((sum, c) => sum + c.score * (c.weight / 100), 0)
    );

    const priorities = [...categories]
      .filter(c => c.score < 75)
      .sort((a, b) => (a.score * a.weight) - (b.score * b.weight))
      .slice(0, 4)
      .map(c => ({
        label: c.label,
        score: c.score,
        tab: c.tab,
        severity: c.score < 40 ? 'Critical' : c.score < 60 ? 'High' : 'Medium'
      }));

    return { overall, categories, priorities };
  }, [pages, summary]);

  if (!summary) return null;

  const {
    totalPages = 0,
    successfulPagesCount = 0,
    skippedPagesCount = 0,
    avgDuplicatePercent = 0,
    avgCommonPercent = 0,
    avgUniquePercent = 0,
    avgLoadTimeMs = 0,
    brokenInternalLinksCount = 0,
    brokenExternalLinksCount = 0
  } = summary;

  const safeNearDuplicates = nearDuplicates || [];
  const safePages = pages || [];

  const getPath = (urlStr) => {
    try {
      const u = new URL(urlStr);
      return u.pathname + u.search;
    } catch (e) {
      return urlStr;
    }
  };

  // Calculate SVG Pie Chart coordinates
  const total = successfulPagesCount + skippedPagesCount;
  const normalPercentage = total > 0 ? (successfulPagesCount / total) * 100 : 0;
  
  const strokeDasharray = 314.16;
  const strokeDashoffset = strokeDasharray - (strokeDasharray * normalPercentage) / 100;

  const totalBroken = brokenInternalLinksCount + brokenExternalLinksCount;

  // Generate and Download sitemap.xml
  const handleDownloadSitemap = (e) => {
    e.stopPropagation();
    const filteredPagesList = safePages.filter(p => p.status >= 200 && p.status < 300);
    
    const sitemapHeader = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
    const sitemapBody = filteredPagesList.map(p => {
      return `  <url>\n    <loc>${p.url}</loc>\n  </url>`;
    }).join('\n');
    const sitemapFooter = `\n</urlset>`;
    
    const xmlContent = sitemapHeader + '\n' + sitemapBody + sitemapFooter;
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sitemap_generated.xml');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Full JSON report
  const handleDownloadFullReport = (e) => {
    e.stopPropagation();
    const reportData = {
      summary,
      nearDuplicates: safeNearDuplicates,
      pages: safePages,
      generatedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `seointel_full_report_${new Date().toISOString().slice(0, 10)}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Crawl-scope note: explain when fewer pages were crawled than the site has / was requested
  const scopeNote = (() => {
    const reason = summary.crawlStoppedReason;
    if (reason === 'time-limit') {
      return { level: 'warning', text: `Crawl stopped at ${totalPages} pages after hitting the serverless time budget. The site has more pages — deploy with a higher function limit, or scan a specific section, to go deeper.` };
    }
    if (summary.crawlCapped) {
      return { level: 'info', text: `You requested ${summary.crawlRequestedPages} pages; this hosted deployment scans up to ${summary.crawlPageLimit} per run. ${totalPages} pages were crawled.` };
    }
    if (reason === 'page-limit') {
      return { level: 'info', text: `Reached your ${summary.crawlPageLimit || totalPages}-page limit — the site has more pages. Raise "Max Pages to Crawl" to scan more.` };
    }
    return null;
  })();

  return (
    <div className="dashboard-summary">
      {scopeNote && (
        <div className="glass-card animate-fade-in" style={{
          padding: '0.85rem 1.1rem', marginBottom: '1.25rem', fontSize: '0.85rem',
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          borderLeft: `4px solid ${scopeNote.level === 'warning' ? 'var(--color-warning)' : 'var(--color-primary)'}`
        }}>
          <span style={{ fontSize: '1.1rem' }}>{scopeNote.level === 'warning' ? '⏱️' : 'ℹ️'}</span>
          <span>{scopeNote.text}</span>
        </div>
      )}

      {/* --- Overall SEO Health Score --- */}
      {health && (
        <div className="seo-health-hero glass-card animate-fade-in">
          <div className="health-gauge">
            <svg width="150" height="150" viewBox="0 0 130 130">
              <circle cx="65" cy="65" r="54" fill="none" stroke="var(--border-light)" strokeWidth="11" />
              <circle
                cx="65" cy="65" r="54" fill="none"
                stroke={healthColor(health.overall)} strokeWidth="11" strokeLinecap="round"
                strokeDasharray="339.29"
                strokeDashoffset={339.29 - (339.29 * health.overall) / 100}
                transform="rotate(-90 65 65)"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
              <text x="65" y="62" textAnchor="middle" className="health-gauge-num" style={{ fill: healthColor(health.overall) }}>{health.overall}</text>
              <text x="65" y="84" textAnchor="middle" className="health-gauge-sub">/ 100</text>
            </svg>
            <div className="health-gauge-caption">
              <span className="health-title">SEO Health Score</span>
              <span className="health-rating" style={{ color: healthColor(health.overall) }}>{healthRating(health.overall)}</span>
            </div>
          </div>

          <div className="health-detail">
            <div className="health-categories">
              {health.categories.map(c => (
                <button key={c.label} className="health-cat-row" onClick={() => onTabChange(c.tab)} title={`Open ${c.label} — ${c.weight}% of score`}>
                  <span className="health-cat-label">{c.label}</span>
                  <span className="health-cat-bar-bg">
                    <span className="health-cat-bar-fill" style={{ width: `${c.score}%`, background: healthColor(c.score) }}></span>
                  </span>
                  <span className="health-cat-score" style={{ color: healthColor(c.score) }}>{c.score}</span>
                </button>
              ))}
            </div>

            {health.priorities.length > 0 && (
              <div className="health-priorities">
                <span className="health-priorities-title">🎯 Priority Focus</span>
                <div className="health-priority-chips">
                  {health.priorities.map(p => (
                    <button key={p.label} className={`priority-chip sev-${p.severity.toLowerCase()}`} onClick={() => onTabChange(p.tab)}>
                      <span className="chip-sev">{p.severity}</span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="metrics-grid">
        {/* Metric 1: Content Analysis */}
        <div className="metric-card glass-card hover-glow" onClick={() => onTabChange('duplicate')}>
          <div className="metric-header">
            <h3>Content Analysis</h3>
            <span className="metric-icon">🔍</span>
          </div>
          <div className="metric-value-large" style={{ fontSize: '2rem', display: 'flex', gap: '0.75rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span className="text-warning">{avgDuplicatePercent}% <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Duplicate</span></span>
            <span className="text-primary">{avgCommonPercent}% <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Common</span></span>
          </div>
          <div className="metric-subtitle">
            Unique: <strong>{avgUniquePercent}%</strong> | Common: <strong>{avgCommonPercent}%</strong> | Duplicate: <strong>{avgDuplicatePercent}%</strong>
          </div>
          <div className="metric-progress-bar-bg" style={{ display: 'flex', height: '8px', overflow: 'hidden' }}>
            <div 
              style={{ width: `${avgDuplicatePercent}%`, height: '100%', backgroundColor: 'var(--color-warning)' }}
              title={`Duplicate: ${avgDuplicatePercent}%`}
            ></div>
            <div 
              style={{ width: `${avgCommonPercent}%`, height: '100%', backgroundColor: 'var(--color-primary)' }}
              title={`Common: ${avgCommonPercent}%`}
            ></div>
            <div 
              style={{ width: `${avgUniquePercent}%`, height: '100%', backgroundColor: 'var(--color-success)' }}
              title={`Unique: ${avgUniquePercent}%`}
            ></div>
          </div>
        </div>

        {/* Metric 2: Pages Scanned */}
        <div className="metric-card glass-card hover-glow" onClick={() => onTabChange('pages')}>
          <div className="metric-header">
            <h3>Pages Scanned</h3>
            <span className="metric-icon">📄</span>
          </div>
          <div className="metric-value-large text-primary">
            {totalPages}
          </div>
          <div className="metric-subtitle">
            {successfulPagesCount} normal pages, {skippedPagesCount} skipped/errors
          </div>
          <div className="pie-chart-container">
            <svg width="80" height="80" viewBox="0 0 120 120" className="pie-chart-svg">
              <circle
                cx="60"
                cy="60"
                r="50"
                className="pie-bg"
                strokeWidth="12"
              />
              {total > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  className="pie-fill"
                  strokeWidth="12"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  transform="rotate(-90 60 60)"
                />
              )}
            </svg>
            <div className="pie-legend">
              <div className="legend-item">
                <span className="legend-dot normal-dot"></span>
                <span>Normal ({successfulPagesCount})</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot skipped-dot"></span>
                <span>Skipped ({skippedPagesCount})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Metric 3: Broken Links */}
        <div className="metric-card glass-card hover-glow" onClick={() => onTabChange(brokenInternalLinksCount > 0 ? 'broken' : 'broken-external')}>
          <div className="metric-header">
            <h3>Broken Links</h3>
            <span className="metric-icon text-danger">⚠️</span>
          </div>
          <div className={`metric-value-large ${totalBroken > 0 ? 'text-danger' : 'text-success'}`} style={{ fontSize: '2rem', display: 'flex', gap: '0.75rem', alignItems: 'baseline' }}>
            <span>{brokenInternalLinksCount} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Internal</span></span>
            <span>{brokenExternalLinksCount} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>External</span></span>
          </div>
          <div className="metric-subtitle">
            {brokenInternalLinksCount} internal and {brokenExternalLinksCount} external links are dead
          </div>
          {totalBroken > 0 && (
            <div className="quick-alert-box">
              Click to view broken link reports.
            </div>
          )}
        </div>

        {/* Metric 4: Average Load Time */}
        <div className="metric-card glass-card hover-glow">
          <div className="metric-header">
            <h3>Average Load Time</h3>
            <span className="metric-icon">⚡</span>
          </div>
          <div className="metric-value-large text-info">
            {avgLoadTimeMs} <span className="text-unit">ms</span>
          </div>
          <div className="metric-subtitle">
            Average response time for crawled pages
          </div>
          <div className="load-time-visual">
            <div className="speedometer-track">
              <div 
                className="speedometer-needle" 
                style={{ 
                  transform: `rotate(${Math.min(180, (avgLoadTimeMs / 2000) * 180 - 90)}deg)` 
                }}
              ></div>
            </div>
            <div className="speed-rating">
              {avgLoadTimeMs < 400 ? 'Excellent' : avgLoadTimeMs < 1000 ? 'Good' : 'Needs Optimization'}
            </div>
          </div>
        </div>
      </div>

      {/* Developer SEO Utilities Banner */}
      <div className="utility-bar glass-card hover-glow" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1.75rem 0', padding: '1.25rem 2rem', gap: '1.25rem', flexWrap: 'wrap', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-heading)' }}>
            ⚙️ Developer SEO Toolkit
          </h4>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Export indexing catalogs and comprehensive analytics offline
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            onClick={handleDownloadSitemap}
            style={{
              padding: '0.5rem 1rem',
              background: 'rgba(59, 130, 246, 0.15)',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-primary)',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.82rem',
              transition: 'var(--transition-smooth)'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-primary)'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
          >
            🗺️ Export generated sitemap.xml
          </button>
          <button 
            onClick={handleDownloadFullReport}
            style={{
              padding: '0.5rem 1rem',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.82rem',
              transition: 'var(--transition-smooth)'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
          >
            📊 Download JSON Dataset
          </button>
        </div>
      </div>

      {/* Top Issues Section */}
      <div className="dashboard-section glass-card">
        <h2 className="section-title">SEO Diagnosis & Suggestions</h2>
        <ul className="issues-list">
          {/* Near duplicates alerts */}
          {safeNearDuplicates.length > 0 && (
            <li className="issue-item danger">
              <span className="issue-badge badge-danger">Near-Duplicates</span>
              <div className="issue-details" style={{ width: '100%' }}>
                <strong>{safeNearDuplicates.length} page pairs are near-duplicates (&ge;85% content match).</strong>
                <p>Google penalizes near-duplicate pages. You should set canonical headers or restructure their copy:</p>
                <ul className="near-dup-list">
                  {safeNearDuplicates.slice(0, 5).map((pair, idx) => (
                    <li key={idx} className="near-dup-card">
                      <div className="near-dup-links">
                        <span className="near-dup-link-item" title={pair.urlA}>Page A: <strong>{pair.titleA}</strong> ({getPath(pair.urlA)})</span>
                        <span className="near-dup-link-item" title={pair.urlB}>Page B: <strong>{pair.titleB}</strong> ({getPath(pair.urlB)})</span>
                      </div>
                      <span className="near-dup-match-pct">{pair.similarityPercent}% Overlap</span>
                    </li>
                  ))}
                  {safeNearDuplicates.length > 5 && (
                    <li style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      And {safeNearDuplicates.length - 5} more page pairs...
                    </li>
                  )}
                </ul>
              </div>
            </li>
          )}

          {avgDuplicatePercent > 20 && (
            <li className="issue-item warning">
              <span className="issue-badge badge-warning">High Duplication</span>
              <div className="issue-details">
                <strong>Duplicate content ratio is high ({avgDuplicatePercent}%).</strong>
                <p>Consider rewriting matching sections or employing `rel="canonical"` references to specify the primary search result.</p>
              </div>
            </li>
          )}
          
          {brokenInternalLinksCount > 0 && (
            <li className="issue-item danger">
              <span className="issue-badge badge-danger">Internal Broken Links</span>
              <div className="issue-details">
                <strong>Your site contains {brokenInternalLinksCount} broken internal links.</strong>
                <p>Broken internal URLs hurt page indexation and user retention. Click the "Broken Internal" tab to see target files.</p>
              </div>
            </li>
          )}

          {brokenExternalLinksCount > 0 && (
            <li className="issue-item warning">
              <span className="issue-badge badge-warning">External Broken Links</span>
              <div className="issue-details">
                <strong>Your site contains {brokenExternalLinksCount} broken outbound links.</strong>
                <p>Linking to dead external sites hurts domain authority. Click the "Broken External" tab to review dead links.</p>
              </div>
            </li>
          )}

          {avgLoadTimeMs > 1000 && (
            <li className="issue-item info">
              <span className="issue-badge badge-info">Slow Load Speeds</span>
              <div className="issue-details">
                <strong>Average page response is slow ({avgLoadTimeMs} ms).</strong>
                <p>Optimize resource loading, minify scripts, and enable server Gzip compression to increase speeds.</p>
              </div>
            </li>
          )}

          {safeNearDuplicates.length === 0 && avgDuplicatePercent <= 20 && totalBroken === 0 && avgLoadTimeMs <= 1000 && (
            <li className="issue-item success">
              <span className="issue-badge badge-success">Excellent Health</span>
              <div className="issue-details">
                <strong>No severe SEO errors found!</strong>
                <p>Low duplication, no broken links, and fast page response speeds. Excellent!</p>
              </div>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
