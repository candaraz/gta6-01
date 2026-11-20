// config.js — every tuneable number and name for Solmar Bay lives here.
// One place to balance the game: world size, vehicle classes, weapons,
// police escalation, mission rewards, ranks, radio stations, coins.
export const WORLD = {
  half: 320,          // city spans -320..320 on x, -320..320 on z
  bayZ: 235,          // water starts at z = bayZ
  beachZ: 205,        // sand strip starts at z = beachZ
  roadGap: 70,        // grid spacing
  roadWidth: 12,
};

export const COLOURS = {
  sky: 0x8ec9ee,
  fog: 0xa8d0e8,
  grass: 0x7fae5a,
  sand: 0xe8d49a,
  water: 0x2e7fb8,
  asphalt: 0x33363c,
  curb: 0xd8d8d0,
  buildingPalette: [0xe8b48c, 0xd9a0a0, 0xa8c4d4, 0xc9b8e0, 0xf0d9a0, 0x9fc4a8, 0xe0e0e0],
  towerGlass: 0x7fb8d8,
  downtown: 0x5a6a7a,
};

// 9 vehicle classes. speed = top m/s, accel = m/s^2, turn = rad/s at speed.
export const VEHICLES = {
  compact:   { name: 'Pinto',    label: 'Compact',    speed: 26, accel: 9,  brake: 18, turn: 1.9, hp: 60,  price: 0,    colour: 0xc9a227 },
  sedan:     { name: 'Marlow',   label: 'Sedan',      speed: 30, accel: 10, brake: 20, turn: 1.8, hp: 80,  price: 0,    colour: 0x4a7fb5 },
  suv:       { name: 'Ridge',    label: 'SUV',        speed: 31, accel: 10, brake: 20, turn: 1.6, hp: 120, price: 0,    colour: 0x7a4a3a },
  van:       { name: 'Hauler',   label: 'Van',        speed: 25, accel: 8,  brake: 16, turn: 1.4, hp: 130, price: 0,    colour: 0xd8d8d8 },
  sports:    { name: 'Comet GT', label: 'Sports',     speed: 46, accel: 16, brake: 26, turn: 2.2, hp: 90,  price: 0,    colour: 0xd42a2a },
  muscle:    { name: 'Brawler',  label: 'Muscle',     speed: 38, accel: 14, brake: 22, turn: 1.7, hp: 110, price: 0,    colour: 0x2a6e4a },
  truck:     { name: 'Mule',     label: 'Truck',      speed: 24, accel: 7,  brake: 15, turn: 1.2, hp: 180, price: 0,    colour: 0x8a7a3a },
  motorcycle:{ name: 'Wasp',     label: 'Motorcycle', speed: 42, accel: 15, brake: 24, turn: 2.6, hp: 40,  price: 0,    colour: 0x222222 },
  boat:      { name: 'Marlin',   label: 'Boat',       speed: 34, accel: 11, brake: 14, turn: 1.5, hp: 100, price: 0,    colour: 0xe8e8e8 },
  police:    { name: 'Interceptor', label: 'Police',  speed: 40, accel: 15, brake: 26, turn: 2.0, hp: 150, price: 0,    colour: 0x1a2a4a },
  taxi:      { name: 'Cab',      label: 'Taxi',       speed: 30, accel: 10, brake: 20, turn: 1.8, hp: 80,  price: 0,    colour: 0xf2c200 },
};

export const WEAPONS = {
  pistol:  { name: 'Pistol',  damage: 34, rate: 0.28, range: 55,  spread: 0.012, mag: 12,  price: 0,    ammoPrice: 0   },
  smg:     { name: 'SMG',     damage: 16, rate: 0.09, range: 45,  spread: 0.030, mag: 32,  price: 800,  ammoPrice: 100 },
  shotgun: { name: 'Shotgun', damage: 14, rate: 0.85, range: 28,  spread: 0.090, mag: 6,   price: 1200, ammoPrice: 120, pellets: 7 },
  rifle:   { name: 'Rifle',   damage: 55, rate: 0.14, range: 110, spread: 0.004, mag: 20,  price: 2000, ammoPrice: 160 },
};

// Police escalation by wanted star.
export const WANTED = {
  maxStars: 5,
  decayQuietSeconds: 12,   // no crime + no cop nearby this long -> stars fall
  decayInterval: 8,        // one star per this many quiet seconds
  copsPerStar: [0, 1, 2, 3, 4, 5],
  roadblockFrom: 3,
  heliFrom: 4,
  bustDistance: 2.2,       // cop this close to on-foot player starts a bust
  bustSeconds: 1.5,
};

export const RANKS = [
  { at: 0,    name: 'Street' },
  { at: 300,  name: 'Hustler' },
  { at: 600,  name: 'Runner' },
  { at: 1000, name: 'Boss' },
  { at: 1320, name: 'Bay King' },
];

export const STATIONS = [
  { name: 'SOL FM',      bpm: 96,  root: 55,   mood: 'chill' },
  { name: 'BASSLINE',    bpm: 124, root: 49,   mood: 'drive' },
  { name: 'NEON NIGHTS', bpm: 112, root: 62,   mood: 'night' },
];

export const COIN_VALUE = 100;
export const COIN_COUNT = 20;
export const SAVE_KEY = 'solmar-bay-save-v2';
// Mission rewards: cash + respect per story mission (m1..m10).
// Respect sums to 1320, the Bay King threshold.
export const MISSION_REWARDS = [
  { cash: 800,   respect: 100 },
  { cash: 1200,  respect: 150 },
  { cash: 3700,  respect: 120 }, // m3: $1200 race prize + $2500 mission
  { cash: 2000,  respect: 200 },
  { cash: 3000,  respect: 100 },
  { cash: 4000,  respect: 150 },
  { cash: 4500,  respect: 200 },
  { cash: 12000, respect: 100 },
  { cash: 9000,  respect: 100 },
  { cash: 25000, respect: 100 },
];

// Garage upgrades: 3 levels each, applied to the player's owned vehicles.
export const UPGRADES = {
  engine: { name: 'Engine', levels: [0, 1200, 2500], speedBonus: [0, 0.12, 0.25] },
  armour: { name: 'Armour', levels: [0, 900, 2000], hpBonus: [0, 60, 140] },
  brakes: { name: 'Brakes', levels: [0, 600, 1400], brakeBonus: [0, 0.2, 0.45] },
};

// The three street-race circuits, as waypoint loops.
export const CIRCUITS = {
  harbour:  { name: 'Harbour Loop',  laps: 2 },
  downtown: { name: 'Downtown Dash', laps: 3 },
  coast:    { name: 'Coast Run',     laps: 2 },
};
export const PRACTICE_FLOOR = 1154; // not used in-game; recorded for the log
