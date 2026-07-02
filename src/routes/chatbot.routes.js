const express = require("express");

const router = express.Router();

const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,

  baseURL: "https://api.groq.com/openai/v1",
});

router.post("/", async (req, res) => {
  try {
    const { message } = req.body;

    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",

      temperature: 0.5,

      max_tokens: 300,

      messages: [
        {
          role: "system",

          content: `
You are YoDoctor AI.

You are an advanced healthcare assistant.

You ONLY answer healthcare and medical related questions.

Allowed topics:
- symptoms
- diseases
- medicines
- fitness
- diet
- mental health
- tests and reports
- pregnancy
- child health
- emergency guidance
- hospitals and doctors


Rules:
- Detect user's language automatically
- Reply in the same language style as the user
- English question → English answer
- Hindi question → Hindi answer in English alphabets
- Hinglish question → Hinglish answer
- Help users with healthcare questions
- Suggest doctor consultation if needed
- Keep answers concise and natural
- Never give dangerous medical advice

IMPORTANT:
If the user asks anything unrelated to healthcare,
politely refuse and say:
"I can help only with healthcare related questions."

`,
        },

        {
          role: "user",
          content: message,
        },
      ],
    });

    res.json({
      success: true,

      reply: completion.choices[0].message.content,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      error: "AI server error",
    });
  }
});

module.exports = router;
