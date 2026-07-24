import React, { useState, useMemo } from 'react';

/**
 * Groups and analyzes pages into thematic silos / topic clusters.
 * Evaluates internal link leakage to calculate structural silo health.
 */
export function analyzeSiteArchitecture(pages) {
  if (!Array.isArray(pages)) pages = [];
  const urlToSilo = {};
  const pageSiloMap = new Map();

  // First pass: Assign each page to a logical Silo based on its path structure or URL keyword prefix
  const processedPages = pages.map(page => {
    const url = page.url || '';
    let siloName = 'General Core Pages';
    let isRoot = false;

    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname.replace(/\/$/, ''); // strip trailing slash

      if (pathname === '' || pathname === '/') {
        siloName = 'Homepage Hub';
        isRoot = true;
      } else {
        const parts = pathname.split('/').filter(Boolean);
        if (parts.length > 0) {
          const firstSegment = parts[0];
          if (parts.length > 1) {
            // Folder structure (e.g. /blog/seo-tips -> /blog/ Silo)
            siloName = `Silo: /${firstSegment}/`;
          } else {
            // Root-level pages. Group by common keyword prefixes to detect keyword-based silos
            const matchPrefix = firstSegment.match(/^(seo|dental|marketing|about|service|blog|contact|legal|product|category|service)/i);
            if (matchPrefix) {
              siloName = `Topic Cluster: ${matchPrefix[0].toUpperCase()}`;
            } else {
              siloName = 'Core Pages';
            }
          }
        }
      }
    } catch (e) {}

    urlToSilo[url] = siloName;
    
    return {
      ...page,
      siloName,
      isRoot,
      innerSiloLinks: [],
      crossSiloLinks: []
    };
  });

  // Second pass: Track internal links and detect cross-silo leaks
  processedPages.forEach(page => {
    const sourceSilo = page.siloName;
    const links = page.links || [];

    links.forEach(link => {
      if (!link.isExternal) {
        const targetSilo = urlToSilo[link.resolved];
        if (targetSilo) {
          // If the link points to a page inside the SAME silo, it is a healthy inner-silo link.
          // Homepage Hub linking out or pages linking back to Homepage are generally considered structural, not leaks.
          if (targetSilo === sourceSilo) {
            page.innerSiloLinks.push(link.resolved);
          } else if (sourceSilo !== 'Homepage Hub' && targetSilo !== 'Homepage Hub' && targetSilo !== 'General Core Pages') {
            // Page in Silo A is linking directly to Silo B (neither is Homepage/Core). This is link juice leakage.
            page.crossSiloLinks.push({
              targetUrl: link.resolved,
              targetSilo
            });
          }
        }
      }
    });
  });

  // Aggregate pages by Silo
  const silosMap = {};
  processedPages.forEach(page => {
    const sName = page.siloName;
    if (!silosMap[sName]) {
      silosMap[sName] = {
        name: sName,
        pages: [],
        totalInnerLinks: 0,
        totalCrossLinks: 0,
        leakagePages: []
      };
    }
    
    silosMap[sName].pages.push(page);
    silosMap[sName].totalInnerLinks += page.innerSiloLinks.length;
    silosMap[sName].totalCrossLinks += page.crossSiloLinks.length;
    if (page.crossSiloLinks.length > 0) {
      silosMap[sName].leakagePages.push(page);
    }
  });

  // Calculate scores and recommendations for each Silo
  const silosList = Object.values(silosMap).map(silo => {
    const totalOutboundInternal = silo.totalInnerLinks + silo.totalCrossLinks;
    // Insulation score is the percentage of inner links relative to total outbound internal links
    let insulationScore = 100;
    if (totalOutboundInternal > 0) {
      insulationScore = Math.round((silo.totalInnerLinks / totalOutboundInternal) * 100);
    }

    // Determine parent index page (shortest path URL in silo acts as category head)
    let parentPage = null;
    let shortestLen = 9999;
    silo.pages.forEach(p => {
      if (p.url.length < shortestLen) {
        shortestLen = p.url.length;
        parentPage = p;
      }
    });

    let health = 'Strict Silo';
    let healthClass = 'badge-success';
    if (insulationScore < 60) {
      health = 'Bleeding Authority';
      healthClass = 'badge-danger';
    } else if (insulationScore < 85) {
      health = 'Weak Insulation';
      healthClass = 'badge-warning';
    }

    // Construct custom architectural recommendations
    const recommendations = [];
    if (insulationScore < 80 && silo.name !== 'Homepage Hub' && silo.name !== 'General Core Pages') {
      recommendations.push({
        type: 'insulation',
        title: 'Tighten Internal Silo Linkages',
        desc: `Silo ${silo.name} leaks link equity directly to other topic silos. Restructure links to force articles to link primarily within this silo, using the category page (${parentPage ? parentPage.title : 'Index'}) as the bridge.`
      });
    }

    // Check if site lacks structured folders
    const isFlat = silo.name.startsWith('Topic Cluster:');
    if (isFlat) {
      recommendations.push({
        type: 'folder',
        title: 'Transition to Subfolder Architecture',
        desc: `Pages in this cluster are hosted flat on the root domain directory. For search crawler optimization, migrate URLs into nested folder paths (e.g., relocate page URLs to start with /${silo.name.replace('Topic Cluster: ', '').toLowerCase()}/).`
      });
    }

    // Check if Silo contains enough supporting articles
    if (silo.pages.length < 3 && silo.name !== 'Homepage Hub') {
      recommendations.push({
        type: 'thin',
        title: 'Add Support Content Articles',
        desc: `This topic cluster has only ${silo.pages.length} pages. Add at least 3-4 auxiliary articles covering related long-tail queries to establish topical authority.`
      });
    }

    return {
      ...silo,
      insulationScore,
      health,
      healthClass,
      parentPage,
      recommendations
    };
  });

  return {
    silos: silosList,
    totalCrossSiloLeaks: processedPages.reduce((acc, p) => acc + p.crossSiloLinks.length, 0)
  };
}

