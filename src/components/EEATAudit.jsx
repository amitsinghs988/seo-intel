import { useState, useMemo } from 'react';

/**
 * Calculates detailed E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)
 * scores and actionable recommendations for a given page.
 */
export function calculatePageEEAT(page) {
  if (!page) page = {};
  const text = page.text || '';
  const url = page.url || '';
  const schemas = page.schemas || [];
  const links = page.links || [];

  // 1. EXPERIENCE SCORE (0 - 25)
  let experienceScore = 0;
  const firstPersonPronouns = (text.match(/\b(I|we|our|my|me|us|ours|myself)\b/gi) || []).length;
  if (firstPersonPronouns > 12) experienceScore += 12;
  else if (firstPersonPronouns > 4) experienceScore += 8;
  else if (firstPersonPronouns > 0) experienceScore += 4;

  const experienceKeywords = (text.match(/\b(case study|behind-the-scenes|original research|tested|hands-on|my experience|our team|we tested)\b/gi) || []).length;
  if (experienceKeywords > 0) experienceScore += 8;
  
  const hasVideoOrImages = (text.match(/\b(video|watch|photo|screenshot|recording|listen)\b/gi) || []).length;
  if (hasVideoOrImages > 0) experienceScore += 5;

  // 2. EXPERTISE SCORE (0 - 25)
  let expertiseScore = 0;
  if (schemas.length > 0) expertiseScore += 10; // Structured Schema
  
  const credentialsKeywords = (text.match(/\b(certified|degree|qualification|licensed|credentials|specialist|expert|accredited|ph\.?d|m\.?d|d\.?d\.?s|professor|engineer)\b/gi) || []).length;
  if (credentialsKeywords > 1) expertiseScore += 10;
  else if (credentialsKeywords > 0) expertiseScore += 5;

  // Check if there is an author bio linkage in text or links
  const hasAuthorLink = links.some(l => /author|bio|profile|team|about/i.test(l.resolved)) || /\b(author bio|about the author|written by)\b/i.test(text);
  if (hasAuthorLink) expertiseScore += 5;

  // 3. AUTHORITATIVENESS SCORE (0 - 25)
  let authoritativenessScore = 0;
  const externalLinks = links.filter(l => l.isExternal);
  if (externalLinks.length >= 3) authoritativenessScore += 10;
  else if (externalLinks.length >= 1) authoritativenessScore += 5;

  const hasAuthoritativeOutbound = externalLinks.some(l => /\.gov|\.edu|wikipedia\.org/i.test(l.resolved));
  if (hasAuthoritativeOutbound) authoritativenessScore += 10;

  const structureH1 = page.h1Count === 1;
  if (structureH1) authoritativenessScore += 5;

  // 4. TRUSTWORTHINESS SCORE (0 - 25)
  let trustworthinessScore = 0;
  const isHttps = url.startsWith('https:');
  if (isHttps) trustworthinessScore += 10;

  const hasTrustPages = links.some(l => /privacy|terms|legal|disclaimer/i.test(l.resolved)) || /\b(privacy policy|terms of service|terms & conditions)\b/i.test(text);
  if (hasTrustPages) trustworthinessScore += 5;

  const hasContactPages = links.some(l => /contact|support/i.test(l.resolved)) || /\b(contact us|get in touch)\b/i.test(text);
  if (hasContactPages) trustworthinessScore += 5;

  // Phone / Email / Address presence (NAP)
  const hasPhone = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(text);
  const hasEmail = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(text);
  const hasAddress = /\b(street|suite|avenue|road|building|zip code|city)\b/i.test(text);
  if (hasPhone || hasEmail || hasAddress) trustworthinessScore += 5;

  const totalScore = experienceScore + expertiseScore + authoritativenessScore + trustworthinessScore;

  // Determine Quality Rating Label
  let rating = 'Critical';
  let ratingColor = 'text-danger';
  if (totalScore >= 80) {
    rating = 'High (Excellent Trust)';
    ratingColor = 'text-success';
  } else if (totalScore >= 60) {
    rating = 'Medium (Good Trust)';
    ratingColor = 'text-warning';
  } else if (totalScore >= 40) {
    rating = 'Low (Needs Audit)';
    ratingColor = 'text-warning';
  }

  // Compile actionable checklist recomendations
  const recommendations = [];
  if (!isHttps) {
    recommendations.push({
      pillar: 'Trustworthiness',
      text: 'Install SSL Certificate (upgrade from HTTP to HTTPS)',
      impact: 'High',
      desc: 'SSL is a foundational ranking signal and guarantees security for user interactions.'
    });
  }
  if (schemas.length === 0) {
    recommendations.push({
      pillar: 'Expertise',
      text: 'Add JSON-LD Schema (e.g., Person, Author, LocalBusiness)',
      impact: 'High',
      desc: 'Schema markups feed AI search engines (GEO/AEO) with structured entity connections.'
    });
  }
  if (credentialsKeywords === 0) {
    recommendations.push({
      pillar: 'Expertise',
      text: 'Showcase author credentials & qualifications',
      impact: 'Medium',
      desc: 'Display professional suffixes (MD, PhD, DDS, Certified) directly on screen to establish credibility.'
    });
  }
  if (firstPersonPronouns === 0) {
    recommendations.push({
      pillar: 'Experience',
      text: 'Incorporate first-person experience indicators',
      impact: 'Medium',
      desc: 'Share personal stories, product tests, or behind-the-scenes logs using words like "we tested" or "my experience".'
    });
  }
  if (!hasAuthoritativeOutbound) {
    recommendations.push({
      pillar: 'Authoritativeness',
      text: 'Add authoritative citations (.edu, .gov, Wikipedia)',
      impact: 'Medium',
      desc: 'Linking to neutral, high-quality reference points proves domain facts are grounded and verified.'
    });
  }
  if (!hasTrustPages) {
    recommendations.push({
      pillar: 'Trustworthiness',
      text: 'Link to site Privacy Policy & Terms of Service',
      impact: 'High',
      desc: 'Legal policies prove corporate transparency and protect user rights.'
    });
  }
  if (!(hasPhone || hasEmail || hasAddress)) {
    recommendations.push({
      pillar: 'Trustworthiness',
      text: 'Publish NAP (Name, Address, Phone) details',
      impact: 'Medium',
      desc: 'Local search engines audit contact elements to verify active brick-and-mortar operations.'
    });
  }
  if (!hasContactPages) {
    recommendations.push({
      pillar: 'Trustworthiness',
      text: 'Provide direct link to Contact page',
      impact: 'Medium',
      desc: 'Easy communication access signals a reliable business model.'
    });
  }

  return {
    url,
    title: page.title || 'Untitled Page',
    score: totalScore,
    rating,
    ratingColor,
    pillars: {
      experience: experienceScore,
      expertise: expertiseScore,
      authority: authoritativenessScore,
      trust: trustworthinessScore
    },
    audits: recommendations,
    recommendations,
    signals: {
      firstPersonCount: firstPersonPronouns,
      schemasFound: schemas,
      outboundCount: externalLinks.length,
      isHttps,
      credentialsKeywords
    }
  };
}

