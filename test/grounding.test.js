import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceGrounding, unsupportedFigures, MISSING_INFO_REPLY } from '../src/grounding.js';
import { buildSystemPrompt, ctaText } from '../src/prompt.js';

const PHONE = '08505322458';
const CTA = 'Detaylı bilgi için 0850 532 2458’i arayabilir veya telefon numaranızı bırakabilirsiniz, ekibimiz sizi arasın.';
const KB = 'KAYNAK: https://ifhaus.com/modeller/villa-nova/ Villa Nova 99 m² 3+1 tek katlı model.';

test('CTA text matches the agreed wording', () => {
  assert.equal(ctaText(PHONE), CTA);
});

test('system prompt allows the CTA from the first meaningful message', () => {
  const first = buildSystemPrompt({ knowledge: KB, messageCount: 1, phone: PHONE });
  assert.ok(first.includes(`İlk anlamlı ifHaus mesajından itibaren`));
  assert.ok(first.includes(CTA));
});

test('the CTA passes the grounding checks untouched on the first message', () => {
  const reply = `Villa Nova 99 m² ve 3+1 bir modeldir. ${CTA}`;
  assert.equal(enforceGrounding(reply, { knowledge: KB }), reply);
});

test('thanking for a phone number is kept', () => {
  const reply = 'Numaranızı aldık, teşekkür ederiz. Ekibimiz en kısa sürede sizi arayacak.';
  assert.equal(enforceGrounding(reply, { knowledge: '', userText: '0555 555 55 55' }), reply);
});

test('figures not in the knowledge base are rejected', () => {
  assert.deepEqual(unsupportedFigures('Villa Nova 99 m² ve 3+1.', KB), []);
  assert.deepEqual(unsupportedFigures('Fiyatı 1.250.000 TL, teslim 90 gün.', KB), ['1.250.000 TL', '90 gün']);
  assert.equal(enforceGrounding('Villa Nova 120 m² ve 4+1 bir modeldir.', { knowledge: KB }), MISSING_INFO_REPLY);
  assert.equal(enforceGrounding('Fiyatı 2.500.000 TL civarındadır.', { knowledge: KB }), MISSING_INFO_REPLY);
});

test('prices are allowed when the source states them', () => {
  const kb = KB + ' Fiyat: 2.500.000 TL';
  assert.equal(enforceGrounding('Villa Nova 2.500.000 TL.', { knowledge: kb }), 'Villa Nova 2.500.000 TL.');
});

test("the user's own figures may be echoed", () => {
  const out = enforceGrounding('120 m² arsanız için satış ekibimiz uygun modeli netleştirebilir.', { knowledge: KB, userText: '120 m2 arsam var' });
  assert.equal(out, '120 m² arsanız için satış ekibimiz uygun modeli netleştirebilir.');
});

test('embellishments not in the source are dropped', () => {
  const reply = 'Villa Nova 99 m² taban alanına sahiptir. Geniş bahçe kullanımı ve güçlü iç-dış mekan ilişkisi sunar. Model 3+1 planlıdır.';
  assert.equal(enforceGrounding(reply, { knowledge: KB }), 'Model 3+1 planlıdır.');
});
