import test from 'node:test';
import assert from 'node:assert/strict';
import { checkScope, parseClassifierOutput } from '../src/scope.js';

const verdict = (msg, opts) => checkScope(msg, opts).verdict;

test('clearly off-topic messages are blocked without an LLM call', () => {
  for (const msg of [
    'Bugün hava nasıl?',
    'Fenerbahçe maçı kaç kaç?',
    'Menemen tarifi verir misin?',
    'Python ile kod yazar mısın?',
    'Seçimi kim kazandı?',
    'Dolar kuru ne kadar?'
  ]) assert.equal(verdict(msg), 'OUT_OF_SCOPE', msg);
});

test('ifHaus topics are in scope', () => {
  for (const msg of [
    'Villa Nova hakkında bilgi verir misin?',
    'Arsama uygun model var mı?',
    '120 m2 3 oda modeliniz var mı?',
    'Fiyatlarınız ne kadar?',
    'Montaj ve teslim ne kadar sürer?',
    'Bayilik veriyor musunuz?',
    'Kredi ile alabilir miyim?',
    'Numaram 0555 555 55 55'
  ]) assert.equal(verdict(msg), 'IN_SCOPE', msg);
});

test('model names from the knowledge base count as in scope', () => {
  assert.equal(verdict('Loft hakkında bilgi', { modelNames: ['loft'] }), 'IN_SCOPE');
});

test('greetings are small talk, unknowns are ambiguous', () => {
  assert.equal(verdict('Merhaba'), 'SMALL_TALK');
  assert.equal(verdict('Teşekkürler'), 'SMALL_TALK');
  assert.equal(verdict('3 kişiyiz'), 'AMBIGUOUS');
  assert.equal(verdict('Evim için hava nasıl olur'), 'AMBIGUOUS');
});

test('classifier output parsing', () => {
  assert.equal(parseClassifierOutput('OUT'), 'OUT_OF_SCOPE');
  assert.equal(parseClassifierOutput(' in\n'), 'IN_SCOPE');
  assert.equal(parseClassifierOutput('belki'), null);
});
