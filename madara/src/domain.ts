import { MODEL_DATA } from './model_data.ts';
import { BREED_CURVES } from './breed_curve_data.ts';
import { calculateFeedAdjustment, FEED_RULE_VERSION, type FeedAdjustment } from './feeds.ts';

export const MODEL_VERSION = MODEL_DATA.version;

export type Choice = 'yes' | 'no' | 'unsure';

export type CowInput = {
  name: string;
  cowId: string;
  internalCowCode?: string;
  breed: string;
  breedOther?: string;
  age: number;
  parity: number;
  daysSinceCalving: number;
  bodyCondition: number;
  feedType: string;
  feedTypes?: string[];
  feedTypeOther?: string;
  feedQuantity?: number;
  mastitis: Choice;
  pregnancy: Choice;
  milkingFrequency: number;
};

export type Estimate = {
  total: number;
  low: number;
  high: number;
  confidence: 'low';
  factors: string[];
  modelVersion: string;
  method: 'white_fulani_full' | 'breed_curve';
  lowConfidenceBreed: boolean;
  feedAdjustment?: FeedAdjustment;
};

export function validateCow(input: CowInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim() && !input.cowId.trim()) errors.name = 'Enter a cow name or unique cow ID.';
  if (!input.breed.trim()) errors.breed = 'Breed is required.';
  else if (!isSupportedBreed(input.breed)) errors.breed = 'No estimate is available for this breed yet.';
  if (!Number.isFinite(input.age) || input.age < 2 || input.age > 25) errors.age = 'Enter an age from 2 to 25 years.';
  if (!Number.isInteger(input.parity) || input.parity < 1 || input.parity > 15) errors.parity = 'Enter calvings from 1 to 15.';
  if (!Number.isInteger(input.daysSinceCalving) || input.daysSinceCalving < 1 || input.daysSinceCalving > 800) errors.daysSinceCalving = 'Enter 1 to 800 days since calving.';
  if (!Number.isInteger(input.bodyCondition) || input.bodyCondition < 1 || input.bodyCondition > 5) errors.bodyCondition = 'Choose a body condition score from 1 to 5.';
  if (!input.feedType.trim() || input.feedTypes?.length === 0) errors.feedType = 'Choose at least one feed type.';
  if ((normalise(input.feedType) === 'other' || input.feedTypes?.includes('Other')) && !input.feedTypeOther?.trim()) errors.feedTypeOther = 'Enter the other feed type.';
  if (input.feedQuantity !== undefined && (!Number.isFinite(input.feedQuantity) || input.feedQuantity <= 0 || input.feedQuantity > 200)) errors.feedQuantity = 'Enter a feed quantity from 0.1 to 200 kg, or leave it blank.';
  if (!Number.isInteger(input.milkingFrequency) || input.milkingFrequency < 1 || input.milkingFrequency > 4) errors.milkingFrequency = 'Enter 1 to 4 milkings per day.';
  return errors;
}

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isWhiteFulani(value: string): boolean {
  const breed = normalise(value);
  return breed === 'white fulani' || breed === 'white fulani bunaji';
}

function supportedBreedName(value: string): string | undefined {
  if (isWhiteFulani(value)) return 'White Fulani';
  const target = normalise(value);
  return Object.keys(BREED_CURVES).find((breed) => normalise(breed) === target);
}

export function isSupportedBreed(value: string): boolean {
  return Boolean(supportedBreedName(value));
}

function feedCategory(value: string): string | undefined {
  const feed = normalise(value);
  if (feed.includes('cut') && feed.includes('carry')) return 'cut_and_carry';
  if (feed.includes('graz') && feed.includes('supplement')) return 'grazing+supplement';
  if (feed.includes('mixed') || feed.includes('ration')) return 'mixed_ration';
  if (feed.includes('graz') || feed.includes('pasture')) return 'grazing_only';
  return undefined;
}

function featureVector(input: CowInput, daysInMilk: number): number[] {
  const feed = feedCategory(input.feedType);
  const pregnancy = input.pregnancy === 'yes' ? 'pregnant' : input.pregnancy === 'no' ? 'not_pregnant' : 'unsure';
  const values: Record<string, number> = {
    age_years: input.age,
    parity: input.parity,
    days_in_milk: daysInMilk,
    body_condition_score: input.bodyCondition,
    feed_quantity_kg_day: input.feedQuantity ?? Number.NaN,
    milking_frequency: input.milkingFrequency,
    'breed_White Fulani': isWhiteFulani(input.breed) ? 1 : 0,
    'feed_type_cut_and_carry': feed === 'cut_and_carry' ? 1 : 0,
    'feed_type_grazing+supplement': feed === 'grazing+supplement' ? 1 : 0,
    'feed_type_grazing_only': feed === 'grazing_only' ? 1 : 0,
    'feed_type_mixed_ration': feed === 'mixed_ration' ? 1 : 0,
    mastitis_status_no: input.mastitis === 'no' ? 1 : 0,
    mastitis_status_yes: input.mastitis === 'yes' ? 1 : 0,
    pregnancy_status_not_pregnant: pregnancy === 'not_pregnant' ? 1 : 0,
    pregnancy_status_pregnant: pregnancy === 'pregnant' ? 1 : 0,
    pregnancy_status_unsure: pregnancy === 'unsure' ? 1 : 0,
  };
  return MODEL_DATA.featureOrder.map((feature) => values[feature]);
}

