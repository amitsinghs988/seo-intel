import { useState, useEffect } from 'react';

export default function SEOActionPlan({ pages = [] }) {
  // 1. Audit stats from crawled pages to show contextual warnings in tasks
  const technicalErrorsCount = pages.filter(p => (p.h1Count || 0) !== 1 || (p.title || '').length < 40 || !(p.metaDescription || '')).length;
  const eeatErrorsCount = pages.filter(p => {
    const isHttps = (p.url || '').startsWith('https:');
    const hasSchema = p.schemas && p.schemas.length > 0;
    return !isHttps || !hasSchema;
  }).length;
  const aeoErrorsCount = pages.filter(p => !(p.schemas || []).some(s => /FAQPage|QAPage/i.test(s))).length;

  // 2. Default task arrays with unique IDs
  const defaultTasks = {
    phase1: [
      { id: 'p1_1', text: 'Complete full technical SEO audit (Screaming Frog + GSC + GTmetrix)', checked: false },
      { id: 'p1_2', text: 'Fix all crawl errors, redirect chains, and 404 pages', checked: false },
      { id: 'p1_3', text: 'Optimize Core Web Vitals: LCP, INP, CLS', checked: false },
      { id: 'p1_4', text: 'Install and configure Google Analytics 4 + Google Tag Manager', checked: false },
      { id: 'p1_5', text: 'Set up Google Search Console and submit XML sitemap', checked: false },
      { id: 'p1_6', text: 'Conduct comprehensive keyword research and create keyword map', checked: false },
      { id: 'p1_7', text: 'Audit and optimize all existing page titles, meta descriptions, H1 tags', checked: false, alert: technicalErrorsCount > 0 ? `⚠️ SEO Intel Alert: Found ${technicalErrorsCount} page(s) with Title/Description/H1 tag violations. Check 'On-Page Technical SEO' tab.` : null },
      { id: 'p1_8', text: 'Implement Organization + WebSite + BreadcrumbList schema', checked: false },
      { id: 'p1_9', text: 'Create / optimize Google Business Profile (local businesses)', checked: false },
      { id: 'p1_10', text: 'Set up rank tracking for all target keywords', checked: false }
    ],
    phase2: [
      { id: 'p2_1', text: 'Create or update author bios with full E-E-A-T signals', checked: false, alert: eeatErrorsCount > 0 ? `⚠️ E-E-A-T Alert: Found ${eeatErrorsCount} page(s) missing credential schemas or HTTPS trust levels. Check 'E-E-A-T Quality Audit' tab.` : null },
      { id: 'p2_2', text: 'Publish first 2–4 pillar pages / cornerstone content pieces', checked: false },
      { id: 'p2_3', text: 'Begin content cluster production (3–5 supporting articles per pillar)', checked: false },
      { id: 'p2_4', text: 'Implement FAQ schema on all content pages', checked: false, alert: aeoErrorsCount > 0 ? `⚠️ AEO Alert: Found ${aeoErrorsCount} page(s) lacking FAQPage/QAPage structured data schema blocks. Check 'AEO & Voice Search' tab.` : null },
      { id: 'p2_5', text: 'Optimize top 10 existing pages: update content, add schema, improve CTA', checked: false },
      { id: 'p2_6', text: 'Launch content calendar for next 6 months', checked: false },
      { id: 'p2_7', text: 'Build or update About Us, Contact, Privacy Policy, and Trust pages', checked: false },
      { id: 'p2_8', text: 'Begin guest posting and digital PR outreach campaigns', checked: false }
    ],
    phase3: [
      { id: 'p3_1', text: 'Submit to and build citations in top 20 industry directories', checked: false },
      { id: 'p3_2', text: 'Launch 2–3 linkable asset campaigns (tools, research, or infographics)', checked: false },
      { id: 'p3_3', text: 'Optimize content for Featured Snippets and People Also Ask', checked: false },
      { id: 'p3_4', text: 'Implement VideoObject schema if video content exists', checked: false },
      { id: 'p3_5', text: 'Build first 5–10 quality backlinks through outreach / HARO', checked: false },
      { id: 'p3_6', text: 'Audit internal linking structure across entire site', checked: false },
      { id: 'p3_7', text: 'Review and optimize for AI Overviews / SGE visibility', checked: false },
      { id: 'p3_8', text: 'Deliver first full monthly SEO performance report', checked: false },
      { id: 'p3_9', text: 'Review 90-day results against targets; adjust strategy for next quarter', checked: false }
    ]
  };

  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('seointel_seo_tasks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Guard against stale/malformed persisted shapes (e.g. an older schema version).
        // All three phases must exist as arrays, otherwise fall back to fresh defaults.
        const validShape = parsed
          && Array.isArray(parsed.phase1)
          && Array.isArray(parsed.phase2)
          && Array.isArray(parsed.phase3);
        if (validShape) {
          // Sync alerts in case crawl has run
          Object.keys(defaultTasks).forEach(phase => {
            if (Array.isArray(parsed[phase])) {
              parsed[phase] = parsed[phase].map(pt => {
                const defT = defaultTasks[phase].find(dt => dt.id === pt.id);
                return { ...pt, alert: defT ? defT.alert : null };
              });
            }
          });
          return parsed;
        }
      } catch (e) {}
    }
    return defaultTasks;
  });

  const [activePhase, setActivePhase] = useState('phase1');

  // Save changes
  useEffect(() => {
    localStorage.setItem('seointel_seo_tasks', JSON.stringify(tasks));
  }, [tasks]);

  const handleToggleTask = (phase, taskId) => {
    setTasks(prev => ({
      ...prev,
      [phase]: prev[phase].map(task =>
        task.id === taskId ? { ...task, checked: !task.checked } : task
      )
    }));
  };

  // Calculate stats
  const totalTasks = tasks.phase1.length + tasks.phase2.length + tasks.phase3.length;
  const completedTasks = 
    tasks.phase1.filter(t => t.checked).length + 
    tasks.phase2.filter(t => t.checked).length + 
    tasks.phase3.filter(t => t.checked).length;
  
  const globalPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const phasePercent = (arr) => arr.length > 0
    ? Math.round((arr.filter(t => t.checked).length / arr.length) * 100)
    : 0;

  const phaseStats = {
    phase1: {
      count: tasks.phase1.length,
      done: tasks.phase1.filter(t => t.checked).length,
      percent: phasePercent(tasks.phase1)
    },
    phase2: {
      count: tasks.phase2.length,
      done: tasks.phase2.filter(t => t.checked).length,
      percent: phasePercent(tasks.phase2)
    },
    phase3: {
      count: tasks.phase3.length,
      done: tasks.phase3.filter(t => t.checked).length,
      percent: phasePercent(tasks.phase3)
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset action plan progress checklist?')) {
      setTasks(defaultTasks);
    }
  };

  const handleExportPlanMarkdown = () => {
    let mdContent = `# 90-Day SEO Action Plan - SEO Intel\n`;
    mdContent += `Generated: ${new Date().toLocaleDateString()} | Progress: ${globalPercent}% (${completedTasks}/${totalTasks} tasks completed)\n\n`;

    Object.keys(tasks).forEach(phase => {
      const phaseLabel = phase === 'phase1' 
        ? 'Phase 1: Days 1–30 — Foundation & Technical Fix' 
        : phase === 'phase2' 
          ? 'Phase 2: Days 31–60 — Content & E-E-A-T' 
          : 'Phase 3: Days 61–90 — Authority, AEO & AI SEO';
      mdContent += `## ${phaseLabel}\n`;
      tasks[phase].forEach(t => {
        mdContent += `- [${t.checked ? 'x' : ' '}] ${t.text}\n`;
        if (t.alert) {
          mdContent += `  *Note: ${t.alert.replace('⚠️ ', '')}*\n`;
        }
      });
      mdContent += `\n`;
    });

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'seointel_seo_action_plan.md');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="seo-action-plan-layout animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Overview Cards */}
      <div className="eeat-dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        
        <div className="eeat-card glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem' }}>
          <div className="eeat-dial" style={{
            position: 'relative',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: `conic-gradient(#10b981 ${globalPercent * 3.6}deg, rgba(0,0,0,0.1) 0deg)`,
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
              {globalPercent}%
            </div>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Overall Progress</h3>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-dark)' }}>
              {completedTasks} of {totalTasks} Tasks
            </span>
          </div>
        </div>

        {/* Phase completion bars */}
        {Object.keys(phaseStats).map(pKey => {
          const stats = phaseStats[pKey];
          const phaseLabel = pKey === 'phase1' ? 'Phase 1: Foundation' : pKey === 'phase2' ? 'Phase 2: Content & EEAT' : 'Phase 3: Authority & AI';
          return (
            <div key={pKey} className="eeat-card glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{phaseLabel}</h3>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dark)' }}>{stats.percent}%</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(0,0,0,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${stats.percent}%`, height: '100%', background: pKey === 'phase1' ? '#3b82f6' : pKey === 'phase2' ? '#10b981' : '#f59e0b', borderRadius: '4px' }}></div>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                {stats.done} of {stats.count} completed
              </span>
            </div>
          );
        })}

      </div>

      {/* Interactive Tabs */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setActivePhase('phase1')}
              className={`nav-tab-btn ${activePhase === 'phase1' ? 'active' : ''}`}
              style={{
                padding: '0.6rem 1.25rem',
                fontSize: '0.85rem',
                borderBottom: activePhase === 'phase1' ? '3px solid #3b82f6' : 'none'
              }}
            >
              🛠️ Phase 1 (Days 1-30)
            </button>
            <button
              onClick={() => setActivePhase('phase2')}
              className={`nav-tab-btn ${activePhase === 'phase2' ? 'active' : ''}`}
              style={{
                padding: '0.6rem 1.25rem',
                fontSize: '0.85rem',
                borderBottom: activePhase === 'phase2' ? '3px solid #10b981' : 'none'
              }}
            >
              ✍️ Phase 2 (Days 31-60)
            </button>
            <button
              onClick={() => setActivePhase('phase3')}
              className={`nav-tab-btn ${activePhase === 'phase3' ? 'active' : ''}`}
              style={{
                padding: '0.6rem 1.25rem',
                fontSize: '0.85rem',
                borderBottom: activePhase === 'phase3' ? '3px solid #f59e0b' : 'none'
              }}
            >
              🚀 Phase 3 (Days 61-90)
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleExportPlanMarkdown}
              style={{
                padding: '0.4rem 0.8rem',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              📋 Export Plan (Markdown)
            </button>
            <button
              onClick={handleReset}
              style={{
                padding: '0.4rem 0.8rem',
                background: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid rgba(185, 28, 28, 0.15)',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Reset Progress
            </button>
          </div>
        </div>

        {/* Task lists container */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', color: 'var(--text-dark)' }}>
            {activePhase === 'phase1' ? 'Phase 1: Foundation & Technical Fix' : activePhase === 'phase2' ? 'Phase 2: Content Creation & E-E-A-T' : 'Phase 3: Authority, AEO & AI SEO'}
          </h2>

          {tasks[activePhase].map(task => (
            <div key={task.id} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              padding: '1rem',
              background: task.checked ? 'rgba(16, 185, 129, 0.02)' : 'rgba(0,0,0,0.01)',
              border: `1px solid ${task.checked ? 'rgba(16, 185, 129, 0.15)' : 'var(--border-light)'}`,
              borderRadius: '8px',
              transition: 'all 0.2s ease'
            }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                
                <input
                  type="checkbox"
                  id={task.id}
                  checked={task.checked}
                  onChange={() => handleToggleTask(activePhase, task.id)}
                  style={{
                    width: '1.2rem',
                    height: '1.2rem',
                    cursor: 'pointer',
                    borderRadius: '4px'
                  }}
                />

                <label
                  htmlFor={task.id}
                  style={{
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    color: task.checked ? 'var(--text-muted)' : 'var(--text-dark)',
                    textDecoration: task.checked ? 'line-through' : 'none',
                    cursor: 'pointer',
                    flex: 1
                  }}
                >
                  {task.text}
                </label>

              </div>

              {/* Contextual warning alert from real-time crawl */}
              {!task.checked && task.alert && (
                <div style={{
                  marginLeft: '2rem',
                  padding: '0.4rem 0.75rem',
                  background: 'rgba(245, 158, 11, 0.06)',
                  borderLeft: '3px solid #f59e0b',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  color: '#b45309',
                  fontWeight: 500
                }}>
                  {task.alert}
                </div>
              )}

            </div>
          ))}

        </div>

      </div>

    </div>
  );
}
