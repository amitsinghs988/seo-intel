import { useState, useMemo } from 'react';

export default function DuplicateList({ pages = [], onSelectPage }) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('duplicatePercent');
  const [sortAsc, setSortAsc] = useState(false);

  const safePages = useMemo(() => {
    return pages || [];
  }, [pages]);

  // Process pages to extract match pages count
  const processedPages = useMemo(() => {
    return safePages.map(page => {
      const matchPages = new Set();
      (page.blocks || []).forEach(block => {
        if (block.type !== 'common' && block.matches) {
          block.matches.forEach(m => matchPages.add(m));
        }
      });

      return {
        ...page,
        matchPagesCount: matchPages.size
      };
    }).filter(page => (page.duplicatePercent || 0) > 0 || (page.commonPercent || 0) > 0 || (page.blocks && page.blocks.length > 0));
  }, [safePages]);

  // Filtered pages
  const filteredPages = useMemo(() => {
    return processedPages.filter(page => {
      const url = page.url || '';
      const title = page.title || '';
      return url.toLowerCase().includes(search.toLowerCase()) || title.toLowerCase().includes(search.toLowerCase());
    });
  }, [processedPages, search]);

  // Sorted pages
  const sortedPages = useMemo(() => {
    const sorted = [...filteredPages];
    sorted.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (aVal === undefined || aVal === null) aVal = 0;
      if (bVal === undefined || bVal === null) bVal = 0;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return sortAsc 
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
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

  const handleExportCSV = (e) => {
    e.stopPropagation();
    const headers = ['URL', 'Title', 'Match Words', 'Match Percentage', 'Match Pages', 'Page Power'];
    const rows = sortedPages.map(p => [
      `"${p.url}"`,
      `"${(p.title || 'Untitled Page').replace(/"/g, '""')}"`,
      p.duplicateWordCount || 0,
      `${p.duplicatePercent || 0}%`,
      p.matchPagesCount || 0,
      p.pagePower || 10
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `seointel_duplicate_table_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="duplicate-list-container glass-card animate-fade-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Title & Instructions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-dark)' }}>Duplicate Content Report</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            To see your duplicate content highlighted on the page, click on any row in the table below:
          </p>
        </div>
        
        <button
          onClick={handleExportCSV}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.45rem 1rem',
            background: 'linear-gradient(135deg, var(--color-success) 0%, rgba(16, 185, 129, 0.7) 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          📥 Export Table (CSV)
        </button>
      </div>

      {/* Search Filter */}
      <div className="search-bar" style={{ maxWidth: '400px', margin: 0 }}>
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Search by title or URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && <button className="clear-btn" onClick={() => setSearch('')}>×</button>}
      </div>

      {/* Main Table */}
      <div className="table-responsive">
        <table className="pages-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th onClick={() => handleSort('url')} style={{ textAlign: 'left', padding: '0.75rem' }}>
                URL & Title {getSortIcon('url')}
              </th>
              <th onClick={() => handleSort('duplicateWordCount')} style={{ textAlign: 'center', padding: '0.75rem', width: '120px' }}>
                Match Words {getSortIcon('duplicateWordCount')}
              </th>
              <th onClick={() => handleSort('duplicatePercent')} style={{ textAlign: 'center', padding: '0.75rem', width: '150px' }}>
                Match Percentage {getSortIcon('duplicatePercent')}
              </th>
              <th onClick={() => handleSort('matchPagesCount')} style={{ textAlign: 'center', padding: '0.75rem', width: '120px' }}>
                Match Pages {getSortIcon('matchPagesCount')}
              </th>
              <th onClick={() => handleSort('pagePower')} style={{ textAlign: 'center', padding: '0.75rem', width: '120px' }}>
                Page Power {getSortIcon('pagePower')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPages.length === 0 ? (
              <tr>
                <td colSpan="5" className="no-data" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No duplicate content detected for this crawl session.
                </td>
              </tr>
            ) : (
              sortedPages.map(page => (
                <tr 
                  key={page.url} 
                  className="page-row" 
                  onClick={() => onSelectPage(page.url, 'duplicate')}
                  style={{ borderBottom: '1px solid var(--border-light)' }}
                >
                  <td style={{ padding: '0.75rem', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {page.url}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {page.title || 'Untitled Page'}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>
                    {page.duplicateWordCount || 0}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                      <div style={{ flex: 1, height: '6px', background: 'rgba(0,0,0,0.06)', borderRadius: '3px', maxWidth: '60px' }}>
                        <div style={{
                          width: `${page.duplicatePercent || 0}%`,
                          height: '100%',
                          background: 'var(--color-warning)',
                          borderRadius: '3px'
                        }}></div>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-warning)' }}>
                        {page.duplicatePercent || 0}%
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-main)' }}>
                    {page.matchPagesCount}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <span className="status-badge" style={{ background: 'rgba(59, 130, 246, 0.08)', color: '#2563eb', fontWeight: 700, fontSize: '0.8rem' }}>
                      {page.pagePower || 10}
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