function residualPrediction(features: number[]): number {
  let prediction = MODEL_DATA.baseScore;
  for (const tree of MODEL_DATA.trees) {
    let node = 0;
    while (tree.l[node] !== -1) {
      const value = features[tree.f[node]];
      const goLeft = Number.isNaN(value) ? Boolean(tree.d[node]) : value < tree.v[node];
      node = goLeft ? tree.l[node] : tree.r[node];
    }
    prediction += tree.v[node];
  }
  return prediction;
}

function dailyEstimateKg(input: CowInput, daysInMilk: number): number {
  // The current app has no historical test-day series, so it uses the approved
  // breed-average Wood curve rather than pretending it can fit a cow curve.
  const params = MODEL_DATA.breedCurves['White Fulani'];
  const baseline = params[0] * Math.pow(daysInMilk, params[1]) * Math.exp(-params[2] * daysInMilk);
  return Math.min(MODEL_DATA.clipHighKgPerDay, Math.max(0, baseline + residualPrediction(featureVector(input, daysInMilk))));
}

function dailyBreedCurveLitres(input: CowInput, daysInMilk: number): number {
  const breed = supportedBreedName(input.breed);
  const curve = breed ? BREED_CURVES[breed] : undefined;
  if (!curve) return 0;
  const [a, b, c] = curve.byParity[input.parity] ?? curve.fallback;
  return Math.max(0, a * Math.pow(daysInMilk, b) * Math.exp(-c * daysInMilk));
}

/** Return an offline seven-day estimate from the bundled Wood + XGBoost model. */
export function createDemoEstimate(input: CowInput): Estimate {
  const whiteFulani = isWhiteFulani(input.breed);
  const factors: string[] = [];
  if (!whiteFulani) {
    factors.push('The selected breed curve was used.');
    factors.push('The number of previous calvings was used.');
    factors.push('Days since calving set the point on the lactation curve.');
  } else if (input.daysSinceCalving <= 100) {
    factors.push('Early lactation was entered and may increase expected yield.');
  } else if (input.daysSinceCalving > 300) {
    factors.push('Later lactation was entered and may reduce expected yield.');
  }
  if (whiteFulani && input.bodyCondition <= 2) {
    factors.push('A lower body condition score may reduce expected yield.');
  } else if (input.bodyCondition >= 4) {
    factors.push('The entered body condition may support expected yield.');
  }
  if (whiteFulani && input.milkingFrequency >= 2) {
    factors.push('More frequent milking may increase expected yield.');
  }
  if (whiteFulani && input.mastitis === 'yes') {
    factors.push('Mastitis was entered and may reduce expected yield.');
  }
  if (whiteFulani && input.pregnancy === 'yes' && input.daysSinceCalving > 220) {
    factors.push('Pregnancy together with later lactation may reduce expected yield.');
  }
  let weeklyYield = 0;
  for (let offset = 0; offset < 7; offset += 1) {
    weeklyYield += whiteFulani
      ? dailyEstimateKg(input, input.daysSinceCalving + offset)
      : dailyBreedCurveLitres(input, input.daysSinceCalving + offset);
  }
  const breed = supportedBreedName(input.breed);
  const exactLitres = whiteFulani ? weeklyYield / MODEL_DATA.kgPerLitre : weeklyYield;
  const errorBandLitres = whiteFulani
    ? (MODEL_DATA.absoluteError70KgPerDay * 7) / MODEL_DATA.kgPerLitre
    : (breed ? BREED_CURVES[breed].absoluteError70LitresPerDay * 7 : 0);
  const feedAdjustment = calculateFeedAdjustment(input.feedTypes ?? [input.feedType]);
  const adjustedLitres = exactLitres * feedAdjustment.multiplier;
  // Shift the range with the estimate; retain the existing absolute error width.
  // This provisional rule has not recalibrated the model's range coverage.
  const total = Math.round(adjustedLitres);
  return {
    total,
    low: Math.max(0, Math.round(adjustedLitres - errorBandLitres)),
    high: Math.round(adjustedLitres + errorBandLitres),
    confidence: 'low',
    factors: factors.slice(0, 3).length ? factors.slice(0, 3) : ['The estimate uses the cow information entered above.'],
    modelVersion: (whiteFulani ? MODEL_VERSION : 'breed-parity-woods-baseline-0.1')
      + (feedAdjustment.score === null ? '' : `+${FEED_RULE_VERSION}`),
    method: whiteFulani ? 'white_fulani_full' : 'breed_curve',
    lowConfidenceBreed: !whiteFulani,
    feedAdjustment,
  };
}

export function predictionDates(now = new Date()): { start: string; end: string } {
  const end = new Date(now);
  end.setDate(end.getDate() + 7);
  return { start: now.toISOString(), end: end.toISOString() };
}
