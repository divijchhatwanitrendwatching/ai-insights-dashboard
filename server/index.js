const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/generate', async (req, res) => {
  const { topic } = req.body;

const prompt = `
Topic: ${topic}

Instructions:
1. Provide a short summary of what this topic is and why it matters (max 3 sentences).
2. List the top 10 MEGA TRENDS relevant to this topic (with names + short descriptions).
3. List the top 10 CONSUMER TRENDS influenced by this topic (if applicable).
4. Describe 2–3 plausible FUTURE SCENARIOS: how might this topic evolve over the next 3–5 years, and why?
5. Include a few KEY STATS or INNOVATIONS from recent years if relevant.

Respond in clearly labeled sections using markdown-style headings (e.g., ## Summary, ## Mega Trends, etc).
`;


  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({ result: response.data.choices[0].message.content });
  } catch (err) {
  console.error("OpenAI Error:", err.response?.data || err.message);
  res.status(500).json({ error: 'Failed to fetch insights from OpenAI' });
}
});

app.listen(process.env.PORT || 10000, () => {
  console.log("Server is running...");
});
