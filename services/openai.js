const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function analyzeLapText(rawText) {
  const prompt = `
You're analyzing F1 hotlap data from a screenshot. Here's the extracted text:

---
${rawText}
---

1. Extract lap time, sector times, track name, and assists if available.
2. Say if the lap is VALID or INVALID based on issues like missing times, sector mismatches, or suspicious values.
3. Add a note explaining your decision.

Respond like this:
Lap Summary:
- Track:
- Lap Time:
- Sector 1:
- Sector 2:
- Sector 3:
- Assists:
- Valid: ✅ or ❌
- Notes:
`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
  });

  return res.choices[0].message.content.trim();
}

module.exports = { analyzeLapText };
