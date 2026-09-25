import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceGrounding, removeLeadCta, unsupportedFigures, MISSING_INFO_REPLY } from '../src/grounding.js';
import { buildSystemPrompt } from '../src/prompt.js';

const PHONE = '08505322458';
const KB = 'KAYNAK: https://ifhaus.com/modeller/villa-nova/ Villa Nova 99 m² 3+1 tek katlı model.';

test('lead CTA is removed before the 2nd meaningful message', () => {
  const reply = 'Villa Nova 99 m² ve 3+1 bir modeldir. Detaylı bilgi için 0850 532 2458 numarasından bize ulaşabilir ya da telefon numaranızı bırakabilirsiniz.';
  const out = enforceGrounding(reply, { knowledge: KB, ctaAllowed: false, phone: PHONE });
  assert.equal(out, 'Villa Nova 99 m² ve 3+1 bir modeldir.');
});

test('lead CTA is kept from the 2nd meaningful message on', () => {
  const reply = 'Villa Nova 99 m². Detaylı bilgi için 0850 532 2458 numarasından bize ulaşabilirsiniz.';
  assert.equal(enforceGrounding(reply, { knowledge: KB, ctaAllowed: true, phone: PHONE }), reply);
});

test('a CTA-only reply falls back to the neutral missing-info sentence', () => {
  assert.equal(removeLeadCta('Numaranızı bırakırsanız sizi arayalım.', PHONE), '');
  const out = enforceGrounding('Bu konuyu netleştirmek için 0850 532 2458 numarasını arayabilirsiniz.', { knowledge: '', ctaAllowed: false, phone: PHONE });
  assert.equal(out, MISSING_INFO_REPLY);
});

test('thanking for a phone number is not treated as a CTA', () => {
  const reply = 'Numaranızı aldık, teşekkür ederiz. Ekibimiz en kısa sürede sizi arayacak.';
  assert.equal(enforceGrounding(reply, { knowledge: '', userText: '0555 555 55 55', ctaAllowed: false, phone: PHONE }), reply);
});

test('figures not in the knowledge base are rejected', () => {
  assert.deepEqual(unsupportedFigures('Villa Nova 99 m² ve 3+1.', KB), []);
  assert.deepEqual(unsupportedFigures('Fiyatı 1.250.000 TL, teslim 90 gün.', KB), ['1.250.000 TL', '90 gün']);
  assert.equal(enforceGrounding('Villa Nova 120 m² ve 4+1 bir modeldir.', { knowledge: KB, ctaAllowed: false, phone: PHONE }), MISSING_INFO_REPLY);
  assert.equal(enforceGrounding('Fiyatı 2.500.000 TL civarındadır.', { knowledge: KB, ctaAllowed: true, phone: PHONE }), MISSING_INFO_REPLY);
});

test('prices are allowed when the source states them', () => {
  const kb = KB + ' Fiyat: 2.500.000 TL';
  assert.equal(enforceGrounding('Villa Nova 2.500.000 TL.', { knowledge: kb, ctaAllowed: true, phone: PHONE }), 'Villa Nova 2.500.000 TL.');
});

test("the user's own figures may be echoed", () => {
  const out = enforceGrounding('120 m² arsanız için satış ekibimiz uygun modeli netleştirebilir.', { knowledge: KB, userText: '120 m2 arsam var', ctaAllowed: false, phone: PHONE });
  assert.equal(out, '120 m² arsanız için satış ekibimiz uygun modeli netleştirebilir.');
});

test('embellishments not in the source are dropped', () => {
  const reply = 'Villa Nova 99 m² taban alanına sahiptir. Geniş bahçe kullanımı ve güçlü iç-dış mekan ilişkisi sunar. Model 3+1 planlıdır.';
  assert.equal(enforceGrounding(reply, { knowledge: KB, ctaAllowed: false, phone: PHONE }), 'Model 3+1 planlıdır.');
});

test('system prompt only allows the phone CTA from the 2nd meaningful message', () => {
  const first = buildSystemPrompt({ knowledge: KB, messageCount: 1, phone: PHONE });
  const second = buildSystemPrompt({ knowledge: KB, messageCount: 2, phone: PHONE });
  assert.match(first, /Bu mesajda telefon numarası verme/);
  assert.doesNotMatch(first, /0850 532 2458 numarasını arayabileceğini/);
  assert.match(second, /Telefon yönlendirmesi bu mesajda kullanılabilir/);
});
