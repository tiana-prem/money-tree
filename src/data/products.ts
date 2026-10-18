import type { Product } from '../engine/types';

/**
 * Curated demo catalog. Prices are illustrative estimates, not live quotes.
 * Product cut-outs come from the DummyJSON CDN; trips and housing use Wikimedia Commons photos.
 */
const dj = (path: string) => `https://cdn.dummyjson.com/product-images/${path}/thumbnail.webp`;
const wm = (path: string) => {
  const file = path.split('/').pop()!;
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}/500px-${file}`;
};

export const PRODUCTS: Product[] = [
  {
    id: 'p-phone-pro', name: 'iPhone 13 Pro', category: 'Electronics', price: 119900,
    imageUrl: dj('smartphones/iphone-13-pro'), imageCredit: 'DummyJSON', cutout: true,
    description: 'Flagship phone, 256 GB.', sourceType: 'curated_demo', alternativeId: 'p-phone-mid',
  },
  {
    id: 'p-phone-mid', name: 'Galaxy S10', category: 'Electronics', price: 49900,
    imageUrl: dj('smartphones/samsung-galaxy-s10'), imageCredit: 'DummyJSON', cutout: true,
    description: 'Great camera and battery for less, 128 GB.', sourceType: 'curated_demo',
  },
  {
    id: 'p-laptop', name: 'MacBook Pro 14"', category: 'Electronics', price: 159900,
    imageUrl: dj('laptops/apple-macbook-pro-14-inch-space-grey'), imageCredit: 'DummyJSON', cutout: true,
    description: 'Fast, quiet and built to last. 16 GB / 512 GB.', sourceType: 'curated_demo', alternativeId: 'p-laptop-budget',
  },
  {
    id: 'p-laptop-budget', name: 'Lenovo Yoga', category: 'Electronics', price: 64900,
    imageUrl: dj('laptops/lenovo-yoga-920'), imageCredit: 'DummyJSON', cutout: true,
    description: 'A capable 2-in-1 for work and school.', sourceType: 'curated_demo',
  },
  {
    id: 'p-headphones', name: 'AirPods Max', category: 'Electronics', price: 55000,
    imageUrl: dj('mobile-accessories/apple-airpods-max-silver'), imageCredit: 'DummyJSON', cutout: true,
    description: 'Premium noise-cancelling headphones.', sourceType: 'curated_demo', alternativeId: 'p-earbuds',
  },
  {
    id: 'p-earbuds', name: 'AirPods', category: 'Electronics', price: 12900,
    imageUrl: dj('mobile-accessories/apple-airpods'), imageCredit: 'DummyJSON', cutout: true,
    description: 'Everyday wireless earbuds.', sourceType: 'curated_demo',
  },
  {
    id: 'p-sneakers', name: 'Air Jordan 1', category: 'Lifestyle', price: 15000,
    imageUrl: dj('mens-shoes/nike-air-jordan-1-red-and-black'), imageCredit: 'DummyJSON', cutout: true,
    description: 'The classic high-top.', sourceType: 'curated_demo', alternativeId: 'p-sneakers-budget',
  },
  {
    id: 'p-sneakers-budget', name: 'Puma trainers', category: 'Lifestyle', price: 8000,
    imageUrl: dj('mens-shoes/puma-future-rider-trainers'), imageCredit: 'DummyJSON', cutout: true,
    description: 'Comfortable everyday sneakers.', sourceType: 'curated_demo',
  },
  {
    id: 'p-desk-setup', name: 'Desk chair upgrade', category: 'Furniture', price: 115000,
    imageUrl: dj('furniture/knoll-saarinen-executive-conference-chair'), imageCredit: 'DummyJSON', cutout: true,
    description: 'Designer office chair for the home desk.', sourceType: 'curated_demo', alternativeId: 'p-desk-basic',
  },
  {
    id: 'p-desk-basic', name: 'Compact wood desk', category: 'Furniture', price: 38000,
    imageUrl: dj('furniture/bedside-table-african-cherry'), imageCredit: 'DummyJSON', cutout: true,
    description: 'Small solid-wood desk for a corner workspace.', sourceType: 'curated_demo',
  },
  {
    id: 'p-sofa', name: 'Velvet sofa', category: 'Furniture', price: 140000,
    imageUrl: dj('furniture/annibale-colombo-sofa'), imageCredit: 'DummyJSON', cutout: true,
    description: 'A real couch for your first apartment.', sourceType: 'curated_demo',
  },
  {
    id: 'p-car-newer', name: '2021 compact SUV (used)', category: 'Transportation', price: 1850000,
    imageUrl: dj('vehicle/dodge-hornet-gt-plus'), imageCredit: 'DummyJSON', cutout: true,
    description: 'Low-mileage SUV, one owner.', sourceType: 'curated_demo', alternativeId: 'p-car-older',
  },
  {
    id: 'p-car-older', name: '2014 sedan (used)', category: 'Transportation', price: 890000,
    imageUrl: dj('vehicle/300-touring'), imageCredit: 'DummyJSON', cutout: true,
    description: 'Older, higher-mileage sedan with a clean history.', sourceType: 'curated_demo',
  },
  {
    id: 'p-scooter', name: 'Commuter scooter', category: 'Transportation', price: 180000,
    imageUrl: dj('motorcycle/scooter-motorcycle'), imageCredit: 'DummyJSON', cutout: true,
    description: 'Cheap to run and easy to park.', sourceType: 'curated_demo',
  },
  {
    id: 'p-apt-1br', name: '1-bedroom upgrade', category: 'Housing', price: 35000,
    imageUrl: wm('6/6a/Apartment_Living_Room_1_2018-09-28.jpg'), imageCredit: 'Wikimedia Commons',
    description: 'Extra rent per month versus your current place, 12-month lease.', sourceType: 'curated_demo',
    recurring: { interval: 'monthly', occurrences: 12 },
  },
  {
    id: 'p-move-in', name: 'Move-in costs', category: 'Housing', price: 260000,
    imageUrl: wm('0/0e/Melrose_Apartment_Building%2C_Galveston.jpg'), imageCredit: 'Wikimedia Commons',
    description: 'Security deposit, movers and first-week setup.', sourceType: 'curated_demo',
  },
  {
    id: 'p-japan', name: 'Ten days in Japan', category: 'Travel', price: 320000,
    imageUrl: wm('e/e6/Golden_Pavilion_Kinkaku-ji_2024.jpg'), imageCredit: 'Wikimedia Commons',
    description: 'Flights, rail pass, lodging and food.', sourceType: 'curated_demo', alternativeId: 'p-weekend',
  },
  {
    id: 'p-weekend', name: 'Weekend in Savannah', category: 'Travel', price: 65000,
    imageUrl: wm('5/56/Forsyth_park_fountain.jpg'), imageCredit: 'Wikimedia Commons',
    description: 'Two nights, gas and meals for a nearby getaway.', sourceType: 'curated_demo',
  },
  {
    id: 'p-gym', name: 'Tennis club membership', category: 'Lifestyle', price: 6500,
    imageUrl: dj('sports-accessories/tennis-racket'), imageCredit: 'DummyJSON', cutout: true,
    description: 'Courts and classes. Billed every month.', sourceType: 'curated_demo',
    recurring: { interval: 'monthly', occurrences: null },
  },
];

export const PRODUCT_CATEGORIES = ['Electronics', 'Transportation', 'Furniture', 'Housing', 'Lifestyle', 'Travel', 'Other'] as const;
