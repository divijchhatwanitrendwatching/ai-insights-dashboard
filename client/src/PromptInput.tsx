import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DARK_BG = "#15171B";
const LIGHT_BG = "#F6F7F8";

const updateOptions = [
  { value: '15min', label: 'Every 15 min' },
  { value: 'hourly', label: 'Hourly update' },
  { value: 'daily', label: 'Daily update' },
  { value: 'weekly', label: 'Weekly update' },
  { value: 'monthly', label: 'Monthly update' },
];

const researchOptions = [
  { value: 'highlevel', label: 'High-level summary' },
  { value: 'in-depth', label: 'In-depth analysis' },
];

interface SavedReport {
  topic: string;
  insights: string;
  updateInterval: string;
  researchDepth: string;
  lastUpdated: string;
}

export default function PromptInput() {
  const [darkMode, setDarkMode] = useState(true);
  const [topic, setTopic] = useState('');
  const [updateInterval, setUpdateInterval] = useState(updateOptions[2].value);
  const [researchDepth, setResearchDepth] = useState(researchOptions[0].value);
  const [insights, setInsights] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [error, setError] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // On load: Get saved reports and theme
  useEffect(() => {
    const stored = localStorage.getItem('savedReportsV2');
    if (stored) setSavedReports(JSON.parse(stored));
    const theme = localStorage.getItem('dashboardTheme');
    if (theme === 'light') setDarkMode(false);
  }, []);

  const saveReports = (reports: SavedReport[]) => {
    setSavedReports(reports);
    localStorage.setItem('savedReportsV2', JSON.stringify(reports));
  };

  useEffect(() => {
    localStorage.setItem('dashboardTheme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  async function handleGenerate(forceTopic?: string, forceResearch?: string, forceUpdate?: string) {
    setLoading(true);
    setError('');
    setInsights('');
    try {
      let finalPrompt = forceTopic || topic;
      const research = forceResearch || researchDepth;
      if (research === 'in-depth') {
        finalPrompt += '. Provide an in-depth analysis with sections for summary, mega trends, consumer trends, future scenarios, and key stats. Use headings for each section.';
      } else {
        finalPrompt += '. Provide a concise, high-level summary highlighting only the 3-4 most important points. Use headings if relevant.';
      }
      // Change this line:
      // const response = await axios.post('https://ai-insights-dashboard-2.onrender.com', {
      //   topic: finalPrompt,
      // });
      // to:
      const response = await axios.post('https://ai-insights-dashboard-zy80.onrender.com/api/generate-fused', {
        topic: finalPrompt,
      });
      const aiOutput =
        response?.data?.insights ||
        response?.data?.result ||
        response?.data?.text ||
        response?.data ||
        'No insights found.';
      setInsights(aiOutput);

      const currentTopic = forceTopic || topic;
      const currentUpdate = forceUpdate || updateInterval;
      const currentResearch = forceResearch || researchDepth;
      if (currentTopic) {
        const now = new Date().toISOString();
        const existing = savedReports.filter(
          (r) =>
            r.topic.toLowerCase() !== currentTopic.toLowerCase() ||
            r.researchDepth !== currentResearch ||
            r.updateInterval !== currentUpdate
        );
        const updated: SavedReport[] = [
          ...existing,
          {
            topic: currentTopic,
            insights: aiOutput,
            updateInterval: currentUpdate,
            researchDepth: currentResearch,
            lastUpdated: now,
          },
        ];
        saveReports(updated);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
        err?.message ||
        'Failed to fetch insights.'
      );
    } finally {
      setLoading(false);
    }
  }

  function handleLoadReport(report: SavedReport) {
    setTopic(report.topic);
    setUpdateInterval(report.updateInterval);
    setResearchDepth(report.researchDepth);
    setInsights(report.insights);
  }

  function handleDeleteReport(idx: number) {
    const updated = savedReports.filter((_, i) => i !== idx);
    saveReports(updated);
    setInsights('');
  }

  function handleEditReport(idx: number) {
    setEditingIdx(idx);
    setEditingValue(savedReports[idx].topic);
  }

  function handleSaveEdit(idx: number) {
    if (!editingValue.trim()) return;
    const updated = [...savedReports];
    updated[idx].topic = editingValue.trim();
    saveReports(updated);
    setEditingIdx(null);
    setEditingValue('');
  }

  function handleClearAll() {
    saveReports([]);
    setInsights('');
  }

  function handleExportPDF(report: SavedReport) {
    const win = window.open('', '', 'height=700,width=900');
    if (!win) return;
    win.document.write('<html><head><title>AI Trend Report</title></head><body>');
    win.document.write(`<h1>${report.topic}</h1>`);
    win.document.write('<pre style="font-size:16px;font-family:Arial,sans-serif;">');
    win.document.write(report.insights.replace(/</g, '&lt;'));
    win.document.write('</pre></body></html>');
    win.document.close();
    setTimeout(() => win.print(), 300);
  }

  function handleExportWord(report: SavedReport) {
    const content =
      `<html><head><meta charset='utf-8'></head><body><h1>${report.topic}</h1><pre style="font-size:16px;font-family:Arial,sans-serif;">${report.insights.replace(/</g, '&lt;')}</pre></body></html>`;
    const blob = new Blob(['\ufeff', content], {
      type: 'application/msword',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.topic.replace(/[^a-zA-Z0-9]+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleUpdateNow(idx: number) {
    const report = savedReports[idx];
    await handleGenerate(report.topic, report.researchDepth, report.updateInterval);
  }

  async function handleCopy(idx: number) {
    try {
      await navigator.clipboard.writeText(savedReports[idx].insights);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1200);
    } catch (e) { }
  }

  // Styling
  const bg = darkMode ? DARK_BG : LIGHT_BG;
  const textColor = darkMode ? 'text-white' : 'text-[#20232a]';
  const cardBg = darkMode ? '#23262D' : '#fff';
  const inputBg = darkMode ? '#191B1F' : '#F9FAFB';
  const highlightColor = darkMode ? '#1CCAFF' : '#3882F6';
  const yellowColor = darkMode ? '#FFD600' : '#FFBB00';
  const iconHover = darkMode ? 'hover:bg-[#2b3136]' : 'hover:bg-[#e7eafd]';

  return (
    <div className={`min-h-screen w-full px-0 py-0`} style={{ background: bg }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&family=Libre+Franklin:wght@400;700;900&display=swap');
          body { background: ${bg} !important; }
          ::selection { background: #1ccaff44; }
        `}
      </style>

      {/* Dark/Light toggle */}
      {/* Remove the top bar, just show the toggle button inline at the top right of the content */}
      <div className="w-full max-w-7xl mx-auto flex justify-end items-center pt-6 pr-10">
        <button
          onClick={() => setDarkMode((d) => !d)}
          className={`px-4 py-2 rounded-xl font-bold shadow transition-colors ${darkMode ? "bg-[#FFD600] text-black" : "bg-[#222c4b] text-[#FFD600]"}`}
          title="Toggle light/dark mode"
        >
          {darkMode ? "🌞 Light" : "🌙 Dark"}
        </button>
      </div>

      <div className="w-full max-w-5xl text-center mt-6 mb-3 mx-auto">
        <div className="flex justify-center mb-2">
          <span className="text-4xl mr-2" style={{ color: yellowColor }}>✨</span>
        </div>
        <h1 className={`text-5xl font-extrabold mb-2`} style={{ letterSpacing: '-2px', color: darkMode ? "#fff" : "#181A20" }}>
          AI Trend Dashboard
        </h1>
      </div>

      <div className="w-full max-w-7xl flex flex-col md:flex-row gap-8 items-start justify-center mt-2 mb-8 mx-auto">

        {/* SAVED REPORTS */}
        <div className="flex-1 max-w-2xl w-[650px] min-w-[360px]">
          <div className="shadow-lg rounded-2xl p-7 mb-6" style={{ background: cardBg }}>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: yellowColor }}>
                Saved Reports
              </h2>
              {savedReports.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className={`px-3 py-1 rounded-lg font-medium text-xs border transition-all ${darkMode ? 'bg-[#26292f] text-[#FFD600] border-[#FFD600] hover:bg-[#383f49]' : 'bg-[#f7f3e9] text-[#FFBB00] border-[#FFD600] hover:bg-[#ffedc6]'}`}
                  title="Clear all saved reports"
                >
                  Clear All
                </button>
              )}
            </div>
            <div className="text-xs text-gray-400 mb-2 font-medium">
              Saved locally. Click a report to view. Rename, refresh, export, copy, or delete below.
            </div>
            {savedReports.length === 0 && (
              <p className={`${textColor} text-base font-medium mt-2 mb-2`}>
                No saved reports yet.
              </p>
            )}
            <div className="flex flex-col gap-3">
              {savedReports
                .slice()
                .reverse()
                .map((r, idxOrig) => {
                  const idx = savedReports.length - 1 - idxOrig;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 px-5 py-3 rounded-xl hover:bg-[#e7eafd1c] transition-all"
                      style={{ background: inputBg, border: darkMode ? '1.5px solid #272f35' : '1.5px solid #e6ebf1' }}
                    >
                      {editingIdx === idx ? (
                        <input
                          className="flex-1 bg-transparent border-b-2 border-[#1CCAFF] text-lg font-semibold outline-none mr-2"
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          onBlur={() => handleSaveEdit(idx)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveEdit(idx)}
                          autoFocus
                        />
                      ) : (
                        <div
                          className="flex flex-col cursor-pointer w-[80%] truncate"
                          onClick={() => handleLoadReport(r)}
                          title={r.topic}
                        >
                          <span className="font-semibold text-lg truncate" style={{ color: highlightColor }}>
                            {r.topic}
                          </span>
                          <span className="text-xs text-gray-400">
                            {updateOptions.find((u) => u.value === r.updateInterval)?.label || 'Unknown'}
                            {' • '}
                            {researchOptions.find((d) => d.value === r.researchDepth)?.label || 'Summary'}
                            <br />
                            <span className="text-[10px]">
                              Updated:{' '}
                              {r.lastUpdated
                                ? new Date(r.lastUpdated).toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Never'}
                            </span>
                          </span>
                        </div>
                      )}
                      {/* ICONS: smaller and in two rows */}
                      <div className="flex flex-col gap-0 items-center ml-1">
                        <div className="flex gap-1 mb-1">
                          <IconBtn onClick={() => handleEditReport(idx)} title="Rename" icon="✏️" darkMode={darkMode} iconHover={iconHover} iconSize={15} />
                          <IconBtn onClick={() => handleUpdateNow(idx)} title="Update now" icon="🔄" darkMode={darkMode} iconHover={iconHover} iconSize={15} />
                          <IconBtn onClick={() => handleExportPDF(r)} title="Export as PDF" icon="📄" darkMode={darkMode} iconHover={iconHover} iconSize={15} />
                        </div>
                        <div className="flex gap-1">
                          <IconBtn onClick={() => handleExportWord(r)} title="Export as Word" icon="📝" darkMode={darkMode} iconHover={iconHover} iconSize={15} />
                          <IconBtn onClick={() => handleCopy(idx)} title="Copy to clipboard" icon="📋" darkMode={darkMode} iconHover={iconHover} highlight={copiedIdx === idx} iconSize={15} />
                          <IconBtn onClick={() => handleDeleteReport(idx)} title="Delete" icon="🗑️" darkMode={darkMode} iconHover={iconHover} iconSize={15} />
                        </div>
                      </div>
                      {copiedIdx === idx && (
                        <span className={`text-xs font-bold pl-2 ${darkMode ? "text-[#FFD600]" : "text-[#222c4b]"}`}>Copied!</span>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        </div>

        {/* MAIN CARD */}
        <div className="flex-[2] w-full">
          <div className="shadow-xl rounded-2xl px-7 py-8 mb-8" style={{ background: cardBg }}>
            <div className="flex flex-col md:flex-row gap-3 items-center mb-6">
              <input
                className={`w-full md:w-auto flex-1 px-5 py-3 text-lg rounded-lg border focus:ring-2 transition-all ${
                  darkMode
                    ? "bg-[#191B1F] text-white border-[#333] focus:border-[#1CCAFF] focus:ring-[#1CCAFF]"
                    : "bg-[#F5F6F9] text-[#181A20] border-[#C3C5C9] focus:border-[#3882F6] focus:ring-[#3882F6]"
                }`}
                placeholder="Enter a trend topic..."
                value={topic}
                maxLength={80}
                onChange={(e) => setTopic(e.target.value)}
                autoFocus
              />
              <select
                className={`px-4 py-3 text-base rounded-lg border focus:ring-2 transition-all ${
                  darkMode
                    ? "bg-[#191B1F] text-white border-[#333] focus:border-[#1CCAFF] focus:ring-[#1CCAFF]"
                    : "bg-[#F5F6F9] text-[#181A20] border-[#C3C5C9] focus:border-[#3882F6] focus:ring-[#3882F6]"
                }`}
                value={updateInterval}
                onChange={(e) => setUpdateInterval(e.target.value)}
              >
                {updateOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                className={`px-4 py-3 text-base rounded-lg border focus:ring-2 transition-all ${
                  darkMode
                    ? "bg-[#191B1F] text-white border-[#333] focus:border-[#1CCAFF] focus:ring-[#1CCAFF]"
                    : "bg-[#F5F6F9] text-[#181A20] border-[#C3C5C9] focus:border-[#3882F6] focus:ring-[#3882F6]"
                }`}
                value={researchDepth}
                onChange={(e) => setResearchDepth(e.target.value)}
              >
                {researchOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                className={`px-7 py-3 text-lg font-bold rounded-lg shadow transition-all ${
                  loading || !topic
                    ? "bg-gray-400 text-white"
                    : "bg-[#3882F6] text-white hover:bg-[#1CCAFF] hover:text-[#23262D]"
                }`}
                disabled={loading || !topic}
                onClick={() => handleGenerate()}
              >
                {loading ? 'Generating...' : 'Generate'}
              </button>
            </div>

            {error && (
              <div className="text-red-400 text-base font-semibold mb-2">{error}</div>
            )}

            {insights && (
              <div className="mt-6 rounded-xl px-7 py-6 shadow-md animate-fade-in"
                style={{
                  background: darkMode ? "#181A20" : "#F8FAFF",
                  border: darkMode ? "1px solid #23262D" : "1.5px solid #c9e7fa",
                }}>
                <RenderFormattedInsights text={insights} darkMode={darkMode} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ onClick, title, icon, darkMode, iconHover, highlight = false, iconSize = 17 }:
  { onClick: () => void, title: string, icon: string, darkMode: boolean, iconHover: string, highlight?: boolean, iconSize?: number }) {
  return (
    <button
      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${iconHover} ${highlight ? (darkMode ? "bg-[#FFD600] text-[#181A20]" : "bg-[#3882F6] text-white") : ""}`}
      style={{ fontSize: iconSize, fontWeight: 700, padding: 0 }}
      title={title}
      onClick={onClick}
      tabIndex={-1}
      type="button"
    >
      {icon}
    </button>
  );
}

// RenderFormattedInsights and helpers
function RenderFormattedInsights({ text, darkMode }: { text: string; darkMode: boolean }) {
  const cleanText = text.replace(/^#+\s?/gm, '');
  const sectionRegex = /([A-Z][A-Za-z ]+)\n/g;
  const matches: RegExpMatchArray[] = [];
  let m;
  while ((m = sectionRegex.exec(cleanText)) !== null) {
    matches.push(m);
  }
  if (!matches.length) {
    return <BasicParagraph darkMode={darkMode}>{cleanText}</BasicParagraph>;
  }
  const sections: { title: string; body: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index! + matches[i][0].length;
    const end = matches[i + 1]?.index ?? cleanText.length;
    const title = matches[i][1];
    const body = cleanText.slice(start, end).trim();
    sections.push({ title, body });
  }
  return (
    <div>
      {sections.map((sec, i) => (
        <div key={i} className="mb-7">
          <h2
            style={{
              color: darkMode ? '#1CCAFF' : '#3882F6',
              fontWeight: 900,
              fontSize: 24,
              marginBottom: 10,
              fontFamily: "'Montserrat', 'Libre Franklin', sans-serif",
              textShadow: darkMode ? '0 2px 7px #1118' : '0 1px 5px #f3f7ff',
            }}
          >
            {sec.title}
          </h2>
          <SectionBody body={sec.body} darkMode={darkMode} />
        </div>
      ))}
    </div>
  );
}

function BasicParagraph({ children, darkMode }: { children: React.ReactNode, darkMode: boolean }) {
  return (
    <div
      className="text-lg"
      style={{
        color: darkMode ? '#fff' : '#23262D',
        fontWeight: 500,
        fontFamily: "'Libre Franklin', 'Montserrat', sans-serif",
        lineHeight: 1.65,
      }}
    >
      {children}
    </div>
  );
}

function SectionBody({ body, darkMode }: { body: string, darkMode: boolean }) {
  const parts = body.split(/\n/).map((line, idx) => {
    const elements: React.ReactNode[] = [];
    let lastIdx = 0;
    let match;
    const boldRegex = /\*\*(.*?)\*\*/g;
    while ((match = boldRegex.exec(line)) !== null) {
      if (match.index > lastIdx) {
        elements.push(line.slice(lastIdx, match.index));
      }
      elements.push(
        <strong
          style={{
            color: darkMode ? '#FFD600' : '#222c4b',
            fontWeight: 700,
            fontFamily: "'Montserrat', sans-serif",
          }}
          key={idx + '-b-' + match.index}
        >
          {match[1]}
        </strong>
      );
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < line.length) {
      elements.push(line.slice(lastIdx));
    }
    return (
      <div
        className="mb-1 text-base"
        key={idx}
        style={{
          color: darkMode ? '#E2E2E2' : '#23262D',
          fontFamily: "'Libre Franklin', 'Montserrat', sans-serif",
          fontWeight: 500,
          letterSpacing: '0.01em',
        }}
      >
        {elements}
      </div>
    );
  });
  return <div>{parts}</div>;
}
