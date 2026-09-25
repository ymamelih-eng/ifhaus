import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { handleChat } from './src/chat.js';
import { isSheetsConfigured } from './src/lead.js';
import { refreshKnowledge } from './src/knowledge.js';
import { createMetaRouter } from './src/meta/router.js';
import { metaStatus } from './src/meta/config.js';
import {
  activeProvider,
  fallbackProvider,
  isAnthropicConfigured,
  isGeminiConfigured
} from './src/ai.js';

const app = express();
// ALLOWED_ORIGINS: comma-separated site origins allowed to call the API from the browser
// (e.g. https://ifhaus.com,https://www.ifhaus.com). Empty = allow all (local development).
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : {}));
// Meta (Messenger + Instagram) webhook. Mounted before express.json: it needs the raw body
// to verify X-Hub-Signature-256.
app.use('/webhook/meta', createMetaRouter({ chat: handleChat }));
app.use(express.json({ limit: '1mb' }));
// Embeddable site widget: loaded cross-origin via <script>, so it is cached briefly.
app.use('/widget', express.static('public/widget', { maxAge: '1h' }));
app.use(express.static('public'));

app.get('/api/health', (_, res) => {
  res.json({
    ok: true,
    aiProvider: activeProvider(),
    fallbackProvider: fallbackProvider(),
    anthropicConfigured: isAnthropicConfigured(),
    geminiConfigured: isGeminiConfigured(),
    sheetsConfigured: isSheetsConfigured(),
    meta: metaStatus()
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const result = await handleChat(req.body || {});
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('Chat error:', err?.message);
    res.status(500).json({ error: 'Chat error' });
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
app.listen(port, () => {
  console.log(`ifHaus chatbot running on http://localhost:${port}`);
  console.log(`AI provider: ${activeProvider()}${fallbackProvider() ? ` (fallback: ${fallbackProvider()})` : ''}`);
  if (activeProvider() === 'anthropic' && !isAnthropicConfigured()) console.warn('ANTHROPIC_API_KEY .env içinde tanımlı değil.');
  if (!isSheetsConfigured()) console.warn('Google Sheets lead kaydı kapalı: GOOGLE_SHEETS_WEBHOOK_URL ve LEAD_WEBHOOK_SECRET .env içinde tanımlı olmalı.');
});
