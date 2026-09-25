// Extracts user text messages from a Meta webhook payload.
// object "page" => Facebook Messenger, object "instagram" => Instagram DM.

const CHANNELS = { page: 'messenger', instagram: 'instagram' };

/**
 * @returns {{ channel: 'messenger'|'instagram', senderId: string, recipientId: string,
 *             messageId: string, text: string, timestamp: number }[]}
 */
export function extractTextMessages(payload) {
  const channel = CHANNELS[payload?.object];
  if (!channel || !Array.isArray(payload.entry)) return [];

  const out = [];
  for (const entry of payload.entry) {
    // Only `messaging`; `standby` belongs to another app during handover.
    for (const ev of entry?.messaging || []) {
      const msg = ev?.message;
      const senderId = ev?.sender?.id;
      // Delivery, read, reaction, postback etc. carry no `message`.
      if (!msg || !senderId) continue;
      // Messages the Page/account itself sent.
      if (msg.is_echo || senderId === entry.id) continue;
      if (msg.is_deleted || msg.is_unsupported) continue;
      const text = typeof msg.text === 'string' ? msg.text.trim() : '';
      if (!text || !msg.mid) continue;
      out.push({
        channel,
        senderId: String(senderId),
        recipientId: String(ev?.recipient?.id || entry.id || ''),
        messageId: String(msg.mid),
        text,
        timestamp: Number(ev.timestamp) || Date.now()
      });
    }
  }
  return out;
}
