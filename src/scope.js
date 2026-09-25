// Deterministic scope guard. Runs before any LLM call so that clearly unrelated
// messages never reach Anthropic/Gemini. Only ambiguous messages are passed on
// to the short LLM classifier.

export const OUT_OF_SCOPE_REPLY =
  'Bu konuda yardımcı olamıyorum. ifHaus modelleri, arsa, fiyatlandırma, üretim ve teslim süreciyle ilgili yardımcı olabilirim.';

export const OUT_OF_SCOPE_TOKEN = 'OUT_OF_SCOPE';

export function normalize(text = '') {
  return text
    .toLocaleLowerCase('tr')
    .replace(/m²/g, ' m2 ')
    .replace(/[^a-z0-9çğıöşü\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(text) {
  return normalize(text).split(' ').filter(Boolean);
}

// Stems match the start of a word, so Turkish suffixes are covered
// ("arsa" matches "arsam", "arsaya"). Exact entries must equal the whole word.
const IN_SCOPE_STEMS = [
  'ifhaus', 'modüler', 'modul', 'modül', 'prefabrik', 'villa', 'konut', 'bungalov', 'tiny',
  'model', 'arsa', 'imar', 'parsel', 'tapu', 'ruhsat', 'metrekare', 'oda', 'salon', 'mutfak',
  'banyo', 'katlı', 'dubleks', 'tripleks', 'plan', 'kroki', 'fiyat', 'teklif', 'ücret', 'maliyet',
  'bütçe', 'üretim', 'üreti', 'fabrika', 'lojistik', 'nakliye', 'sevkiyat', 'montaj',
  'kurulum', 'teslim', 'anahtar', 'temel', 'çatı', 'cephe', 'duvar', 'yalıtım', 'izolasyon',
  'deprem', 'statik', 'taşıyıcı', 'çelik', 'ahşap', 'beton', 'malzeme', 'garanti', 'enerji',
  'finansman', 'kredi', 'taksit', 'vade', 'peşin', 'ödeme', 'bayi', 'blog', 'rehber',
  'iletişim', 'telefon', 'numara', 'satış', 'showroom', 'katalog', 'broşür', 'proje', 'mimari',
  'tasarım', 'inşaat', 'bahçe', 'teras', 'yatak'
];
const IN_SCOPE_EXACT = new Set([
  'ev', 'evi', 'evim', 'evin', 'eve', 'evde', 'evden', 'evler', 'evleri', 'evlerin', 'evleriniz',
  'evlerinizin', 'eviniz', 'evimi', 'evimiz', 'm2', 'süre', 'süresi', 'sürer', 'ara', 'arayın',
  'arar', 'arasın', 'kat', 'yapı', 'yapısı', 'yapıda', 'adres', 'adresiniz', 'ofis', 'ofisiniz'
]);

// Phrases/words that are clearly unrelated to ifHaus.
const OUT_OF_SCOPE_PHRASES = [
  'hava durumu', 'hava nasıl', 'havalar nasıl', 'hava kaç derece', 'yağmur yağ', 'kar yağ',
  'maç', 'skor', 'kaç kaç', 'futbol', 'basketbol', 'voleybol', 'fenerbahçe', 'galatasaray',
  'beşiktaş', 'trabzonspor', 'süper lig', 'şampiyonlar ligi', 'transfer', 'gol ',
  'seçim', 'siyaset', 'politika', 'cumhurbaşkan', 'başbakan', 'milletvekil', 'meclis', 'parti ',
  'hükümet', 'muhalefet', 'savaş',
  'yemek tarif', 'tarifi', 'tarif ver', 'nasıl pişir', 'ne pişir', 'menemen', 'kek ', 'pilav',
  'python', 'javascript', 'java ', 'kod yaz', 'yazılım', 'programlama', 'html', 'sql',
  'bitcoin', 'kripto', 'borsa', 'dolar kuru', 'euro kuru', 'altın fiyat',
  'film', 'dizi ', 'şarkı', 'oyun', 'burç', 'fıkra', 'şiir', 'hikaye yaz', 'ödev',
  'başkenti', 'kim kazandı', 'kaç yaşında', 'tarihte', 'nobel',
  'chatgpt', 'openai', 'gemini', 'claude', 'yapay zeka'
];

const SMALL_TALK = new Set([
  'merhaba', 'selam', 'selamlar', 'mrb', 'slm', 'günaydın', 'iyi günler', 'iyi akşamlar',
  'teşekkürler', 'teşekkür ederim', 'sağol', 'sağolun', 'sağ olun', 'tamam', 'ok', 'okey',
  'evet', 'hayır', 'peki', 'anladım', 'görüşürüz', 'hoşça kal', 'kolay gelsin', 'merhabalar'
]);

const TR_PHONE = /(?:\+?90\s*)?(?:0\s*)?5\d{2}[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}/;

function hasInScopeTerm(ws, extraNames) {
  const joined = ` ${ws.join(' ')} `;
  if (extraNames.some(n => n && joined.includes(` ${n} `))) return true;
  return ws.some(w => IN_SCOPE_EXACT.has(w) || IN_SCOPE_STEMS.some(s => w.startsWith(s)));
}

function hasOutOfScopeTerm(norm) {
  const padded = ` ${norm} `;
  return OUT_OF_SCOPE_PHRASES.some(p => padded.includes(p.startsWith(' ') ? p : ` ${p}`));
}

/**
 * @returns {{ verdict: 'IN_SCOPE'|'OUT_OF_SCOPE'|'SMALL_TALK'|'AMBIGUOUS', reason: string }}
 */
export function checkScope(message, { modelNames = [] } = {}) {
  const norm = normalize(message);
  if (!norm) return { verdict: 'AMBIGUOUS', reason: 'empty' };
  if (TR_PHONE.test(message)) return { verdict: 'IN_SCOPE', reason: 'phone' };

  const ws = norm.split(' ');
  const names = modelNames.map(normalize);
  const inScope = hasInScopeTerm(ws, names);
  const outScope = hasOutOfScopeTerm(norm);

  if (outScope && !inScope) return { verdict: 'OUT_OF_SCOPE', reason: 'keyword' };
  if (inScope && !outScope) return { verdict: 'IN_SCOPE', reason: 'keyword' };
  if (inScope && outScope) return { verdict: 'AMBIGUOUS', reason: 'mixed' };
  if (SMALL_TALK.has(norm) || (ws.length <= 3 && ws.every(w => SMALL_TALK.has(w)))) {
    return { verdict: 'SMALL_TALK', reason: 'small_talk' };
  }
  return { verdict: 'AMBIGUOUS', reason: 'no_keyword' };
}

export const CLASSIFIER_SYSTEM = `Sen bir konu sınıflandırıcısısın. ifHaus, modüler ev/villa üreten bir Türk firmasıdır.
Kullanıcının son mesajı şu konulardan biriyle ilgiliyse IN, değilse OUT yaz:
ifHaus, ifHaus modelleri, modüler ev/villa, model özellikleri, m² ve oda planları, arsa, arsaya uygun model, fiyatlandırma ve teklif, üretim, lojistik, montaj, teslim, teknik yapı bilgileri, finansman, bayilik, ifHaus blog ve rehberleri, iletişim ve satış.
Önceki asistan mesajına verilen kısa bir cevap veya takip sorusu (ör. "peki ya büyüğü?", "3 kişiyiz") IN sayılır.
Hava durumu, spor, siyaset, genel kültür, yemek, yazılım, başka şirketler ve ifHaus ile ilgisiz her şey OUT'tur.
Sadece tek kelime yaz: IN veya OUT.`;

export function parseClassifierOutput(text = '') {
  const t = text.trim().toUpperCase();
  if (t.startsWith('OUT')) return 'OUT_OF_SCOPE';
  if (t.startsWith('IN')) return 'IN_SCOPE';
  return null;
}
