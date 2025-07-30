import React, { useState, useEffect } from "react";
import axios from "axios";

const updateOptions = [
  { value: "15min", label: "Every 15 min" },
  { value: "hourly", label: "Hourly update" },
  { value: "daily", label: "Daily update" },
  { value: "weekly", label: "Weekly update" },
  { value: "monthly", label: "Monthly update" },
];

const researchOptions = [
  { value: "highlevel", label: "High-level summary" },
  { value: "in-depth", label: "In-depth analysis" },
];

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
  };
  sources?: string[];
}

interface SavedReport {
  topic: string;
  summary: string;
  details: FusedDetails | null;
  updateInterval: string;
  researchDepth: string;
  lastUpdated: string;
}

const FONT_HEADER = "'Montserrat', 'Libre Franklin', Arial, sans-serif";
const FONT_BODY = "'Libre Franklin', 'Montserrat', Arial, sans-serif";

export default function PromptInput() {
  const [darkMode, setDarkMode] = useState(true);
  const [topic, setTopic] = useState("");
  const [updateInterval, setUpdateInterval] = useState(updateOptions[2].value);
  const [researchDepth, setResearchDepth] = useState(researchOptions[0].value);
  const [summary, setSummary] = useState<string>("");
  const [details, setDetails] = useState<FusedDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [error, setError] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  // On load: Get saved reports and theme
  useEffect(() => {
    const stored = localStorage.getItem("savedReportsV3");
    if (stored) setSavedReports(JSON.parse(stored));
    const theme = localStorage.getItem("dashboardTheme");
    if (theme === "light") setDarkMode(false);
  }, []);

  const saveReports = (reports: SavedReport[]) => {
    setSavedReports(reports);
    localStorage.setItem("savedReportsV3", JSON.stringify(reports));
  };

  useEffect(() => {
    localStorage.setItem("dashboardTheme", darkMode ? "dark" : "light");
  }, [darkMode]);

  async function handleGenerate() {
    setLoading(true);
    setError("");
    setSummary("");
    setDetails(null);
    setShowDetails(false);
    try {
      const response = await axios.post(
        "/api/generate-fused",
        {
          topic,
          detailLevel: researchDepth === "in-depth" ? "high" : "low",
        }
      );

      const apiSummary =
        response?.data?.summary ||
        response?.data?.insights ||
        response?.data?.result ||
        response?.data?.text ||
        "No summary found.";

      setSummary(apiSummary);
      setDetails(response?.data || null);

      // Save report
      const now = new Date().toISOString();
      const updated: SavedReport[] = [
        ...savedReports.filter(
          (r) =>
            r.topic.toLowerCase() !== topic.toLowerCase() ||
            r.researchDepth !== researchDepth ||
            r.updateInterval !== updateInterval
        ),
        {
          topic,
          summary: apiSummary,
          details: response?.data || null,
          updateInterval,
          researchDepth,
          lastUpdated: now,
        },
      ];
      saveReports(updated);
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to fetch insights."
      );
    } finally {
      setLoading(false);
    }
  }

  // --- UI helpers ---

  function DetailsPanel({ details }: { details: FusedDetails }) {
    if (!details) return null;
    return (
      <div
        className="rounded-xl px-5 py-5 mt-7 animate-fade-in"
        style={{
          background: darkMode ? "#23262D" : "#F6F9FF",
          border: darkMode ? "1.2px solid #2A72D4" : "1.5px solid #c1e0fa",
          fontFamily: FONT_BODY,
        }}
      >
        <h3
          className="text-2xl font-extrabold mb-6"
          style={{
            color: darkMode ? "#FFD600" : "#2A72D4",
            fontFamily: FONT_HEADER,
            letterSpacing: "-1px",
          }}
        >
          Full AI Research Panel
        </h3>
        <Section
          title="OpenAI Main Output"
          text={details.openai}
          color="#1CCAFF"
        />
        <Section
          title="OpenAI Validated by Perplexity"
          text={details.validations.openaiByPerplexity}
          color="#6EFAD1"
        />
        <Section
          title="OpenAI Validated by Gemini"
          text={details.validations.openaiByGemini}
          color="#f2683a"
        />

        <Section
          title="Perplexity Main Output"
          text={details.perplexity}
          color="#07d189"
        />
        <Section
          title="Perplexity Validated by OpenAI"
          text={details.validations.perplexityByOpenai}
          color="#1CCAFF"
        />
        <Section
          title="Perplexity Validated by Gemini"
          text={details.validations.perplexityByGemini}
          color="#f2683a"
        />

        <Section
          title="Gemini Main Output"
          text={details.gemini}
          color="#f2683a"
        />
        <Section
          title="Gemini Validated by OpenAI"
          text={details.validations.geminiByOpenai}
          color="#1CCAFF"
        />
        <Section
          title="Gemini Validated by Perplexity"
          text={details.validations.geminiByPerplexity}
          color="#07d189"
        />

        {details.sources && details.sources.length > 0 && (
          <div style={{ marginTop: 26 }}>
            <h4
              className="font-bold text-lg mb-2"
              style={{ color: "#2A72D4", fontFamily: FONT_HEADER }}
            >
              Sources
            </h4>
            <ul style={{ fontSize: 15, paddingLeft: 20 }}>
              {details.sources.map((src, i) => (
                <li
                  key={i}
                  style={{
                    color: darkMode ? "#b3f1ff" : "#29367a",
                    textDecoration: "underline dotted",
                    marginBottom: 3,
                    fontFamily: FONT_BODY,
                  }}
                >
                  {src}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  function Section({
    title,
    text,
    color,
  }: {
    title: string;
    text: string;
    color: string;
  }) {
    if (!text || typeof text !== "string" || !text.trim()) return null;
    return (
      <div className="mb-7">
        <h4
          className="font-bold text-lg mb-2"
          style={{
            color,
            textTransform: "capitalize",
            letterSpacing: "-0.5px",
            fontFamily: FONT_HEADER,
          }}
        >
          {title}
        </h4>
        <div
          className="rounded-lg px-4 py-3 text-base"
          style={{
            background: darkMode ? "#181A1B" : "#fafcff",
            border: `1px solid ${color}22`,
            color: darkMode ? "#e6eaf2" : "#193243",
            fontFamily: FONT_BODY,
            fontSize: 17,
            whiteSpace: "pre-wrap",
          }}
        >
          {text}
        </div>
      </div>
    );
  }

  // --- MAIN UI ---
  return (
    <div
      style={{
        minHeight: "100vh",
        background: darkMode
          ? "linear-gradient(135deg, #15171B 0%, #23272f 100%)"
          : "linear-gradient(135deg, #f7f8fa 0%, #e9f3ff 100%)",
        fontFamily: FONT_BODY,
        transition: "background .4s",
      }}
    >
      {/* HEADER */}
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&family=Libre+Franklin:wght@400;700;900&display=swap');
          body { background: ${darkMode ? "#15171B" : "#F6F7F8"} !important; }
          ::selection { background: #1ccaff33; }
          .animate-fade-in { animation: fadeIn 0.6s; }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}
      </style>
      <div
        style={{
          textAlign: "center",
          marginTop: 35,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 40,
            fontWeight: 900,
            color: darkMode ? "#fff" : "#23262d",
            letterSpacing: "-2.3px",
            fontFamily: FONT_HEADER,
            textShadow: darkMode
              ? "0 2px 12px #0002"
              : "0 2px 12px #fff2",
          }}
        >
          <span role="img" aria-label="sparkle">
            ✨
          </span>{" "}
          AI Trend Dashboard
        </span>
        <button
          onClick={() => setDarkMode((v) => !v)}
          style={{
            position: "absolute",
            right: 55,
            top: 38,
            fontSize: 18,
            padding: "8px 20px",
            borderRadius: 14,
            border: 0,
            background: darkMode ? "#273352" : "#DEE6F5",
            color: "#FFD02C",
            fontWeight: 700,
            transition: "all .3s",
            boxShadow: "0 2px 8px rgba(0,0,0,.06)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {darkMode ? "🌞 Light" : "🌙 Dark"}
        </button>
      </div>

      {/* MAIN CARD */}
      <div
        style={{
          maxWidth: 900,
          margin: "35px auto 0 auto",
          padding: "38px 38px 30px 38px",
          borderRadius: 28,
          background: darkMode ? "#23272f" : "#fff",
          boxShadow: "0 8px 32px rgba(32,50,80,0.10)",
          border: darkMode
            ? "1.5px solid #23272f"
            : "1.5px solid #e3e8f0",
          zIndex: 2,
          minHeight: 320,
        }}
      >
        {/* INPUT ROW */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            marginBottom: 32,
            width: "100%",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            placeholder="Enter a trend topic..."
            value={topic}
            maxLength={80}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            autoFocus
            style={{
              flex: 3,
              fontSize: 20,
              padding: "15px 24px",
              borderRadius: 13,
              border: `1.5px solid ${darkMode ? "#30363d" : "#d2d6dc"}`,
              background: darkMode ? "#181A1B" : "#f6f8fb",
              color: darkMode ? "#fff" : "#23262D",
              fontWeight: 500,
              outline: "none",
              marginRight: 0,
              boxShadow: "0 1.5px 8px rgba(32,50,80,0.04)",
              transition: "border .2s",
              minWidth: 0,
              fontFamily: FONT_BODY,
            }}
          />
          <select
            style={{
              fontSize: 16,
              padding: "13px 16px",
              borderRadius: 10,
              border: `1.5px solid ${darkMode ? "#30363d" : "#d2d6dc"}`,
              background: darkMode ? "#181A1B" : "#f6f8fb",
              color: darkMode ? "#c6d4e4" : "#353a44",
              fontWeight: 500,
              outline: "none",
              minWidth: 140,
              boxShadow: "0 1.5px 8px rgba(32,50,80,0.04)",
              transition: "border .2s",
              fontFamily: FONT_BODY,
            }}
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
            style={{
              fontSize: 16,
              padding: "13px 16px",
              borderRadius: 10,
              border: `1.5px solid ${darkMode ? "#30363d" : "#d2d6dc"}`,
              background: darkMode ? "#181A1B" : "#f6f8fb",
              color: darkMode ? "#c6d4e4" : "#353a44",
              fontWeight: 500,
              outline: "none",
              minWidth: 160,
              boxShadow: "0 1.5px 8px rgba(32,50,80,0.04)",
              transition: "border .2s",
              fontFamily: FONT_BODY,
            }}
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
            disabled={loading || !topic}
            onClick={handleGenerate}
            style={{
              fontSize: 20,
              fontWeight: 700,
              borderRadius: 10,
              padding: "14px 40px",
              border: "none",
              background: loading
                ? "#A7C3E9"
                : "#3882F6",
              color: "#fff",
              boxShadow: "0 2px 16px rgba(32,50,80,0.09)",
              cursor: loading ? "wait" : "pointer",
              marginLeft: 2,
              marginRight: 0,
              transition: ".1s all",
              outline: "none",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: FONT_HEADER,
            }}
          >
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              color: "#ff4d4f",
              background: "#fff0f0",
              borderRadius: 8,
              padding: "10px 18px",
              marginBottom: 18,
              fontWeight: 500,
              fontSize: 16,
              border: `1.2px solid #ff4d4f33`,
              boxShadow: "0 1.5px 8px rgba(255,77,79,0.04)",
              fontFamily: FONT_BODY,
            }}
          >
            {error}
          </div>
        )}

        {/* SUMMARY */}
        {summary && (
          <div
            className="tw-insight animate-fade-in"
            style={{
              marginTop: 2,
              background: darkMode ? "#181A1B" : "#FAFBFC",
              color: darkMode ? "#ccecff" : "#193243",
              borderRadius: 15,
              padding: "38px 36px 34px 36px",
              minHeight: 190,
              fontSize: 18,
              fontWeight: 500,
              lineHeight: 1.68,
              boxShadow: "0 2.5px 14px rgba(23,36,55,0.07)",
              whiteSpace: "pre-wrap",
              border: darkMode
                ? "1.2px solid #23272f"
                : `1.2px solid #e3e8f0`,
              transition: "background .3s, color .3s",
              wordBreak: "break-word",
              fontFamily: FONT_BODY,
            }}
            dangerouslySetInnerHTML={{
              __html: summary.replace(/\n/g, "<br />"),
            }}
          />
        )}

        {/* Show Details Toggle */}
        {details && (
          <div className="flex justify-center mt-7">
            <button
              onClick={() => setShowDetails((v) => !v)}
              style={{
                background: showDetails
                  ? (darkMode ? "#FFD02C" : "#3882F6")
                  : (darkMode ? "#273352" : "#DEE6F5"),
                color: showDetails
                  ? (darkMode ? "#181A1B" : "#fff")
                  : "#FFD02C",
                fontWeight: 700,
                borderRadius: 9,
                fontSize: 17,
                padding: "13px 28px",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(32,50,80,0.08)",
                transition: ".2s background, .2s color",
                letterSpacing: "0.01em",
                fontFamily: FONT_HEADER,
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
  );
}
