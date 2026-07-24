import { useState, useMemo } from 'react';

/**
 * Calculates page-level AI SEO (Generative Engine Optimization) scores and simulation logs.
 */
export function calculatePageAISEO(page) {
  if (!page) page = {};
  const text = page.text || '';
  const url = page.url || '';
  const schemas = page.schemas || [];
  const robots = page.robots || '';

  let score = 100;
  const audits = [];

  // 1. Entity SEO & Organization Schema
  const hasOrgSchema = schemas.some(s => /Organization|LocalBusiness|Brand/i.test(s));
  if (!hasOrgSchema) {
    score -= 20;
    audits.push({
      pillar: 'Entity SEO',
      status: 'warning',
      message: 'Missing Organization / Brand schema markup',
      desc: 'AI search models search schema nodes to connect corporate entities, social handles, and branding.'
    });
  } else {
    audits.push({
      pillar: 'Entity SEO',
      status: 'optimal',
      message: 'Organization/Brand schema markup detected',
      desc: 'Optimal for entity relationship mapping.'
    });
  }

  // 2. NAP Consistency check
  const hasNAP = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(text) || /\b(street|suite|avenue|road|zip code|city)\b/i.test(text);
  if (!hasNAP) {
    score -= 15;
    audits.push({
      pillar: 'Entity SEO',
      status: 'warning',
      message: 'No business Name, Address, or Phone (NAP) found on page',
      desc: 'Consistent contact cards establish real-world entity credibility in Knowledge Graphs.'
    });
  }

  // 3. AI Bot Access / Robots Blocks
  const isBotBlocked = /noindex|nofollow/i.test(robots);
  if (isBotBlocked) {
    score -= 30;
    audits.push({
      pillar: 'AI Crawlability',
      status: 'critical',
      message: 'Meta robots blocks indexing / follow crawlers',
      desc: 'AI scrapers (GPTBot, Gemini, ClaudeBot) respect meta tags and will bypass blocked domains.'
    });
  } else {
    audits.push({
      pillar: 'AI Crawlability',
      status: 'optimal',
      message: 'AI crawlers index access allowed',
      desc: 'Optimal. AI agents can access and extract this page content.'
    });
  }

  // 4. Scannable Content structures (LLMs prefer structured data)
  // Check for bullet lists (*), steps (numbers), or headings (###)
  const bulletsCount = (text.match(/\n\*/g) || []).length;
  const stepsCount = (text.match(/\n\d+\./g) || []).length;
  const headingsCount = (page.h2Count || 0) + (page.h3Count || 0);

  if (bulletsCount === 0 && stepsCount === 0) {
    score -= 15;
    audits.push({
      pillar: 'LLM Scannability',
      status: 'warning',
      message: 'Content lacks lists (bullets or numbered steps)',
      desc: 'AI models prefer scannable structures to extract definitions, answers, and summaries.'
    });
  } else {
    audits.push({
      pillar: 'LLM Scannability',
      status: 'optimal',
      message: `Structured list elements found (${bulletsCount + stepsCount} list items)`,
      desc: 'Optimal. High readability layout for parsing text nodes.'
    });
  }

  // 5. Original Data / Statistical citations
  const hasStats = (text.match(/\b\d+%\b|\b\d+\s+percent\b|\b\$\d+|\bUSD\b|\bstatistics\b|\bstudy\b|\bresearch\b/i) || []).length > 0;
  if (!hasStats) {
    score -= 10;
    audits.push({
      pillar: 'AI Citations',
      status: 'warning',
      message: 'No original data, statistics, or research terms found',
      desc: 'LLMs actively cite unique numbers, survey statistics, and original datasets.'
    });
  } else {
    audits.push({
      pillar: 'AI Citations',
      status: 'optimal',
      message: 'Original research data indicators found',
      desc: 'High citation probability due to statistical data.'
    });
  }

  // 6. Direct Factual Openers (First 50 words)
  const startsWithFactual = /\b(is|refers to|defines|was created|studies|analyzes)\b/i.test(text.substring(0, 200));
  if (!startsWithFactual) {
    score -= 10;
    audits.push({
      pillar: 'AI Citations',
      status: 'warning',
      message: 'Opener lacks direct factual definitions',
      desc: 'Avoid vague introductions. LLMs fetch definitions that begin with direct, factual explanations.'
    });
  }

  score = Math.max(0, score);
  
  let rating = 'High Citation Likelihood';
  let qualityClass = 'badge-success';
  if (score < 55) {
    rating = 'Low Citation Likelihood';
    qualityClass = 'badge-danger';
  } else if (score < 80) {
    rating = 'Medium Citation Likelihood';
    qualityClass = 'badge-warning';
  }

  return {
    url,
    title: page.title || 'Untitled Page',
    score,
    rating,
    qualityClass,
    audits,
    hasOrgSchema,
    isBotBlocked,
    hasStats,
    bulletsCount,
    stepsCount,
    headingsCount
  };
}

