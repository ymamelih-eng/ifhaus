// Meta Send API client. Messenger and Instagram use the same /messages shape;
// token, host and sender id are configurable per channel.

const MAX_TEXT = { messenger: 2000, instagram: 1000 };

export function createMetaSender({ getConfig, fetchImpl = globalThis.fetch, logger = console }) {
  return async function sendText({ channel, recipientId, text }) {
    const config = getConfig();
    const isIg = channel === 'instagram';
    const token = isIg ? config.instagramAccessToken || config.pageAccessToken : config.pageAccessToken;
    if (!token) {
      logger.warn(`[meta] ${channel} reply not sent: access token not configured`);
      return { skipped: true };
    }
    const host = isIg ? config.instagramGraphHost : 'graph.facebook.com';
    const senderPath = (isIg ? config.instagramAccountId : config.pageId) || 'me';
    const url = `https://${host}/${config.graphApiVersion}/${encodeURIComponent(senderPath)}/messages`;

    const r = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        recipient: { id: recipientId },
        messaging_type: 'RESPONSE',
        message: { text: text.slice(0, MAX_TEXT[channel] || 1000) }
      })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Meta send failed: ${r.status} ${data?.error?.message || ''}`.trim());
    return data;
  };
}
