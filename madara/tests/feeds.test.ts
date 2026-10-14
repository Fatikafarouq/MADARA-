import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateFeedAdjustment, FEED_TYPES, FEED_SCORES, FEED_RULE_VERSION } from '../src/feeds.ts';
import { feedLabels, feedCopy } from '../src/feed_labels.ts';
import { createDemoEstimate, validateCow, type CowInput } from '../src/domain.ts';

const cow: CowInput = {
  name: 'Test cow', cowId: 'TEST', breed: 'Sokoto Gudali', age: 5, parity: 2,
  daysSinceCalving: 70, bodyCondition: 3, feedType: 'Hay', mastitis: 'no',
  pregnancy: 'no', milkingFrequency: 2,
};

test('all 45 feed choices have the approved score or explicit unscored status', () => {
  const expected = [5,8,6,3,7,3,5,7,9,9,null,7,7,8,7,3,5,9,8,3,2,3,0,8,8,8,7,8,8,7,7,7,8,8,6,8,9,10,7,6,0,5,5,6,6];
  assert.equal(FEED_TYPES.length, 45);
  assert.equal(new Set(FEED_TYPES).size, 45);
  assert.deepEqual(Object.values(FEED_SCORES), expected);
  for (const name of FEED_TYPES) {
    assert.deepEqual(validateCow({ ...cow, feedType: name, feedTypes: [name], feedTypeOther: name === 'Other' ? 'Unlisted feed' : undefined }), {});
  }
});

test('approved examples use five as neutral and three percent per point', () => {
  for (const [feed, multiplier] of [['Hay',1],['Groundnut haulms',1.06],['Concentrate',1.12],['Crop residues',0.94],['Rice straw',0.91],['Soybean meal',1.15]] as const) {
    assert.ok(Math.abs(calculateFeedAdjustment([feed]).multiplier - multiplier) < 1e-12);
  }
});

test('multiple feeds average scores without weights or duplicate selections', () => {
  const result = calculateFeedAdjustment(['Groundnut haulms', 'Rice straw', 'Groundnut haulms']);
  assert.equal(result.score, 4.5);
  assert.equal(result.multiplier, 0.985);
  assert.equal(result.countedFeeds.length, 2);
});

test('overlapping generic categories are excluded when ingredients are selected', () => {
  const pairs = [
    ['Grazing only', feedLabels.rainyPasture], ['Grazing with supplement', 'Soybean meal'],
    ['Cut-and-carry forage', 'Lablab'], ['Crop residues', 'Rice straw'],
    ['Maize or sorghum stover', 'Sorghum stover'], ['Hay', 'Grass hay'],
    ['Silage', 'Maize silage'], ['Concentrate', 'Groundnut cake'], ['Mixed ration', 'Soybean meal'],
  ];
  for (const [category, ingredient] of pairs) {
    const result = calculateFeedAdjustment([category, ingredient]);
    assert.deepEqual(result.excludedCategories, [category]);
    assert.deepEqual(result.countedFeeds, [ingredient]);
  }
});

test('unrelated generic choices remain counted', () => {
  assert.deepEqual(calculateFeedAdjustment(['Hay','Soybean meal']).countedFeeds, ['Hay','Soybean meal']);
  assert.deepEqual(calculateFeedAdjustment(['Grazing only','Groundnut cake']).countedFeeds, ['Grazing only','Groundnut cake']);
});

test('blank, Other and legacy unknown feeds are not treated as zero', () => {
  for (const names of [[], ['Other'], ['Pasture'], ['Unknown legacy feed']]) {
    const result = calculateFeedAdjustment(names);
    assert.equal(result.score, null);
    assert.equal(result.multiplier, 1);
    assert.equal(result.safetyRisk, false);
  }
  const mixed = calculateFeedAdjustment(['Other','Soybean meal']);
  assert.equal(mixed.score, 10);
  assert.deepEqual(mixed.unscoredFeeds, ['Other']);
});

test('either or both score-zero feeds override all other scores with a single ten percent reduction', () => {
  for (const names of [[feedLabels.rawCassava], [feedLabels.youngSorghum],
    [feedLabels.rawCassava, 'Soybean meal'], [feedLabels.rawCassava, feedLabels.youngSorghum, 'Mixed ration']]) {
    const result = calculateFeedAdjustment(names);
    assert.equal(result.multiplier, 0.9);
    assert.equal(result.safetyRisk, true);
  }
  assert.equal(calculateFeedAdjustment([feedLabels.processedCassava]).multiplier, 1.03);
});

test('feed adjustment applies once to the seven-day estimate for both prediction methods', () => {
  for (const breed of ['White Fulani', 'Sokoto Gudali']) {
    // Keep the existing model input fixed to isolate the new post-model rule.
    const baseline = createDemoEstimate({ ...cow, breed, feedTypes: ['Hay'] });
    for (const [feed, multiplier] of [['Groundnut haulms',1.06],['Concentrate',1.12],['Rice straw',0.91],[feedLabels.rawCassava,0.9]] as const) {
      const estimate = createDemoEstimate({ ...cow, breed, feedTypes: [feed] });
      assert.ok(Math.abs(estimate.total - baseline.total * multiplier) <= 1);
      assert.ok(estimate.total > 0);
      assert.ok(estimate.low <= estimate.total && estimate.total <= estimate.high);
      assert.equal(estimate.confidence, 'low');
      assert.ok(estimate.modelVersion.endsWith(FEED_RULE_VERSION));
      assert.equal(estimate.feedAdjustment?.multiplier, multiplier);
    }
  }
});

test('optional feed quantity may remain blank and old predictions need no new fields', () => {
  assert.deepEqual(validateCow(cow), {});
  const estimate = createDemoEstimate(cow);
  assert.ok(Number.isFinite(estimate.total));
  assert.equal(estimate.feedAdjustment?.score, 5);
  assert.equal(estimate.feedAdjustment?.multiplier, 1);
});

test('new copy describes the approximate rule and human-translation fallback', () => {
  assert.match(feedCopy('en').approximate, /different amounts/);
  assert.match(feedCopy('en').safetyReduction, /does not mean the feed is safe/);
  assert.equal(feedCopy('ha').heading, feedCopy('en').heading);
});
