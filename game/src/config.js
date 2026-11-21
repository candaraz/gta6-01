// config.js — Solmar Bay v3: world constants, vehicle classes, weapons, ranks.
// One job: every number the rest of the game agrees on lives here.

export const WORLD = {
  half: 320,          // world runs -320..320 on x and z
  grid: 48,           // street pitch: one block + one road
  road: 10,           // road width (asphalt)
  walk: 4,            // sidewalk width each side of a road
  seaX: 300,          // sea starts east of x = 300
  seaZ: 300,          // sea starts south of z = 300
  beach: 288,         // sand strip starts here
};

// Street centre lines (both axes). Roads run the full world length.
export const AVENUES = [-288, -240, -192, -144, -96, -48, 0, 48, 96, 144, 192, 240, 288];

// Districts, by rectangle. A point's district decides building height,
// palette, and what props (cranes, houses, containers) surround it.
export const DISTRICTS = {
  downtown: { x0: -120, x1: 120, z0: -120, z1: 120, hMin: 30, hMax: 72, cls: 'tall' },
  midrise:  { x0: -200, x1: 200, z0: -200, z1: 200, hMin: 12, hMax: 28, cls: 'mid' },
  suburbs:  { x0: -320, x1: -200, z0: -200, z1: 280, hMin: 7, hMax: 11, cls: 'low' },
  yards:    { x0: -200, x1: 200, z0: -320, z1: -200, hMin: 10, hMax: 18, cls: 'yard' },
  marina:   { x0: 200, x1: 300, z0: -120, z1: 120, hMin: 10, hMax: 20, cls: 'dock' },
};

// Facade palettes for the windowed building textures (base colour + window mix).
export const PALETTES = [
  { base: '#8d8578', trim: '#6f675c', name: 'sandstone' },
  { base: '#7a7f88', trim: '#5d6169', name: 'slate' },
  { base: '#a08a6d', trim: '#7d6c53', name: 'adobe' },
  { base: '#6e6a72', trim: '#55515a', name: 'plum' },
];

// Vehicle classes: top speed m/s, acceleration, turn rate, mass.
export const VEHICLES = {
  kestrel:     { name: 'Kestrel',    kind: 'sedan',   top: 34, accel: 16, turn: 1.9, colours: [0x3a6fd8, 0xc0c4c8, 0x8a2f2f] },
  bantam:      { name: 'Bantam',     kind: 'hatch',   top: 30, accel: 18, turn: 2.3, colours: [0xe8b93a, 0x3f9e6b, 0xd8d8d8] },
  longhorn:    { name: 'Longhorn',   kind: 'pickup',  top: 32, accel: 14, turn: 1.7, colours: [0x7a4a2a, 0x4a5a3a, 0x2a2a2e] },
  viceroy:     { name: 'Viceroy',    kind: 'luxury',  top: 38, accel: 17, turn: 2.0, colours: [0x1a1a22, 0xd8c8a0, 0x5a2a4a] },
  tide:        { name: 'Tide Runner',kind: 'van',     top: 28, accel: 12, turn: 1.5, colours: [0xe8e4da, 0x3a6f8a, 0xc86a2a] },
  falcon:      { name: 'Falcon GT',  kind: 'sports',  top: 44, accel: 21, turn: 2.4, colours: [0xd81f2a, 0x1a5ad8, 0xe8e8e8] },
  comet:       { name: 'Comet GT',   kind: 'sports',  top: 48, accel: 24, turn: 2.5, colours: [0xff2a3a, 0xffc21f, 0x1ad8c8] },
  interceptor: { name: 'Interceptor',kind: 'police',  top: 42, accel: 22, turn: 2.3, colours: [0x14161c] },
  marlin:      { name: 'Marlin',     kind: 'boat',    top: 26, accel: 12, turn: 1.6, colours: [0xe8e4da, 0x2a6f8a] },
  bike:        { name: 'Stallion',   kind: 'bike',    top: 40, accel: 23, turn: 2.8, colours: [0xd81f2a, 0x1a1a22] },
};

// Weapons: damage per hit, shots per second, magazine, reload seconds, range.
export const WEAPONS = {
  fists:   { name: 'Fists',    dmg: 12, rate: 2.2, mag: Infinity, reload: 0,   range: 2.6,  auto: false },
  pistol:  { name: 'P9 Pistol',dmg: 26, rate: 4.0, mag: 12,       reload: 1.1, range: 60,   auto: false },
  smg:     { name: 'SMG',      dmg: 16, rate: 9.0, mag: 30,       reload: 1.4, range: 55,   auto: true },
  shotgun: { name: 'Shotgun',  dmg: 14, rate: 1.1, mag: 6,        reload: 2.0, range: 28,   auto: false, pellets: 6 },
  rifle:   { name: 'Rifle',    dmg: 48, rate: 2.0, mag: 20,       reload: 1.6, range: 90,   auto: false },
};

export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];

// Respect ranks: [threshold, title].
export const RANKS = [
  [0, 'Street'], [150, 'Hustler'], [400, 'Runner'],
  [700, 'Enforcer'], [1000, 'Kingpin'], [1320, 'Bay King'],
];

// Mission rewards: [cash, respect] per mission id (m1..m10).
export const MISSION_REWARDS = [
  [800, 100], [1200, 150], [3700, 120], [2000, 200], [3000, 100],
  [4000, 150], [4500, 200], [12000, 100], [9000, 100], [25000, 100],
];

// Radio stations: name, base note (Hz), tempo (bpm), mood.
export const STATIONS = [
  { name: 'SOL FM',   base: 110, bpm: 96,  mood: 'sunset' },
  { name: 'BAY 88',   base: 98,  bpm: 122, mood: 'drive' },
  { name: 'PALM AM',  base: 131, bpm: 76,  mood: 'cruise' },
];

// Golden-hour look.
export const SUN = {
  colour: 0xffd9a8, intensity: 2.1,
  dir: { x: -0.62, y: 0.55, z: 0.34 },   // low in the west, warm rake
  fogColour: 0xe8c9a4, fogNear: 220, fogFar: 720,
  skyTop: '#6f9fd0', skyMid: '#f2b878', skyLow: '#ffd9a0',
};

// Gameplay tuning.
export const TUNE = {
  walkSpeed: 6.5, runSpeed: 10, jumpSpeed: 7,
  playerHealth: 100, enemyHealth: 16, enemyDps: 4.5, // enemyHealth 16 (was 60): one SMG/pistol round kills
  wantedDecayHidden: 9,       // seconds hidden to lose a star
  bustRange: 3.2,             // cop within this + player slow = busted
  coinValue: 100, coinCount: 20,
  raceReward: 1500, raceRespect: 120,
  taxiReward: 434, taxiRespect: 20,
  garageCost: [0, 900, 2200, 4200],   // engine tiers
  gunCost: { pistol: 0, smg: 1200, shotgun: 1800, rifle: 3200 },
};
