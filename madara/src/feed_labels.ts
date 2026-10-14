// Stable English labels also preserve existing saved feed values.
// TODO: human-reviewed Hausa labels for the new feeds. Use English until supplied.
export const feedLabels = {
  grazing: 'Grazing only', supplemented: 'Grazing with supplement', cutCarry: 'Cut-and-carry forage',
  residues: 'Crop residues', groundnutHaulms: 'Groundnut haulms', stover: 'Maize or sorghum stover',
  hay: 'Hay', silage: 'Silage', concentrate: 'Concentrate', mixed: 'Mixed ration', other: 'Other',
  napier: 'Napier / elephant grass', guinea: 'Guinea grass', brachiaria: 'Brachiaria',
  rainyPasture: 'Natural pasture — rainy season', dryPasture: 'Natural pasture — dry standing grass',
  grassHay: 'Grass hay', maizeSilage: 'Maize silage', sorghumSilage: 'Sorghum silage',
  maizeStover: 'Maize stover (dry stalks)', riceStraw: 'Rice straw', sorghumStover: 'Sorghum stover',
  youngSorghum: 'Young sorghum regrowth (fresh)', lablab: 'Lablab', stylosanthes: 'Stylosanthes',
  centrosema: 'Centrosema', cowpea: 'Cowpea haulms', leucaena: 'Leucaena', gliricidia: 'Gliricidia',
  wheatBran: 'Wheat offal / wheat bran', maizeBran: 'Maize bran', riceBran: 'Rice bran',
  wetBrewers: 'Brewers grains (wet)', dryBrewers: 'Brewers grains (dry)', molasses: 'Molasses',
  cottonseed: 'Cottonseed cake', groundnutCake: 'Groundnut cake', soybean: 'Soybean meal', palmKernel: 'Palm kernel cake',
  processedCassava: 'Cassava peels (dried or properly processed)', rawCassava: 'Raw cassava or fresh peels',
  salt: 'Salt', boneMeal: 'Bone meal (feed-grade)', phosphate: 'Dicalcium phosphate', mineralLick: 'Mineral lick block',
} as const;

export const feedingCopy = {
  heading: 'Feed effect on this estimate',
  approximate: 'The feeding score is approximate. Selected feeds may be eaten in different amounts.',
  score: 'Average feed score',
  adjustment: 'Change to the seven-day estimate',
  unscored: 'Other or unrecognised feeds have no approved score and are left out of the average.',
  safetyReduction: 'A safety-risk feed was selected. A provisional 10% reduction replaces the normal feed-score adjustment. This does not mean the feed is safe.',
  curveExplanation: 'This seven-day estimate uses the breed-and-calving-number Wood curve, days since calving, and the approved feed-score adjustment. Other entered fields do not change this breed estimate yet.',
};
// TODO: needs human translation into Hausa. Existing Hausa copy remains unchanged.
export function feedCopy(_language: 'en' | 'ha') { return feedingCopy; }
