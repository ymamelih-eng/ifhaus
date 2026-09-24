const TR_PHONE = /(?:\+?90\s*)?(?:0\s*)?5\d{2}[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}/;

export function extractPhone(text = '') {
  const m = text.match(TR_PHONE);
  if (!m) return null;
  return m[0].replace(/\D/g, '').replace(/^90/, '0');
}

export async function saveLead(payload) {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const secret = process.env.LEAD_WEBHOOK_SECRET;
  if (!url) return { skipped: true, reason: 'GOOGLE_SHEETS_WEBHOOK_URL missing' };
  if (!secret) return { skipped: true, reason: 'LEAD_WEBHOOK_SECRET missing' };

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      secret
    })
  });

  const text = await r.text();
  if (!r.ok) throw new Error(`Lead webhook failed: ${r.status} ${text}`);
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Lead webhook returned non-JSON: ${text.slice(0, 200)}`); }
  if (data.success === false) throw new Error(`Lead webhook rejected: ${data.message || text}`);
  return data;
}

export function isSheetsConfigured() {
  return Boolean(process.env.GOOGLE_SHEETS_WEBHOOK_URL && process.env.LEAD_WEBHOOK_SECRET);
}