/**
 * Generates custom copy-pasteable HTML or JSON-LD schema snippets to resolve
 * specific E-E-A-T warnings dynamically based on url and title.
 */
export function generateEEATFixSnippet(recType, url, title) {
  let host = 'example.com';
  let siteName = 'Our Brand';
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    siteName = host.replace('www.', '').split('.')[0];
    siteName = siteName.charAt(0).toUpperCase() + siteName.slice(1);
  } catch (e) {}

  switch (recType) {
    case 'Add JSON-LD Schema (e.g., Person, Author, LocalBusiness)':
      return {
        lang: 'json',
        code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "${title.replace(/"/g, '\\"')}",
  "url": "${url}",
  "datePublished": "${new Date().toISOString().split('T')[0]}",
  "author": {
    "@type": "Person",
    "name": "Dr. Alex Carter, PhD",
    "jobTitle": "Lead Industry Specialist",
    "sameAs": [
      "https://www.linkedin.com/in/username"
    ]
  },
  "publisher": {
    "@type": "Organization",
    "name": "${siteName}",
    "logo": {
      "@type": "ImageObject",
      "url": "https://${host}/assets/logo.png"
    }
  }
}
</script>`
      };

    case 'Showcase author credentials & qualifications':
      return {
        lang: 'html',
        code: `<div class="author-bio-card" style="border: 1px solid #cbd5e1; padding: 1.25rem; border-radius: 8px; margin: 1.5rem 0; display: flex; gap: 1.25rem; align-items: center; background: rgba(0,0,0,0.01);">
  <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150" alt="Author" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover;" />
  <div>
    <h4 style="margin: 0; font-size: 1rem; color: #0f172a;">Written by Dr. Alex Carter, PhD</h4>
    <p style="margin: 0.2rem 0 0 0; font-size: 0.85rem; color: #475569; line-height: 1.4;">Dr. Carter is a certified authority in ${siteName} systems with 10+ years of research. Reviewed and fact-checked by our professional advisory board.</p>
  </div>
