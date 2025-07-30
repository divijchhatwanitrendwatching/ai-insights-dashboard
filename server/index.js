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

// ---- ORIGINAL OPENAI ENDPOINT (for fallback/testing) ----
app.post('/api/generate', async (req, res) => {
  const { topic, detailLevel } = req.body;
  const prompt = buildPrompt(topic, detailLevel);

  try {
    const response = await axios.post(
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
    const insights = response.data.choices[0].message.content;
    res.json({ insights });
  } catch (error) {
    console.error("OpenAI Error:", error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch insights from OpenAI' });
  }
});

// ---- FUSED ENDPOINT: OpenAI + Perplexity, merging, validation ----
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
        model: 'sonar-pro', // you can change model here if needed
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

    // 3. Wait for both
    const [openaiResult, perplexityResult] = await Promise.all([openaiPromise, perplexityPromise]);

    const openaiText = openaiResult.data.choices[0].message.content.trim();
    const perplexityText = perplexityResult.data.choices[0].message.content.trim();

    // 4. Cross-validation step: Each LLM critiques the other's answer (optional, simple version)
    // We'll just merge their insights, and (optionally) let OpenAI validate Perplexity's for brevity

    // a. Send Perplexity's answer to OpenAI for a "critique/validation"
    let validatedPerplexity = "";
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
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
        }
      );
      validatedPerplexity = validation.data.choices[0].message.content.trim();
    } catch (err) {
      validatedPerplexity = "(Validation unavailable, original Perplexity result used.)\n" + perplexityText;
    }

    // 5. Merge all: main structure = OpenAI's, then add a section with "Perplexity Additions & Critique"
    let insights =
      `## Trend Report (OpenAI)\n${openaiText}\n\n` +
      `## Perplexity Result\n${perplexityText}\n\n` +
      `## Perplexity Critique by OpenAI\n${validatedPerplexity}`;

    res.json({ insights });
  } catch (error) {
    console.error("Fusion API Error:", error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch insights from OpenAI and Perplexity' });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
