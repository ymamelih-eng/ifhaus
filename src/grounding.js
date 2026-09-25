// Deterministic checks applied to every model reply after generation, so the
// prompt rules for the lead CTA and for source-only figures are enforced even
// when the model ignores them.

export const MISSING_INFO_REPLY = 'Bu bilgiyi satış ekibimizle netleştirmemiz gerekiyor.';

function sentences(text) {
  return text.split(/(?<=[.!?…])\s+/).map(s => s.trim()).filter(Boolean);
}

function digitsOnly(s) {
  return s.replace(/\D/g, '');
}

function lower(s) {
  return s.toLocaleLowerCase('tr');
}

// Sentences that offer a call or ask for the visitor's number.
const LEAD_CTA = /numara(nızı|nizi|nız|niz)\s*(bırak|paylaş|ilet|yaz|gönder|verebilir|verir)|telefon(unuzu| numaranızı)|bizi\s+arayabilir|bize\s+ulaşabilir|sizi\s+arasın|arayabilirsiniz/;

export function removeLeadCta(reply, phone) {
  const phoneDigits = digitsOnly(phone).replace(/^0/, '');
  const kept = sentences(reply).filter(s => {
    const l = lower(s);
    if (phoneDigits && digitsOnly(s).includes(phoneDigits)) return false;
    return !LEAD_CTA.test(l);
  });
  return kept.join(' ');
}

// Numbers that carry product facts: areas, prices, durations, room plans.
const FIGURE = /(\d+\s*\+\s*\d+)|(\d[\d.,]*)\s*(m²|m2\b|metrekare|metre kare|tl\b|₺|lira|euro|€|\$|usd|dolar|gün|hafta|ay\b|aylık|yıl|saat|oda)/gi;

function normalizeNumber(n) {
  return n.replace(/\s+/g, '').replace(/(?<=\d)[.,](?=\d{3}\b)/g, '').replace(',', '.');
}

function sourceNumbers(text) {
  const out = new Set();
  for (const m of text.matchAll(/\d+\s*\+\s*\d+|\d[\d.,]*/g)) out.add(normalizeNumber(m[0]).replace(/[.,]$/, ''));
  return out;
}

export function unsupportedFigures(reply, sourceText) {
  const allowed = sourceNumbers(sourceText);
  const bad = [];
  for (const m of reply.matchAll(FIGURE)) {
    const num = normalizeNumber(m[1] || m[2]).replace(/[.,]$/, '');
    if (!allowed.has(num)) bad.push(m[0].trim());
  }
  return bad;
}

// Embellishments the model tends to add; allowed only if the source uses them.
const EMBELLISHMENTS = [
  'taban alanı', 'geniş', 'ferah', 'lüks', 'eşsiz', 'benzersiz', 'mükemmel', 'muhteşem',
  'harika', 'etkileyici', 'şık', 'modern', 'konforlu', 'iç-dış mekan', 'iç dış mekan',
  'doğayla iç içe', 'bahçe kullanımı', 'yüksek kalite', 'en iyi', 'ideal'
];

export function unsupportedEmbellishments(sentence, sourceText) {
  const l = lower(sentence);
  const src = lower(sourceText);
  return EMBELLISHMENTS.filter(t => l.includes(t) && !src.includes(t));
}

/**
 * @param {string} reply       model reply (plain text)
 * @param {object} opts
 * @param {string} opts.knowledge   source text the model was given
 * @param {string} opts.userText    what the user said in this conversation (their own figures may be echoed)
 * @param {boolean} opts.ctaAllowed whether the call/leave-number CTA may appear
 * @param {string} opts.phone
 */
export function enforceGrounding(reply, { knowledge = '', userText = '', ctaAllowed, phone }) {
  const source = `${knowledge}\n${userText}`;
  let out = reply;

  // A reply that states a figure not present in the sources is replaced entirely.
  if (unsupportedFigures(out, source).length) out = MISSING_INFO_REPLY;

  // Drop sentences that add wording the sources do not use.
  const kept = sentences(out).filter(s => unsupportedEmbellishments(s, source).length === 0);
  out = kept.length ? kept.join(' ') : MISSING_INFO_REPLY;

  if (!ctaAllowed) out = removeLeadCta(out, phone) || MISSING_INFO_REPLY;
  return out;
}
