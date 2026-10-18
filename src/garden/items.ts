import type { GardenItem } from '../engine/types';

export const GARDEN_ITEMS: GardenItem[] = [
  // Plants and flowers
  { id: 'clover', name: 'Clover patch', category: 'plants', pointCost: 0, unlockRequirement: { type: 'none' }, description: 'Where every garden starts.', grows: true },
  { id: 'tulip', name: 'Tulips', category: 'plants', pointCost: 120, unlockRequirement: { type: 'none' }, description: 'Bright spring tulips.', grows: true },
  { id: 'lavender', name: 'Lavender', category: 'plants', pointCost: 150, unlockRequirement: { type: 'none' }, description: 'Calm, fragrant and hardy.', grows: true },
  { id: 'fern', name: 'Fern', category: 'plants', pointCost: 140, unlockRequirement: { type: 'none' }, description: 'Lush green fronds for shady corners.', grows: true },
  { id: 'sunflower', name: 'Sunflower', category: 'plants', pointCost: 220, unlockRequirement: { type: 'successfulWeeks', weeks: 4 }, description: 'Tall and steady, like a good habit.', grows: true },
  { id: 'peony', name: 'Peonies', category: 'plants', pointCost: 260, unlockRequirement: { type: 'streak', weeks: 3 }, description: 'Full blooms for consistent weeks.', grows: true },
  { id: 'monstera', name: 'Monstera', category: 'plants', pointCost: 300, unlockRequirement: { type: 'successfulWeeks', weeks: 8 }, description: 'A statement plant.', grows: true },
  { id: 'rose', name: 'Rose bush', category: 'plants', pointCost: 420, unlockRequirement: { type: 'streak', weeks: 6 }, description: 'Reserved for a six-week streak.', grows: true },
  // Trees and larger features
  { id: 'maple', name: 'Young maple', category: 'trees', pointCost: 450, unlockRequirement: { type: 'successfulWeeks', weeks: 6 }, description: 'A tree that grows with you.', grows: true },
  { id: 'cherry', name: 'Cherry blossom', category: 'trees', pointCost: 650, unlockRequirement: { type: 'emergencyFund', percent: 75 }, description: 'Unlocks when your emergency fund is 75% funded.', grows: true },
  { id: 'pond', name: 'Lily pond', category: 'trees', pointCost: 500, unlockRequirement: { type: 'successfulWeeks', weeks: 10 }, description: 'A small pond with lily pads.', grows: false },
  { id: 'oak', name: 'Old oak', category: 'trees', pointCost: 900, unlockRequirement: { type: 'emergencyFund', percent: 100 }, description: 'Unlocks with a fully funded emergency fund.', grows: true },
  // Pots and planters
  { id: 'pot-terracotta', name: 'Terracotta pot', category: 'pots', pointCost: 80, unlockRequirement: { type: 'none' }, description: 'A classic clay pot.', grows: false },
  { id: 'pot-glazed', name: 'Glazed planter', category: 'pots', pointCost: 160, unlockRequirement: { type: 'none' }, description: 'Deep green glaze.', grows: false },
  { id: 'planter-box', name: 'Cedar planter box', category: 'pots', pointCost: 240, unlockRequirement: { type: 'successfulWeeks', weeks: 5 }, description: 'Raised cedar bed.', grows: false },
  // Paths and layouts
  { id: 'path-gravel', name: 'Gravel path', category: 'paths', pointCost: 0, unlockRequirement: { type: 'none' }, description: 'Simple and tidy.', grows: false },
  { id: 'path-stone', name: 'Stepping stones', category: 'paths', pointCost: 200, unlockRequirement: { type: 'none' }, description: 'Round stones across the lawn.', grows: false },
  { id: 'path-brick', name: 'Brick walkway', category: 'paths', pointCost: 350, unlockRequirement: { type: 'streak', weeks: 4 }, description: 'Warm herringbone brick.', grows: false },
  // Decorative objects
  { id: 'bench', name: 'Garden bench', category: 'decor', pointCost: 180, unlockRequirement: { type: 'none' }, description: 'A place to sit and plan.', grows: false },
  { id: 'lantern', name: 'Lantern', category: 'decor', pointCost: 120, unlockRequirement: { type: 'none' }, description: 'Soft evening light.', grows: false },
  { id: 'birdbath', name: 'Bird bath', category: 'decor', pointCost: 240, unlockRequirement: { type: 'successfulWeeks', weeks: 3 }, description: 'Visitors welcome.', grows: false },
  { id: 'watering-can', name: 'Watering can', category: 'decor', pointCost: 60, unlockRequirement: { type: 'none' }, description: 'Small steps, regularly.', grows: false },
  { id: 'arbor', name: 'Rose arbor', category: 'decor', pointCost: 550, unlockRequirement: { type: 'streak', weeks: 5 }, description: 'An archway for a five-week streak.', grows: false },
  // Backgrounds and seasonal themes
  { id: 'theme-spring', name: 'Spring morning', category: 'themes', pointCost: 0, unlockRequirement: { type: 'none' }, description: 'Clear sky and fresh grass.', grows: false },
  { id: 'theme-autumn', name: 'Autumn afternoon', category: 'themes', pointCost: 250, unlockRequirement: { type: 'none' }, description: 'Warm light and amber hills.', grows: false },
  { id: 'theme-dusk', name: 'Summer dusk', category: 'themes', pointCost: 300, unlockRequirement: { type: 'successfulWeeks', weeks: 6 }, description: 'Lavender sky at golden hour.', grows: false },
  { id: 'theme-winter', name: 'Winter frost', category: 'themes', pointCost: 400, unlockRequirement: { type: 'streak', weeks: 8 }, description: 'Quiet, crisp and bright.', grows: false },
];

export const GARDEN_CATEGORY_LABEL: Record<GardenItem['category'], string> = {
  plants: 'Plants & flowers',
  trees: 'Trees & features',
  pots: 'Pots & planters',
  paths: 'Paths',
  decor: 'Decor',
  themes: 'Themes',
};

export const GARDEN_SLOTS = 12;
