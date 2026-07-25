import React, { useState, useMemo, useEffect } from 'react';
import { calculatePageEEAT, generateEEATFixSnippet } from './EEATAudit';
import { calculateOnPageSEO, generateOnPageFixCode } from './OnPageSEO';
import { calculatePageAEO, generateAEOQuestions, generateAEOSchemaCode } from './AEOAudit';
import { calculatePageAISEO, generateAISEOFix } from './AISEO';
import { analyzeSiteArchitecture } from './SiloAnalyzer';

export default function DuplicateDetail({ pageData, pages = [], initialTab, onTabChange, onClose, onSelectPage, historyList = [], onGoBack }) {
  // Destructure safely with defaults right at the top before any hooks or effects reference text/title/url
  const {
    url = '',
    title = '',
    wordCount = 0,
    duplicatePercent = 0,
    commonPercent = 0,
    status = 200,
    blocks = [],
    text = '',
    links = [],
    metaDescription = '',
    canonicalUrl = '',
    h1Count = 0,
    robots = '',
    schemas = []
  } = pageData || {};

  const [activeSubTab, setActiveSubTab] = useState(initialTab || 'duplicate');

  useEffect(() => {
    if (initialTab) {
      setActiveSubTab(initialTab);
    }
  }, [initialTab]);

  const handleTabChange = (tab) => {
    setActiveSubTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const [hoveredBlockIdx, setHoveredBlockIdx] = useState(null);
  const [hoveredUrl, setHoveredUrl] = useState(null);
  const [selectedBlockIdx, setSelectedBlockIdx] = useState(null);
  const [highlightFilter, setHighlightFilter] = useState('all'); // all, duplicate, common, none
  const [viewMode, setViewMode] = useState('text'); // text, page
  const [liveText, setLiveText] = useState(text || '');

  useEffect(() => {
    // Keep the optimizer's editable buffer in sync with the incoming page text,
    // including when the new page has empty text (avoids showing stale content).
    setLiveText(text || '');
  }, [text]);

  const lsiKeywords = useMemo(() => {
    const pageTitle = title || '';
    const lowTitle = pageTitle.toLowerCase();
    
    let terms = [];
    if (lowTitle.includes('seo') || lowTitle.includes('search') || lowTitle.includes('web') || lowTitle.includes('developer') || lowTitle.includes('sitemap') || lowTitle.includes('crawl')) {
      terms = [
        { word: 'search engines', min: 2, max: 5 },
        { word: 'topical authority', min: 1, max: 3 },
        { word: 'search volume', min: 1, max: 4 },
        { word: 'meta tags', min: 2, max: 4 },
        { word: 'link building', min: 1, max: 3 },
        { word: 'organic search', min: 2, max: 5 },
        { word: 'site audit', min: 1, max: 3 },
        { word: 'search queries', min: 2, max: 4 },
        { word: 'technical SEO', min: 1, max: 3 },
        { word: 'core web vitals', min: 1, max: 3 }
      ];
    } else if (lowTitle.includes('marketing') || lowTitle.includes('brand') || lowTitle.includes('creative') || lowTitle.includes('agency') || lowTitle.includes('design') || lowTitle.includes('ads')) {
      terms = [
        { word: 'brand strategy', min: 2, max: 5 },
        { word: 'target audience', min: 2, max: 4 },
        { word: 'conversion rate', min: 1, max: 3 },
        { word: 'social media', min: 2, max: 5 },
        { word: 'creative agency', min: 1, max: 3 },
        { word: 'digital marketing', min: 2, max: 5 },
        { word: 'brand identity', min: 2, max: 4 },
        { word: 'user experience', min: 2, max: 4 },
        { word: 'marketing campaign', min: 1, max: 3 },
        { word: 'market research', min: 1, max: 3 }
      ];
    } else if (lowTitle.includes('dental') || lowTitle.includes('doctor') || lowTitle.includes('smile') || lowTitle.includes('patient') || lowTitle.includes('health') || lowTitle.includes('medical') || lowTitle.includes('dentist')) {
      terms = [
        { word: 'patient care', min: 2, max: 5 },
        { word: 'dental hygiene', min: 2, max: 4 },
        { word: 'cosmetic dentistry', min: 1, max: 3 },
        { word: 'oral health', min: 2, max: 5 },
        { word: 'treatment options', min: 2, max: 4 },
        { word: 'preventative care', min: 1, max: 3 },
        { word: 'teeth whitening', min: 1, max: 3 },
        { word: 'medical services', min: 2, max: 4 },
        { word: 'wellness', min: 1, max: 3 },
        { word: 'restorative dentistry', min: 1, max: 3 }
      ];
    } else if (lowTitle.includes('business') || lowTitle.includes('consulting') || lowTitle.includes('strategy') || lowTitle.includes('advisor') || lowTitle.includes('firm') || lowTitle.includes('finance')) {
      terms = [
        { word: 'business growth', min: 2, max: 5 },
        { word: 'strategic planning', min: 2, max: 4 },
        { word: 'project management', min: 1, max: 3 },
        { word: 'market analysis', min: 1, max: 4 },
        { word: 'financial planning', min: 1, max: 3 },
        { word: 'consulting services', min: 2, max: 5 },
        { word: 'competitive advantage', min: 1, max: 3 },
        { word: 'efficiency', min: 2, max: 4 },
        { word: 'operations', min: 1, max: 3 },
        { word: 'solutions', min: 2, max: 5 }
      ];
    } else {
      terms = [
        { word: 'best practices', min: 2, max: 4 },
        { word: 'expert guide', min: 1, max: 3 },
        { word: 'step-by-step', min: 1, max: 3 },
        { word: 'comprehensive review', min: 1, max: 3 },
        { word: 'industry standards', min: 2, max: 4 },
        { word: 'proven results', min: 1, max: 3 },
        { word: 'key insights', min: 1, max: 3 },
        { word: 'practical tips', min: 2, max: 4 },
        { word: 'expert advice', min: 1, max: 3 },
        { word: 'detailed analysis', min: 1, max: 3 }
      ];
    }
    return terms;
  }, [title]);

  const lsiCounts = useMemo(() => {
    if (!liveText) return {};
    const textLower = liveText.toLowerCase();
    const counts = {};
    lsiKeywords.forEach(term => {
      const wordEscaped = term.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${wordEscaped}\\b`, 'gi');
      const matches = textLower.match(regex);
      counts[term.word] = matches ? matches.length : 0;
    });
    return counts;
  }, [liveText, lsiKeywords]);

  const liveOptimizerScore = useMemo(() => {
    let score = 30; // base score
    
    // Check title length
    const pageTitle = title || '';
    if (pageTitle.length >= 40 && pageTitle.length <= 60) {
      score += 10;
    }

    // Word count score
    const words = liveText ? liveText.split(/\s+/).filter(Boolean).length : 0;
    if (words >= 600 && words <= 1500) {
      score += 20;
    } else if (words > 200 && words < 2500) {
      score += 10;
    }

    // LSI keyword usage score
    lsiKeywords.forEach(term => {
      const count = lsiCounts[term.word] || 0;
      if (count >= term.min && count <= term.max) {
        score += 4;
      } else if (count > 0) {
        score += 2;
      }
    });

    return Math.min(100, Math.round(score));
  }, [liveText, lsiKeywords, lsiCounts, title]);

  // States for sub-tab fix consoles
  const [fixIndex, setFixIndex] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const [eeatFixIndex, setEeatFixIndex] = useState(null);
  const [eeatCopiedIndex, setEeatCopiedIndex] = useState(null);

  const [aeoFixIndex, setAeoFixIndex] = useState(null);
  const [aeoCopiedIndex, setAeoCopiedIndex] = useState(null);

  const [aiseoFixIndex, setAiseoFixIndex] = useState(null);
  const [aiseoCopiedIndex, setAiseoCopiedIndex] = useState(null);

  // Calculate matching stats per page URL, breaking it down into duplicate and common totals
  const matchStats = useMemo(() => {
    const stats = {}; // url -> { url, dupWordCount, commonWordCount, dupBlockCount, commonBlockCount }
    if (!blocks) return [];

    blocks.forEach((block, blockIdx) => {
      if (!block || !block.matches) return;
      block.matches.forEach(matchUrl => {
        if (!stats[matchUrl]) {
          stats[matchUrl] = {
            url: matchUrl,
            dupWordCount: 0,
            commonWordCount: 0,
            dupBlockCount: 0,
            commonBlockCount: 0,
            blockIndices: []
          };
        }
        if (block.type === 'common') {
          stats[matchUrl].commonWordCount += block.wordCount;
          stats[matchUrl].commonBlockCount += 1;
        } else {
          stats[matchUrl].dupWordCount += block.wordCount;
          stats[matchUrl].dupBlockCount += 1;
        }
        stats[matchUrl].blockIndices.push(blockIdx);
      });
    });

    return Object.values(stats).sort((a, b) => 
      (b.dupWordCount + b.commonWordCount) - (a.dupWordCount + a.commonWordCount)
    );
  }, [blocks]);

  // Segment the text into duplicate, common, and non-duplicate blocks safely
  const textSegments = useMemo(() => {
    if (!text || !blocks || blocks.length === 0) {
      return [{ text: text || '', isDuplicate: false }];
    }

    const segments = [];
    let lastIdx = 0;
    const sortedBlocks = [...blocks].sort((a, b) => a.charStart - b.charStart);

    sortedBlocks.forEach((block) => {
      const originalIdx = blocks.findIndex(
        b => b.charStart === block.charStart && b.charEnd === block.charEnd
      );

      // Staff engineer guard: if a block starts before the last index we processed, it overlaps
      if (block.charStart < lastIdx) {
        if (block.charEnd <= lastIdx) return;
        
        // Otherwise, it extends past lastIdx. Slice it to prevent double-rendering text
        segments.push({
          text: text.substring(lastIdx, block.charEnd),
          isDuplicate: true,
          blockIdx: originalIdx,
          blockType: block.type,
          matches: block.matches,
          wordCount: block.wordCount
        });
        lastIdx = block.charEnd;
        return;
      }

      // Clean text before block
      if (block.charStart > lastIdx) {
        segments.push({
          text: text.substring(lastIdx, block.charStart),
          isDuplicate: false
        });
      }

      // Active block (Duplicate or Common)
      segments.push({
        text: text.substring(block.charStart, block.charEnd),
        isDuplicate: true,
        blockIdx: originalIdx,
        blockType: block.type,
        matches: block.matches,
        wordCount: block.wordCount
      });

      lastIdx = block.charEnd;
    });

    // Remainder of text
    if (lastIdx < text.length) {
      segments.push({
        text: text.substring(lastIdx),
        isDuplicate: false
      });
    }

    return segments;
  }, [text, blocks]);

  const shouldHighlightSegment = (seg) => {
    if (!seg.isDuplicate) return false;
    if (highlightFilter === 'none') return false;
    if (highlightFilter === 'duplicate' && seg.blockType !== 'duplicate') return false;
    if (highlightFilter === 'common' && seg.blockType !== 'common') return false;
    return true;
  };

  const isSegmentHoveredOrClicked = (segment) => {
    if (hoveredBlockIdx === segment.blockIdx) return true;
    if (selectedBlockIdx === segment.blockIdx) return true;
    if (hoveredUrl && segment.matches && segment.matches.includes(hoveredUrl)) return true;
    return false;
  };

  const isCardHighlighted = (cardUrl) => {
    if (hoveredUrl === cardUrl) return true;
    if (hoveredBlockIdx !== null) {
      const block = blocks[hoveredBlockIdx];
      if (block && block.matches && block.matches.includes(cardUrl)) return true;
    }
    if (selectedBlockIdx !== null) {
      const block = blocks[selectedBlockIdx];
      if (block && block.matches && block.matches.includes(cardUrl)) return true;
    }
    return false;
  };

  // Rules of Hooks safety check: early return after hook declarations
  if (!pageData) {
    return (
      <div className="duplicate-detail-layout animate-fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <div className="loader-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
          <div className="crawler-spinner"></div>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Loading page details & analyzing matches...</span>
        </div>
      </div>
    );
  }

  const handleExportFullPDF = () => {
    try {
      // Build from the already-loaded in-memory crawl results. /api/crawl/page is not
      // available after a serverless crawl completes (per-invocation memory is gone).
      const duplicateMatches = matchStats.filter(m => m.dupWordCount > 0);
      const compiledData = duplicateMatches
        .map(m => (pages || []).find(p => p.url === m.url))
        .filter(Boolean);

      const escapeHtml = (str) => {
        return (str || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };

      const getSegmentsForPage = (txt, blks) => {
        if (!txt || !blks || blks.length === 0) {
          return [{ text: txt || '', isDuplicate: false }];
        }

        const segments = [];
        let lastIdx = 0;
        const sortedBlocks = [...blks].sort((a, b) => a.charStart - b.charStart);

        sortedBlocks.forEach((block) => {
          if (block.charStart < lastIdx) {
            if (block.charEnd <= lastIdx) return;
            segments.push({
              text: txt.substring(lastIdx, block.charEnd),
              isDuplicate: true,
              blockType: block.type
            });
            lastIdx = block.charEnd;
            return;
          }
          if (block.charStart > lastIdx) {
            segments.push({
              text: txt.substring(lastIdx, block.charStart),
              isDuplicate: false
            });
          }
          segments.push({
            text: txt.substring(block.charStart, block.charEnd),
            isDuplicate: true,
            blockType: block.type
          });
          lastIdx = block.charEnd;
        });

        if (lastIdx < txt.length) {
          segments.push({
            text: txt.substring(lastIdx),
            isDuplicate: false
          });
        }
        return segments;
      };

      const renderHighlightedText = (txt, blks) => {
        const segments = getSegmentsForPage(txt, blks);
        return segments
          .map(seg => {
            if (seg.isDuplicate && seg.blockType !== 'common') {
              return `<span style="background-color: #fee2e2; color: #b91c1c; border-bottom: 1.5px solid #ef4444; padding: 1px 2px; border-radius: 2px; font-weight: 500;">${escapeHtml(seg.text)}</span>`;
            }
            return escapeHtml(seg.text);
          })
          .join('');
      };

      const mainHighlightsHtml = renderHighlightedText(text, blocks);

      const matchingPagesHtml = compiledData
        .map(match => {
          const matchHighlightsHtml = renderHighlightedText(match.text, match.blocks);
          return `
            <div class="page-break" style="page-break-before: always; margin-top: 2rem; border-top: 2px solid #e5e7eb; padding-top: 2rem;">
              <h2 style="color: #b91c1c; font-size: 1.3rem; margin-bottom: 0.5rem;">Matching Duplicate Page Analysis</h2>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 0.85rem; background: #fafafa; border: 1px solid #e5e7eb;">
                <tr>
                  <td style="padding: 0.4rem; font-weight: bold; width: 120px; border: 1px solid #e5e7eb;">Title:</td>
                  <td style="padding: 0.4rem; border: 1px solid #e5e7eb;">${escapeHtml(match.title || 'Untitled')}</td>
                </tr>
                <tr>
                  <td style="padding: 0.4rem; font-weight: bold; border: 1px solid #e5e7eb;">URL:</td>
                  <td style="padding: 0.4rem; border: 1px solid #e5e7eb;"><a href="${match.url}" target="_blank" style="color: #2563eb; text-decoration: none;">${escapeHtml(match.url)}</a></td>
                </tr>
                <tr>
                  <td style="padding: 0.4rem; font-weight: bold; border: 1px solid #e5e7eb;">Word Count:</td>
                  <td style="padding: 0.4rem; border: 1px solid #e5e7eb;">${match.wordCount} words</td>
                </tr>
                <tr>
                  <td style="padding: 0.4rem; font-weight: bold; border: 1px solid #e5e7eb;">Duplicate %:</td>
                  <td style="padding: 0.4rem; border: 1px solid #e5e7eb; color: #b91c1c; font-weight: bold;">${match.duplicatePercent}%</td>
                </tr>
              </table>
              <h3 style="font-size: 1rem; color: #4b5563; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.25rem;">Highlighted Content (Duplicate Text in Red)</h3>
              <div style="line-height: 1.6; font-size: 0.9rem; text-align: justify; margin-top: 0.75rem; white-space: pre-wrap; word-break: break-word; color: #1f2937;">
                ${matchHighlightsHtml}
              </div>
            </div>
          `;
        })
        .join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>SEO Intel - Audit Report for ${escapeHtml(title)}</title>
          <meta charset="utf-8">
          <style>
            @media print {
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                color: #111827;
                line-height: 1.5;
                margin: 0;
                padding: 1.5cm;
              }
              .page-break {
                page-break-before: always;
              }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #111827;
              line-height: 1.5;
              max-width: 800px;
              margin: 2rem auto;
              padding: 0 1rem;
            }
            h1, h2, h3 {
              margin-top: 0;
            }
          </style>
        </head>
        <body>
          <div style="text-align: center; margin-bottom: 2rem; border-bottom: 3px double #e5e7eb; padding-bottom: 1rem;">
            <h1 style="color: #1e3a8a; font-size: 1.8rem; margin-bottom: 0.25rem;">SEO Intel - Duplicate Content Audit Report</h1>
            <p style="color: #6b7280; font-size: 0.85rem; margin: 0;">Compiled automatically on ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
          </div>

          <h2 style="color: #1e3a8a; font-size: 1.4rem; margin-bottom: 0.5rem;">Target Page Overview</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-size: 0.9rem; border: 1px solid #e5e7eb;">
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 0.5rem; font-weight: bold; width: 150px; border-right: 1px solid #e5e7eb; background: #f9fafb;">Title:</td>
              <td style="padding: 0.5rem;">${escapeHtml(title || 'Untitled')}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 0.5rem; font-weight: bold; border-right: 1px solid #e5e7eb; background: #f9fafb;">URL:</td>
              <td style="padding: 0.5rem;"><a href="${url}" target="_blank" style="color: #2563eb; text-decoration: none;">${escapeHtml(url)}</a></td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 0.5rem; font-weight: bold; border-right: 1px solid #e5e7eb; background: #f9fafb;">Word Count:</td>
              <td style="padding: 0.5rem;">${wordCount} words</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 0.5rem; font-weight: bold; border-right: 1px solid #e5e7eb; background: #f9fafb;">Duplicate Content:</td>
              <td style="padding: 0.5rem; color: #b91c1c; font-weight: bold; font-size: 1.1rem;">${duplicatePercent}%</td>
            </tr>
          </table>

          <h3 style="font-size: 1.1rem; color: #4b5563; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.35rem;">Target Page Content Highlights (Duplicate Text in Red)</h3>
          <div style="line-height: 1.6; font-size: 0.95rem; text-align: justify; margin-top: 1rem; white-space: pre-wrap; word-break: break-word; color: #1f2937; margin-bottom: 2rem;">
            ${mainHighlightsHtml}
          </div>

          ${matchingPagesHtml}
        </body>
        </html>
      `;

      // Render into an off-screen iframe and print it. Unlike window.open (a pop-up,
      // which browsers/extensions frequently block), an iframe always works — this is
      // the reliable path to the browser's "Save as PDF" dialog.
      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();

      const cleanup = () => { try { iframe.remove(); } catch (e) { /* ignore */ } };
      // Give the browser a beat to lay the report out, then open the print/save dialog.
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.onafterprint = cleanup;
          iframe.contentWindow.print();
          setTimeout(cleanup, 120000); // fallback cleanup if onafterprint never fires
        } catch (e) {
          cleanup();
          alert('Could not open the print dialog: ' + e.message);
        }
      }, 400);
    } catch (err) {
      alert('Failed to generate PDF report: ' + err.message);
    }
  };

  // On-Page SEO Dashboard Tab
  const renderOnPageTab = () => {
    const onPage = calculateOnPageSEO(pageData);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', marginTop: '1rem', alignItems: 'start' }}>
        {/* Left Side: Score & Checklist */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: onPage.score >= 85 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                {onPage.score}%
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>SEO Score</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <div>📱 Viewport Mobile Scaled: <strong>{onPage.hasViewport ? 'Optimal 🟢' : 'Missing Viewport Meta 🔴'}</strong></div>
              <div style={{ marginTop: '0.25rem' }}>🔒 Secure HTTPS protocol: <strong>{url.startsWith('https:') ? 'Secure 🟢' : 'Insecure HTTP 🔴'}</strong></div>
              <div style={{ marginTop: '0.25rem' }}>🏷️ Schema metadata tags: <strong>{onPage.schemas.length} detected</strong></div>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.75rem 0', color: 'var(--text-dark)' }}>On-Page Compliance Signals</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {onPage.audits.map((audit, idx) => (
                <div key={idx} style={{
                  padding: '0.85rem 1rem',
                  background: audit.status === 'optimal' ? 'rgba(16, 185, 129, 0.02)' : 'rgba(0,0,0,0.01)',
                  border: `1px solid ${audit.status === 'optimal' ? 'rgba(16, 185, 129, 0.15)' : 'var(--border-light)'}`,
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}>
                  <span style={{ fontSize: '1rem', marginTop: '-0.1rem' }}>
                    {audit.status === 'optimal' ? '✅' : '⚠️'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>
                      {audit.category ? <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{audit.category} · </span> : null}
                      {audit.message}
                    </div>
                    {/* On-page audits carry actual/recommended (not desc) */}
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                      {audit.desc || (audit.status === 'optimal' ? audit.actual : audit.recommended) || ''}
                    </div>
                  </div>
                  {audit.status !== 'optimal' && (
                    <button
                      onClick={() => setFixIndex(fixIndex === idx ? null : idx)}
                      style={{
                        alignSelf: 'center',
                        background: 'rgba(59, 130, 246, 0.12)',
                        color: '#2563eb',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {fixIndex === idx ? 'Hide Fix' : '⚡ View Code Fix'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Fix Console */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem 0', color: 'var(--text-dark)' }}>⚡ Interactive Technical Fix Console</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 1rem 0' }}>
              Select any warning indicator on the left checklist to fetch customized source code snippets.
            </p>

            {fixIndex !== null && onPage.audits[fixIndex] ? (() => {
              const auditItem = onPage.audits[fixIndex];
              // Fix snippets are keyed on the audit item name (e.g. 'Title Tag'), not the message
              const snippet = generateOnPageFixCode(auditItem.item || auditItem.message, url, title);
              const isCopied = copiedIndex === fixIndex;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-warning)' }}>
                    Fix Target: "{auditItem.message}"
                  </div>
                  <div style={{ background: 'var(--bg-terminal)', color: '#cbd5e1', padding: '1rem', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>RECOMMENDED CODE ({snippet.lang.toUpperCase()}):</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(snippet.code);
                          setCopiedIndex(fixIndex);
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
                        {isCopied ? '✓ Copied' : 'Copy Snippet'}
                      </button>
                    </div>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.35 }}>
                      {snippet.code}
                    </pre>
                  </div>
                </div>
              );
            })() : (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-light)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '2rem', textAlign: 'center' }}>
                Console idle. Click "⚡ View Code Fix" on any warning element to load suggestions.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // E-E-A-T Dashboard Tab
  // E-E-A-T Dashboard Tab
  const renderEEATTab = () => {
    const eeat = calculatePageEEAT(pageData) || {};
    const pillars = eeat.pillars || { experience: 0, expertise: 0, authority: 0, trust: 0 };
    const auditsList = eeat.audits || eeat.recommendations || [];

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', marginTop: '1rem', alignItems: 'start' }}>
        {/* Left Side: Score & Checklist */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: (eeat.score || 0) >= 80 ? 'var(--color-success)' : (eeat.score || 0) >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                {eeat.score || 0}%
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>E-E-A-T Score</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <div>👉 Experience Level: <strong>{pillars.experience}/25</strong></div>
              <div style={{ marginTop: '0.25rem' }}>🎓 Expertise Signal: <strong>{pillars.expertise}/25</strong></div>
              <div style={{ marginTop: '0.25rem' }}>🛡️ Trust & Citation Probability: <strong>{eeat.rating || 'Needs Audit'}</strong></div>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.75rem 0', color: 'var(--text-dark)' }}>E-E-A-T Quality Signals</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {auditsList.map((rec, idx) => (
                <div key={idx} style={{
                  padding: '0.85rem 1rem',
                  background: rec.status === 'optimal' ? 'rgba(16, 185, 129, 0.02)' : 'rgba(0,0,0,0.01)',
                  border: `1px solid ${rec.status === 'optimal' ? 'rgba(16, 185, 129, 0.15)' : 'var(--border-light)'}`,
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}>
                  <span style={{ fontSize: '1rem', marginTop: '-0.1rem' }}>
                    {rec.status === 'optimal' ? '✅' : rec.status === 'critical' ? '❌' : '⚠️'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{rec.message}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>{rec.desc}</div>
                  </div>
                  {rec.status !== 'optimal' && (
                    <button
                      onClick={() => setEeatFixIndex(eeatFixIndex === idx ? null : idx)}
                      style={{
                        alignSelf: 'center',
                        background: 'rgba(59, 130, 246, 0.12)',
                        color: '#2563eb',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {eeatFixIndex === idx ? 'Hide Fix' : '⚡ View Code Fix'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Fix Console */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem 0', color: 'var(--text-dark)' }}>⚡ E-E-A-T Citation Fix Console</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 1rem 0' }}>
              Select any E-E-A-T recommendation on the left list to copy tailored quality signals code.
            </p>

            {eeatFixIndex !== null && auditsList[eeatFixIndex] ? (() => {
              const auditItem = auditsList[eeatFixIndex];
              const snippet = generateEEATFixSnippet(auditItem.message, url, title);
              const isCopied = eeatCopiedIndex === eeatFixIndex;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-warning)' }}>
                    Fix Target: "{auditItem.message}"
                  </div>
                  <div style={{ background: 'var(--bg-terminal)', color: '#cbd5e1', padding: '1rem', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>RECOMMENDED CODE ({snippet.lang.toUpperCase()}):</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(snippet.code);
                          setEeatCopiedIndex(eeatFixIndex);
                          setTimeout(() => setEeatCopiedIndex(null), 2000);
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
                        {isCopied ? '✓ Copied' : 'Copy Snippet'}
                      </button>
                    </div>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.35 }}>
                      {snippet.code}
                    </pre>
                  </div>
                </div>
              );
            })() : (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-light)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '2rem', textAlign: 'center' }}>
                Console idle. Click "⚡ View Code Fix" to load credential or footer markup boilerplates.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // AEO Dashboard Tab
  const renderAEOTab = () => {
    const aeo = calculatePageAEO(pageData);
    const paaList = generateAEOQuestions(url, title);
    const isFAQOpen = aeoFixIndex === 99;
    const isCopiedFAQ = aeoCopiedIndex === 99;

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', marginTop: '1rem', alignItems: 'start' }}>
        {/* Left Side: Score & Checklist */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: aeo.score >= 80 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                {aeo.score}%
              </span>
              <span style={{ fontSize: '0.70rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>AEO Score</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div>❓ Question Headings: <strong>{aeo.questionsFound.length} detected</strong></div>
              <div>🏷️ Schema types: <strong>{aeo.schemas.length > 0 ? aeo.schemas.join(', ') : 'None'}</strong></div>
              <div>📱 Viewport support: <strong>Yes (Optimal)</strong></div>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.75rem 0', color: 'var(--text-dark)' }}>AEO Compliance Signals</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(aeo.audits || []).map((rec, idx) => (
                <div key={idx} style={{
                  padding: '0.85rem 1rem',
                  background: rec.status === 'optimal' ? 'rgba(16, 185, 129, 0.02)' : 'rgba(0,0,0,0.01)',
                  border: `1px solid ${rec.status === 'optimal' ? 'rgba(16, 185, 129, 0.15)' : 'var(--border-light)'}`,
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}>
                  <span style={{ fontSize: '1rem', marginTop: '-0.1rem' }}>
                    {rec.status === 'optimal' ? '✅' : '⚠️'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{rec.message}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>{rec.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Generated PAA & FAQ Schema */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-dark)' }}>🚀 Conversational PAA & Voice Search Q&As</h3>
            <button
              onClick={() => setAeoFixIndex(isFAQOpen ? null : 99)}
              style={{
                background: isFAQOpen ? 'rgba(0,0,0,0.05)' : 'rgba(59, 130, 246, 0.15)',
                color: '#0066cc',
                border: 'none',
                borderRadius: '4px',
                padding: '0.25rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {isFAQOpen ? '🙈 Hide Schema' : '⚡ View FAQ Schema'}
            </button>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
            Insert these conversational Q&A blocks onto your page layout to capture Alexa/Google voice queries and PAA box rankings.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {isFAQOpen && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg-terminal)', color: '#a7f3d0', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid var(--border-light)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', overflowX: 'auto', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.3rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>GENERATED FAQ JSON-LD SCHEMA:</span>
                  <button
                    onClick={() => {
                      const code = generateAEOSchemaCode(paaList);
                      navigator.clipboard.writeText(code);
                      setAeoCopiedIndex(99);
                      setTimeout(() => setAeoCopiedIndex(null), 2000);
                    }}
                    style={{
                      background: isCopiedFAQ ? '#10b981' : '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      padding: '0.15rem 0.4rem',
                      fontSize: '0.65rem',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    {isCopiedFAQ ? '✓ Copied' : '📋 Copy Schema'}
                  </button>
                </div>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#a7f3d0', lineHeight: 1.35 }}>
                  {generateAEOSchemaCode(paaList)}
                </pre>
              </div>
            )}

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
        </div>
      </div>
    );
  };

  // AI SEO / GEO Tab Render
  const renderAISEOTab = () => {
    const aiseo = calculatePageAISEO(pageData);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', marginTop: '1rem', alignItems: 'start' }}>
        {/* Left Side: Score & Checklist */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: aiseo.score >= 80 ? 'var(--color-success)' : aiseo.score >= 55 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                {aiseo.score}%
              </span>
              <span style={{ fontSize: '0.70rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>AI-GEO Score</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <div>🏢 Entity Schema metadata: <strong>{aiseo.hasOrgSchema ? 'Optimal 🟢' : 'Missing 🔴'}</strong></div>
              <div style={{ marginTop: '0.25rem' }}>🤖 Scraper crawler access: <strong>{!aiseo.isBotBlocked ? 'Allowed 🟢' : 'Blocked 🔴'}</strong></div>
              <div style={{ marginTop: '0.25rem' }}>📈 Citations & research terms: <strong>{aiseo.hasStats ? 'Found 🟢' : 'None detected 🔴'}</strong></div>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.75rem 0', color: 'var(--text-dark)' }}>Actionable GEO Recommendations</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(aiseo.audits || []).map((rec, idx) => (
                <div key={idx} style={{
                  padding: '0.85rem 1rem',
                  background: rec.status === 'optimal' ? 'rgba(16, 185, 129, 0.02)' : 'rgba(0,0,0,0.01)',
                  border: `1px solid ${rec.status === 'optimal' ? 'rgba(16, 185, 129, 0.15)' : 'var(--border-light)'}`,
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}>
                  <span style={{ fontSize: '1rem', marginTop: '-0.1rem' }}>
                    {rec.status === 'optimal' ? '✅' : rec.status === 'critical' ? '❌' : '⚠️'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{rec.message}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>{rec.desc}</div>
                  </div>
                  {rec.status !== 'optimal' && (
                    <button
                      onClick={() => setAiseoFixIndex(aiseoFixIndex === idx ? null : idx)}
                      style={{
                        alignSelf: 'center',
                        background: 'rgba(59, 130, 246, 0.12)',
                        color: '#2563eb',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {aiseoFixIndex === idx ? 'Hide Fix' : '⚡ View Code Fix'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Simulator or Fix Console */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {aiseoFixIndex !== null && aiseo.audits[aiseoFixIndex] ? (() => {
            const auditItem = aiseo.audits[aiseoFixIndex];
            const snippet = generateAISEOFix(auditItem.message, url, title);
            const isCopied = aiseoCopiedIndex === aiseoFixIndex;

            return (
              <div className="glass-card" style={{ padding: '1.5rem', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem 0', color: 'var(--text-dark)' }}>⚡ AI Search Schema Fix Console</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 1rem 0' }}>
                  Inject this schema block to let cognitive search crawlers link your company entities.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-warning)' }}>
                    Fix Target: "{auditItem.message}"
                  </div>
                  <div style={{ background: 'var(--bg-terminal)', color: '#cbd5e1', padding: '1rem', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>RECOMMENDED CODE ({snippet.lang.toUpperCase()}):</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(snippet.code);
                          setAiseoCopiedIndex(aiseoFixIndex);
                          setTimeout(() => setAiseoCopiedIndex(null), 2000);
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
                        {isCopied ? '✓ Copied' : 'Copy Snippet'}
                      </button>
                    </div>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.35 }}>
                      {snippet.code}
                    </pre>
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-dark)' }}>🤖 AI Search Citation Simulator</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                This card simulates how an LLM engine (ChatGPT / Gemini) processes and citation-links this page.
              </p>

              <div style={{ border: '1px solid var(--border-light)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: '#f8fafc', padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-light)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>SIMULATED COGNITIVE CRAWLER</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', background: 'var(--bg-card)' }}>
                  <div style={{ alignSelf: 'flex-end', background: '#2563eb', color: 'white', padding: '0.6rem 0.9rem', borderRadius: '12px 12px 0 12px', fontSize: '0.8rem', maxWidth: '80%' }}>
                    Explain the main details of {(title || 'your topic').split(' - ')[0]}?
                  </div>

                  <div style={{ alignSelf: 'flex-start', background: '#f1f5f9', color: '#1e293b', padding: '0.75rem 1rem', borderRadius: '12px 12px 12px 0', fontSize: '0.8rem', maxWidth: '85%', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '1rem' }}>🤖</span>
                      <strong style={{ fontSize: '0.75rem', color: '#475569' }}>AI Search Assistant:</strong>
                    </div>
                    {aiseo.score >= 55 ? (
                      <div>
                        According to recent factual insights from <strong>{url.replace('https://', '').replace('http://', '').split('/')[0]}</strong>, the primary context is structured as a readable layout with lists and entity definitions. 
                        {aiseo.hasStats ? ' Statistical data indexes support these claims. ' : ''}
                        
                        <div style={{ marginTop: '0.5rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.4rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ color: '#059669', fontWeight: 600 }}>🟢 Citations:</span>
                          <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                            [Source: {(title || 'Untitled Page').substring(0, 20)}...]
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
          )}
        </div>
      </div>
    );
  };

  const renderSurferOptimizerWorkspace = () => {
    const wordCountLive = liveText ? liveText.split(/\s+/).filter(Boolean).length : 0;
    const charCountLive = liveText ? liveText.length : 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '550px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.02)', padding: '0.5rem 1.1rem', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid var(--border-light)' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            📝 Sandbox Editor: <strong>Live Interactive Optimization</strong>
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            Words: <strong>{wordCountLive}</strong> | Characters: <strong>{charCountLive}</strong>
          </span>
        </div>
        <textarea
          value={liveText}
          onChange={(e) => setLiveText(e.target.value)}
          placeholder="Type or paste your content draft here to check and optimize target LSI terms and overall quality index in real-time..."
          style={{
            flex: 1,
            padding: '1.25rem',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            border: '1px solid var(--border-light)',
            borderRadius: '8px',
            fontFamily: 'inherit',
            fontSize: '0.9rem',
            lineHeight: '1.68',
            outline: 'none',
            resize: 'none',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
          }}
        />
      </div>
    );
  };

  const renderOptimizerScorePanel = () => {
    const words = liveText ? liveText.split(/\s+/).filter(Boolean).length : 0;
    
    // Intelligent Silo Identification Heuristics
    const pagePath = (() => {
      try {
        return new URL(url).pathname.replace(new RegExp('/$'), '');
      } catch (e) {
        return '';
      }
    })();

    const isUtilityPage = 
      pagePath === '' || 
      pagePath === '/' || 
      new RegExp('\\b(about|contact|privacy|terms|legal|disclaimer|cookie|sitemap|faq|help|support)\\b', 'i').test(pagePath);

    // Compute Silo Link recommendations if pages are loaded
    let siloRecommendationHtml = null;
    
    if (isUtilityPage) {
      siloRecommendationHtml = (
        <div style={{ fontSize: '0.72rem', color: '#475569', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0.6rem 0.75rem', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <strong>ℹ️ Core Utility Page</strong>
          <span>Silo insulation internal link structures are not recommended for utility pages (such as Contact, About, or legal agreements). Keep these pages outside content siloing.</span>
        </div>
      );
    } else if (pages && pages.length > 0) {
      try {
        const { silos } = analyzeSiteArchitecture(pages);
        // Find current page's silo
        const currentSilo = silos.find(s => s.pages.some(p => p.url === url));
        
        if (currentSilo && currentSilo.name !== 'General Core Pages' && currentSilo.name !== 'Homepage Hub') {
          const isPillar = currentSilo.parentPage && currentSilo.parentPage.url === url;
          
          if (isPillar) {
            // Suggest category pillar link flows (pointing down to supporting children)
            const children = currentSilo.pages.filter(p => p.url !== url).slice(0, 3);
            
            siloRecommendationHtml = (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#065f46', background: '#d1fae5', border: '1px solid #10b981', padding: '0.6rem 0.75rem', borderRadius: '4px' }}>
                  <strong>🏛️ Category Pillar Hub ({currentSilo.name})</strong>
                  <div style={{ marginTop: '0.2rem' }}>This page acts as the category index. Link down to your silo support articles to distribute authority:</div>
                </div>
                {children.length > 0 && (
                  <div style={{ fontSize: '0.68rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', background: 'rgba(0,0,0,0.02)', padding: '0.5rem', borderRadius: '6px', border: '1px dashed var(--border-light)' }}>
                    <strong>Recommended down-links:</strong>
                    {children.map(child => {
                      const path = (() => { try { return new URL(child.url).pathname; } catch(e) { return child.url; } })();
                      const snippet = `<a href="${path}">${child.title || 'Support Article'}</a>`;
                      return (
                        <div key={child.url} style={{ fontFamily: 'monospace', background: 'var(--bg-card)', padding: '0.25rem', borderRadius: '4px', border: '1px solid var(--border-light)', overflowX: 'auto', whiteSpace: 'nowrap' }} title="Copy this link snippet">
                          {snippet}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          } else if (currentSilo.parentPage) {
            // Suggest supporting page link flows (pointing back up to parent category)
            const parentRelativePath = (() => { try { return new URL(currentSilo.parentPage.url).pathname; } catch(e) { return currentSilo.parentPage.url; } })();
            const anchorSnippet = `<a href="${parentRelativePath}">${currentSilo.parentPage.title || 'Category Index'}</a>`;
            
            siloRecommendationHtml = (
              <div style={{ fontSize: '0.72rem', color: '#1e40af', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.6rem 0.75rem', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <strong>🔗 Silo Supporting Page ({currentSilo.name})</strong>
                <span>Add an anchor link pointing from this article back to your parent category hub to insulate PageRank authority:</span>
                <div style={{ fontFamily: 'monospace', background: 'var(--bg-card)', padding: '0.25rem', borderRadius: '4px', border: '1px solid #cbd5e1', overflowX: 'auto', whiteSpace: 'nowrap', color: '#1e40af' }}>
                  {anchorSnippet}
                </div>
              </div>
            );
          }
        }
      } catch (e) {
        console.error('Failed to compute silo links suggestions:', e);
      }
    }

    // Default fallback if no silo fits or list is empty
    if (!siloRecommendationHtml) {
      siloRecommendationHtml = (
        <div style={{ fontSize: '0.72rem', color: '#475569', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0.6rem 0.75rem', borderRadius: '4px' }}>
          <strong>ℹ️ No Topic Silo Identified</strong>
          <div style={{ marginTop: '0.2rem' }}>Ensure pages share similar subfolders or keyword prefixes (e.g. /blog/ or /services/) to compute silo linking recommendations.</div>
        </div>
      );
    }

    return (
      <div className="side-panel glass-card animate-fade-in" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 className="panel-title" style={{ margin: 0, paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
          ⚡ SurferSEO Live Score
        </h3>
        
        {/* Dynamic Dial Score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.02)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
          <div style={{
            position: 'relative',
            width: '70px',
            height: '70px',
            borderRadius: '50%',
            background: `conic-gradient(${liveOptimizerScore >= 80 ? 'var(--color-success)' : liveOptimizerScore >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'} ${liveOptimizerScore * 3.6}deg, rgba(0,0,0,0.1) 0deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.15rem',
              color: 'var(--text-dark)'
            }}>
              {liveOptimizerScore}
            </div>
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-dark)' }}>Content Score</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {liveOptimizerScore >= 80 ? 'Optimal Content Structure' : liveOptimizerScore >= 50 ? 'Good keyword distribution' : 'Thin topical authority'}
            </span>
          </div>
        </div>

        {/* Text Metrics Check */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem', background: 'rgba(0,0,0,0.01)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Word Count:</span>
            <strong>{words} / 1000</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>LSI Keywords Used:</span>
            <strong>{lsiKeywords.filter(t => (lsiCounts[t.word] || 0) >= t.min).length} / {lsiKeywords.length} terms</strong>
          </div>
        </div>

        {/* LSI keywords check list */}
        <div>
          <h4 style={{ fontSize: '0.82rem', margin: '0 0 0.5rem 0', color: 'var(--text-dark)' }}>LSI Keywords checklist:</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {lsiKeywords.map(term => {
              const count = lsiCounts[term.word] || 0;
              const isOk = count >= term.min && count <= term.max;
              const isOver = count > term.max;
              
              let badgeColor = 'rgba(239, 68, 68, 0.1)';
              let badgeText = '#dc2626';
              let badgeLabel = 'Missing';
              if (isOk) {
                badgeColor = 'rgba(16, 185, 129, 0.1)';
                badgeText = '#10b981';
                badgeLabel = 'Optimal';
              } else if (isOver) {
                badgeColor = 'rgba(245, 158, 11, 0.1)';
                badgeText = '#d97706';
                badgeLabel = 'Over-Used';
              } else if (count > 0) {
                badgeColor = 'rgba(59, 130, 246, 0.1)';
                badgeText = '#2563eb';
                badgeLabel = 'Under-Used';
              }

              return (
                <div key={term.word} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.4rem 0.6rem',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '6px',
                  fontSize: '0.78rem'
                }}>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{term.word}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginLeft: '0.4rem' }}>
                      ({term.min}-{term.max})
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.7rem',
                    background: badgeColor,
                    color: badgeText,
                    padding: '0.15rem 0.4rem',
                    borderRadius: '4px',
                    fontWeight: 700
                  }}>
                    {count} ({badgeLabel})
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Internal Link Recommendations */}
        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
          <h4 style={{ fontSize: '0.82rem', margin: '0 0 0.4rem 0', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            🔗 Silo Link Recommendations
          </h4>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>
            Establish solid internal anchor siloing to maximize PageRank:
          </p>
          {siloRecommendationHtml}
        </div>
      </div>
    );
  };

  const activeBlock = selectedBlockIdx !== null ? blocks[selectedBlockIdx] : null;

  return (
    <div className="duplicate-detail-layout animate-fade-in">
      {/* Header Panel */}
      <div className="detail-header-panel glass-card">
        <div className="header-meta" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="back-btn" onClick={onClose} style={{ padding: '0.45rem 0.9rem', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                ✕ Close Report
              </button>
              {historyList.length > 0 && (
                <button className="back-btn" onClick={onGoBack} style={{ padding: '0.45rem 0.9rem', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                  ← Back to Previous Page
                </button>
              )}
            </div>
            
            <button
              onClick={handleExportFullPDF}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.45rem 1.1rem',
                background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
                transition: 'all 0.2s ease'
              }}
            >
              📄 Export Full PDF Audit Report
            </button>
          </div>

          {/* Breadcrumbs trail */}
          {historyList.length > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem', background: '#f8fafc', padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #f1f5f9', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', width: '100%', boxSizing: 'border-box' }}>
              <strong>History:</strong>
              {historyList.map((histUrl, idx) => (
                <React.Fragment key={histUrl}>
                  <button
                    onClick={() => onSelectPage(histUrl)}
                    style={{ background: 'none', border: 'none', color: '#2563eb', padding: 0, textDecoration: 'underline', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    {histUrl.split('/').pop() || histUrl}
                  </button>
                  {idx < historyList.length - 1 && <span>→</span>}
                </React.Fragment>
              ))}
              <span>→</span>
              <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{url.split('/').pop() || url}</span>
            </div>
          )}

          <h1 style={{ marginTop: '0.25rem', fontSize: '1.4rem' }}>{title}</h1>
          <div className="url-link-row">
            <a href={url} target="_blank" rel="noopener noreferrer" className="external-link">
              {url} ↗
            </a>
          </div>
        </div>

        <div className="header-stats">
          <div className="stat-pill">
            <span className="stat-label">Duplicate %</span>
            <span className={`stat-val ${duplicatePercent > 20 ? 'text-warning' : 'text-success'}`}>
              {duplicatePercent}%
            </span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Common %</span>
            <span className="stat-val text-primary">{commonPercent}%</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Total Words</span>
            <span className="stat-val">{wordCount}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Est. Reading Time</span>
            <span className="stat-val text-info">{Math.ceil((wordCount || 0) / 200)} min</span>
          </div>
          <div className="stat-pill">
            <span className="stat-label">Status</span>
            <span className={`stat-val ${status === 200 ? 'text-success' : 'text-danger'}`}>
              {status}
            </span>
          </div>
        </div>
      </div>

      {/* Sub-tabs bar: Duplicates, On-Page SEO, E-E-A-T, AEO, AI SEO */}
      <div className="tabs-navigation glass-card" style={{ padding: '0.4rem 1rem', display: 'flex', gap: '0.5rem', marginBottom: '0.25rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <button
          className={`nav-tab-btn ${activeSubTab === 'duplicate' ? 'active' : ''}`}
          onClick={() => handleTabChange('duplicate')}
          style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
        >
          📄 Duplicate Content
        </button>
        <button
          className={`nav-tab-btn ${activeSubTab === 'onpage' ? 'active' : ''}`}
          onClick={() => handleTabChange('onpage')}
          style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
        >
          🛠️ On-Page SEO Audit
        </button>
        <button
          className={`nav-tab-btn ${activeSubTab === 'eeat' ? 'active' : ''}`}
          onClick={() => handleTabChange('eeat')}
          style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
        >
          🛡️ E-E-A-T Signals
        </button>
        <button
          className={`nav-tab-btn ${activeSubTab === 'aeo' ? 'active' : ''}`}
          onClick={() => handleTabChange('aeo')}
          style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
        >
          🚀 AEO & PAA Questions
        </button>
        <button
          className={`nav-tab-btn ${activeSubTab === 'aiseo' ? 'active' : ''}`}
          onClick={() => handleTabChange('aiseo')}
          style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
        >
          🤖 AI SEO & GEO Simulator
        </button>
      </div>

      {activeSubTab === 'duplicate' && (
        <div className="detail-body-grid">
        {/* Left Side: Highlighted Text */}
        <div className="text-viewer-card glass-card">
          <div className="card-title-sticky" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <h3 style={{ margin: 0 }}>Page Content Viewer</h3>
              
              {/* HTML/Text/SEO/Keywords/NLP View Mode Toggle */}
              <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                <button
                  className={`filter-tab ${viewMode === 'text' ? 'active' : ''}`}
                  onClick={() => setViewMode('text')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-light)',
                    background: viewMode === 'text' ? 'var(--color-primary)' : 'transparent',
                    color: viewMode === 'text' ? 'white' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  📄 Text View
                </button>
                <button
                  className={`filter-tab ${viewMode === 'page' ? 'active' : ''}`}
                  onClick={() => setViewMode('page')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-light)',
                    background: viewMode === 'page' ? 'var(--color-primary)' : 'transparent',
                    color: viewMode === 'page' ? 'white' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  🌐 Page View (HTML Live)
                </button>
                <button
                  className={`filter-tab ${viewMode === 'seo' ? 'active' : ''}`}
                  onClick={() => setViewMode('seo')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-light)',
                    background: viewMode === 'seo' ? 'var(--color-primary)' : 'transparent',
                    color: viewMode === 'seo' ? 'white' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  🔍 SEO Tags Audit
                </button>
                <button
                  className={`filter-tab ${viewMode === 'keywords' ? 'active' : ''}`}
                  onClick={() => setViewMode('keywords')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-light)',
                    background: viewMode === 'keywords' ? 'var(--color-primary)' : 'transparent',
                    color: viewMode === 'keywords' ? 'white' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  🔑 Keywords Density
                </button>
                <button
                  className={`filter-tab ${viewMode === 'nlp' ? 'active' : ''}`}
                  onClick={() => setViewMode('nlp')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-light)',
                    background: viewMode === 'nlp' ? 'var(--color-primary)' : 'transparent',
                    color: viewMode === 'nlp' ? 'white' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  🤖 NLP & AI Engine (AEO/GEO)
                </button>
                <button
                  className={`filter-tab ${viewMode === 'optimizer' ? 'active' : ''}`}
                  onClick={() => setViewMode('optimizer')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-light)',
                    background: viewMode === 'optimizer' ? 'var(--color-primary)' : 'transparent',
                    color: viewMode === 'optimizer' ? 'white' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  ✍️ Content Optimizer
                </button>
              </div>
            </div>
            
            {/* Highlight Toggle Filters (Only visible in Text View mode) */}
            {viewMode === 'text' && (
              <div className="highlight-toggle-bar" style={{ margin: 0 }}>
                <button 
                  className={`highlight-toggle-btn ${highlightFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setHighlightFilter('all')}
                >
                  All Highlights
                </button>
                <button 
                  className={`highlight-toggle-btn type-dup ${highlightFilter === 'duplicate' ? 'active' : ''}`}
                  onClick={() => setHighlightFilter('duplicate')}
                >
                  Duplicates Only
                </button>
                <button 
                  className={`highlight-toggle-btn type-common ${highlightFilter === 'common' ? 'active' : ''}`}
                  onClick={() => setHighlightFilter('common')}
                >
                  Common Only
                </button>
                <button 
                  className={`highlight-toggle-btn ${highlightFilter === 'none' ? 'active' : ''}`}
                  onClick={() => setHighlightFilter('none')}
                >
                  None
                </button>
              </div>
            )}
          </div>

          {viewMode === 'text' && (
            <div className="text-content-scroll">
              {textSegments.map((seg, idx) => {
                const activeHighlight = shouldHighlightSegment(seg);
                if (activeHighlight) {
                  const isActive = isSegmentHoveredOrClicked(seg);
                  const className = seg.blockType === 'common' 
                    ? `common-highlight-span ${isActive ? 'active' : ''}` 
                    : `dup-highlight-span ${isActive ? 'active' : ''}`;

                  return (
                    <span
                      key={idx}
                      className={className}
                      onMouseEnter={() => setHoveredBlockIdx(seg.blockIdx)}
                      onMouseLeave={() => setHoveredBlockIdx(null)}
                      onClick={() => setSelectedBlockIdx(
                        selectedBlockIdx === seg.blockIdx ? null : seg.blockIdx
                      )}
                      title={`Click to view match details (${seg.blockType === 'common' ? 'Common Boilerplate' : 'Duplicate Content'})`}
                    >
                      {seg.text}
                    </span>
                  );
                }
                return <span key={idx}>{seg.text}</span>;
              })}
            </div>
          )}

          {viewMode === 'page' && (
            <div className="html-viewer-iframe-wrapper" style={{ height: '70vh', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
              <iframe
                src={`/api/crawl/view-html?url=${encodeURIComponent(url)}`}
                style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
                title="Page HTML Live Replica View"
                sandbox="allow-same-origin allow-scripts"
              />
            </div>
          )}

          {viewMode === 'seo' && (
            <div className="seo-audit-container text-content-scroll" style={{ height: '70vh', overflowY: 'auto', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Google SERP Snippet Preview */}
              <div className="serp-preview-card" style={{ background: '#ffffff', border: '1px solid #dadce0', borderRadius: '8px', padding: '1rem', fontFamily: 'arial, sans-serif' }}>
                <h4 style={{ color: '#70757a', fontSize: '12px', margin: '0 0 6px 0', fontWeight: 'normal' }}>
                  Google Search Snippet Preview
                </h4>
                <div className="serp-title" style={{ color: '#1a0dab', fontSize: '20px', lineHeight: '1.3', cursor: 'pointer', textDecoration: 'none', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {title.length > 60 ? title.substring(0, 60) + '...' : title}
                </div>
                <div className="serp-url" style={{ color: '#202124', fontSize: '14px', lineHeight: '1.3', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {url}
                </div>
                <div className="serp-description" style={{ color: '#4d5156', fontSize: '14px', lineHeight: '1.58', wordWrap: 'break-word' }}>
                  {metaDescription ? (metaDescription.length > 155 ? metaDescription.substring(0, 155) + '...' : metaDescription) : 'Please provide a meta description for this page to optimize search presence.'}
                </div>
              </div>

              {/* SEO Checklist */}
              <div className="seo-checklist" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <h3 style={{ fontSize: '1.1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', margin: '0 0 0.5rem 0' }}>SEO Health Check</h3>
                
                {/* Title Checklist */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.9rem' }}>
                  <span style={{ fontSize: '1.25rem', lineHeight: '1.2' }}>
                    {!title ? '❌' : (title.length > 60 || title.length < 30) ? '⚠️' : '✅'}
                  </span>
                  <div>
                    <strong>Page Title:</strong> "{title || 'Missing'}" ({title ? title.length : 0} characters)
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {!title ? 'Title is missing. Search engines require title tags for indexing.' : (title.length > 60) ? 'Title exceeds 60 characters and will be truncated in search results.' : (title.length < 30) ? 'Title is too short. Try making it more descriptive.' : 'Optimal length (30-60 characters).'}
                    </div>
                  </div>
                </div>

                {/* Description Checklist */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.9rem' }}>
                  <span style={{ fontSize: '1.25rem', lineHeight: '1.2' }}>
                    {!metaDescription ? '❌' : (metaDescription.length > 160 || metaDescription.length < 50) ? '⚠️' : '✅'}
                  </span>
                  <div>
                    <strong>Meta Description:</strong> {metaDescription ? `"${metaDescription}"` : 'Missing'} ({metaDescription ? metaDescription.length : 0} characters)
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {!metaDescription ? 'Meta description is missing. Search engines will automatically generate one, which might not look appealing.' : (metaDescription.length > 160) ? 'Description exceeds 160 characters and will be truncated.' : (metaDescription.length < 50) ? 'Description is too short. Expand it to describe the page content better.' : 'Optimal length (50-160 characters).'}
                    </div>
                  </div>
                </div>

                {/* H1 Checklist */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.9rem' }}>
                  <span style={{ fontSize: '1.25rem', lineHeight: '1.2' }}>
                    {h1Count === 1 ? '✅' : h1Count === 0 ? '❌' : '⚠️'}
                  </span>
                  <div>
                    <strong>H1 Heading Tag:</strong> {h1Count} found
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {h1Count === 1 ? 'Exactly one <h1> tag found. Perfect heading hierarchy!' : h1Count === 0 ? 'No <h1> tag found. Every page should have exactly one main heading.' : `Multiple (${h1Count}) <h1> tags found. Avoid having more than one <h1> per page for optimal structure.`}
                    </div>
                  </div>
                </div>

                {/* Canonical Checklist */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.9rem' }}>
                  <span style={{ fontSize: '1.25rem', lineHeight: '1.2' }}>
                    {!canonicalUrl ? '⚠️' : canonicalUrl === url ? '✅' : '⚠️'}
                  </span>
                  <div>
                    <strong>Canonical URL:</strong> {canonicalUrl || 'Not specified'}
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {!canonicalUrl ? 'Canonical tag is missing. Add it to prevent duplicate content indexing issues.' : canonicalUrl !== url ? `Points to a different URL: "${canonicalUrl}". Verify this is intentional.` : 'Canonical tag is configured correctly and matches the page URL.'}
                    </div>
                  </div>
                </div>

                {/* Robots tag */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.9rem' }}>
                  <span style={{ fontSize: '1.25rem', lineHeight: '1.2' }}>ℹ️</span>
                  <div>
                    <strong>Robots Directive:</strong> {robots || 'index, follow (default)'}
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Informs crawler search bots whether to index this page and follow its outbound links.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'keywords' && (
            <div className="keywords-density-container text-content-scroll" style={{ height: '70vh', overflowY: 'auto', padding: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', margin: '0 0 0.5rem 0' }}>
                Keyword Frequency & Density
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Analyzes the visible text content of this page, filters out common stop words, and measures keyword density percentages. Density values between 1% and 3% are optimal. Avoid exceeding 5% to prevent keyword stuffing penalties.
              </p>
              <KeywordDensityTable text={text} />
            </div>
          )}

          {viewMode === 'nlp' && (
            <div className="nlp-analysis-container text-content-scroll" style={{ height: '70vh', overflowY: 'auto', padding: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', margin: '0 0 0.5rem 0' }}>
                Semantic NLP, AEO & GEO Analysis
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Measures readability scores, extracts semantic named entities, and audits the page structure for Answer Engine (AEO) and Generative Search Engine (GEO) optimization parameters.
              </p>
              <SemanticNlpPanel text={text} schemas={schemas} url={url} title={title} links={links} />
            </div>
          )}

          {viewMode === 'optimizer' && (
            <div className="optimizer-workspace-container" style={{ padding: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', margin: '0 0 0.5rem 0' }}>
                SurferSEO-Style Content Optimizer Sandbox
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Draft, edit, or paste your copy below. The panel on the right measures your score, checks LSI keyword densities, and suggests topical insulation links in real-time.
              </p>
              {renderSurferOptimizerWorkspace()}
            </div>
          )}
        </div>

        {/* Right Side: Sidebar Panels */}
        <div className="sidebar-panels-container">
          {viewMode === 'optimizer' ? renderOptimizerScorePanel() : (
            <>
              {/* Panel 1: Selected Block Details */}
              {activeBlock && (
                <div className="side-panel glass-card active-block-panel" style={{ borderColor: activeBlock.type === 'common' ? 'var(--color-primary)' : 'var(--color-danger)' }}>
                  <div className="panel-header">
                    <h3 style={{ color: activeBlock.type === 'common' ? 'var(--color-primary)' : '#ff859b' }}>
                      Selected {activeBlock.type === 'common' ? 'Common Boilerplate' : 'Duplicate Passage'}
                    </h3>
                    <button className="close-panel-btn" onClick={() => setSelectedBlockIdx(null)}>×</button>
                  </div>
                  <div className="panel-body">
                    <p className="block-preview-text">"{activeBlock.text}"</p>
                    <div className="block-meta">
                      <span><strong>Length:</strong> {activeBlock.wordCount} words</span>
                      <span style={{ margin: '0 0.5rem' }}>•</span>
                      <span><strong>Type:</strong> <span style={{ color: activeBlock.type === 'common' ? 'var(--color-primary)' : '#ff859b', fontWeight: 600 }}>{activeBlock.type}</span></span>
                    </div>
                    <div className="block-matches-list">
                      <strong>Matches found on ({(activeBlock.matches || []).length}):</strong>
                      <ul style={{ maxHeight: '120px', overflowY: 'auto' }}>
                        {(activeBlock.matches || []).map(matchUrl => (
                          <li key={matchUrl} className="match-url-item">
                            <button className="link-style-btn" onClick={() => onSelectPage(matchUrl)}>
                              {matchUrl}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Panel 2: Matching Pages List */}
              <div className="side-panel glass-card">
                <h3 className="panel-title">Matching Pages ({matchStats.length})</h3>
                <div className="panel-list-scroll">
                  {matchStats.length === 0 ? (
                    <div className="no-matches-msg">No shared content found.</div>
                  ) : (
                    matchStats.map(stat => (
                      <div
                        key={stat.url}
                        className={`match-item-card ${isCardHighlighted(stat.url) ? 'hovered' : ''}`}
                        onMouseEnter={() => setHoveredUrl(stat.url)}
                        onMouseLeave={() => setHoveredUrl(null)}
                        style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border-light)' }}
                      >
                        <div className="match-card-header">
                          <button 
                            className="match-title-btn" 
                            onClick={() => onSelectPage(stat.url)}
                            title="Analyze this page"
                            style={{ background: 'none', border: 'none', color: '#2563eb', padding: 0, textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left', fontWeight: 600 }}
                          >
                            {stat.url.split('/').pop() || stat.url}
                          </button>
                        </div>
                        <div className="match-card-stats" style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', fontSize: '0.72rem' }}>
                          {stat.dupWordCount > 0 && (
                            <div style={{ color: 'var(--color-warning)' }}>
                              <strong>{stat.dupWordCount}</strong> duplicate words ({stat.dupBlockCount} blocks)
                            </div>
                          )}
                          {stat.commonWordCount > 0 && (
                            <div style={{ color: 'var(--color-primary)' }}>
                              <strong>{stat.commonWordCount}</strong> common boilerplate words ({stat.commonBlockCount} blocks)
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Panel 3: Links on Page */}
              <div className="side-panel glass-card">
                <h3 className="panel-title">Links on Page ({links.length})</h3>
                <div className="panel-list-scroll links-scroll">
                  {links.length === 0 ? (
                    <div className="no-matches-msg">No outbound links found.</div>
                  ) : (
                    <ul className="links-status-list">
                      {links.map((link, idx) => (
                        <li key={idx} className={`link-status-item ${link.isExternal ? 'external' : 'internal'}`}>
                          <div className="link-href-text" title={link.resolved}>{link.resolved}</div>
                          <span className={`link-type-badge ${link.isExternal ? 'badge-ext' : 'badge-int'}`}>
                            {link.isExternal ? 'External' : 'Internal'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )}

      {activeSubTab === 'onpage' && renderOnPageTab()}
      {activeSubTab === 'eeat' && renderEEATTab()}
      {activeSubTab === 'aeo' && renderAEOTab()}
      {activeSubTab === 'aiseo' && renderAISEOTab()}
    </div>
  );
}

function KeywordDensityTable({ text }) {
  const keywordData = useMemo(() => {
    if (!text) return { single: [], bigram: [], trigram: [] };

    const stopWords = new Set([
      'the', 'and', 'a', 'of', 'in', 'to', 'is', 'for', 'with', 'that', 'it', 'on', 'at', 'by',
      'this', 'an', 'are', 'be', 'as', 'from', 'at', 'your', 'or', 'you', 'was', 'with', 'we',
      'our', 'us', 'i', 'my', 'me', 'they', 'them', 'their', 'he', 'she', 'him', 'her', 'but',
      'if', 'not', 'have', 'has', 'had', 'do', 'does', 'did', 'about', 'can', 'will', 'would'
    ]);

    const words = text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);

    const totalWordCount = words.length;
    if (totalWordCount === 0) return { single: [], bigram: [], trigram: [] };

    // 1-Word
    const singleCounts = {};
    words.forEach(w => {
      if (stopWords.has(w)) return;
      singleCounts[w] = (singleCounts[w] || 0) + 1;
    });

    // 2-Word
    const bigramCounts = {};
    for (let i = 0; i < words.length - 1; i++) {
      const w1 = words[i];
      const w2 = words[i+1];
      if (stopWords.has(w1) || stopWords.has(w2)) continue;
      const phrase = `${w1} ${w2}`;
      bigramCounts[phrase] = (bigramCounts[phrase] || 0) + 1;
    }

    // 3-Word
    const trigramCounts = {};
    for (let i = 0; i < words.length - 2; i++) {
      const w1 = words[i];
      const w2 = words[i+1];
      const w3 = words[i+2];
      if (stopWords.has(w1) || stopWords.has(w3)) continue;
      const phrase = `${w1} ${w2} ${w3}`;
      trigramCounts[phrase] = (trigramCounts[phrase] || 0) + 1;
    }

    const sortAndFormat = (countsMap) => {
      return Object.entries(countsMap)
        .map(([phrase, count]) => {
          const density = ((count / totalWordCount) * 100).toFixed(1);
          return { phrase, count, density: parseFloat(density) };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
    };

    return {
      single: sortAndFormat(singleCounts),
      bigram: sortAndFormat(bigramCounts),
      trigram: sortAndFormat(trigramCounts)
    };
  }, [text]);

  const renderTable = (list, title) => {
    return (
      <div style={{ flex: 1, minWidth: '220px' }}>
        <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.35rem' }}>
          {title}
        </h4>
        <table className="pages-table" style={{ fontSize: '0.8rem', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ padding: '0.4rem', textAlign: 'left' }}>Keyword</th>
              <th style={{ padding: '0.4rem', textAlign: 'center' }}>Count</th>
              <th style={{ padding: '0.4rem', textAlign: 'right' }}>Density</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan="3" className="no-data" style={{ padding: '0.8rem' }}>None found.</td>
              </tr>
            ) : (
              list.map((item, idx) => (
                <tr key={idx} style={{ background: item.density > 5 ? 'rgba(239, 68, 68, 0.05)' : 'none' }}>
                  <td style={{ padding: '0.4rem', fontWeight: 500, color: 'var(--text-dark)' }}>{item.phrase}</td>
                  <td style={{ padding: '0.4rem', textAlign: 'center' }}>{item.count}</td>
                  <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 'bold', color: item.density > 5 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    {item.density}% {item.density > 5 && '⚠️'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
      {renderTable(keywordData.single, '1-Word Keywords')}
      {renderTable(keywordData.bigram, '2-Word Phrases')}
      {renderTable(keywordData.trigram, '3-Word Phrases')}
    </div>
  );
}

function SemanticNlpPanel({ text, schemas, url, title, links }) {
  const nlpData = useMemo(() => {
    if (!text) return {
      readingEase: 0,
      gradeLevel: 'N/A',
      entities: { orgs: [], locs: [], numbers: [] },
      qaPairs: [],
      authoritativeToneScore: 0,
      infoDensity: 0,
      citationCount: 0,
      geoScore: 0
    };

    const countSyllables = (word) => {
      word = word.toLowerCase().trim();
      if (word.length <= 3) return 1;
      word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
      word = word.replace(/^y/, '');
      const matches = word.match(/[aeiouy]{1,2}/g);
      return matches ? matches.length : 1;
    };

    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    const words = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, '').split(/\s+/).filter(Boolean);
    
    const wordCount = words.length;
    const sentenceCount = sentences.length || 1;

    // Text with no word characters (e.g. only punctuation/whitespace) would make the
    // Flesch division 0/0 = NaN. Return the same neutral default the empty-text guard uses.
    if (wordCount === 0) return {
      readingEase: 0,
      gradeLevel: 'N/A',
      entities: { orgs: [], locs: [], numbers: [] },
      qaPairs: [],
      authoritativeToneScore: 0,
      infoDensity: 0,
      citationCount: 0,
      geoScore: 0
    };

    let totalSyllables = 0;
    words.forEach(w => {
      totalSyllables += countSyllables(w);
    });

    const readingEase = parseFloat((206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (totalSyllables / wordCount)).toFixed(1));

    let gradeLevel = 'Standard';
    if (readingEase > 90) gradeLevel = '5th Grade (Very Easy)';
    else if (readingEase > 80) gradeLevel = '6th Grade (Easy)';
    else if (readingEase > 70) gradeLevel = '7th Grade (Fairly Easy)';
    else if (readingEase > 60) gradeLevel = '8th & 9th Grade (Standard - Optimal)';
    else if (readingEase > 50) gradeLevel = '10th to 12th Grade (Fairly Difficult)';
    else if (readingEase > 30) gradeLevel = 'College (Difficult)';
    else gradeLevel = 'College Graduate (Very Difficult)';

    const orgSuffixes = /\b(inc|corp|co|ltd|agency|group|systems|solutions|university|bank|studios)\b/i;
    const locationIndicators = /\b(street|road|avenue|city|state|country|county|beach|island|mountain|hills|valley|lake|park|square|station|center)\b/i;
    const statRegex = /\b\d+(?:\.\d+)?%|\$\d+(?:,\d+)*(?:\.\d+)?|\b\d{4}\b/g;

    const orgsSet = new Set();
    const locsSet = new Set();
    const numbersSet = new Set();

    const statsMatched = text.match(statRegex);
    if (statsMatched) {
      statsMatched.forEach(s => numbersSet.add(s));
    }

    sentences.forEach(sentence => {
      const sentenceWords = sentence.split(/\s+/).filter(w => w.length > 2);
      for (let i = 0; i < sentenceWords.length; i++) {
        const w = sentenceWords[i];
        if (w[0] && w[0] === w[0].toUpperCase()) {
          const cleanW = w.replace(/[^\w]/g, '');
          if (orgSuffixes.test(cleanW)) {
            orgsSet.add(cleanW);
          }
          if (locationIndicators.test(cleanW)) {
            locsSet.add(cleanW);
          }
          if (/^(Google|Apple|Microsoft|Amazon|Facebook|Meta|OpenAI|SEO Intel|Hyer|Makeup|Mmkup)$/i.test(cleanW)) {
            orgsSet.add(cleanW);
          }
        }
      }
    });

    const qaPairs = [];
    sentences.forEach((sentence, idx) => {
      if (sentence.includes('?') || /^(what|how|why|who|where|when|which|can|is|are|do|does)\b/i.test(sentence)) {
        const nextSentence = sentences[idx + 1];
        if (nextSentence) {
          qaPairs.push({
            question: sentence + (sentence.endsWith('?') ? '' : '?'),
            answer: nextSentence
          });
        }
      }
    });

    const authoritativeWords = /\b(verified|demonstrates|proves|concludes|research|statistics|studies|data|validated|according to)\b/i;

    const totalAuthSentences = sentences.filter(s => authoritativeWords.test(s)).length;
    const authoritativeToneScore = Math.min(100, Math.round(((totalAuthSentences + 1) / (sentences.length || 1)) * 100));

    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const infoDensity = parseFloat(((uniqueWords.size / (wordCount || 1)) * 100).toFixed(1));

    const externalLinksCount = (links || []).filter(l => l.isExternal).length;
    const geoScore = Math.min(100, Math.round((infoDensity * 0.4) + (authoritativeToneScore * 0.4) + (Math.min(5, externalLinksCount) * 4)));

    return {
      readingEase,
      gradeLevel,
      entities: {
        orgs: Array.from(orgsSet).slice(0, 5),
        locs: Array.from(locsSet).slice(0, 5),
        numbers: Array.from(numbersSet).slice(0, 8)
      },
      qaPairs: qaPairs.slice(0, 3),
      authoritativeToneScore,
      infoDensity,
      citationCount: externalLinksCount,
      geoScore
    };
  }, [text, links]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* SECTION A: SEMANTIC NLP INSIGHTS */}
      <div className="nlp-card" style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '1.25rem', background: 'var(--card-bg)' }}>
        <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
          🧠 Semantic NLP Analysis
        </h4>
        
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          
          {/* Readability Score */}
          <div style={{ flex: 1, minWidth: '250px' }}>
            <strong style={{ fontSize: '0.9rem' }}>Readability (Flesch Reading Ease):</strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: nlpData.readingEase > 60 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                {nlpData.readingEase}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{nlpData.gradeLevel}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Target standard: 60-70 for general audience readability and optimal crawling retention.
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* SECTION C: GENERATIVE ENGINE OPTIMIZATION (GEO) */}
      <div className="nlp-card" style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '1.25rem', background: 'var(--card-bg)' }}>
        <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)' }}>
          🚀 Generative Engine Optimization (GEO) Strength
        </h4>
        
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center', padding: '0.5rem 1.5rem', borderRight: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-success)' }}>{nlpData.geoScore}%</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>GEO Score</div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <span><strong>Information Density</strong> (Ratio of unique words)</span>
                <span style={{ fontWeight: 'bold' }}>{nlpData.infoDensity}%</span>
              </div>
              <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${nlpData.infoDensity}%`, height: '100%', background: 'var(--color-success)' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <span><strong>Authoritative Tone Strength</strong></span>
                <span style={{ fontWeight: 'bold' }}>{nlpData.authoritativeToneScore}%</span>
              </div>
              <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${nlpData.authoritativeToneScore}%`, height: '100%', background: '#8b5cf6' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <span><strong>Outbound Citation Verification Count</strong> (External links)</span>
                <span style={{ fontWeight: 'bold' }}>{nlpData.citationCount}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                LLM citation generators favor pages that link to external research sources.
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}
