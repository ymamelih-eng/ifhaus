import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { buildSystemPrompt } from './src/prompt.js';
import { enforceGrounding } from './src/grounding.js';
import { getRelevantKnowledge, refreshKnowledge, getModelNames } from './src/knowledge.js';
import { extractPhone, saveLead, isSheetsConfigured } from './src/lead.js';
import {
  checkScope,
  CLASSIFIER_SYSTEM,
  parseClassifierOutput,
  OUT_OF_SCOPE_REPLY,
  OUT_OF_SCOPE_TOKEN
} from './src/scope.js';
import {
  generate,
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
app.use(express.json({ limit: '1mb' }));
// Embeddable site widget: loaded cross-origin via <script>, so it is cached briefly.
app.use('/widget', express.static('public/widget', { maxAge: '1h' }));
app.use(express.static('public'));

const sessions = new Map();
const ifHausPhone = process.env.IFHAUS_PHONE || '08505322458';

function getSession(id) {
  const sid = id || crypto.randomUUID();
  if (!sessions.has(sid)) {
    sessions.set(sid, { history: [], userMessages: 0, leadSaved: false, outOfScopeReplied: false });
  }
  return [sid, sessions.get(sid)];
}

// Chat replies are shown as plain DM text: strip markdown the model may still produce.
function toPlainText(text) {
  return text
    .replace(/\*\*|__|`/g, '')
    .split('\n')
    .map(line => line.replace(/^\s*(#{1,6}\s+|[-*•]\s+|\d+[.)]\s+)/, '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

async function classifyScope(message, session) {
  const lastReply = [...session.history].reverse().find(m => m.role === 'assistant')?.text;
  const text = lastReply
    ? `Önceki asistan mesajı: ${lastReply.slice(0, 500)}\nKullanıcının son mesajı: ${message}`
    : `Kullanıcının son mesajı: ${message}`;
  try {
    const { text: out } = await generate({
      system: CLASSIFIER_SYSTEM,
      history: [{ role: 'user', text }],
      maxTokens: 256,
      classifier: true
    });
    // Unparseable output: let the main prompt decide (it can still answer OUT_OF_SCOPE).
    return parseClassifierOutput(out) || 'IN_SCOPE';
  } catch {
    return 'IN_SCOPE';
  }
}

// First off-topic message in a conversation gets the fixed reply; later ones get no reply at all.
function outOfScopeResponse(sid, session) {
  if (session.outOfScopeReplied) {
    return { sessionId: sid, reply: null, silent: true, outOfScope: true, leadSaved: session.leadSaved };
  }
  session.outOfScopeReplied = true;
  return { sessionId: sid, reply: OUT_OF_SCOPE_REPLY, outOfScope: true, leadSaved: session.leadSaved };
}

app.get('/api/health', (_, res) => {
  res.json({
    ok: true,
    aiProvider: activeProvider(),
    fallbackProvider: fallbackProvider(),
    anthropicConfigured: isAnthropicConfigured(),
    geminiConfigured: isGeminiConfigured(),
    sheetsConfigured: isSheetsConfigured()
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, source = 'web', instagramUsername = '' } = req.body || {};
    if (!message?.trim()) return res.status(400).json({ error: 'message required' });

    const [sid, session] = getSession(sessionId);

    await refreshKnowledge();
    const guard = checkScope(message, { modelNames: getModelNames() });
    let verdict = guard.verdict;
    if (verdict === 'AMBIGUOUS') verdict = await classifyScope(message, session);
    if (verdict === 'OUT_OF_SCOPE') return res.json(outOfScopeResponse(sid, session));

    const meaningful = verdict !== 'SMALL_TALK';
    const messageCount = session.userMessages + (meaningful ? 1 : 0);

    const knowledge = await getRelevantKnowledge(message);
    const systemInstruction = buildSystemPrompt({
      knowledge,
      messageCount,
      phone: ifHausPhone
    });

    const { text } = await generate({
      system: systemInstruction,
      history: [...session.history.slice(-12), { role: 'user', text: message }],
      maxTokens: 1024
    });

    if (text.includes(OUT_OF_SCOPE_TOKEN)) return res.json(outOfScopeResponse(sid, session));

    const reply = enforceGrounding(toPlainText(text) || 'Bu konuda ekibimiz yardımcı olabilir.', {
      knowledge,
      userText: [...session.history.filter(m => m.role === 'user').map(m => m.text), message].join('\n')
    });
    session.userMessages = messageCount;
    session.history.push({ role: 'user', text: message });
    session.history.push({ role: 'assistant', text: reply });

    const phone = extractPhone(message);
    let leadResult = null;
    if (phone && !session.leadSaved) {
      try {
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
            .map(x => `${x.role === 'user' ? 'Kullanıcı' : 'Asistan'}: ${x.text}`)
            .join(' | ')
            .slice(0, 1800),
          source
        });
        session.leadSaved = !leadResult?.skipped;
      } catch (e) {
        console.error('Lead save error:', e.message);
        leadResult = { success: false, error: 'Lead kaydedilemedi' };
      }
    }

    // From the first meaningful message on, the widget may show the call/leave-number CTA once.
    const cta = session.userMessages >= 1 && !session.leadSaved && !session.ctaShown;
    if (cta) session.ctaShown = true;

    res.json({ sessionId: sid, reply, leadSaved: Boolean(phone && session.leadSaved), leadResult, cta });
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
