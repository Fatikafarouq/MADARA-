import { feedLabels } from './feed_labels.ts';

type FeedId = keyof typeof feedLabels;
// Scores and adjustment rules supplied by the builder as lecturer-approved.
export const FEED_SCORES: Record<FeedId, number | null> = {
  grazing: 5, supplemented: 8, cutCarry: 6, residues: 3, groundnutHaulms: 7, stover: 3,
  hay: 5, silage: 7, concentrate: 9, mixed: 9, other: null,
  napier: 7, guinea: 7, brachiaria: 8, rainyPasture: 7, dryPasture: 3,
  grassHay: 5, maizeSilage: 9, sorghumSilage: 8, maizeStover: 3, riceStraw: 2, sorghumStover: 3,
  youngSorghum: 0, lablab: 8, stylosanthes: 8, centrosema: 8, cowpea: 7, leucaena: 8, gliricidia: 8,
  wheatBran: 7, maizeBran: 7, riceBran: 7, wetBrewers: 8, dryBrewers: 8, molasses: 6,
  cottonseed: 8, groundnutCake: 9, soybean: 10, palmKernel: 7,
  processedCassava: 6, rawCassava: 0, salt: 5, boneMeal: 5, phosphate: 6, mineralLick: 6,
};
export const FEED_TYPES: string[] = [...Object.values(feedLabels).filter((label) => label !== feedLabels.other), feedLabels.other];
export const FEED_RULE_VERSION = 'lecturer-feed-score-1';

const forage: FeedId[] = ['napier', 'guinea', 'brachiaria', 'rainyPasture', 'dryPasture', 'grassHay',
  'maizeSilage', 'sorghumSilage', 'youngSorghum', 'lablab', 'stylosanthes', 'centrosema',
  'groundnutHaulms', 'cowpea', 'leucaena', 'gliricidia'];
const supplements: FeedId[] = ['wheatBran', 'maizeBran', 'riceBran', 'wetBrewers', 'dryBrewers',
  'molasses', 'cottonseed', 'groundnutCake', 'soybean', 'palmKernel', 'processedCassava', 'rawCassava',
  'salt', 'boneMeal', 'phosphate', 'mineralLick'];
// Suppress a broad category only when a selected ingredient overlaps it.
const overlaps: Partial<Record<FeedId, FeedId[]>> = {
  grazing: ['rainyPasture', 'dryPasture'], supplemented: [...forage, ...supplements],
  cutCarry: forage, residues: ['maizeStover', 'sorghumStover', 'stover', 'riceStraw', 'groundnutHaulms', 'cowpea'],
  stover: ['maizeStover', 'sorghumStover'], hay: ['grassHay'], silage: ['maizeSilage', 'sorghumSilage'],
  concentrate: supplements,
  mixed: [...forage, ...supplements, 'maizeStover', 'sorghumStover', 'riceStraw', 'stover'],
};

export type FeedAdjustment = {
  score: number | null;
  multiplier: number;
  safetyRisk: boolean;
  countedFeeds: string[];
  excludedCategories: string[];
  unscoredFeeds: string[];
};

export function calculateFeedAdjustment(feeds: readonly string[]): FeedAdjustment {
  const unique = [...new Set(feeds)];
  const ids = unique.map((name) => (Object.keys(feedLabels) as FeedId[]).find((id) => feedLabels[id] === name));
  const selected = new Set(ids.filter((id): id is FeedId => id !== undefined));
  const excluded = new Set([...selected].filter((id) => overlaps[id]?.some((ingredient) => selected.has(ingredient))));
  const counted = [...selected].filter((id) => !excluded.has(id) && FEED_SCORES[id] !== null);
  const score = counted.length ? counted.reduce((sum, id) => sum + FEED_SCORES[id]!, 0) / counted.length : null;
  const safetyRisk = [...selected].some((id) => FEED_SCORES[id] === 0);
  return {
    score, multiplier: safetyRisk ? 0.9 : score === null ? 1 : 1 + (score - 5) * 0.03,
    safetyRisk, countedFeeds: counted.map((id) => feedLabels[id]),
    excludedCategories: [...excluded].map((id) => feedLabels[id]),
    unscoredFeeds: unique.filter((_, index) => ids[index] === undefined || FEED_SCORES[ids[index]!] === null),
  };
}
