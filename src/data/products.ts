import type { Product } from '../engine/types';

/**
 * Curated demo catalog. Prices are illustrative estimates, not live quotes.
 * Images: Wikimedia Commons thumbnails (stable upload.wikimedia.org URLs, freely licensed).
 */
const wm = (path: string) => {
  const file = path.split('/').pop()!;
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}/500px-${file}`;
};

export const PRODUCTS: Product[] = [
  {
    id: 'p-phone-pro', name: 'Flagship smartphone', category: 'Electronics', price: 119900,
    imageUrl: wm('1/19/Apple_iPhone_15_Pro.jpg'), imageCredit: 'Wikimedia Commons — Apple iPhone 15 Pro',
    description: 'Latest-generation flagship, 256 GB.', sourceType: 'curated_demo', alternativeId: 'p-phone-mid',
  },
  {
    id: 'p-phone-mid', name: 'Midrange smartphone', category: 'Electronics', price: 49900,
    imageUrl: wm('a/a6/Google_Pixel_7A.jpg'), imageCredit: 'Wikimedia Commons — Google Pixel 7a',
    description: 'Strong camera and battery at a lower price, 128 GB.', sourceType: 'curated_demo',
  },
  {
    id: 'p-laptop', name: '13-inch ultralight laptop', category: 'Electronics', price: 109900,
    imageUrl: wm('9/9f/M2_Macbook_Air_Starlight_model.jpg'), imageCredit: 'Wikimedia Commons — MacBook Air (M2)',
    description: 'Thin, quiet, all-day battery. 16 GB / 512 GB.', sourceType: 'curated_demo', alternativeId: 'p-laptop-budget',
  },
  {
    id: 'p-laptop-budget', name: '14-inch everyday laptop', category: 'Electronics', price: 64900,
    imageUrl: wm('3/37/Schenker_VIA14_Laptop_asv2021-01.jpg'), imageCredit: 'Wikimedia Commons — Schenker VIA14',
    description: 'Capable Windows laptop for work and school.', sourceType: 'curated_demo',
  },
  {
    id: 'p-headphones', name: 'Noise-cancelling headphones', category: 'Electronics', price: 54900,
    imageUrl: wm('3/33/Apple_airpods_max_with_case.jpg'), imageCredit: 'Wikimedia Commons — AirPods Max',
    description: 'Premium over-ear headphones with case.', sourceType: 'curated_demo', alternativeId: 'p-earbuds',
  },
  {
    id: 'p-earbuds', name: 'Wireless earbuds', category: 'Electronics', price: 12900,
    imageUrl: wm('8/83/AirPods_%28cropped%29.jpg'), imageCredit: 'Wikimedia Commons — AirPods',
    description: 'Everyday wireless earbuds with charging case.', sourceType: 'curated_demo',
  },
  {
    id: 'p-desk-setup', name: 'Sit-stand desk and chair setup', category: 'Furniture', price: 115000,
    imageUrl: wm('2/29/Ikea_Bekant_Sit_Stand_Desk_%2819548044600%29.jpg'), imageCredit: 'Wikimedia Commons — Ikea Bekant sit/stand desk',
    description: 'Motorized standing desk, ergonomic chair and monitor arm.', sourceType: 'curated_demo', alternativeId: 'p-desk-basic',
  },
  {
    id: 'p-desk-basic', name: 'Basic desk setup', category: 'Furniture', price: 38000,
    imageUrl: wm('5/53/Office%2C_Standing_Desk_%285155525455%29.jpg'), imageCredit: 'Wikimedia Commons — Office standing desk',
    description: 'Simple desk and task lamp for a home office.', sourceType: 'curated_demo',
  },
  {
    id: 'p-chair', name: 'Ergonomic mesh office chair', category: 'Furniture', price: 65000,
    imageUrl: wm('8/8a/Prototype_ergonomic_office_chair%2C_V%26A_London.jpg'), imageCredit: 'Wikimedia Commons — ergonomic office chair, V&A',
    description: 'Refurbished premium mesh chair with lumbar support.', sourceType: 'curated_demo',
  },
  {
    id: 'p-car-newer', name: '2018 compact sedan (used, 45k mi)', category: 'Transportation', price: 1650000,
    imageUrl: wm('2/24/2018_Toyota_Corolla_%28ZRE172R%29_Ascent_sedan_%282018-11-02%29_02.jpg'), imageCredit: 'Wikimedia Commons — 2018 Toyota Corolla',
    description: 'Reliable used compact sedan, one owner.', sourceType: 'curated_demo', alternativeId: 'p-car-older',
  },
  {
    id: 'p-car-older', name: '2012 compact sedan (used, 98k mi)', category: 'Transportation', price: 890000,
    imageUrl: wm('7/76/2012_Honda_Civic_LX_sedan.jpg'), imageCredit: 'Wikimedia Commons — 2012 Honda Civic LX',
    description: 'Older, higher-mileage sedan with a clean history.', sourceType: 'curated_demo',
  },
  {
    id: 'p-bike', name: 'Commuter bike', category: 'Transportation', price: 110000,
    imageUrl: wm('4/4f/Mal%C3%B3n_Bikes_Hibrida_commuter.jpg'), imageCredit: 'Wikimedia Commons — Malón hybrid commuter',
    description: 'Lightweight hybrid with rack, for a car-free commute.', sourceType: 'curated_demo', alternativeId: 'p-bike-used',
  },
  {
    id: 'p-bike-used', name: 'Used touring bike', category: 'Transportation', price: 38000,
    imageUrl: wm('6/67/Surly_Long_Haul_Trucker.jpg'), imageCredit: 'Wikimedia Commons — Surly Long Haul Trucker',
    description: 'Durable steel bike from a local resale shop.', sourceType: 'curated_demo',
  },
  {
    id: 'p-apt-1br', name: '1-bedroom apartment upgrade', category: 'Housing', price: 35000,
    imageUrl: wm('6/6a/Apartment_Living_Room_1_2018-09-28.jpg'), imageCredit: 'Wikimedia Commons — apartment living room',
    description: 'Extra rent per month versus your current place, on a 12-month lease.', sourceType: 'curated_demo',
    recurring: { interval: 'monthly', occurrences: 12 },
  },
  {
    id: 'p-move-in', name: 'Move-in costs', category: 'Housing', price: 260000,
    imageUrl: wm('0/0e/Melrose_Apartment_Building%2C_Galveston.jpg'), imageCredit: 'Wikimedia Commons — Melrose Apartment Building',
    description: 'Security deposit, movers and first-week setup for a new apartment.', sourceType: 'curated_demo',
  },
  {
    id: 'p-japan', name: 'Ten days in Japan', category: 'Travel', price: 320000,
    imageUrl: wm('e/e6/Golden_Pavilion_Kinkaku-ji_2024.jpg'), imageCredit: 'Wikimedia Commons — Kinkaku-ji, Kyoto',
    description: 'Flights, rail pass, lodging and food for a 10-day trip.', sourceType: 'curated_demo', alternativeId: 'p-weekend',
  },
  {
    id: 'p-weekend', name: 'Weekend in Savannah', category: 'Travel', price: 65000,
    imageUrl: wm('5/56/Forsyth_park_fountain.jpg'), imageCredit: 'Wikimedia Commons — Forsyth Park fountain',
    description: 'Two nights, gas and meals for a nearby getaway.', sourceType: 'curated_demo',
  },
  {
    id: 'p-gym', name: 'Gym membership', category: 'Lifestyle', price: 6500,
    imageUrl: wm('8/84/Health_club_in_Gothenburg_Sweden_in_March_2025.jpg'), imageCredit: 'Wikimedia Commons — health club',
    description: 'Monthly membership with classes. Billed every month.', sourceType: 'curated_demo',
    recurring: { interval: 'monthly', occurrences: null },
  },
];

export const PRODUCT_CATEGORIES = ['Electronics', 'Transportation', 'Furniture', 'Housing', 'Lifestyle', 'Travel', 'Other'] as const;
