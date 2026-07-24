import React, { useState, useMemo } from 'react';

export default function PageList({ pages = [], onSelectPage }) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, duplicated, errors
  const [minDuplicate, setMinDuplicate] = useState(0);
  const [selectedSubdir, setSelectedSubdir] = useState('');
  const [sortField, setSortField] = useState('duplicatePercent');
  const [sortAsc, setSortAsc] = useState(false);

  const safePages = useMemo(() => {
    return pages || [];
  }, [pages]);

  // Dynamically extract unique top-level directories for intelligent filtering
  const subdirectories = useMemo(() => {
    const dirs = new Set();
    safePages.forEach(p => {
      try {
        const url = new URL(p.url);
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length > 0) {
          dirs.add('/' + parts[0]);
        }
      } catch (e) {}
    });
    return ['', ...dirs];
  }, [safePages]);

  // Filter pages safely
  const filteredPages = useMemo(() => {
    return safePages.filter(page => {
      if (!page) return false;
      
      const url = page.url || '';
      const title = page.title || '';
      
      const matchesSearch = 
        url.toLowerCase().includes(search.toLowerCase()) ||
        title.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      // Filter by Min Duplicate Percent Slider
      if ((page.duplicatePercent || 0) < minDuplicate) return false;

      // Filter by Subdirectory
      if (selectedSubdir) {
        try {
          const urlObj = new URL(page.url);
          if (!urlObj.pathname.startsWith(selectedSubdir)) {
            return false;
          }
        } catch (e) {
          return false;
        }
      }

      if (filterType === 'duplicated') {
        return (page.duplicatePercent || 0) > 10;
      }
      if (filterType === 'errors') {
        return page.status === 0 || page.status >= 300 || !page.status;
      }
      return true;
    });
  }, [safePages, search, filterType, minDuplicate, selectedSubdir]);

  // Sort pages safely
  const sortedPages = useMemo(() => {
    const sorted = [...filteredPages];
    sorted.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      
      const aString = String(aVal).toLowerCase();
      const bString = String(bVal).toLowerCase();
      
      return sortAsc 
        ? aString.localeCompare(bString)
        : bString.localeCompare(aString);
    });
    return sorted;
  }, [filteredPages, sortField, sortAsc]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return '↕️';
    return sortAsc ? '▲' : '▼';
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 KB';
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const getDuplicateClass = (pct) => {
    const value = pct || 0;
    if (value >= 50) return 'txt-high-dup';
    if (value >= 20) return 'txt-mid-dup';
    return 'txt-low-dup';
  };

  const getStatusClass = (status) => {
    if (!status) return 'status-error';
    if (status >= 200 && status < 300) return 'status-success';
    if (status >= 300 && status < 400) return 'status-redirect';
    return 'status-error';
  };

  const handleExportCSV = (e) => {
    e.stopPropagation();
    const headers = ['Page URL', 'Title', 'Duplicate %', 'Common %', 'Unique %', 'Words', 'Est. Reading Time (min)', 'Size (Bytes)', 'Load Time (ms)', 'HTTP Status'];
    const rows = sortedPages.map(page => {
      const readingTime = Math.ceil((page.wordCount || 0) / 200);
      return [
        `"${page.url}"`,
        `"${(page.title || '').replace(/"/g, '""')}"`,
        page.duplicatePercent || 0,
        page.commonPercent || 0,
        page.uniquePercent || 0,
        page.wordCount || 0,
        readingTime,
        page.sizeBytes || 0,
        page.loadTimeMs || 0,
        page.status || 0
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `seointel_report_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-list-container glass-card animate-fade-in">
      <div className="list-controls">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search pages by URL or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button className="clear-btn" onClick={() => setSearch('')}>×</button>}
        </div>

        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All Pages ({safePages.length})
          </button>
          <button 
            className={`filter-tab ${filterType === 'duplicated' ? 'active' : ''}`}
            onClick={() => setFilterType('duplicated')}
          >
            Duplicated ({safePages.filter(p => (p.duplicatePercent || 0) > 10).length})
          </button>
          <button 
            className={`filter-tab ${filterType === 'errors' ? 'active' : ''}`}
            onClick={() => setFilterType('errors')}
          >
            Skipped/Errors ({safePages.filter(p => !p.status || p.status === 0 || p.status >= 300).length})
          </button>
        </div>
      </div>

      {/* Slider, Directory and Export Action Row */}
      <div className="controls-sub-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1.25rem 0', gap: '1.5rem', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.25rem' }}>
        <div className="dup-slider-container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 2, minWidth: '260px' }}>
          <label htmlFor="dup-slider" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Min Duplication: <strong>{minDuplicate}%</strong>
          </label>
          <input
            id="dup-slider"
            type="range"
            min="0"
            max="100"
            step="5"
            value={minDuplicate}
            onChange={(e) => setMinDuplicate(parseInt(e.target.value))}
            style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--color-warning)' }}
          />
          {minDuplicate > 0 && (
            <button 
              className="clear-btn" 
              onClick={() => setMinDuplicate(0)}
              style={{ padding: '0.2rem 0.6rem', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', border: '1px solid var(--border-light)', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-main)' }}
            >
              Reset
            </button>
          )}
        </div>

        {/* Intelligent Subdirectory Dropdown */}
        {subdirectories.length > 2 && (
          <div className="subdir-filter-container" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="subdir-select" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              📁 Path Section:
            </label>
            <select
              id="subdir-select"
              value={selectedSubdir}
              onChange={(e) => setSelectedSubdir(e.target.value)}
              style={{
                padding: '0.4rem 0.75rem',
                background: 'var(--bg-card)',
                color: 'var(--text-dark)',
                border: '1px solid var(--border-light)',
                borderRadius: '6px',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="">All Subdirectories</option>
              {subdirectories.filter(Boolean).map(dir => (
                <option key={dir} value={dir}>{dir}/</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button 
            className="export-csv-btn" 
            onClick={handleExportCSV}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.55rem 1.1rem',
              background: 'linear-gradient(135deg, var(--color-success) 0%, rgba(16, 185, 129, 0.7) 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.85rem',
              boxShadow: '0 4px 12px var(--color-success-glow)',
              transition: 'var(--transition-smooth)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
          >
            📥 CSV Report
          </button>
          
          <button 
            className="export-pdf-btn" 
            onClick={() => window.print()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.55rem 1.1rem',
              background: 'linear-gradient(135deg, var(--color-primary) 0%, rgba(59, 130, 246, 0.7) 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.85rem',
              boxShadow: '0 4px 12px var(--color-primary-glow)',
              transition: 'var(--transition-smooth)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
          >
            📄 PDF Report
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="pages-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('url')}>Page URL {getSortIcon('url')}</th>
              <th onClick={() => handleSort('title')}>Title {getSortIcon('title')}</th>
              <th onClick={() => handleSort('pagePower')} className="text-center">Page Power {getSortIcon('pagePower')}</th>
              <th onClick={() => handleSort('duplicatePercent')} className="text-right">Duplicate % {getSortIcon('duplicatePercent')}</th>
              <th onClick={() => handleSort('commonPercent')} className="text-right">Common % {getSortIcon('commonPercent')}</th>
              <th onClick={() => handleSort('wordCount')} className="text-right">Words {getSortIcon('wordCount')}</th>
              <th onClick={() => handleSort('sizeBytes')} className="text-right">Size {getSortIcon('sizeBytes')}</th>
              <th onClick={() => handleSort('loadTimeMs')} className="text-right">Load Time {getSortIcon('loadTimeMs')}</th>
              <th onClick={() => handleSort('status')} className="text-center">Status {getSortIcon('status')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedPages.length === 0 ? (
              <tr>
                <td colSpan="9" className="no-data">No pages match the active filters.</td>
              </tr>
            ) : (
              sortedPages.map((page) => (
                <tr key={page.url} className="page-row" onClick={() => onSelectPage && onSelectPage(page.url)}>
                  <td className="url-cell" title={page.url}>
                    <span className="url-text">{page.url || ''}</span>
                  </td>
                  <td className="title-cell" title={page.title || ''}>{page.title || ''}</td>
                  <td className="text-center">
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>{page.pagePower || 10}</span>
                      <div style={{ width: '40px', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                        <div style={{ width: `${page.pagePower || 10}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #0066cc)' }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right font-semibold">
                    <span className={getDuplicateClass(page.duplicatePercent)}>
                      {page.duplicatePercent || 0}%
                    </span>
                  </td>
                  <td className="text-right font-semibold text-primary">
                    {page.commonPercent || 0}%
                  </td>
                  <td className="text-right">{(page.wordCount || 0).toLocaleString()}</td>
                  <td className="text-right">{formatSize(page.sizeBytes)}</td>
                  <td className="text-right">{page.loadTimeMs || 0} ms</td>
                  <td className="text-center">
                    <span className={`status-badge ${getStatusClass(page.status)}`}>
                      {page.status === 0 || !page.status ? 'Network Error' : page.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