export default function SiloAnalyzer({ pages = [], onSelectPage }) {
  const [selectedSilo, setSelectedSilo] = useState(null);
  
  const { silos, totalCrossSiloLeaks } = useMemo(() => {
    return analyzeSiteArchitecture(pages);
  }, [pages]);

  // Calculate average silo health index (insulation)
  const averageInsulation = useMemo(() => {
    const validSilos = silos.filter(s => s.name !== 'Homepage Hub' && s.name !== 'General Core Pages');
    if (validSilos.length === 0) return 100;
    const sum = validSilos.reduce((acc, s) => acc + s.insulationScore, 0);
    return Math.round(sum / validSilos.length);
  }, [silos]);

  return (
    <div className="silo-analyzer-layout animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Overview Cards */}
      <div className="eeat-dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        
        <div className="eeat-card glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem' }}>
          <div className="eeat-dial" style={{
            position: 'relative',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: `conic-gradient(${averageInsulation >= 75 ? 'var(--color-success)' : 'var(--color-warning)'} ${averageInsulation * 3.6}deg, rgba(0,0,0,0.1) 0deg)`,
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
              {averageInsulation}%
            </div>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Silo Insulation Index</h3>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-dark)' }}>
              {averageInsulation >= 85 ? 'Strong Authority Isolation' : averageInsulation >= 65 ? 'Minor Link Leakage' : 'Critical Structure Leak'}
            </span>
          </div>
        </div>

        <div className="eeat-card glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Topic Clusters Discovered</h3>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-dark)' }}>
            {silos.filter(s => s.name !== 'Homepage Hub' && s.name !== 'General Core Pages').length} Silos
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Logical directory paths or prefix groups</span>
        </div>

        <div className="eeat-card glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Cross-Silo Link Leaks</h3>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: totalCrossSiloLeaks > 5 ? 'var(--color-danger)' : 'var(--text-dark)' }}>
            {totalCrossSiloLeaks} Leaks
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Direct internal links between different silos</span>
        </div>

      </div>

      {/* Silo Tree list card */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', margin: '0 0 0.5rem 0', color: 'var(--text-dark)' }}>Discovered Silo Structures & Clusters</h2>
        <p className="subtitle" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Below is your audited website architecture. Expand a Silo to inspect its supporting pages, insulation scores, and architectural link leakage.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {silos.map(silo => (
            <div key={silo.name} style={{
              border: '1px solid var(--border-light)',
              borderRadius: '10px',
              overflow: 'hidden',
              background: 'rgba(0,0,0,0.01)'
            }}>
              
              {/* Header card for silo */}
              <div style={{
                padding: '1rem 1.25rem',
                background: 'var(--bg-card)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                borderBottom: '1px solid var(--border-light)'
              }}>
                <div>
                  <strong style={{ fontSize: '1rem', color: 'var(--text-dark)' }}>{silo.name}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Pillar Category Page: <code style={{ color: '#0066cc' }}>{silo.parentPage ? silo.parentPage.url.split('/').pop() || '/' : '/'}</code>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Insulation</span>
                    <strong style={{ fontSize: '0.9rem', color: silo.insulationScore >= 80 ? 'var(--color-success)' : '#ea580c' }}>
                      {silo.insulationScore}%
                    </strong>
                  </div>
                  
                  <span className={`status-badge ${silo.healthClass}`} style={{ fontSize: '0.75rem' }}>
                    {silo.health}
                  </span>

                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <strong>{silo.pages.length}</strong> pages
                  </span>

                  <button
                    onClick={() => setSelectedSilo(selectedSilo === silo.name ? null : silo.name)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0066cc',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 600
                    }}
                  >
                    {selectedSilo === silo.name ? 'Collapse 🔺' : 'Expand Details 🔻'}
                  </button>
                </div>
              </div>

              {/* Collapsible Details */}
              {selectedSilo === silo.name && (
                <div className="animate-fade-in" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', background: 'var(--bg-card)' }}>
                  
                  {/* Recommendations */}
                  {silo.recommendations.length > 0 && (
                    <div style={{ padding: '1rem', background: 'rgba(234, 88, 12, 0.05)', borderLeft: '4px solid #ea580c', borderRadius: '4px' }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#ea580c', fontWeight: 700 }}>Architectural Recommendations:</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {silo.recommendations.map((rec, idx) => (
                          <div key={idx} style={{ fontSize: '0.8rem' }}>
                            <strong>💡 {rec.title}:</strong> <span style={{ color: 'var(--text-main)' }}>{rec.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Silo Flow Visualizer list */}
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-dark)' }}>Silo Tree Structure:</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '0.5rem' }}>
                      
                      {/* Parent node */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1rem' }}>🏛️</span>
                        <div 
                          onClick={() => onSelectPage && silo.parentPage && onSelectPage(silo.parentPage.url, 'duplicate')}
                          style={{ background: 'rgba(0,102,204,0.05)', border: '1px solid rgba(0,102,204,0.2)', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: onSelectPage && silo.parentPage ? 'pointer' : 'default' }}
                          title={onSelectPage && silo.parentPage ? "Click to inspect page audit" : ""}
                        >
                          Category Pillar: <span style={{ color: '#0066cc', textDecoration: onSelectPage && silo.parentPage ? 'underline' : 'none' }}>{silo.parentPage ? silo.parentPage.title : 'Pillar'}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginLeft: '0.5rem' }}>({silo.parentPage ? silo.parentPage.url : '/'})</span>
                        </div>
                      </div>

                      {/* Child support pages */}
                      {silo.pages.filter(p => p !== silo.parentPage).map(page => (
                        <div key={page.url} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '1.5rem' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>├── 📄</span>
                          <div 
                            onClick={() => onSelectPage && onSelectPage(page.url, 'duplicate')}
                            style={{ background: 'var(--bg-main)', border: '1px solid var(--border-light)', padding: '0.35rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: onSelectPage ? 'pointer' : 'default' }}
                            title={onSelectPage ? "Click to inspect page audit" : ""}
                          >
                            <div>
                              <strong style={{ textDecoration: onSelectPage ? 'underline' : 'none' }}>{page.title}</strong>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginLeft: '0.5rem' }}>({page.url.split('/').pop()})</span>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Inner links: {page.innerSiloLinks.length}
                              </span>
                              {page.crossSiloLinks.length > 0 && (
                                <span style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600 }} title="Direct links leaking to other topic silos">
                                  ⚠️ Leaking: {page.crossSiloLinks.length}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                    </div>
                  </div>

                  {/* Leak Details */}
                  {silo.totalCrossLinks > 0 && (
                    <div>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#dc2626' }}>Detected Link Leaks (Cross-Silo Links):</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                        {silo.pages.flatMap(p => p.crossSiloLinks.map((l, index) => ({ source: p, target: l, key: `${p.url}-${index}` })))
                          .map(leak => (
                            <div key={leak.key} style={{
                              fontSize: '0.75rem',
                              padding: '0.4rem 0.6rem',
                              background: 'rgba(239, 68, 68, 0.02)',
                              border: '1px solid rgba(239, 68, 68, 0.12)',
                              borderRadius: '6px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <div>
                                <span>Page <strong>{leak.source.title}</strong> links to </span>
                                <a href={leak.target.targetUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                                  {leak.target.targetUrl}
                                </a>
                              </div>
                              <span style={{ fontSize: '0.7rem', background: '#fee2e2', color: '#b91c1c', padding: '0.15rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
                                Destination: {leak.target.targetSilo}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          ))}
        </div>

      </div>

      {/* Silo strategy explanation */}
      <div className="glass-card" style={{ padding: '1.25rem', background: 'rgba(0, 102, 204, 0.02)', border: '1px dashed rgba(0, 102, 204, 0.2)' }}>
        <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.4rem 0', color: 'var(--text-dark)' }}>💡 What is a Silo Structure?</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
          Siloing is an advanced search engine optimization strategy that groups related content into distinct topical branches on your website. 
          By insulating topic clusters (e.g., grouping and linking articles strictly within the <code>/seo/</code> folder), you demonstrate to search engine crawlers that your page clusters carry deep, concentrated topical authority on that specific subject. 
          A high <strong>Silo Insulation Index</strong> means you have clean navigation silos, keeping page authority concentrated where it belongs!
        </p>
      </div>

    </div>
  );
}
