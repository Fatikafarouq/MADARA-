import assert from 'node:assert/strict';
import test from 'node:test';
import { createDemoEstimate, predictionDates, validateCow, type CowInput } from '../src/domain.ts';
import { translateValidationErrors, translations } from '../src/translations.ts';

const valid: CowInput = {
  name: 'Amina', cowId: 'ABU-01', breed: 'White Fulani', age: 5, parity: 2,
  daysSinceCalving: 70, bodyCondition: 3, feedType: 'Pasture', mastitis: 'no',
  pregnancy: 'no', milkingFrequency: 2,
};

test('valid cow data passes validation', () => {
  assert.deepEqual(validateCow(valid), {});
});

test('either cow name or cow ID is enough for identification', () => {
  assert.deepEqual(validateCow({ ...valid, name: '', cowId: 'TAG-17' }), {});
  assert.deepEqual(validateCow({ ...valid, name: 'Binta', cowId: '' }), {});
  assert.match(validateCow({ ...valid, name: '', cowId: '' }).name, /name or unique cow ID/);
});

test('dropdown White Fulani label maps to the same supported breed', () => {
  assert.deepEqual(validateCow({ ...valid, breed: 'White Fulani (Bunaji)' }), {});
});

test('other feed requires the separate typed value', () => {
  assert.match(validateCow({ ...valid, feedType: 'Other', feedTypeOther: '' }).feedTypeOther, /other feed/);
  assert.deepEqual(validateCow({ ...valid, feedType: 'Other', feedTypeOther: 'Cottonseed cake' }), {});
});

test('multiple structured feeds are accepted and an empty selection is rejected', () => {
  assert.deepEqual(validateCow({ ...valid, feedType: 'Mixed ration', feedTypes: ['Hay', 'Concentrate'] }), {});
  assert.match(validateCow({ ...valid, feedType: '', feedTypes: [] }).feedType, /at least one/);
});

test('unsafe or impossible values are rejected', () => {
  const errors = validateCow({ ...valid, age: 1, parity: 0, bodyCondition: 8, milkingFrequency: 0 });
  assert.deepEqual(Object.keys(errors).sort(), ['age', 'bodyCondition', 'milkingFrequency', 'parity']);
});

test('listed breeds are accepted and an unlisted breed remains blocked', () => {
  assert.deepEqual(validateCow({ ...valid, breed: 'Sokoto Gudali' }), {});
  assert.deepEqual(validateCow({ ...valid, breed: 'Holstein Friesian' }), {});
  assert.match(validateCow({ ...valid, breed: 'Other (type breed name)' }).breed, /No estimate/);
});

test('model estimate always gives a range around the total', () => {
  const estimate = createDemoEstimate(valid);
  assert.ok(estimate.low < estimate.total);
  assert.ok(estimate.high > estimate.total);
  assert.equal(estimate.confidence, 'low');
  assert.equal(estimate.modelVersion, 'woods-xgb-synthetic-research-0.1');
  assert.equal(estimate.method, 'white_fulani_full');
  assert.equal(estimate.lowConfidenceBreed, false);
});

test('mobile estimate matches the Python model golden result', () => {
  assert.equal(createDemoEstimate(valid).total, 32);
});

test('additional breeds use a low-confidence breed curve and retain a range', () => {
  const estimate = createDemoEstimate({ ...valid, breed: 'Sokoto Gudali' });
  assert.ok(estimate.total > 0);
  assert.ok(estimate.low < estimate.total);
  assert.ok(estimate.high > estimate.total);
  assert.equal(estimate.method, 'breed_curve');
  assert.equal(estimate.lowConfidenceBreed, true);
  assert.equal(estimate.modelVersion, 'breed-parity-woods-baseline-0.1');
  assert.deepEqual(estimate.factors, [
    'The selected breed curve was used.',
    'The number of previous calvings was used.',
    'Days since calving set the point on the lactation curve.',
  ]);
});

test('breed curve ignores non-feed fields that were absent from its source data', () => {
  const input = { ...valid, breed: 'Jersey' };
  const first = createDemoEstimate(input);
  const changed = createDemoEstimate({ ...input, bodyCondition: 1, mastitis: 'yes', pregnancy: 'yes', milkingFrequency: 4 });
  assert.deepEqual({ total: changed.total, low: changed.low, high: changed.high }, { total: first.total, low: first.low, high: first.high });
});

test('prediction period ends seven days after it starts', () => {
  const start = new Date('2026-08-01T12:00:00.000Z');
  const dates = predictionDates(start);
  assert.equal(new Date(dates.end).getTime() - new Date(dates.start).getTime(), 7 * 24 * 60 * 60 * 1000);
});

test('Hausa copy contains the reviewed navigation and safety wording', () => {
  const copy = translations('ha');
  assert.equal(copy.backToLanguage, 'Koma zaɓin harshe');
  assert.match(copy.prototypeLabel, /ba garanti/);
  assert.match(copy.safetyWarning, /Kada a dogara/);
});

test('validation errors follow the selected language', () => {
  const errors = translateValidationErrors(validateCow({ ...valid, age: 1 }), 'ha');
  assert.equal(errors.age, 'Shigar da shekaru daga 2 zuwa 25.');
});
