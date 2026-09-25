import express from 'express';
import { readMetaConfig } from './config.js';
import { isValidSignature } from './signature.js';
import { extractTextMessages } from './events.js';
import { createDedup } from './dedup.js';
import { createMetaSender } from './send.js';

// Sent when the chatbot engine fails, so the visitor is not left without an answer.
const ERROR_REPLY = 'Şu anda yanıt veremiyorum. 0850 532 2458 numarasından bize ulaşabilirsiniz.';

/**
 * Meta webhook adapter: GET verifies the subscription, POST accepts Messenger and
 * Instagram messaging events, answers 200 immediately and processes in the background.
 *
 * @param {object} deps
 * @param {(input: object) => Promise<object>} deps.chat   the shared chatbot engine (handleChat)
 * @param {(msg: object) => Promise<unknown>} [deps.send]  Send API client
 * @param {() => object} [deps.getConfig]
 */
export function createMetaRouter({
  chat,
  getConfig = () => readMetaConfig(),
  send = createMetaSender({ getConfig }),
  dedup = createDedup(),
  logger = console
}) {
  const router = express.Router();
  const queues = new Map(); // per-conversation chains keep replies in order
  const pending = new Set();

  router.get('/', (req, res) => {
    const { verifyToken } = getConfig();
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && verifyToken && token === verifyToken && typeof challenge === 'string') {
      return res.status(200).type('text/plain').send(challenge);
    }
    res.sendStatus(403);
  });

  // Raw body is required to check the signature, so this route parses JSON itself.
  router.post('/', express.raw({ type: '*/*', limit: '1mb' }), (req, res) => {
    const { appSecret } = getConfig();
    if (!appSecret) {
      logger.error('[meta] META_APP_SECRET not configured; webhook rejected');
      return res.sendStatus(403);
    }
    if (!isValidSignature(req.body, req.get('x-hub-signature-256'), appSecret)) {
      return res.sendStatus(403);
    }
    let payload;
    try {
      payload = JSON.parse(req.body.toString('utf8'));
    } catch {
      return res.sendStatus(400);
    }

    res.status(200).send('EVENT_RECEIVED');

    for (const ev of extractTextMessages(payload)) {
      if (!dedup.firstSeen(`${ev.channel}:${ev.messageId}`)) continue;
      const sessionId = `meta:${ev.channel}:${ev.recipientId}:${ev.senderId}`;
      enqueue(sessionId, () => handleEvent(ev, sessionId));
    }
  });

  async function handleEvent(ev, sessionId) {
    let reply;
    try {
      const result = await chat({ message: ev.text, sessionId, source: ev.channel, senderId: ev.senderId });
      if (!result || result.error || result.silent || !result.reply) return;
      reply = result.reply;
    } catch (err) {
      logger.error(`[meta] chat failed for ${ev.channel} message: ${err?.message}`);
      reply = ERROR_REPLY;
    }
    try {
      await send({ channel: ev.channel, recipientId: ev.senderId, text: reply });
    } catch (err) {
      logger.error(`[meta] send failed: ${err?.message}`);
    }
  }

  function enqueue(key, task) {
    const prev = queues.get(key) || Promise.resolve();
    const next = prev.then(task, task);
    queues.set(key, next);
    pending.add(next);
    next.finally(() => {
      pending.delete(next);
      if (queues.get(key) === next) queues.delete(key);
    });
  }

  /** Resolves when all queued events have been processed (used by tests and shutdown). */
  router.drain = async () => {
    while (pending.size) await Promise.allSettled([...pending]);
  };

  return router;
}
