import React, { useState, useEffect, useRef } from 'react';
import Dashboard from './components/Dashboard';
import PageList from './components/PageList';
import DuplicateDetail from './components/DuplicateDetail';
import DuplicateList from './components/DuplicateList';
import EEATAudit from './components/EEATAudit';
import OnPageSEO from './components/OnPageSEO';
import SiloAnalyzer from './components/SiloAnalyzer';
import AEOAudit from './components/AEOAudit';
import AISEO from './components/AISEO';
import SEOActionPlan from './components/SEOActionPlan';

export default function App() {
  const [page, setPage] = useState('input'); // input, crawling, results
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState(100);
  const [checkExternal, setCheckExternal] = useState(true);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('seointel-theme') || 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    localStorage.setItem('seointel-theme', theme);
  }, [theme]);
  const [crawlState, setCrawlState] = useState(() => {
    try {
      const saved = localStorage.getItem('seointel_crawl_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.status === 'completed' && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}
    return {
      status: 'idle',
      targetUrl: '',
      progress: { currentUrl: '', crawledCount: 0, queueLength: 0, pagesFoundCount: 0 },
      summary: null,
      pages: [],
      nearDuplicates: [],
      error: null
    };
  });

  // Persist completed crawl state to localStorage
  useEffect(() => {
    if (crawlState.status === 'completed' && Array.isArray(crawlState.pages) && crawlState.pages.length > 0) {
      try {
        localStorage.setItem('seointel_crawl_state', JSON.stringify({
          status: 'completed',
          targetUrl: crawlState.targetUrl,
          progress: crawlState.progress,
          summary: crawlState.summary,
          pages: crawlState.pages,
          nearDuplicates: crawlState.nearDuplicates
        }));
      } catch (e) {
        console.error('Failed to cache crawl state to localStorage:', e);
      }
    }
  }, [crawlState]);

  const [activeTab, setActiveTab] = useState('summary'); // summary, pages, broken
  const [selectedPageUrl, setSelectedPageUrl] = useState(null);
  const [selectedPageData, setSelectedPageData] = useState(null);
  const [pageDetailTab, setPageDetailTab] = useState('duplicate');
  const [detailHistory, setDetailHistory] = useState([]);
  const [logMessages, setLogMessages] = useState([]);

  const eventSourceRef = useRef(null);
  const logEndRef = useRef(null);

  // Auto-scroll the live crawler log to the bottom
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logMessages]);

  // Connect to SSE on mount and listen to popstate routing
  useEffect(() => {
    connectToEventStream();
    
    // Initialize state from URL history
    syncStateFromHistory();

    const handlePopState = () => {
      syncStateFromHistory();
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigate = (path) => {
    window.history.pushState(null, '', path);
    syncStateFromHistory();
  };

  const normalizeUrlStr = (str) => {
    if (!str) return '';
    let s = String(str).trim();
    try {
      const u = new URL(s);
      let path = u.pathname;
      if (path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
      }
      return (u.hostname + path).toLowerCase();
    } catch (e) {
      return s.replace(/^https?:\/\//i, '').replace(/\/$/, '').toLowerCase();
    }
  };

  // Sync React page state based on URL history without wiping client state
  const syncStateFromHistory = () => {
    const path = window.location.pathname;
    const search = window.location.search;

    let activeState = crawlState;

    // Check localStorage cache if activeState is idle
    if (!activeState || activeState.status === 'idle' || !Array.isArray(activeState.pages) || activeState.pages.length === 0) {
      try {
        const saved = localStorage.getItem('seointel_crawl_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.status === 'completed' && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
            activeState = parsed;
            setCrawlState(parsed);
          }
        }
      } catch (e) {}
    }

    if (!activeState || activeState.status !== 'completed' || !Array.isArray(activeState.pages) || activeState.pages.length === 0) {
      if (path === '/page' || path.startsWith('/results/')) {
        const urlParams = new URLSearchParams(search);
        const urlParam = urlParams.get('url');
        if (urlParam) {
          setUrl(decodeURIComponent(urlParam));
        }
      }
      setPage('input');
      setSelectedPageUrl(null);
      setSelectedPageData(null);
      if (path !== '/') {
        window.history.replaceState(null, '', '/');
      }
      return;
    }

    if (activeState.status === 'crawling' || activeState.status === 'analyzing') {
      setPage('crawling');
      setSelectedPageUrl(null);
      setSelectedPageData(null);
      if (path !== '/') {
        window.history.replaceState(null, '', '/');
      }
      return;
    }

    if (activeState.status === 'completed') {
      if (path === '/page') {
        const urlParams = new URLSearchParams(search);
        const urlParam = urlParams.get('url');
        const tabParam = urlParams.get('tab') || 'duplicate';
        
        if (urlParam) {
          const decodedUrl = decodeURIComponent(urlParam);
          setPage('results');
          setSelectedPageUrl(decodedUrl);
          setPageDetailTab(tabParam);
          
          const targetNorm = normalizeUrlStr(decodedUrl);
          const memoryPage = activeState.pages.find(p => normalizeUrlStr(p.url) === targetNorm) || activeState.pages.find(p => p.url === decodedUrl);
          
          if (memoryPage) {
            setSelectedPageData(memoryPage);
          } else {
            setSelectedPageData({
              url: decodedUrl,
              title: decodedUrl,
              wordCount: 0,
              duplicateWordCount: 0,
              commonWordCount: 0,
              duplicatePercent: 0,
              commonPercent: 0,
              uniquePercent: 100,
              status: 200,
              loadTimeMs: 0,
              sizeBytes: 0,
              blocksCount: 0,
              blocks: [],
              text: '',
              links: [],
              pagePower: 10
            });
          }
        } else {
          setPage('results');
          setActiveTab('pages');
          setSelectedPageUrl(null);
          setSelectedPageData(null);
          window.history.replaceState(null, '', '/results/pages');
        }
      } else if (path.startsWith('/results/')) {
        const tab = path.substring('/results/'.length);
        setPage('results');
        setActiveTab(tab || 'summary');
        setSelectedPageUrl(null);
        setSelectedPageData(null);
      } else {
        setPage('results');
        setActiveTab('summary');
        setSelectedPageUrl(null);
        setSelectedPageData(null);
        window.history.replaceState(null, '', '/results/summary');
      }
    }
  };

  const connectToEventStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/crawl/stream');
    eventSourceRef.current = es;

    es.addEventListener('init', (e) => {
      const state = JSON.parse(e.data);
      setCrawlState(prev => {
        if (prev.status === 'completed' && Array.isArray(prev.pages) && prev.pages.length > 0 && state.status === 'idle') {
          return prev;
        }
        return {
          ...prev,
          status: state.status,
          targetUrl: state.targetUrl,
          progress: state.progress || prev.progress,
          summary: state.summary || prev.summary,
          error: state.error
        };
      });
    });

    es.addEventListener('started', (e) => {
      const state = JSON.parse(e.data);
      setPage('crawling');
      setLogMessages(['Crawl started for ' + state.targetUrl]);
      setCrawlState(prev => ({
        ...prev,
        status: state.status,
        targetUrl: state.targetUrl,
        progress: state.progress || prev.progress,
        summary: state.summary || prev.summary,
        error: state.error
      }));
      window.history.replaceState(null, '', '/'); // Reset route during crawling
    });

    es.addEventListener('progress', (e) => {
      const progress = JSON.parse(e.data);
      setCrawlState(prev => ({
        ...prev,
        progress
      }));
    });

    es.addEventListener('page_crawled', (e) => {
      const info = JSON.parse(e.data);
      const logLine = `[Crawled] ${info.url} | Status: ${info.status} | Speed: ${info.loadTimeMs}ms | Words: ${info.wordCount}`;
      setLogMessages(prev => [...prev.slice(-49), logLine]);
    });

    es.addEventListener('analyzing', (e) => {
      const msg = JSON.parse(e.data);
      setCrawlState(prev => ({ ...prev, status: 'analyzing' }));
      setLogMessages(prev => [...prev, msg.message]);
    });

    es.addEventListener('completed', (e) => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      setLogMessages(prev => [...prev, 'Duplicate analysis completed! Loading report...']);
      navigate('/results/summary'); // Route to results summary
    });

    es.addEventListener('error', (e) => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      const err = JSON.parse(e.data);
      setCrawlState(prev => ({
        ...prev,
        status: 'error',
        error: err.error
      }));
      window.history.replaceState(null, '', '/');
      alert(`Crawl failed: ${err.error}`);
    });

    es.addEventListener('cancelled', (e) => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      setPage('input');
      setCrawlState({
        status: 'idle',
        targetUrl: '',
        progress: null,
        pagesRaw: [],
        pagesAnalyzed: [],
        nearDuplicates: [],
        summary: null,
        error: null
      });
      window.history.replaceState(null, '', '/');
      alert('Crawling was cancelled.');
    });
  };

  const startCrawl = async (e) => {
    e.preventDefault();
    if (!url) return;

    let cleanUrl = url.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'http://' + cleanUrl;
    }
    setUrl(cleanUrl);

    try {
      setPage('crawling');
      setLogMessages(['Initiating site scan for ' + cleanUrl + '...']);
      connectToEventStream(); // Establish SSE stream if available

      const res = await fetch('/api/crawl/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl, maxPages, checkExternal })
      });
      const data = await res.json();
      if (!res.ok) {
        setPage('input');
        alert(data.error || 'Failed to start crawl');
      } else if (data.state && data.state.status === 'completed') {
        // Direct response from Serverless Function (Vercel)
        setCrawlState({
          status: 'completed',
          targetUrl: cleanUrl,
          progress: data.state.progress,
          summary: data.state.summary,
          pages: data.state.pages || [],
          nearDuplicates: data.state.nearDuplicates || [],
          error: null
        });
        navigate('/results/summary');
      } else {
        window.history.replaceState(null, '', '/');
      }
    } catch (err) {
      setPage('input');
      alert('Network error starting crawl: ' + err.message);
    }
  };

  const cancelCrawl = async () => {
    try {
      await fetch('/api/crawl/cancel', { method: 'POST' });
    } catch (e) {
      console.error('Failed to cancel crawl:', e);
    }
  };

  // Navigates by updating history path
  const handleSelectPage = (pageUrl, tab = 'duplicate') => {
    if (!pageUrl) return;

    if (selectedPageUrl && selectedPageUrl !== pageUrl) {
      setDetailHistory(prev => {
        if (prev[prev.length - 1] === selectedPageUrl) return prev;
        return [...prev, selectedPageUrl];
      });
    }

    let pagesList = crawlState.pages;
    if (!Array.isArray(pagesList) || pagesList.length === 0) {
      try {
        const saved = localStorage.getItem('seointel_crawl_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
            pagesList = parsed.pages;
            setCrawlState(parsed);
          }
        }
      } catch (e) {}
    }

    const targetNorm = normalizeUrlStr(pageUrl);
    const memoryPage = (pagesList || []).find(p => normalizeUrlStr(p.url) === targetNorm) || (pagesList || []).find(p => p.url === pageUrl);

    setPage('results');
    setSelectedPageUrl(pageUrl);
    setPageDetailTab(tab);
    
    if (memoryPage) {
      setSelectedPageData(memoryPage);
    } else {
      setSelectedPageData({
        url: pageUrl,
        title: pageUrl,
        wordCount: 0,
        duplicateWordCount: 0,
        commonWordCount: 0,
        duplicatePercent: 0,
        commonPercent: 0,
        uniquePercent: 100,
        status: 200,
        loadTimeMs: 0,
        sizeBytes: 0,
        blocksCount: 0,
        blocks: [],
        text: '',
        links: [],
        pagePower: 10
      });
    }

    window.history.pushState(null, '', `/page?url=${encodeURIComponent(pageUrl)}&tab=${tab}`);
  };

  const handleDetailBack = () => {
    if (detailHistory.length > 0) {
      const prevUrl = detailHistory[detailHistory.length - 1];
      setDetailHistory(prev => prev.slice(0, -1));
      navigate(`/page?url=${encodeURIComponent(prevUrl)}`);
    } else {
      navigate('/results/pages');
    }
  };

  const handleDetailClose = () => {
    setDetailHistory([]);
    navigate('/results/pages');
  };

  const formatUrlHost = (fullUrl) => {
    try {
      return new URL(fullUrl).hostname;
    } catch (e) {
      return fullUrl;
    }
  };

  return (
    <div className="app-container">
      {/* Header Bar */}
      <header className="app-header glass-header">
        <div className="header-logo" onClick={() => setPage('input')}>
          <svg className="logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
          <span className="logo-text"><span style={{ color: '#0066cc' }}>SEO</span><span style={{ color: '#ea580c' }}> Intel</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {crawlState.status === 'completed' && page === 'results' && (
            <div className="header-active-site">
              Analyzing: <strong>{formatUrlHost(crawlState.targetUrl)}</strong>
            </div>
          )}
          
          <button
            onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
            className="theme-toggle-btn"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            style={{
              background: 'rgba(0, 0, 0, 0.05)',
              border: '1px solid var(--border-light)',
              borderRadius: '50%',
              width: '2.2rem',
              height: '2.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.1rem',
              transition: 'var(--transition-smooth)',
              outline: 'none'
            }}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-content">
        {/* PAGE 1: Input Setup */}
        {page === 'input' && (
          <div className="input-page-layout animate-fade-in">
            <div className="hero-section">
              <h1>Find Duplicate Content & Broken Links</h1>
              <p>Crawl your website automatically, analyze text shingles, and see exactly what pages share matching text blocks.</p>
            </div>

            <form onSubmit={startCrawl} className="scan-form-card glass-card">
              <div className="form-group">
                <label htmlFor="site-url">Website URL to Scan</label>
                <div className="input-with-button">
                  <input
                    id="site-url"
                    type="text"
                    required
                    placeholder="e.g. example.com or https://mywebsite.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                  <button type="submit" className="scan-submit-btn">
                    Scan Site ⚡
                  </button>
                </div>
              </div>

              <div className="form-settings-row" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="setting-control">
                  <label htmlFor="max-pages">Max Pages to Crawl: <strong>{maxPages}</strong></label>
                  <input
                    id="max-pages"
                    type="range"
                    min="10"
                    max="4000"
                    step="50"
                    value={maxPages}
                    onChange={(e) => setMaxPages(parseInt(e.target.value))}
                  />
                  <div className="range-labels">
                    <span>10</span>
                    <span>2000</span>
                    <span>4000</span>
                  </div>
                </div>

                <div className="setting-control" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    id="check-external"
                    type="checkbox"
                    checked={checkExternal}
                    onChange={(e) => setCheckExternal(e.target.checked)}
                    style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                  />
                  <label htmlFor="check-external" style={{ margin: 0, fontWeight: 500, cursor: 'pointer', fontSize: '0.9rem' }}>
                    Verify Outbound Links (External Dead Link Checking)
                  </label>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* PAGE 2: Live Crawling Progress */}
        {page === 'crawling' && (
          <div className="crawling-page-layout glass-card animate-fade-in">
            <div className="crawling-header">
              <div className="crawler-spinner"></div>
              <h2>
                {crawlState.status === 'analyzing' 
                  ? 'Analyzing Duplicate Content...' 
                  : 'Crawling Website...'}
              </h2>
              <span className="crawling-target">{crawlState.targetUrl}</span>
            </div>

            <div className="progress-stats-grid">
              <div className="prog-stat-card">
                <span className="prog-label">Pages Crawled</span>
                <span className="prog-val">{crawlState.progress.crawledCount}</span>
              </div>
              <div className="prog-stat-card">
                <span className="prog-label">Pages in Queue</span>
                <span className="prog-val">{crawlState.progress.queueLength}</span>
              </div>
              <div className="prog-stat-card">
                <span className="prog-label">Total Pages Discovered</span>
                <span className="prog-val">{crawlState.progress.pagesFoundCount}</span>
              </div>
            </div>

            {/* Custom Progress Bar */}
            {crawlState.status === 'crawling' && (
              <div className="crawler-progress-bar-container">
                <div className="crawler-progress-bar-fill animate-pulse"></div>
              </div>
            )}

            {/* Terminal Logs */}
            <div className="terminal-logs-card">
              <div className="terminal-header">
                <span className="terminal-dot red"></span>
                <span className="terminal-dot yellow"></span>
                <span className="terminal-dot green"></span>
                <span className="terminal-title">Console Output Logs</span>
              </div>
              <div className="terminal-content">
                {logMessages.map((msg, idx) => (
                  <div key={idx} className="log-line">{msg}</div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>

            <div className="crawling-actions">
              <button className="cancel-btn" onClick={cancelCrawl}>
                Cancel Crawl 🛑
              </button>
            </div>
          </div>
        )}

        {/* PAGE 3: Results Dashboard */}
        {page === 'results' && (
          <div className="results-page-layout">
            {selectedPageUrl ? (
              /* Overlay detail page comparison view */
              <DuplicateDetail
                pageData={selectedPageData}
                pages={crawlState.pages}
                initialTab={pageDetailTab}
                onTabChange={(tab) => navigate(`/page?url=${encodeURIComponent(selectedPageUrl)}&tab=${tab}`)}
                onClose={handleDetailClose}
                onSelectPage={handleSelectPage}
                historyList={detailHistory}
                onGoBack={handleDetailBack}
              />
            ) : (
              /* Standard Dashboard Tab view */
              <>
                <div className="tabs-navigation glass-card">
                  <button
                    className={`nav-tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
                    onClick={() => navigate('/results/summary')}
                  >
                    📊 Summary Report
                  </button>
                  <button
                    className={`nav-tab-btn ${activeTab === 'duplicate' ? 'active' : ''}`}
                    onClick={() => navigate('/results/duplicate')}
                  >
                    🥞 Duplicate Content ({crawlState.summary ? crawlState.summary.avgDuplicatePercent : 0}%)
                  </button>
                  <button
                    className={`nav-tab-btn ${activeTab === 'pages' ? 'active' : ''}`}
                    onClick={() => navigate('/results/pages')}
                  >
                    📄 Pages ({crawlState.pages ? crawlState.pages.length : 0})
                  </button>
                  <button
                    className={`nav-tab-btn ${activeTab === 'broken' ? 'active' : ''}`}
                    onClick={() => navigate('/results/broken')}
                  >
                    ⚠️ Broken Internal ({crawlState.summary ? crawlState.summary.brokenInternalLinksCount : 0})
                  </button>
                  <button
                    className={`nav-tab-btn ${activeTab === 'broken-external' ? 'active' : ''}`}
                    onClick={() => navigate('/results/broken-external')}
                  >
                    🌐 Broken External ({crawlState.summary ? crawlState.summary.brokenExternalLinksCount : 0})
                  </button>
                  <button
                    className={`nav-tab-btn ${activeTab === 'eeat' ? 'active' : ''}`}
                    onClick={() => navigate('/results/eeat')}
                  >
                    🛡️ E-E-A-T Quality Audit
                  </button>
                  <button
                    className={`nav-tab-btn ${activeTab === 'onpage' ? 'active' : ''}`}
                    onClick={() => navigate('/results/onpage')}
                  >
                    🛠️ On-Page Technical SEO
                  </button>
                  <button
                    className={`nav-tab-btn ${activeTab === 'architecture' ? 'active' : ''}`}
                    onClick={() => navigate('/results/architecture')}
                  >
                    🕸️ Site Architecture & Silos
                  </button>
                  <button
                    className={`nav-tab-btn ${activeTab === 'aeo' ? 'active' : ''}`}
                    onClick={() => navigate('/results/aeo')}
                  >
                    🚀 AEO & Voice Search
                  </button>
                  <button
                    className={`nav-tab-btn ${activeTab === 'aiseo' ? 'active' : ''}`}
                    onClick={() => navigate('/results/aiseo')}
                  >
                    🤖 AI SEO & LLM Citations
                  </button>
                  <button
                    className={`nav-tab-btn ${activeTab === 'plan' ? 'active' : ''}`}
                    onClick={() => navigate('/results/plan')}
                  >
                    📅 90-Day SEO Action Plan
                  </button>
                </div>

                <div className="tab-content-area">
                  {activeTab === 'summary' && (
                    <Dashboard 
                      summary={crawlState.summary} 
                      nearDuplicates={crawlState.nearDuplicates}
                      pages={crawlState.pages}
                      onTabChange={(tab) => navigate(`/results/${tab}`)} 
                    />
                  )}

                  {activeTab === 'duplicate' && (
                    <DuplicateList 
                      pages={crawlState.pages} 
                      onSelectPage={handleSelectPage} 
                    />
                  )}

                  {activeTab === 'pages' && (
                    <PageList 
                      pages={crawlState.pages} 
                      onSelectPage={handleSelectPage} 
                    />
                  )}

                  {activeTab === 'eeat' && (
                    <EEATAudit 
                      pages={crawlState.pages} 
                      onSelectPage={handleSelectPage}
                    />
                  )}

                  {activeTab === 'onpage' && (
                    <OnPageSEO 
                      pages={crawlState.pages} 
                      onSelectPage={handleSelectPage}
                    />
                  )}

                  {activeTab === 'architecture' && (
                    <SiloAnalyzer 
                      pages={crawlState.pages} 
                      onSelectPage={handleSelectPage}
                    />
                  )}

                  {activeTab === 'aeo' && (
                    <AEOAudit 
                      pages={crawlState.pages} 
                      onSelectPage={handleSelectPage}
                    />
                  )}

                  {activeTab === 'aiseo' && (
                    <AISEO 
                      pages={crawlState.pages} 
                      onSelectPage={handleSelectPage}
                    />
                  )}

                  {activeTab === 'plan' && (
                    <SEOActionPlan 
                      pages={crawlState.pages} 
                    />
                  )}

                  {activeTab === 'broken' && (
                    <div className="broken-links-container glass-card animate-fade-in">
                      <h2>Broken Internal Links List</h2>
                      <p className="subtitle">
                        Below are links on your website pointing to pages that returned an HTTP error or failed to load.
                      </p>
                      
                      <div className="table-responsive mt-3">
                        <table className="pages-table">
                          <thead>
                            <tr>
                              <th>Source Page</th>
                              <th>Failed Link URL</th>
                              <th>Link HTML Text</th>
                              <th className="text-center">Response Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {!crawlState.summary || !crawlState.summary.brokenInternalLinks || crawlState.summary.brokenInternalLinks.length === 0 ? (
                              <tr>
                                <td colSpan="4" className="no-data success-text">
                                  🎉 No broken internal links found on this website!
                                </td>
                              </tr>
                            ) : (
                              crawlState.summary.brokenInternalLinks.map((link, idx) => (
                                <tr key={idx} className="broken-row">
                                  <td>
                                    <button 
                                      className="link-style-btn" 
                                      onClick={() => handleSelectPage(link.sourceUrl)}
                                      title="View source page details"
                                    >
                                      {link.sourceUrl}
                                    </button>
                                  </td>
                                  <td className="url-cell" title={link.targetUrl}>
                                    <a href={link.targetUrl} target="_blank" rel="noopener noreferrer" className="broken-target-link">
                                      {link.targetUrl} ↗
                                    </a>
                                  </td>
                                  <td className="code-text"><code>{link.rawHref}</code></td>
                                  <td className="text-center">
                                    <span className="status-badge status-error">
                                      {link.status === 0 ? 'Network Error' : link.status}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {activeTab === 'broken-external' && (
                    <div className="broken-links-container glass-card animate-fade-in">
                      <h2>Broken External Links List</h2>
                      <p className="subtitle">
                        Below are outbound links pointing to external sites that timed out, returned an HTTP error, or failed to resolve.
                      </p>
                      
                      <div className="table-responsive mt-3">
                        <table className="pages-table">
                          <thead>
                            <tr>
                              <th>Source Page</th>
                              <th>Failed External URL</th>
                              <th>Link HTML Text</th>
                              <th className="text-center">Response Status/Error</th>
                            </tr>
                          </thead>
                          <tbody>
                            {!crawlState.summary || !crawlState.summary.brokenExternalLinks || crawlState.summary.brokenExternalLinks.length === 0 ? (
                              <tr>
                                <td colSpan="4" className="no-data success-text">
                                  🎉 No broken outbound external links found!
                                </td>
                              </tr>
                            ) : (
                              crawlState.summary.brokenExternalLinks.map((link, idx) => (
                                <tr key={idx} className="broken-row">
                                  <td>
                                    <button 
                                      className="link-style-btn" 
                                      onClick={() => handleSelectPage(link.sourceUrl)}
                                      title="View source page details"
                                    >
                                      {link.sourceUrl}
                                    </button>
                                  </td>
                                  <td className="url-cell" title={link.targetUrl}>
                                    <a href={link.targetUrl} target="_blank" rel="noopener noreferrer" className="broken-target-link">
                                      {link.targetUrl} ↗
                                    </a>
                                  </td>
                                  <td className="code-text"><code>{link.rawHref}</code></td>
                                  <td className="text-center">
                                    <span className="status-badge status-error">
                                      {link.status === 0 ? `Error / ${link.error}` : link.status}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
