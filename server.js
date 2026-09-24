import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { buildSystemPrompt } from './src/prompt.js';
import { getRelevantKnowledge, refreshKnowledge } from './src/knowledge.js';
import { extractPhone, saveLead } from './src/lead.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

const sessions = new Map();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const ifHausPhone = process.env.IFHAUS_PHONE || '08505322458';

function getSession(id) {
  const sid = id || crypto.randomUUID();
  if (!sessions.has(sid)) sessions.set(sid, { history: [], userMessages: 0, leadSaved: false });
  return [sid, sessions.get(sid)];
}

app.get('/api/health', (_, res) => {
  res.json({ ok: true, geminiConfigured: Boolean(process.env.GEMINI_API_KEY) });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, source = 'web', instagramUsername = '' } = req.body || {};
    if (!message?.trim()) return res.status(400).json({ error: 'message required' });

    const [sid, session] = getSession(sessionId);
    session.userMessages += 1;

    const knowledge = await getRelevantKnowledge(message);
    const systemInstruction = buildSystemPrompt({
      knowledge,
      messageCount: session.userMessages,
      phone: ifHausPhone
    });

    const contents = [
      ...session.history.slice(-12),
      { role: 'user', parts: [{ text: message }] }
    ];

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.25,
        maxOutputTokens: 500
      }
    });

    const reply = (response.text || 'Bu konuda ekibimiz yardımcı olabilir.').trim();
    session.history.push({ role: 'user', parts: [{ text: message }] });
    session.history.push({ role: 'model', parts: [{ text: reply }] });

    const phone = extractPhone(message);
    let leadResult = null;
    if (phone && !session.leadSaved) {
      leadResult = await saveLead({
        instagramUsername: source === 'instagram' ? instagramUsername : '',
        name: '',
        phone,
        model: '',
        city: '',
        landStatus: '',
        budget: '',
        intent: 'DM/Web bilgi talebi',
        summary: session.history
          .slice(-8)
          .map(x => `${x.role === 'user' ? 'Kullanıcı' : 'Asistan'}: ${x.parts?.[0]?.text || ''}`)
          .join(' | ')
          .slice(0, 1800),
        source
      });
      session.leadSaved = true;
    }

    res.json({ sessionId: sid, reply, leadSaved: Boolean(phone && session.leadSaved), leadResult });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Chat error', detail: err.message });
  }
});

app.post('/api/admin/refresh-knowledge', async (_, res) => {
  try {
    const pages = await refreshKnowledge(true);
    res.json({ ok: true, pages: pages.map(p => p.url) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`ifHaus chatbot running on http://localhost:${port}`));
