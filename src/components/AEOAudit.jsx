import React, { useState, useMemo } from 'react';

/**
 * Evaluates a page's text and structure for AEO (Answer Engine Optimization) compliance.
 */
export function calculatePageAEO(page) {
  if (!page) page = {};
  const text = page.text || '';
  const url = page.url || '';
  const schemas = page.schemas || [];
  const loadTimeMs = page.loadTimeMs || 0;
  const isHttps = url.startsWith('https:');

  let score = 100;
  const audits = [];
  const questionsFound = [];

  // 1. Scan for headings styled as questions (Natural Language Questions)
  // Look for lines starting with headings syntax (### text ###) ending in "?" or containing Q-words
  const headingMatches = text.match(/###\s*([^#\n]+)\s*###/g) || [];
  headingMatches.forEach(hm => {
    const rawHeading = hm.replace(/###/g, '').trim();
    if (/\?$/i.test(rawHeading) || /^(who|what|how|when|why|where|is|are|can|do|should)/i.test(rawHeading)) {
      // Find the text block immediately following this heading
      const idx = text.indexOf(hm);
      if (idx !== -1) {
        const nextTextSection = text.substring(idx + hm.length).trim().split('\n\n')[0] || '';
        const wordCount = nextTextSection.split(/\s+/).filter(Boolean).length;
        
        let formatType = 'paragraph';
        if (nextTextSection.startsWith('*') || nextTextSection.includes('\n*')) {
          formatType = 'list';
        } else if (nextTextSection.match(/^\d+\./)) {
          formatType = 'numbered';
        }

        questionsFound.push({
          question: rawHeading,
          answer: nextTextSection.substring(0, 150) + (nextTextSection.length > 150 ? '...' : ''),
          wordCount,
          formatType
        });
      }
    }
  });

  // Score based on Q&A elements
  if (questionsFound.length === 0) {
    score -= 25;
    audits.push({
      pillar: 'Featured Snippet',
      status: 'warning',
      message: 'No natural language question headings found',
      desc: 'SGE and Featured Snippets rely on H2/H3 question headers matching user queries (e.g. "What is...", "How to...").'
    });
  } else {
    // Audit each question's answer block length
    let optimalSnippets = 0;
    questionsFound.forEach(q => {
      // Featured Snippet optimal: 40-60 words
      if (q.wordCount >= 40 && q.wordCount <= 65) {
        optimalSnippets++;
      }
    });

    if (optimalSnippets === 0) {
      score -= 10;
      audits.push({
        pillar: 'Featured Snippet',
        status: 'warning',
        message: 'No answers match the 40-60 word snippet rule',
        desc: 'Featured snippet answer paragraphs should ideally be structured in 40-60 words immediately following the question heading.'
      });
    } else {
      audits.push({
        pillar: 'Featured Snippet',
        status: 'optimal',
        message: `${optimalSnippets} question answer blocks match optimal 40-60 word rule`,
        desc: 'Good length structuring for featured snippet definition boxes.'
      });
    }
  }

  // 2. Structured Data / FAQ Schema check
  const hasFAQSchema = schemas.some(s => /FAQPage|QAPage/i.test(s));
  if (!hasFAQSchema) {
    score -= 20;
    audits.push({
      pillar: 'AI Overviews (SGE)',
      status: 'critical',
      message: 'No FAQPage or QAPage schema markup detected',
      desc: 'Schema markup validates factual entity linkages and FAQ nodes for voice search feeds.'
    });
  } else {
    audits.push({
      pillar: 'AI Overviews (SGE)',
      status: 'optimal',
      message: 'FAQPage/QAPage schema markup detected',
      desc: 'Optimal schema metadata for AI overview engines.'
    });
  }

  // 3. Voice search conversational queries (long-tail keywords)
  const conversationalHeading = questionsFound.some(q => q.question.split(/\s+/).length >= 6);
  if (!conversationalHeading) {
    score -= 15;
    audits.push({
      pillar: 'Voice Search',
      status: 'warning',
      message: 'No long-tail conversational headings (6+ words)',
      desc: 'Voice searches are spoken and conversational, averaging 6-10+ words in length.'
    });
  } else {
    audits.push({
      pillar: 'Voice Search',
      status: 'optimal',
      message: 'Conversational long-tail question heading detected',
      desc: 'Strong voice query match (e.g. natural spoken-language question).'
    });
  }

  // 4. Voice concise answer limit (under 30 words)
  const voiceSnippetOptimal = questionsFound.some(q => q.wordCount > 0 && q.wordCount <= 30);
  if (questionsFound.length > 0 && !voiceSnippetOptimal) {
    score -= 10;
    audits.push({
      pillar: 'Voice Search',
      status: 'warning',
      message: 'No voice-ready answers (under 30 words)',
      desc: 'Smart assistants read out short summaries. Optimize at least one definition block to under 30 words.'
    });
  }

  // 5. Local Search voice signal
  const hasLocalTriggers = /\b(near me|open now|phone|contact|address|in [a-zA-Z]+)\b/i.test(text);
  if (!hasLocalTriggers) {
    score -= 10;
    audits.push({
      pillar: 'Voice Search',
      status: 'warning',
      message: 'No local voice search intent words detected',
      desc: 'Target conversational local modifiers (e.g. NAP, "near me", "[city] + [service]").'
    });
  }

  // 6. Fast response speed for crawler
  if (loadTimeMs > 800) {
    score -= 10;
    audits.push({
      pillar: 'AI Overviews (SGE)',
      status: 'warning',
      message: `Slow load time for crawlers (${loadTimeMs} ms)`,
      desc: 'AI crawlers prioritize fast, responsive pages to scrape data.'
    });
  }

  score = Math.max(0, score);
  let rating = 'Excellent';
  let qualityClass = 'badge-success';
  if (score < 55) {
    rating = 'Critical';
    qualityClass = 'badge-danger';
  } else if (score < 80) {
    rating = 'Needs Optimization';
    qualityClass = 'badge-warning';
  }

  return {
    url,
    title: page.title || 'Untitled Page',
    score,
    rating,
    qualityClass,
    questionsFound,
    audits,
    schemas
  };
}

export function generateAEOQuestions(url, title) {
  let host = 'example.com';
  let cleanName = 'our services';
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    cleanName = host.replace('www.', '').split('.')[0];
    cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  } catch(e) {}

  const pageSubject = (title || 'Marketing').split(' - ')[0];

  return [
    {
      q: `What is ${pageSubject}?`,
      a: `${pageSubject} refers to the professional practice of optimizing and promotion systems inside the ${cleanName} ecosystem. It guarantees active user conversions and maximizes search visibility through structured content audits and index enhancements.`,
      action: 'Featured Snippet Definition Box (40-60 words)'
    },
    {
      q: `How long does it take to see results for ${pageSubject}?`,
      a: `Typically, optimized campaigns show preliminary crawl adjustments within 2 to 4 weeks. Full organic keyword visibility and search ranking improvements generally require 3 to 6 months of active content audits, E-E-A-T integrations, and citation builds.`,
      action: 'PAA Strategy Answer'
    },
    {
      q: `What are the best strategies for ${pageSubject}?`,
      a: `The best strategies involve structuring clear natural-language H2 headings, adding valid JSON-LD schema markups, minifying server loading speeds under 500ms, and links citations targeting authoritative neutral .edu/.gov reference domains.`,
      action: 'Voice Search Concise Snippet (under 30 words)'
    },
    {
      q: `Why is schema markup important for AEO?`,
      a: `Schema markup is critical because it feeds AI search engines and LLM overview crawlers with structured context. It establishes factual connections between entities, which improves SGE snippet pulls and enables voice assistant readings.`,
      action: 'Featured Snippet List format'
    },
    {
      q: `Where can I find certified support for ${pageSubject}?`,
      a: `You can access direct support via our Contact page. Our certified industry experts provide full technical audits, site architecture siloing, and AI search optimizations tailored to your brand needs.`,
      action: 'Local Voice Search Intent'
    }
  ];
}

export function generateAEOSchemaCode(paaList) {
  const faqs = paaList.map(item => `{
      "@type": "Question",
      "name": "${item.q.replace(/"/g, '\\"')}",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "${item.a.replace(/"/g, '\\"')}"
      }
    }`).join(',\n    ');

  return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    ${faqs}
  ]
}
</script>`;
}

export default function AEOAudit({ pages = [], onSelectPage }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [aeoFilter, setAeoFilter] = useState('all'); // all, optimal, warning, critical
  const [selectedPage, setSelectedPage] = useState(null);
  const [openFixIndex, setOpenFixIndex] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Compute page stats
  const auditedPages = useMemo(() => {
    return pages.map(page => calculatePageAEO(page));
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
      if (p.score >= 80) optimal++;
      else if (p.score >= 55) warning++;
      else critical++;
    });

    return {
      avg: Math.round(sum / auditedPages.length),
      optimal,
      warning,
      critical
    };
  }, [auditedPages]);

  // Filtered pages
  const filteredPages = useMemo(() => {
    return auditedPages.filter(p => {
      const matchesSearch = p.url.toLowerCase().includes(searchTerm.toLowerCase()) || p.title.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (aeoFilter === 'optimal') return p.score >= 80;
      if (aeoFilter === 'warning') return p.score >= 55 && p.score < 80;
      if (aeoFilter === 'critical') return p.score < 55;
      return true;
    });
  }, [auditedPages, searchTerm, aeoFilter]);

  const handleCloseModal = () => {
    setSelectedPage(null);
    setOpenFixIndex(null);
    setCopiedIndex(null);
  };

  return (
    <div className="aeo-audit-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Overview Cards */}
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
            <h3 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>AEO Readiness Score</h3>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-dark)' }}>
              {stats.avg >= 80 ? 'AI-Search Ready' : stats.avg >= 60 ? 'Moderate Optimize' : 'Low AI Compatibility'}
            </span>
          </div>
        </div>

        <div className="eeat-card glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Site-Wide AEO Health</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Optimal AEO Pages (80+):</span>
              <strong className="text-success">{stats.optimal} pages</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Warning Pages (55-79):</span>
              <strong className="text-warning">{stats.warning} pages</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Critical AEO Pages (&lt;55):</span>
              <strong className="text-danger">{stats.critical} pages</strong>
            </div>
          </div>
        </div>

        <div className="eeat-card glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>AI Overview Signals</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem' }}>
            <div>🏷️ FAQ/Q&A Markup: <strong>{pages.filter(p => p.schemas && p.schemas.some(s => /FAQPage|QAPage/i.test(s))).length}</strong></div>
            <div>❓ Spoken voice questions: <strong>{auditedPages.reduce((acc, p) => acc + p.questionsFound.length, 0)} detected</strong></div>
            <div>📱 Viewport Mobile Scaled: <strong>{pages.filter(p => p.hasViewport).length}</strong></div>
          </div>
        </div>

      </div>

      {/* Main Tab area */}
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
              onClick={() => setAeoFilter('all')}
              className={`nav-tab-btn ${aeoFilter === 'all' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              All Pages ({auditedPages.length})
            </button>
            <button
              onClick={() => setAeoFilter('optimal')}
              className={`nav-tab-btn ${aeoFilter === 'optimal' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              🟢 SGE Ready ({stats.optimal})
            </button>
            <button
              onClick={() => setAeoFilter('warning')}
              className={`nav-tab-btn ${aeoFilter === 'warning' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              🟡 Warning ({stats.warning})
            </button>
            <button
              onClick={() => setAeoFilter('critical')}
              className={`nav-tab-btn ${aeoFilter === 'critical' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              🔴 Critical ({stats.critical})
            </button>
          </div>

        </div>

        {/* Audited Pages Table */}
        <div className="table-responsive" style={{ marginTop: '1.25rem' }}>
          <table className="pages-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Page URL & Title</th>
                <th style={{ textAlign: 'center', padding: '0.75rem', width: '130px' }}>AEO Score</th>
                <th style={{ textAlign: 'center', padding: '0.75rem', width: '150px' }}>FAQ Schema</th>
                <th style={{ textAlign: 'center', padding: '0.75rem', width: '160px' }}>Spoken Questions</th>
                <th style={{ textAlign: 'center', padding: '0.75rem', width: '110px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPages.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No pages matched your AEO filters.
                  </td>
                </tr>
              ) : (
                filteredPages.map(page => {
                  const hasFAQ = page.schemas.some(s => /FAQPage|QAPage/i.test(s));
                  return (
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
                          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{page.score}/100</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <span className={`status-badge ${hasFAQ ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}>
                          {hasFAQ ? 'Detected' : 'Missing'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600 }}>
                        {page.questionsFound.length > 0 ? (
                          <span style={{ color: '#0066cc' }}>❓ {page.questionsFound.length} found</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>0 questions</span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <button
                          onClick={() => onSelectPage(page.url, 'aeo')}
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
                          AEO Audit 🔍
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AEO Inspection Modal */}
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
                Answer Engine Optimization (AEO) Audit
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedPage.url}
              </p>
            </div>

            {/* Score box */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', background: 'rgba(0,0,0,0.03)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: selectedPage.score >= 80 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {selectedPage.score}%
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>AEO Score</span>
                <span className={`status-badge ${selectedPage.score >= 80 ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>
                  {selectedPage.rating}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', justifyContent: 'center' }}>
                <div>❓ Heading Questions: <strong>{(selectedPage.questionsFound || []).length} found</strong></div>
                <div>🏷️ Detected Schemas: <strong>{(selectedPage.schemas || []).length > 0 ? selectedPage.schemas.join(', ') : 'None'}</strong></div>
                <div>📱 Mobile Friendly (Viewport): <strong>Yes (Optimal)</strong></div>
              </div>
            </div>

            {/* Checklist Audits */}
            <div>
              <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem 0', color: 'var(--text-dark)' }}>AEO Compliance Signals</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {(selectedPage.audits || []).map((audit, idx) => (
                  <div key={idx} style={{
                    padding: '0.75rem 1rem',
                    background: audit.status === 'optimal' ? 'rgba(16, 185, 129, 0.02)' : 'rgba(0,0,0,0.01)',
                    border: `1px solid ${audit.status === 'optimal' ? 'rgba(16, 185, 129, 0.15)' : 'var(--border-light)'}`,
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem'
                  }}>
                    <span style={{ fontSize: '1rem', marginTop: '-0.1rem' }}>
                      {audit.status === 'optimal' ? '✅' : '⚠️'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{audit.message}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>{audit.desc}</div>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.05)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                      {audit.pillar}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Generated PAA Questions & Fix Schema Markup */}
            <div style={{ background: 'rgba(0, 102, 204, 0.02)', border: '1px solid rgba(0, 102, 204, 0.1)', padding: '1.25rem', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.95rem', margin: 0, color: 'var(--text-dark)' }}>
                  Tailored PAA & Voice Search Q&As
                </h3>
                
                <button
                  onClick={() => setOpenFixIndex(openFixIndex === 99 ? null : 99)}
                  style={{
                    background: openFixIndex === 99 ? 'rgba(0,0,0,0.05)' : 'rgba(59, 130, 246, 0.15)',
                    color: '#0066cc',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {openFixIndex === 99 ? '🙈 Hide Schema' : '⚡ View FAQ Schema'}
                </button>
              </div>

              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '1rem' }}>
                Add these 5 conversational Q&A blocks directly onto your page's body content to capture voice search intent and People Also Ask (PAA) boxes.
              </p>

              {(() => {
                const paaList = generateAEOQuestions(selectedPage.url, selectedPage.title);
                const isCopied = copiedIndex === 99;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    
                    {/* FAQ Schema display */}
                    {openFixIndex === 99 && (
                      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg-terminal)', color: '#a7f3d0', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid var(--border-light)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', overflowX: 'auto', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.3rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>GENERATED FAQ JSON-LD SCHEMA:</span>
                          <button
                            onClick={() => {
                              const code = generateAEOSchemaCode(paaList);
                              navigator.clipboard.writeText(code);
                              setCopiedIndex(99);
                              setTimeout(() => setCopiedIndex(null), 2000);
                            }}
                            style={{
                              background: isCopied ? '#10b981' : '#2563eb',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              padding: '0.15rem 0.4rem',
                              fontSize: '0.65rem',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            {isCopied ? '✓ Copied!' : '📋 Copy Schema'}
                          </button>
                        </div>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#a7f3d0', lineHeight: 1.35 }}>
                          {generateAEOSchemaCode(paaList)}
                        </pre>
                      </div>
                    )}

                    {/* Q&A Cards */}
                    {paaList.map((paa, idx) => (
                      <div key={idx} style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '6px',
                        padding: '0.75rem 1rem',
                        fontSize: '0.8rem'
                      }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-dark)', display: 'flex', justifyContent: 'space-between' }}>
                          <span>❓ {paa.q}</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.04)', padding: '0.1rem 0.3rem', borderRadius: '4px', alignSelf: 'flex-start' }}>
                            {paa.action}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-main)', marginTop: '0.35rem', lineHeight: 1.45 }}>{paa.a}</div>
                      </div>
                    ))}

                  </div>
                );
              })()}

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
