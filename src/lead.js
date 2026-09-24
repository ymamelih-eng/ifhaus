const TR_PHONE = /(?:\+?90\s*)?(?:0\s*)?5\d{2}[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}/;

export function extractPhone(text = '') {
  const m = text.match(TR_PHONE);
  if (!m) return null;
  return m[0].replace(/\D/g, '').replace(/^90/, '0');
}

export async function saveLead(payload) {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!url) return { skipped: true, reason: 'GOOGLE_SHEETS_WEBHOOK_URL missing' };

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      secret: process.env.LEAD_WEBHOOK_SECRET || '',
      ...payload
    })
  });

  const text = await r.text();
  if (!r.ok) throw new Error(`Lead webhook failed: ${r.status} ${text}`);
  try { return JSON.parse(text); } catch { return { success: true, raw: text }; }
}
