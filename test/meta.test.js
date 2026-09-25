import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import express from 'express';
import { createMetaRouter } from '../src/meta/router.js';
import { createMetaSender } from '../src/meta/send.js';
import { extractTextMessages } from '../src/meta/events.js';
import { isValidSignature } from '../src/meta/signature.js';
import { SOURCE_LABELS } from '../src/chat.js';

const CONFIG = {
  verifyToken: 'test-verify-token',
  appSecret: 'test-app-secret',
  pageAccessToken: '',
  graphApiVersion: 'v23.0',
  pageId: '',
  instagramAccessToken: '',
  instagramAccountId: '',
  instagramGraphHost: 'graph.facebook.com'
};
const silentLogger = { log() {}, warn() {}, error() {} };

async function startServer(chatImpl) {
  const calls = { chat: [], send: [] };
  const router = createMetaRouter({
    getConfig: () => CONFIG,
    chat: async input => {
      calls.chat.push(input);
      return chatImpl(input);
    },
    send: async msg => {
      calls.send.push(msg);
    },
    logger: silentLogger
  });
  const app = express();
  app.use('/webhook/meta', router);
  const server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/webhook/meta`;
  return { base, calls, router, close: () => new Promise(r => server.close(r)) };
}

function sign(body, secret = CONFIG.appSecret) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function post(base, payload, signature) {
  const body = JSON.stringify(payload);
  return fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature ?? sign(body) },
    body
  });
}

function messengerEvent({ mid = 'm_1', text = 'Villa Nova hakkında bilgi', sender = 'PSID_1', echo = false } = {}) {
  return {
    object: 'page',
    entry: [{
      id: 'PAGE_1',
      time: 1,
      messaging: [{
        sender: { id: echo ? 'PAGE_1' : sender },
        recipient: { id: echo ? sender : 'PAGE_1' },
        timestamp: 1,
        message: { mid, text, ...(echo ? { is_echo: true } : {}) }
      }]
    }]
  };
}

function instagramEvent({ mid = 'ig_1', text = 'Fiyat almak istiyorum', sender = 'IGSID_1' } = {}) {
  return {
    object: 'instagram',
    entry: [{
      id: 'IG_ACCOUNT_1',
      time: 1,
      messaging: [{ sender: { id: sender }, recipient: { id: 'IG_ACCOUNT_1' }, timestamp: 1, message: { mid, text } }]
    }]
  };
}

const reply = input => ({ sessionId: input.sessionId, reply: `Cevap: ${input.message}` });

test('webhook verification returns the challenge', async () => {
  const srv = await startServer(reply);
  const r = await fetch(`${srv.base}?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=12345`);
  assert.equal(r.status, 200);
  assert.equal(await r.text(), '12345');
  await srv.close();
});

test('wrong verify token is rejected with 403', async () => {
  const srv = await startServer(reply);
  const r = await fetch(`${srv.base}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345`);
  assert.equal(r.status, 403);
  const r2 = await fetch(`${srv.base}?hub.mode=unsubscribe&hub.verify_token=test-verify-token&hub.challenge=1`);
  assert.equal(r2.status, 403);
  await srv.close();
});

test('invalid or missing signature is rejected and nothing is processed', async () => {
  const srv = await startServer(reply);
  const bad = await post(srv.base, messengerEvent(), sign('other body'));
  assert.equal(bad.status, 403);
  const wrongSecret = await post(srv.base, messengerEvent(), sign(JSON.stringify(messengerEvent()), 'wrong-secret'));
  assert.equal(wrongSecret.status, 403);
  const missing = await post(srv.base, messengerEvent(), '');
  assert.equal(missing.status, 403);
  await srv.router.drain();
  assert.equal(srv.calls.chat.length, 0);
  assert.equal(srv.calls.send.length, 0);
  await srv.close();
});

test('Messenger text event goes through the chatbot and the reply is sent back', async () => {
  const srv = await startServer(reply);
  const r = await post(srv.base, messengerEvent());
  assert.equal(r.status, 200);
  await srv.router.drain();
  assert.deepEqual(srv.calls.chat, [{
    message: 'Villa Nova hakkında bilgi',
    sessionId: 'meta:messenger:PAGE_1:PSID_1',
    source: 'messenger',
    senderId: 'PSID_1'
  }]);
  assert.deepEqual(srv.calls.send, [{ channel: 'messenger', recipientId: 'PSID_1', text: 'Cevap: Villa Nova hakkında bilgi' }]);
  await srv.close();
});

test('Instagram text event is routed to the instagram channel', async () => {
  const srv = await startServer(reply);
  const r = await post(srv.base, instagramEvent());
  assert.equal(r.status, 200);
  await srv.router.drain();
  assert.equal(srv.calls.chat[0].source, 'instagram');
  assert.equal(srv.calls.chat[0].sessionId, 'meta:instagram:IG_ACCOUNT_1:IGSID_1');
  assert.deepEqual(srv.calls.send, [{ channel: 'instagram', recipientId: 'IGSID_1', text: 'Cevap: Fiyat almak istiyorum' }]);
  await srv.close();
});

test('echo, delivery and read events are ignored', async () => {
  const srv = await startServer(reply);
  await post(srv.base, messengerEvent({ echo: true }));
  await post(srv.base, {
    object: 'page',
    entry: [{
      id: 'PAGE_1',
      messaging: [
        { sender: { id: 'PSID_1' }, recipient: { id: 'PAGE_1' }, delivery: { mids: ['m_1'], watermark: 1 } },
        { sender: { id: 'PSID_1' }, recipient: { id: 'PAGE_1' }, read: { watermark: 1 } }
      ]
    }]
  });
  await srv.router.drain();
  assert.equal(srv.calls.chat.length, 0);
  assert.equal(srv.calls.send.length, 0);
  await srv.close();
});

test('silent chatbot response sends nothing to Meta', async () => {
  const srv = await startServer(input => ({ sessionId: input.sessionId, reply: null, silent: true, outOfScope: true }));
  const r = await post(srv.base, messengerEvent({ text: 'Fenerbahçe maçı kaç kaç?' }));
  assert.equal(r.status, 200);
  await srv.router.drain();
  assert.equal(srv.calls.chat.length, 1);
  assert.equal(srv.calls.send.length, 0);
  await srv.close();
});

test('a repeated message id is processed only once', async () => {
  const srv = await startServer(reply);
  await post(srv.base, messengerEvent({ mid: 'm_dup' }));
  await post(srv.base, messengerEvent({ mid: 'm_dup' }));
  await srv.router.drain();
  assert.equal(srv.calls.chat.length, 1);
  assert.equal(srv.calls.send.length, 1);
  await srv.close();
});

test('webhook answers 200 before the chatbot finishes', async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const srv = await startServer(async input => { await gate; return reply(input); });
  const r = await post(srv.base, messengerEvent({ mid: 'm_slow' }));
  assert.equal(r.status, 200);
  assert.equal(srv.calls.send.length, 0);
  release();
  await srv.router.drain();
  assert.equal(srv.calls.send.length, 1);
  await srv.close();
});

test('webhook is rejected when META_APP_SECRET is not configured', async () => {
  const router = createMetaRouter({
    getConfig: () => ({ ...CONFIG, appSecret: '' }),
    chat: async () => ({}),
    send: async () => {},
    logger: silentLogger
  });
  const app = express();
  app.use('/webhook/meta', router);
  const server = await new Promise(resolve => { const s = app.listen(0, () => resolve(s)); });
  const body = JSON.stringify(messengerEvent());
  const r = await fetch(`http://127.0.0.1:${server.address().port}/webhook/meta`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': sign(body, '') },
    body
  });
  assert.equal(r.status, 403);
  await new Promise(res => server.close(res));
});