</div>`
      };

    case 'Incorporate first-person experience indicators':
      return {
        lang: 'html',
        code: `<p style="font-style: italic; border-left: 3px solid #0066cc; padding-left: 0.75rem; color: #475569; margin: 1.5rem 0; font-size: 0.9rem; line-height: 1.5;">
  <strong>Our Editorial Process:</strong> To write this guide, our editorial team personally audited these metrics and verified standard parameters first-hand. We reviewed performance variables, duplicate content thresholds, and AEO/GEO indexing rules to publish authentic recommendations.
</p>`
      };

    case 'Add authoritative citations (.edu, .gov, Wikipedia)':
      return {
        lang: 'html',
        code: `<!-- Add this citation footer to verify data reference sources -->
<div class="page-citations" style="margin-top: 2rem; border-top: 1px dashed #cbd5e1; padding-top: 1rem; font-size: 0.8rem; color: #64748b;">
  <strong>Reference Sources & Citations:</strong>
  <ul style="margin: 0.25rem 0 0 0; padding-left: 1.25rem; line-height: 1.5;">
    <li><a href="https://en.wikipedia.org/wiki/Search_engine_optimization" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">SEO Architecture (Wikipedia)</a></li>
    <li><a href="https://www.w3.org/standards/" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; margin-left: 0.25rem;">W3C Web Core Guidelines (.org)</a></li>
  </ul>
</div>`
      };

    case 'Link to site Privacy Policy & Terms of Service':
      return {
        lang: 'html',
        code: `<!-- Include this navigation block in your global footer links -->
<footer style="margin-top: 3rem; text-align: center; font-size: 0.8rem; color: #64748b;">
  <span style="margin: 0 0.75rem;">© ${new Date().getFullYear()} ${siteName}. All rights reserved.</span>
  <a href="/privacy-policy" style="color: #2563eb; text-decoration: underline; margin-right: 0.75rem;">Privacy Policy</a> |
  <a href="/terms-of-service" style="color: #2563eb; text-decoration: underline; margin-left: 0.75rem;">Terms of Service</a>
</footer>`
      };

    case 'Publish NAP (Name, Address, Phone) details':
      return {
        lang: 'html',
        code: `<!-- Add this local business NAP card to your website contact page or footer -->
<div class="business-contact-card" style="border: 1px solid #cbd5e1; padding: 1.25rem; border-radius: 8px; background: rgba(0,0,0,0.01); max-width: 320px; font-size: 0.85rem; color: #475569;">
  <strong style="color: #0f172a; display: block; margin-bottom: 0.4rem;">${siteName} Headquarters</strong>
  <div style="margin-bottom: 0.25rem;">📍 100 Main Street, Suite 4B, Cityville, NY 10001</div>
  <div style="margin-bottom: 0.25rem;">📞 Phone: (555) 019-2834</div>
  <div>✉ Email: team@${host}</div>
</div>`
      };

    case 'Provide direct link to Contact page':
      return {
        lang: 'html',
        code: `<p style="font-size: 0.85rem; margin-top: 1.5rem;">
  Questions or inquiries? Access our <a href="/contact" style="color: #2563eb; text-decoration: underline; font-weight: bold;">Contact Support Page</a> to get in touch with our certified engineers.
