import * as cheerio from 'cheerio';

const SEED_URLS = [
  'https://ifhaus.com/',
  'https://ifhaus.com/modeller/',
  'https://ifhaus.com/arsana-ozel-tasarim/',
  'https://ifhaus.com/blog/celik-villa/'
];

let pages = [];
let lastRefresh = 0;

function cleanText(html) {
  const $ = cheerio.load(html);
  $('script,style,noscript,svg,nav,footer').remove();
  return $('body')
    .text()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 22000);
}

async function fetchPage(url) {
  const r = await fetch(url, {
    headers: { 'user-agent': 'ifHaus-DM-Assistant/1.0' }
  });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  const html = await r.text();
  return { url, text: cleanText(html) };
}

async function discoverModelUrls() {
  try {
    const r = await fetch('https://ifhaus.com/modeller/');
    if (!r.ok) return [];
    const html = await r.text();
    const $ = cheerio.load(html);
    const urls = new Set();
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const abs = new URL(href, 'https://ifhaus.com').toString();
      if (/ifhaus\.com\/model/i.test(abs) || /ifhaus\.com\/modeller\//i.test(abs)) {
        if (abs !== 'https://ifhaus.com/modeller/') urls.add(abs);
      }
    });
    return [...urls].slice(0, 20);
  } catch {
    return [];
  }
}

export async function refreshKnowledge(force = false) {
  const now = Date.now();
  if (!force && pages.length && now - lastRefresh < 6 * 60 * 60 * 1000) return pages;

  const discovered = await discoverModelUrls();
  const urls = [...new Set([...SEED_URLS, ...discovered])];
  const results = await Promise.allSettled(urls.map(fetchPage));
  pages = results
    .filter(x => x.status === 'fulfilled')
    .map(x => x.value);
  lastRefresh = now;
  return pages;
}

function tokens(s) {
  return (s.toLocaleLowerCase('tr').match(/[a-z0-9çğıöşü]+/g) || [])
    .filter(x => x.length > 2);
}

export async function getRelevantKnowledge(query) {
  const all = await refreshKnowledge();
  const q = new Set(tokens(query));
  const scored = all.map(p => {
    const words = tokens(p.text.slice(0, 12000));
    let score = 0;
    for (const w of words) if (q.has(w)) score += 1;
    return { ...p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, 4);
  return selected
    .map(p => `KAYNAK: ${p.url}\n${p.text.slice(0, 9000)}`)
    .join('\n\n---\n\n')
    .slice(0, 28000);
}

// Model names derived from cached model page URLs (e.g. /modeller/villa-nova/ -> "villa nova").
// Used by the scope guard so model names count as in-scope without an LLM call.
export function getModelNames() {
  return pages
    .map(p => {
      const m = p.url.match(/ifhaus\.com\/(?:modeller|model)\/([^/?#]+)/i);
      return m ? decodeURIComponent(m[1]).replace(/-/g, ' ') : null;
    })
    .filter(Boolean);
}