export function generateAISEOFix(recType, url, title) {
  let host = 'example.com';
  let siteName = 'Our Brand';
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    siteName = host.replace('www.', '').split('.')[0];
    siteName = siteName.charAt(0).toUpperCase() + siteName.slice(1);
  } catch(e) {}

  switch (recType) {
    case 'Missing Organization / Brand schema markup':
      return {
        lang: 'json',
        code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${siteName}",
  "url": "https://${host}",
  "logo": "https://${host}/assets/logo.png",
  "sameAs": [
    "https://twitter.com/${siteName.toLowerCase()}",
    "https://www.linkedin.com/company/${siteName.toLowerCase()}"
  ]
}
</script>`
      };

    case 'No business Name, Address, or Phone (NAP) found on page':
      return {
        lang: 'html',
        code: `<div class="nap-footer-block" style="font-size: 0.8rem; line-height: 1.4; color: #475569; border-top: 1px solid #cbd5e1; padding-top: 1rem; margin-top: 2rem;">
  <strong>Contact ${siteName}:</strong><br/>
  📍 100 Innovation Way, Suite 200, Albany, NY 12203<br/>
  📞 Office: (555) 890-1234 | ✉ support@${host}
</div>`
      };

    case 'Content lacks lists (bullets or numbered steps)':
      return {
        lang: 'html',
        code: `<!-- Restructure your main content to include scannable steps -->
<h3>Key Optimizations:</h3>
<ul>
  <li><strong>First-person methodology:</strong> Prove experience with original testing records.</li>
  <li><strong>Structured entity markup:</strong> Feed SGE crawlers with clean metadata loops.</li>
  <li><strong>Outbound authority links:</strong> Link directly to .gov or .edu data sources.</li>
</ul>`
      };

    case 'No original data, statistics, or research terms found':
      return {
        lang: 'html',
        code: `<p>
  <strong>Research Data:</strong> During our recent ${new Date().getFullYear()} study, we measured a <strong>34% increase</strong> in crawl indexing times on sites with insulated silos compared to flat directory architectures.
</p>`
      };

    default:
      return {
        lang: 'text',
        code: `Review page content for ${title} to ensure direct factual openers and scannable list elements exist.`
      };
  }
}

export default function AISEO({ pages = [], onSelectPage }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [citationFilter, setCitationFilter] = useState('all'); // all, high, medium, low
  const [selectedPage, setSelectedPage] = useState(null);
  const [openFixIndex, setOpenFixIndex] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Compute all scores
  const auditedPages = useMemo(() => {
    return pages.map(page => calculatePageAISEO(page));
  }, [pages]);

  // Aggregate stats
  const stats = useMemo(() => {
    if (auditedPages.length === 0) return { avg: 0, high: 0, med: 0, low: 0 };
    let sum = 0;
    let high = 0;
    let med = 0;
    let low = 0;

    auditedPages.forEach(p => {
      sum += p.score;
      if (p.score >= 80) high++;
      else if (p.score >= 55) med++;
      else low++;
    });

    return {
      avg: Math.round(sum / auditedPages.length),
      high,
      med,
      low
    };
  }, [auditedPages]);

  // Filtered pages
  const filteredPages = useMemo(() => {
    return auditedPages.filter(p => {
      const matchesSearch = p.url.toLowerCase().includes(searchTerm.toLowerCase()) || p.title.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (citationFilter === 'high') return p.score >= 80;
      if (citationFilter === 'medium') return p.score >= 55 && p.score < 80;
      if (citationFilter === 'low') return p.score < 55;
      return true;
    });
  }, [auditedPages, searchTerm, citationFilter]);

  const handleCloseModal = () => {
    setSelectedPage(null);
    setOpenFixIndex(null);
    setCopiedIndex(null);
  };

  return (
    <div className="aeo-audit-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Overview stats */}
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
            <h3 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>LLM Visibility Score</h3>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-dark)' }}>
              {stats.avg >= 80 ? 'Optimized for Chat' : stats.avg >= 60 ? 'Moderate Visibility' : 'Low AI Citations'}
            </span>
          </div>
        </div>

        <div className="eeat-card glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Citation Likelihood</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>High Citation (80+):</span>
              <strong className="text-success">{stats.high} pages</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Medium Citation (55-79):</span>
              <strong className="text-warning">{stats.med} pages</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Low Citation (&lt;55):</span>
              <strong className="text-danger">{stats.low} pages</strong>
            </div>
          </div>
        </div>

        <div className="eeat-card glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Site-Wide Entity Index</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem' }}>
            <div>🏢 Entity Schemas: <strong>{pages.filter(p => p.schemas && p.schemas.some(s => /Organization|LocalBusiness|Brand/i.test(s))).length}</strong></div>
            <div>🤖 Scraper Blocks: <strong>{pages.filter(p => p.robots && /noindex|nofollow/i.test(p.robots)).length} pages</strong></div>
            <div>📈 Research statistics: <strong>{auditedPages.filter(p => p.hasStats).length} cited pages</strong></div>
          </div>
        </div>

      </div>

      {/* Main Tab results */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          
          <div className="search-box" style={{ flex: 1, minWidth: '250px' }}>
            <input
              type="text"
              placeholder="Search audited pages..."
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
              onClick={() => setCitationFilter('all')}
              className={`nav-tab-btn ${citationFilter === 'all' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              All Pages ({auditedPages.length})
            </button>
            <button
              onClick={() => setCitationFilter('high')}
              className={`nav-tab-btn ${citationFilter === 'high' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              🟢 High Citation ({stats.high})
            </button>
            <button
              onClick={() => setCitationFilter('medium')}
              className={`nav-tab-btn ${citationFilter === 'medium' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              🟡 Medium Citation ({stats.med})
            </button>
            <button
              onClick={() => setCitationFilter('low')}
              className={`nav-tab-btn ${citationFilter === 'low' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              🔴 Low Citation ({stats.low})
            </button>
          </div>

        </div>

        {/* Audited Pages Table */}
        <div className="table-responsive" style={{ marginTop: '1.25rem' }}>
          <table className="pages-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Page URL & Title</th>
                <th style={{ textAlign: 'center', padding: '0.75rem', width: '130px' }}>AI SEO Score</th>
                <th style={{ textAlign: 'center', padding: '0.75rem', width: '150px' }}>Citation Status</th>
                <th style={{ textAlign: 'center', padding: '0.75rem', width: '140px' }}>AI Scraper Access</th>
                <th style={{ textAlign: 'center', padding: '0.75rem', width: '110px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPages.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No pages matched your AI SEO criteria.
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
                            background: page.score >= 80 ? 'var(--color-success)' : page.score >= 55 ? '#f59e0b' : '#ef4444',
                            borderRadius: '3px'
                          }}></div>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{page.score}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span className={`status-badge ${page.score >= 80 ? 'badge-success' : page.score >= 55 ? 'badge-info' : 'badge-danger'}`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}>
                        {page.score >= 80 ? 'High Citation' : page.score >= 55 ? 'Medium' : 'Low'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span className={`status-badge ${page.isBotBlocked ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}>
                        {page.isBotBlocked ? 'Blocked 🚫' : 'Allowed 🤖'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <button
                        onClick={() => onSelectPage(page.url, 'aiseo')}
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
                        AI SEO Audit 🔍
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Modal / LLM Citation Simulator */}
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
              onClick={handleCloseModal}
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
              <h2 style={{ fontSize: '1.3rem', margin: 0, color: 'var(--text-dark)' }}>
                AI SEO & LLM Citation Audit
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedPage.url}
              </p>
            </div>

            {/* LLM Citation Chatbox Simulator */}
            <div>
              <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.5rem 0', color: 'var(--text-dark)' }}>
                AI Search Citation Simulator (ChatGPT / Perplexity)
              </h3>
              
              <div style={{ border: '1px solid var(--border-light)', borderRadius: '8px', overflow: 'hidden' }}>
                
                {/* Chat header */}
                <div style={{ background: '#f8fafc', padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-light)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>SIMULATED COGNITIVE CRAWLER</span>
                </div>

                {/* Chat content container */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', background: 'var(--bg-card)' }}>
                  
                  {/* User prompt */}
                  <div style={{ alignSelf: 'flex-end', background: '#2563eb', color: 'white', padding: '0.6rem 0.9rem', borderRadius: '12px 12px 0 12px', fontSize: '0.8rem', maxWidth: '80%' }}>
                    Explain the main details of {(selectedPage.title || 'your topic').split(' - ')[0]}?
                  </div>

                  {/* LLM response */}
                  <div style={{ alignSelf: 'flex-start', background: '#f1f5f9', color: '#1e293b', padding: '0.75rem 1rem', borderRadius: '12px 12px 12px 0', fontSize: '0.8rem', maxWidth: '85%', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '1rem' }}>🤖</span>
                      <strong style={{ fontSize: '0.75rem', color: '#475569' }}>AI Search Assistant:</strong>
                    </div>
                    {selectedPage.score >= 55 ? (
                      <div>
                        According to recent factual insights from <strong>{selectedPage.url.replace('https://', '').replace('http://', '').split('/')[0]}</strong>, the primary context is structured as a readable layout with lists and entity definitions. 
                        {selectedPage.hasStats ? ' Statistical data indexes support these claims. ' : ''}
                        
                        <div style={{ marginTop: '0.5rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.4rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ color: '#059669', fontWeight: 600 }}>🟢 Citations:</span>
                          <a href={selectedPage.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                            [Source: {(selectedPage.title || 'Untitled Page').substring(0, 20)}...]
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div>
                        I searched for this topic, but could not retrieve high-authority factual indices. The page structure lacks Organization metadata schema nodes, has no statistical references, or is blocked by crawlers. I am unable to citation-link this page.
                        
                        <div style={{ marginTop: '0.5rem', borderTop: '1px dashed #fca5a5', paddingTop: '0.4rem', fontSize: '0.72rem', color: '#dc2626', fontWeight: 600 }}>
                          🔴 Citation Probability: Low (0 signals detected)
                        </div>
                      </div>
                    )}
                  </div>

                </div>

              </div>
            </div>

            {/* Checklist recommendations */}
            <div>
              <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem 0', color: 'var(--text-dark)' }}>
                Actionable GEO Recommendations {(selectedPage.audits || []).length}
              </h3>
              
              {(selectedPage.audits || []).length === 0 ? (
                <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px dashed var(--color-success)', color: '#047857', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
                  🎉 Outstanding! This page has flawless AI search engine optimization structures.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {(selectedPage.audits || []).map((rec, index) => {
                    const snippet = generateAISEOFix(rec.message, selectedPage.url, selectedPage.title);
                    const isFixOpen = openFixIndex === index;
                    const isCopied = copiedIndex === index;

                    return (
                      <div key={index} style={{
                        padding: '0.85rem 1rem',
                        background: 'rgba(0,0,0,0.01)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                          <span style={{ fontSize: '1rem', marginTop: '-0.1rem' }}>
                            {rec.status === 'optimal' ? '✅' : rec.status === 'critical' ? '❌' : '⚠️'}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{rec.message}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>{rec.desc}</div>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.05)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                            {rec.pillar}
                          </span>
                        </div>

                        {/* Collapsible fixes */}
                        {rec.status !== 'optimal' && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-light)', paddingTop: '0.4rem' }}>
                            <button
                              onClick={() => setOpenFixIndex(isFixOpen ? null : index)}
                              style={{
                                background: isFixOpen ? 'rgba(0,0,0,0.05)' : 'rgba(59, 130, 246, 0.1)',
                                color: '#2563eb',
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

                        {isFixOpen && (
                          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'var(--bg-terminal)', color: '#a7f3d0', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border-light)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', overflowX: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.25rem', marginBottom: '0.25rem' }}>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>SUGGESTED IMPLEMENTATION ({snippet.lang.toUpperCase()} CODE):</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(snippet.code);
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
                                {isCopied ? '✓ Copied' : 'Copy Code'}
                              </button>
                            </div>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#e2e8f0', lineHeight: 1.35 }}>
                              {snippet.code}
                            </pre>
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                onClick={handleCloseModal}
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