</p>`
      };

    default:
      return {
        lang: 'text',
        code: `Action Plan for ${title}: Add custom topic-relevant content to verify your credentials, experience, and transparent contact methods.`
      };
  }
}

export default function EEATAudit({ pages = [], onSelectPage }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [pillarFilter, setPillarFilter] = useState('all'); // all, high, medium, low
  const [selectedAuditPage, setSelectedAuditPage] = useState(null);
  const [openFixIndex, setOpenFixIndex] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleClosePageModal = () => {
    setSelectedAuditPage(null);
    setOpenFixIndex(null);
    setCopiedIndex(null);
  };

  // Compute stats for all pages
  const auditedPages = useMemo(() => {
    return pages.map(page => calculatePageEEAT(page));
  }, [pages]);

  // Aggregate Site-Wide Statistics
  const stats = useMemo(() => {
    if (auditedPages.length === 0) return { avg: 0, high: 0, med: 0, low: 0, crit: 0 };
    let sum = 0;
    let high = 0;
    let med = 0;
    let low = 0;
    let crit = 0;

    auditedPages.forEach(p => {
      sum += p.score;
      if (p.score >= 80) high++;
      else if (p.score >= 60) med++;
      else if (p.score >= 40) low++;
      else crit++;
    });

    return {
      avg: Math.round(sum / auditedPages.length),
      high,
      med,
      low,
      crit
    };
  }, [auditedPages]);

  // Filtered pages for the table
  const filteredPages = useMemo(() => {
    return auditedPages.filter(p => {
      const matchesSearch = p.url.toLowerCase().includes(searchTerm.toLowerCase()) || p.title.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (pillarFilter === 'high') return p.score >= 80;
      if (pillarFilter === 'medium') return p.score >= 60 && p.score < 80;
      if (pillarFilter === 'low') return p.score >= 40 && p.score < 60;
      if (pillarFilter === 'critical') return p.score < 40;
      return true;
    });
  }, [auditedPages, searchTerm, pillarFilter]);

  return (
    <div className="eeat-audit-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Overview Cards Grid */}
      <div className="eeat-dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        
        <div className="eeat-card glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem' }}>
          <div className="eeat-dial" style={{
            position: 'relative',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: `conic-gradient(${stats.avg >= 60 ? 'var(--color-success)' : 'var(--color-warning)'} ${stats.avg * 3.6}deg, rgba(0,0,0,0.1) 0deg)`,
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
              {stats.avg >= 75 ? 'Strong Authority' : stats.avg >= 55 ? 'Moderate Trust' : 'Needs Optimization'}
            </span>
          </div>
        </div>

        <div className="eeat-card glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Trust Distribution</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span>High Trust (80-100):</span>
              <strong className="text-success">{stats.high} pages</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span>Medium Trust (60-79):</span>
              <strong className="text-info">{stats.med} pages</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span>Improvement Needed:</span>
              <strong className="text-warning">{stats.low + stats.crit} pages</strong>
            </div>
          </div>
        </div>

        <div className="eeat-card glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Core Signals Found</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem' }}>
            <div>🔒 SSL Enabled Pages: <strong>{pages.filter(p => (p.url || '').startsWith('https:')).length}</strong></div>
            <div>🏷️ Pages with JSON-LD Schema: <strong>{pages.filter(p => p.schemas && p.schemas.length > 0).length}</strong></div>
            <div>🎓 Expert Credentials Mentioned: <strong>{pages.filter(p => p.text && /\b(certified|degree|expert|phd|md|dds)\b/i.test(p.text)).length}</strong></div>
          </div>
        </div>

      </div>

      {/* Interactive Controls & Filters */}
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
              onClick={() => setPillarFilter('all')}
              className={`nav-tab-btn ${pillarFilter === 'all' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              All Pages ({auditedPages.length})
            </button>
            <button
              onClick={() => setPillarFilter('high')}
              className={`nav-tab-btn ${pillarFilter === 'high' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              🟢 High Trust ({stats.high})
            </button>
            <button
              onClick={() => setPillarFilter('medium')}
              className={`nav-tab-btn ${pillarFilter === 'medium' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              🟡 Medium Trust ({stats.med})
            </button>
            <button
              onClick={() => setPillarFilter('low')}
              className={`nav-tab-btn ${pillarFilter === 'low' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              🟠 Low Trust ({stats.low})
            </button>
            <button
              onClick={() => setPillarFilter('critical')}
              className={`nav-tab-btn ${pillarFilter === 'critical' ? 'active' : ''}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              🔴 Critical ({stats.crit})
            </button>
          </div>

        </div>

        {/* Audited Pages Table */}
        <div className="table-responsive" style={{ marginTop: '1.25rem' }}>
          <table className="pages-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Page URL & Title</th>
                <th style={{ textAlign: 'center', padding: '0.75rem', width: '130px' }}>E-E-A-T Score</th>
                <th style={{ textAlign: 'center', padding: '0.75rem', width: '160px' }}>Quality Rating</th>
                <th style={{ textAlign: 'center', padding: '0.75rem', width: '100px' }}>Signals</th>
                <th style={{ textAlign: 'center', padding: '0.75rem', width: '110px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPages.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No audited pages matched your search or filters.
                  </td>
                </tr>
              ) : (
                filteredPages.map(page => (
                  <tr key={page.url} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '0.75rem', maxWidth: '380px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)' }}>{page.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{page.url}</div>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                        <div style={{ flex: 1, height: '6px', background: 'rgba(0,0,0,0.1)', borderRadius: '3px', maxWidth: '60px' }}>
                          <div style={{
                            width: `${page.score}%`,
                            height: '100%',
                            background: page.score >= 80 ? 'var(--color-success)' : page.score >= 60 ? '#10b981' : '#f59e0b',
                            borderRadius: '3px'
                          }}></div>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{page.score}/100</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span className={`status-badge ${page.score >= 80 ? 'badge-success' : page.score >= 60 ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                        {page.rating}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem' }}>
                        <span title={`Experience Score: ${page.pillars.experience}/25`}>👉 {page.pillars.experience}</span>
                        <span title={`Expertise Score: ${page.pillars.expertise}/25`}>🎓 {page.pillars.expertise}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <button
                        onClick={() => onSelectPage(page.url, 'eeat')}
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
                        Inspect Audit 🔍
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Page Audit Recommendation Modal */}
      {selectedAuditPage && (
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
              onClick={handleClosePageModal}
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
                Page E-E-A-T Quality Audit
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedAuditPage.url}
              </p>
            </div>

            {/* Score Ring Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', background: 'rgba(0,0,0,0.03)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: selectedAuditPage.score >= 60 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {selectedAuditPage.score}
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>EEAT Score</span>
                <span className={`status-badge ${selectedAuditPage.score >= 80 ? 'badge-success' : selectedAuditPage.score >= 60 ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>
                  {selectedAuditPage.rating}
                </span>
              </div>

              {/* Pillars breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                    <span>Experience (Personal Proof):</span>
                    <span>{selectedAuditPage.pillars.experience}/25</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(0,0,0,0.1)', borderRadius: '2px', marginTop: '0.15rem' }}>
                    <div style={{ width: `${(selectedAuditPage.pillars.experience / 25) * 100}%`, height: '100%', background: '#3b82f6', borderRadius: '2px' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                    <span>Expertise (Credentials & Bios):</span>
                    <span>{selectedAuditPage.pillars.expertise}/25</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(0,0,0,0.1)', borderRadius: '2px', marginTop: '0.15rem' }}>
                    <div style={{ width: `${(selectedAuditPage.pillars.expertise / 25) * 100}%`, height: '100%', background: '#10b981', borderRadius: '2px' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                    <span>Authoritativeness (Outbound Citations):</span>
                    <span>{selectedAuditPage.pillars.authority}/25</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(0,0,0,0.1)', borderRadius: '2px', marginTop: '0.15rem' }}>
                    <div style={{ width: `${(selectedAuditPage.pillars.authority / 25) * 100}%`, height: '100%', background: '#f59e0b', borderRadius: '2px' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                    <span>Trustworthiness (SSL & Legal Policies):</span>
                    <span>{selectedAuditPage.pillars.trust}/25</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(0,0,0,0.1)', borderRadius: '2px', marginTop: '0.15rem' }}>
                    <div style={{ width: `${(selectedAuditPage.pillars.trust / 25) * 100}%`, height: '100%', background: '#ef4444', borderRadius: '2px' }}></div>
                  </div>
                </div>
              </div>

            </div>

            {/* Core page audit logs */}
            <div>
              <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem 0', color: 'var(--text-dark)' }}>Audited Page Signals</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '0.5rem', borderRadius: '6px' }}>
                  🔒 SSL Connection: <strong>{selectedAuditPage.signals.isHttps ? 'HTTPS (Secure)' : 'HTTP (Insecure)'}</strong>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '0.5rem', borderRadius: '6px' }}>
                  🏷️ JSON-LD Schema: <strong>{selectedAuditPage.signals.schemasFound.length > 0 ? selectedAuditPage.signals.schemasFound.join(', ') : 'None Detected'}</strong>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '0.5rem', borderRadius: '6px' }}>
                  ✍️ First-person Pronouns: <strong>{selectedAuditPage.signals.firstPersonCount} found</strong>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '0.5rem', borderRadius: '6px' }}>
                  🎓 Credential Keywords: <strong>{selectedAuditPage.signals.credentialsKeywords} found</strong>
                </div>
              </div>
            </div>

            {/* Checklist recommendations */}
            <div>
              <h3 style={{ fontSize: '1rem', margin: '0 0 0.75rem 0', color: 'var(--text-dark)' }}>
                Actionable Recommendations {(selectedAuditPage.recommendations || selectedAuditPage.audits || []).length}
              </h3>
              
              {(selectedAuditPage.recommendations || selectedAuditPage.audits || []).length === 0 ? (
                <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px dashed var(--color-success)', color: '#047857', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
                  🎉 Outstanding! This page satisfies all core E-E-A-T search quality guidelines. No immediate actions are needed.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {(selectedAuditPage.recommendations || selectedAuditPage.audits || []).map((rec, index) => {
                    const snippet = generateEEATFixSnippet(rec.text, selectedAuditPage.url, selectedAuditPage.title);
                    const isFixOpen = openFixIndex === index;
                    const isCopied = copiedIndex === index;

                    return (
                      <div key={index} style={{
                        padding: '1rem',
                        background: 'rgba(0,0,0,0.01)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            background: rec.impact === 'High' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            color: rec.impact === 'High' ? '#dc2626' : '#d97706',
                            textTransform: 'uppercase',
                            marginTop: '0.15rem'
                          }}>
                            {rec.impact}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{rec.text}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>{rec.desc}</div>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.05)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                            {rec.pillar}
                          </span>
                        </div>

                        {/* Interactive Fix Generator Controls */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-light)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                          <button
                            onClick={() => setOpenFixIndex(isFixOpen ? null : index)}
                            style={{
                              background: isFixOpen ? 'rgba(0, 0, 0, 0.05)' : 'rgba(59, 130, 246, 0.1)',
                              color: isFixOpen ? 'var(--text-main)' : '#2563eb',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '0.25rem 0.6rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            {isFixOpen ? '🙈 Hide Solution' : '⚡ Generate Fix Content'}
                          </button>
                        </div>

                        {isFixOpen && (
                          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg-terminal)', color: '#a7f3d0', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid var(--border-light)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', overflowX: 'auto', position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.3rem' }}>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600 }}>SUGGESTED IMPLEMENTATION ({snippet.lang.toUpperCase()} CODE):</span>
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
                                  padding: '0.15rem 0.4rem',
                                  fontSize: '0.65rem',
                                  cursor: 'pointer',
                                  fontWeight: 600
                                }}
                              >
                                {isCopied ? '✓ Copied!' : '📋 Copy Code'}
                              </button>
                            </div>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: snippet.lang === 'json' ? '#a7f3d0' : '#e2e8f0', lineHeight: 1.4 }}>
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
                onClick={handleClosePageModal}
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
