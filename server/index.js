// server/index.js

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 5000;

// --- CORS: allow your Vercel frontend and localhost dev
app.use(cors({
  origin: [
    "https://ai-insights-dashboard-67iy.vercel.app",
    "http://localhost:3000"
  ]
}));
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Utility: Compose prompt for research depth
function buildPrompt(topic, detailLevel = "high") {
  if (detailLevel === "high") {
    return `In-depth trend research and analysis for: "${topic}"
    1. Give a synthesized summary of what this topic is and why it matters in 2025.
    2. List the top 10 mega trends related to this topic globally.
    3. List the top consumer trends or implications for this topic.
    4. Give at least 3 future scenarios or directions for this topic, with reasoning.
    5. Provide supporting stats, innovations, and notable sources (if available).
    Write in clear, business/professional language, numbered/structured, and avoid speculation.`;
  }
  // Low = high-level summary
  return `Give a high-level summary and 3-5 key points about "${topic}" as a current global trend. List top future directions, and highlight any notable stats or innovations. Respond in clear, concise bullets.`;
}

app.post('/api/generate-fused', async (req, res) => {
  const { topic, detailLevel } = req.body;
  const prompt = buildPrompt(topic, detailLevel);

  try {
    // 1. Get response from OpenAI
    const openaiPromise = axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: "You are an expert trend analyst, skilled at synthesizing business and consumer insights in structured, concise form." },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 1200,
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
      }
    );

    // 2. Get response from Perplexity
    const perplexityPromise = axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: "You are an expert trend analyst, skilled at synthesizing business and consumer insights in structured, concise form." },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1200,
        temperature: 0.5
      },
      {
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'accept': 'application/json',
        },
      }
    );

    // 3. Get response from Gemini (Google)
    const geminiPromise = axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      }
    );

    // Wait for all three
    const [openaiResult, perplexityResult, geminiResult] = await Promise.all([
      openaiPromise, perplexityPromise, geminiPromise
    ]);

    // Extract text from each model
    const openaiText = openaiResult.data.choices[0].message.content.trim();
    const perplexityText = perplexityResult.data.choices[0].message.content.trim();
    // Gemini: handle content extraction
    let geminiText = "";
    if (geminiResult.data && geminiResult.data.candidates && geminiResult.data.candidates[0]?.content?.parts?.length) {
      geminiText = geminiResult.data.candidates[0].content.parts.map(p => p.text).join("\n").trim();
    } else {
      geminiText = "(No Gemini output)";
    }

    // ========== VALIDATION PHASE ==========
    // 1. OpenAI validated by Perplexity & Gemini
    const openaiByPerplexity = await validateWithPerplexity(perplexityText, openaiText, PERPLEXITY_API_KEY);
    const openaiByGemini = await validateWithGemini(geminiText, openaiText, GEMINI_API_KEY);

    // 2. Perplexity validated by OpenAI & Gemini
    const perplexityByOpenai = await validateWithOpenAI(openaiText, perplexityText, OPENAI_API_KEY);
    const perplexityByGemini = await validateWithGemini(geminiText, perplexityText, GEMINI_API_KEY);

    // 3. Gemini validated by OpenAI & Perplexity
    const geminiByOpenai = await validateWithOpenAI(openaiText, geminiText, OPENAI_API_KEY);
    const geminiByPerplexity = await validateWithPerplexity(perplexityText, geminiText, PERPLEXITY_API_KEY);

    // === Merge/summarize everything via OpenAI (as "referee") ===
    let finalSummary = "";
    try {
      const mergedPrompt = `
There are three AI-generated trend reports (OpenAI, Perplexity, Gemini) and six cross-validations.
- Carefully read all responses and validations below.
- Your task: Synthesize one summary that contains **all important, validated information** from every model (but avoid duplicate facts).
- For every key point, **cite** the model(s) as sources, e.g. [OpenAI], [Perplexity], [Gemini].
- Clearly list numbers for facts and the corresponding model (e.g. "Fact X: ... [OpenAI, Gemini]").
- Be neutral if sources disagree or uncertain.

---OpenAI Main Output:
${openaiText}

---Perplexity Main Output:
${perplexityText}

---Gemini Main Output:
${geminiText}

---Validations:
OpenAI by Perplexity:
${openaiByPerplexity}

OpenAI by Gemini:
${openaiByGemini}

Perplexity by OpenAI:
${perplexityByOpenai}

Perplexity by Gemini:
${perplexityByGemini}

Gemini by OpenAI:
${geminiByOpenai}

Gemini by Perplexity:
${geminiByPerplexity}
`;
      const merged = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: "You are a professional research summary writer and must synthesize multi-source AI research reports into one brief, unbiased summary. Cite sources clearly as instructed." },
            { role: 'user', content: mergedPrompt }
          ],
          temperature: 0.3,
          max_tokens: 1500,
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
        }
      );
      finalSummary = merged.data.choices[0].message.content.trim();
    } catch (err) {
      finalSummary = "Error generating unified summary.";
    }

    res.json({
      summary: finalSummary,
      openai: openaiText,
      perplexity: perplexityText,
      gemini: geminiText,
      validations: {
        openaiByPerplexity,
        openaiByGemini,
        perplexityByOpenai,
        perplexityByGemini,
        geminiByOpenai,
        geminiByPerplexity
      }
    });
  } catch (error) {
    console.error("Fusion API Error:", error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch insights from OpenAI, Perplexity, or Gemini' });
  }
});

// ==== HELPERS for validation ====

async function validateWithOpenAI(openaiText, targetText, apiKey) {
  try {
    const validationPrompt = `Here is an AI-generated trend report. Critique for accuracy, completeness, and suggest improvements or missing points:\n\n${targetText}`;
    const validation = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: "You are a rigorous business analyst and trend validation expert." },
          { role: 'user', content: validationPrompt }
        ],
        temperature: 0.4,
        max_tokens: 700,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );
    return validation.data.choices[0].message.content.trim();
  } catch (err) {
    return "(Validation unavailable from OpenAI.)";
  }
}

async function validateWithPerplexity(perplexityText, targetText, apiKey) {
  try {
    const validationPrompt = `Here is an AI-generated trend report. Critique for accuracy, completeness, and suggest improvements or missing points:\n\n${targetText}`;
    const validation = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: "You are a rigorous business analyst and trend validation expert." },
          { role: 'user', content: validationPrompt }
        ],
        max_tokens: 700,
        temperature: 0.4
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'accept': 'application/json',
        },
      }
    );
    return validation.data.choices[0].message.content.trim();
  } catch (err) {
    return "(Validation unavailable from Perplexity.)";
  }
}

async function validateWithGemini(geminiText, targetText, apiKey) {
  try {
    const validationPrompt = `Here is an AI-generated trend report. Critique for accuracy, completeness, and suggest improvements or missing points:\n\n${targetText}`;
    const validation = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ role: 'user', parts: [{ text: validationPrompt }] }]
      }
    );
    if (validation.data && validation.data.candidates && validation.data.candidates[0]?.content?.parts?.length) {
      return validation.data.candidates[0].content.parts.map(p => p.text).join("\n").trim();
    }
    return "(Validation unavailable from Gemini.)";
  } catch (err) {
    return "(Validation unavailable from Gemini.)";
  }
}

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
