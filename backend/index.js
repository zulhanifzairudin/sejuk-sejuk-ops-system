import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// --- Mock AI endpoint ---
app.post("/ask-ai", (req, res) => {
  const { question, data } = req.body;

  // TEMP MOCK RESPONSE
  res.json({
    answer: `Mock AI: received ${data.length} records for question "${question}"`,
  });
});

app.listen(3000, () =>
  console.log("Server running on http://localhost:3000"),
);

/*
----------------------------------------
REFERENCE: Real OpenAI implementation
----------------------------------------

import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/ask-ai", async (req, res) => {
  const { question, data } = req.body;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You answer based on provided data only." },
        {
          role: "user",
          content: `Data: ${JSON.stringify(data)}\nQuestion: ${question}`,
        },
      ],
    });

    res.json({ answer: response.choices[0].message.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "AI request failed" });
  }
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
*/

