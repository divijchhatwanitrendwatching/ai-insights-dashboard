// server/index.js

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Set in your .env

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
        max_tokens: 1300,
      },
      {
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }
      }
    );

    // 2. Get response from Perplexity (sonar-pro)
    const perplexityPromise = axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: "You are an expert trend analyst, skilled at synthesizing business and consumer insights in structured, concise form." },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1300,
        temperature: 0.5,
      },
      {
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'accept': 'application/json',
        }
      }
    );

    // 3. Get response from Gemini
    const geminiPromise = axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }]
      }
    );

    // Await all
    const [openaiResult, perplexityResult, geminiResult] = await Promise.all([
      openaiPromise,
      perplexityPromise,
      geminiPromise
    ]);

    // Parse outputs
    const openaiText = openaiResult.data.choices[0].message.content.trim();
    const perplexityText = perplexityResult.data.choices[0].message.content.trim();
    // Gemini response format is different
    const geminiText =
      geminiResult.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      geminiResult.data.candidates?.[0]?.content?.text?.trim() ||
      "(Gemini answer unavailable)";

    // === VALIDATION ===

    // Perplexity's answer validated by OpenAI
    let perplexityValidatedByOpenAI = "";
    try {
      const validationPrompt = `Here is an AI-generated trend report. Critique it for accuracy, completeness, and suggest improvements or missing points:\n\n${perplexityText}`;
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
        { headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` } }
      );
      perplexityValidatedByOpenAI = validation.data.choices[0].message.content.trim();
    } catch {
      perplexityValidatedByOpenAI = "(OpenAI validation unavailable)";
    }

    // Perplexity's answer validated by Gemini
    let perplexityValidatedByGemini = "";
    try {
      const validationPrompt = `Here is an AI-generated trend report. Critique it for accuracy, completeness, and suggest improvements or missing points:\n\n${perplexityText}`;
      const validation = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        { contents: [{ role: "user", parts: [{ text: validationPrompt }] }] }
      );
      perplexityValidatedByGemini =
        validation.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
        validation.data.candidates?.[0]?.content?.text?.trim() ||
        "(Gemini validation unavailable)";
    } catch {
      perplexityValidatedByGemini = "(Gemini validation unavailable)";
    }

    // OpenAI's answer validated by Perplexity
    let openaiValidatedByPerplexity = "";
    try {
      const validationPrompt = `Here is an AI-generated trend report. Critique it for accuracy, completeness, and suggest improvements or missing points:\n\n${openaiText}`;
      const validation = await axios.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model: 'sonar-pro',
          messages: [
            { role: 'system', content: "You are a rigorous business analyst and trend validation expert." },
            { role: 'user', content: validationPrompt }
          ],
          max_tokens: 700,
          temperature: 0.3
        },
        {
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'accept': 'application/json',
          }
        }
      );
      openaiValidatedByPerplexity = validation.data.choices[0].message.content.trim();
    } catch {
      openaiValidatedByPerplexity = "(Perplexity validation unavailable)";
    }

    // OpenAI's answer validated by Gemini
    let openaiValidatedByGemini = "";
    try {
      const validationPrompt = `Here is an AI-generated trend report. Critique it for accuracy, completeness, and suggest improvements or missing points:\n\n${openaiText}`;
      const validation = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        { contents: [{ role: "user", parts: [{ text: validationPrompt }] }] }
      );
      openaiValidatedByGemini =
        validation.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
        validation.data.candidates?.[0]?.content?.text?.trim() ||
        "(Gemini validation unavailable)";
    } catch {
      openaiValidatedByGemini = "(Gemini validation unavailable)";
    }

    // Gemini's answer validated by OpenAI
    let geminiValidatedByOpenAI = "";
    try {
      const validationPrompt = `Here is an AI-generated trend report. Critique it for accuracy, completeness, and suggest improvements or missing points:\n\n${geminiText}`;
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
        { headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` } }
      );
      geminiValidatedByOpenAI = validation.data.choices[0].message.content.trim();
    } catch {
      geminiValidatedByOpenAI = "(OpenAI validation unavailable)";
    }

    // Gemini's answer validated by Perplexity
    let geminiValidatedByPerplexity = "";
    try {
      const validationPrompt = `Here is an AI-generated trend report. Critique it for accuracy, completeness, and suggest improvements or missing points:\n\n${geminiText}`;
      const validation = await axios.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model: 'sonar-pro',
          messages: [
            { role: 'system', content: "You are a rigorous business analyst and trend validation expert." },
            { role: 'user', content: validationPrompt }
          ],
          max_tokens: 700,
          temperature: 0.3
        },
        {
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'accept': 'application/json',
          }
        }
      );
      geminiValidatedByPerplexity = validation.data.choices[0].message.content.trim();
    } catch {
      geminiValidatedByPerplexity = "(Perplexity validation unavailable)";
    }

    // === FUSION ===
    // Now merge ALL into one summary using OpenAI
    let fusionPrompt =
      `You are an expert research synthesizer.\n` +
      `You are given 3 trend analyses and 6 cross-validations by different AIs for this topic: "${topic}".\n` +
      `Your job:\n- Merge all correct, useful, and non-redundant info into a single, readable, well-structured summary.\n` +
      `- For every important fact, statistic, or claim, reference its original model and the line number in parentheses (e.g. [OpenAI, Line 7], [Gemini, Validation by OpenAI, Line 5]).\n` +
      `- If models contradict, mention that clearly.\n` +
      `- Write with numbered sections and concise prose.\n\n` +
      `-- OpenAI Main Answer:\n${openaiText}\n\n` +
      `-- OpenAI validated by Perplexity:\n${openaiValidatedByPerplexity}\n` +
      `-- OpenAI validated by Gemini:\n${openaiValidatedByGemini}\n\n` +
      `-- Perplexity Main Answer:\n${perplexityText}\n\n` +
      `-- Perplexity validated by OpenAI:\n${perplexityValidatedByOpenAI}\n` +
      `-- Perplexity validated by Gemini:\n${perplexityValidatedByGemini}\n\n` +
      `-- Gemini Main Answer:\n${geminiText}\n\n` +
      `-- Gemini validated by OpenAI:\n${geminiValidatedByOpenAI}\n` +
      `-- Gemini validated by Perplexity:\n${geminiValidatedByPerplexity}\n\n` +
      `-- Please start your summary below:\n`;

    // Final unified summary by OpenAI
    let finalSummary = "";
    try {
      const fusionResp = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: "You are an expert at fusing, comparing, and attributing AI research results." },
            { role: 'user', content: fusionPrompt }
          ],
          temperature: 0.3,
          max_tokens: 1400,
        },
        { headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` } }
      );
      finalSummary = fusionResp.data.choices[0].message.content.trim();
    } catch {
      finalSummary = "(Fusion step failed. Returning separate results.)";
    }

    // Send everything for debugging/traceability, or just finalSummary
    res.json({
      summary: finalSummary,
      openai: openaiText,
      perplexity: perplexityText,
      gemini: geminiText,
      validations: {
        openaiByPerplexity: openaiValidatedByPerplexity,
        openaiByGemini: openaiValidatedByGemini,
        perplexityByOpenai: perplexityValidatedByOpenAI,
        perplexityByGemini: perplexityValidatedByGemini,
        geminiByOpenai: geminiValidatedByOpenAI,
        geminiByPerplexity: geminiValidatedByPerplexity,
      }
    });

  } catch (error) {
    console.error("Fusion API Error:", error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch insights from OpenAI, Perplexity, and Gemini.' });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
