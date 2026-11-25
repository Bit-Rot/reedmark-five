export const RELIC_EFFECTS = [
  'frenzyOnDamage',
  'flintShim', 'reedShuttle', 'clayWeir', 'mudWedge', 'threadSpool',
  'waxBalance', 'knottedCord', 'siltQuill', 'keepersBead', 'pocketSpring',
  'coldPebble', 'twinRivets', 'sedgeLaces', 'fenTongs', 'siltSalt',
  'hingePin', 'reedLoom', 'loopWeight', 'drownedCompass', 'tideKnot',
  'blankFerrule', 'clayFlask', 'ironThread', 'mireGlass', 'tideSlate',
  'counterweightCrown', 'sixfoldBell', 'floodgateKey', 'hollowPrism', 'twinwakeDial',
] as const;

export type RelicEffect = (typeof RELIC_EFFECTS)[number];