test('attachments without text and unknown objects are ignored', () => {
  assert.deepEqual(extractTextMessages({ object: 'whatsapp_business_account', entry: [] }), []);
  const withAttachment = messengerEvent();
  delete withAttachment.entry[0].messaging[0].message.text;
  withAttachment.entry[0].messaging[0].message.attachments = [{ type: 'image' }];
  assert.deepEqual(extractTextMessages(withAttachment), []);
});

test('signature helper accepts only a matching sha256 HMAC', () => {
  const body = Buffer.from('{"a":1}');
  assert.equal(isValidSignature(body, sign(body), CONFIG.appSecret), true);
  assert.equal(isValidSignature(body, 'sha1=abc', CONFIG.appSecret), false);
  assert.equal(isValidSignature(body, sign(body), ''), false);
});

test('Send API request uses env credentials and the channel host (no network)', async () => {
  const requests = [];
  const fakeFetch = async (url, init) => {
    requests.push({ url, init });
    return { ok: true, json: async () => ({ message_id: 'x' }) };
  };
  const config = { ...CONFIG, pageAccessToken: 'PAGE_TOKEN', instagramAccessToken: 'IG_TOKEN', instagramGraphHost: 'graph.instagram.com' };
  const send = createMetaSender({ getConfig: () => config, fetchImpl: fakeFetch, logger: silentLogger });

  await send({ channel: 'messenger', recipientId: 'PSID_1', text: 'Merhaba' });
  await send({ channel: 'instagram', recipientId: 'IGSID_1', text: 'x'.repeat(1500) });

  assert.equal(requests[0].url, 'https://graph.facebook.com/v23.0/me/messages');
  assert.equal(requests[0].init.headers.authorization, 'Bearer PAGE_TOKEN');
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    recipient: { id: 'PSID_1' }, messaging_type: 'RESPONSE', message: { text: 'Merhaba' }
  });
  assert.equal(requests[1].url, 'https://graph.instagram.com/v23.0/me/messages');
  assert.equal(requests[1].init.headers.authorization, 'Bearer IG_TOKEN');
  assert.equal(JSON.parse(requests[1].init.body).message.text.length, 1000);
});

test('Send API is skipped when no access token is configured', async () => {
  let called = false;
  const send = createMetaSender({ getConfig: () => CONFIG, fetchImpl: async () => { called = true; }, logger: silentLogger });
  assert.deepEqual(await send({ channel: 'messenger', recipientId: 'PSID_1', text: 'x' }), { skipped: true });
  assert.equal(called, false);
});

test('lead source labels distinguish Site, Instagram and Facebook', () => {
  assert.deepEqual(SOURCE_LABELS, { web: 'Site', instagram: 'Instagram', messenger: 'Facebook' });
});
