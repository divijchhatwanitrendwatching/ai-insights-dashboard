import React, { useState, useEffect } from 'react';
import axios from 'axios';

// ... (keep your color and helper constants as before)
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
  summary: string;
  details: FusedDetails | null;
  updateInterval: string;
  researchDepth: string;
  lastUpdated: string;
}

interface FusedDetails {
  openai: string;
  perplexity: string;
  gemini: string;
  validations: {
    openaiByPerplexity: string;
    openaiByGemini: string;
    perplexityByOpenai: string;
    perplexityByGemini: string;
    geminiByOpenai: string;
    geminiByPerplexity: string;
  }
}

export default function PromptInput() {
  const [darkMode, setDarkMode] = useState(true);
  const [topic, setTopic] = useState('');
  const [updateInterval, setUpdateInterval] = useState(updateOptions[2].value);
  const [researchDepth, setResearchDepth] = useState(researchOptions[0].value);
  const [summary, setSummary] = useState<string>('');
  const [details, setDetails] = useState<FusedDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  // On load: Get saved reports and theme
  useEffect(() => {
    const stored = localStorage.getItem('savedReportsV3');
    if (stored) setSavedReports(JSON.parse(stored));
    const theme = localStorage.getItem('dashboardTheme');
    if (theme === 'light') setDarkMode(false);
  }, []);

  const saveReports = (reports: SavedReport[]) => {
    setSavedReports(reports);
    localStorage.setItem('savedReportsV3', JSON.stringify(reports));
  };

  useEffect(() => {
    localStorage.setItem('dashboardTheme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  async function handleGenerate(forceTopic?: string, forceResearch?: string, forceUpdate?: string) {
    setLoading(true);
    setError('');
    setSummary('');
    setDetails(null);
    setShowDetails(false);
    try {
      let finalPrompt = forceTopic || topic;
      const research = forceResearch || researchDepth;
      // The server will structure prompt appropriately, just send through
      const response = await axios.post('http://localhost:5000/api/generate-fused', {
        topic: finalPrompt,
        detailLevel: research === "in-depth" ? "high" : "low"
      });

      const apiSummary =
        response?.data?.summary ||
        response?.data?.insights ||
        response?.data?.result ||
        response?.data?.text ||
        'No summary found.';

      setSummary(apiSummary);
      setDetails(response?.data || null);

      // Save report
      const currentTopic = forceTopic || topic;
      const currentUpdate = forceUpdate || updateInterval;
      const currentResearch = forceResearch || researchDepth;
      if (currentTopic) {
        const now = new Date().toISOString();
        const updated: SavedReport[] = [
          ...savedReports.filter(
            (r) =>
              r.topic.toLowerCase() !== currentTopic.toLowerCase() ||
              r.researchDepth !== currentResearch ||
              r.updateInterval !== currentUpdate
          ),
          {
            topic: currentTopic,
            summary: apiSummary,
            details: response?.data || null,
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

  // Helper for displaying details
  function DetailsPanel({ details }: { details: FusedDetails }) {
    if (!details) return null;
    return (
      <div
        className="rounded-xl px-5 py-5 mt-6"
        style={{
          background: darkMode ? "#202329" : "#f1f5fd",
          border: darkMode ? "1.2px solid #23262D" : "1.5px solid #b7c6e7",
        }}>
        <h3 className="text-2xl font-extrabold mb-5" style={{ color: darkMode ? "#FFD600" : "#2A72D4" }}>
          Full AI Research Panel
        </h3>
        <Section title="OpenAI Main Output" text={details.openai} color="#3bb3fc" />
        <Section title="OpenAI Validated by Perplexity" text={details.validations.openaiByPerplexity} color="#3bb3fc" />
        <Section title="OpenAI Validated by Gemini" text={details.validations.openaiByGemini} color="#3bb3fc" />

        <Section title="Perplexity Main Output" text={details.perplexity} color="#07d189" />
        <Section title="Perplexity Validated by OpenAI" text={details.validations.perplexityByOpenai} color="#07d189" />
        <Section title="Perplexity Validated by Gemini" text={details.validations.perplexityByGemini} color="#07d189" />

        <Section title="Gemini Main Output" text={details.gemini} color="#f2683a" />
        <Section title="Gemini Validated by OpenAI" text={details.validations.geminiByOpenai} color="#f2683a" />
        <Section title="Gemini Validated by Perplexity" text={details.validations.geminiByPerplexity} color="#f2683a" />
      </div>
    );
  }

  function Section({ title, text, color }: { title: string; text: string; color: string }) {
    return (
      <div className="mb-5">
        <h4 className="font-bold text-lg mb-2" style={{ color }}>{title}</h4>
        <div className="rounded-lg px-4 py-3 text-base"
          style={{
            background: darkMode ? "#23262d" : "#fafcff",
            border: `1px solid ${color}33`,
            color: darkMode ? "#e6eaf2" : "#181A20",
            fontFamily: "'Libre Franklin', 'Montserrat', sans-serif"
          }}>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{text}</pre>
        </div>
      </div>
    );
  }

  // ... all your Saved Reports and Inputs UI (from your last code)
  // (For brevity, not re-pasting all of your Saved Reports UI logic here! Use your previous version.)

  // Main return (showing summary and toggle details)
  return (
    <div
      style={{
        minHeight: "100vh",
        background: darkMode
          ? "linear-gradient(135deg, #181A1B 0%, #23272f 100%)"
          : "linear-gradient(135deg, #f7f8fa 0%, #e9f3ff 100%)",
        fontFamily: "Inter, Arial, sans-serif",
        paddingBottom: 40,
        transition: "background .4s",
      }}
      className={darkMode ? "tw-dark" : "tw-light"}
    >
      {/* HEADER */}
      <div
        style={{
          background: "none",
          width: "100vw",
          marginLeft: -32,
          padding: "38px 0 18px 0",
          textAlign: "center",
          position: "relative",
        }}
      >
        <span style={{
          fontSize: 38,
          fontWeight: 800,
          color: darkMode ? "#fff" : "#222",
          letterSpacing: "-1.5px",
          textShadow: darkMode ? "0 2px 12px #0002" : "0 2px 12px #fff2",
        }}>
          <span role="img" aria-label="sparkle">✨</span> AI Trend Dashboard
        </span>
        <button
          onClick={() => setDarkMode((v) => !v)}
          style={{
            position: "absolute",
            right: 60,
            top: 38,
            fontSize: 18,
            padding: "8px 18px",
            borderRadius: 14,
            border: 0,
            background: darkMode ? "#273352" : "#DEE6F5",
            color: "#FFD02C",
            fontWeight: 700,
            transition: "all .3s",
            boxShadow: "0 2px 8px rgba(0,0,0,.06)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {darkMode ? "🌞 Light" : "🌙 Dark"}
        </button>
      </div>
      <div className="tw-main" style={{
        display: "flex",
        justifyContent: "center",
        gap: "38px",
        marginTop: 12,
        width: "100%",
        alignItems: "flex-start",
      }}>
        {/* (Keep your Saved Reports UI here) */}

        {/* MAIN CARD */}
        <div
          style={{
            background: darkMode ? "#23272f" : "#fff",
            borderRadius: 28,
            boxShadow: `0 8px 32px rgba(32,50,80,0.10)`,
            padding: "44px 48px 38px 48px",
            minWidth: 650,
            maxWidth: 900,
            width: "100%",
            alignSelf: "flex-start",
            border: darkMode ? "1.5px solid #23272f" : `1.5px solid #e3e8f0`,
            position: "relative",
            zIndex: 2,
          }}
        >
          {/* INPUT ROW ... (your existing code) */}

          {error && (
            <div style={{
              color: "#ff4d4f",
              background: "#fff0f0",
              borderRadius: 8,
              padding: "10px 18px",
              marginBottom: 18,
              fontWeight: 500,
              fontSize: 16,
              border: `1.2px solid #ff4d4f33`,
              boxShadow: "0 1.5px 8px rgba(255,77,79,0.04)",
            }}>
              {error}
            </div>
          )}

          {summary && (
            <div
              className="tw-insight"
              style={{
                marginTop: 2,
                background: darkMode ? "#16181c" : "#FAFBFC",
                color: darkMode ? "#ccecff" : "#193243",
                borderRadius: 15,
                padding: "38px 36px 34px 36px",
                minHeight: 190,
                fontSize: 18,
                fontWeight: 450,
                lineHeight: 1.68,
                boxShadow: "0 2.5px 14px rgba(23,36,55,0.07)",
                whiteSpace: "pre-wrap",
                border: darkMode ? "1.2px solid #23272f" : `1.2px solid #e3e8f0`,
                transition: "background .3s, color .3s",
                wordBreak: "break-word",
              }}
              dangerouslySetInnerHTML={{ __html: summary.replace(/\n/g, "<br />") }}
            />
          )}

          {/* Toggle details */}
          {details && (
            <div className="flex justify-center mt-5">
              <button
                onClick={() => setShowDetails(v => !v)}
                style={{
                  background: showDetails ? (darkMode ? "#FFD02C" : "#3882F6") : (darkMode ? "#273352" : "#DEE6F5"),
                  color: showDetails ? (darkMode ? "#181A1B" : "#fff") : "#FFD02C",
                  fontWeight: 700,
                  borderRadius: 9,
                  fontSize: 17,
                  padding: "13px 28px",
                  margin: "0 auto",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(32,50,80,0.08)",
                  transition: ".2s background, .2s color",
                  letterSpacing: "0.01em",
                }}
              >
                {showDetails ? "Hide Details" : "Show Full AI Details"}
              </button>
            </div>
          )}

          {/* Details Panel */}
          {showDetails && details && <DetailsPanel details={details} />}
        </div>
      </div>
    </div>
  );
}
