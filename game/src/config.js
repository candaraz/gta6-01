// Static tuning and data for Solmar Bay. No code runs here; systems read it.
export const CFG = {
  seedDefault: 7,
  // City: a road grid. Roads run along x and z at multiples of BLOCK.
  block: 48,            // metres between road centrelines
  halfBlocks: 6,        // grid spans -6..6 blocks each way (~576 m across)
  roadHalf: 5,          // half width of the road surface
  worldEdge: 290,       // cars / walking clamp
  seaX: 300,            // sea starts east of this x
  beachX: 268,          // sand band before the sea
  // Districts, by block coords (bx,bz).
  downtown: { x0: -2, x1: 2, z0: -2, z1: 2 },   // tall towers
  marina: { x0: 3, x1: 5, z0: -2, z1: 2 },      // docks, cranes, containers, boats
  suburbs: { x0: -6, x1: -3, z0: -2, z1: 3 },   // low houses, yards
  yards: { x0: -2, x1: 2, z0: -5, z1: -3 },     // industrial, warehouses
  // Golden-hour lighting.
  sunDir: { x: -0.55, y: 0.62, z: -0.42 },
  sunColor: 0xffd9a0,
  skyTop: 0x7fb2e0,
  skyHorizon: 0xffd9a8,
  fogColor: 0xf2c9a0,
  fogNear: 260,
  fogFar: 720,
};

export const VEHICLES = {
  kestrel:   { name: 'Kestrel',    cls: 'sedan',   color: 0xf2b705, top: 34, accel: 16, turn: 2.1, seats: 1 },
  bantam:    { name: 'Bantam',     cls: 'hatch',   color: 0x4fc3f7, top: 30, accel: 15, turn: 2.4, seats: 1 },
  longhorn:  { name: 'Longhorn',   cls: 'pickup',  color: 0x8d6e63, top: 32, accel: 14, turn: 1.9, seats: 1 },
  viceroy:   { name: 'Viceroy',    cls: 'luxury',  color: 0x2e2e38, top: 36, accel: 18, turn: 2.2, seats: 1 },
  tide:      { name: 'Tide Runner',cls: 'van',     color: 0xe8e8e8, top: 28, accel: 12, turn: 1.7, seats: 1 },
  falcon:    { name: 'Falcon GT',  cls: 'sport',   color: 0xd32f2f, top: 42, accel: 22, turn: 2.5, seats: 1 },
  comet:     { name: 'Comet GT',   cls: 'sport',   color: 0x00b8a9, top: 46, accel: 25, turn: 2.6, seats: 1 },
  stallion:  { name: 'Stallion',   cls: 'bike',    color: 0x7b1fa2, top: 40, accel: 24, turn: 3.2, seats: 1 },
  marlin:    { name: 'Marlin',     cls: 'boat',    color: 0x1565c0, top: 30, accel: 14, turn: 1.6, seats: 1 },
  interceptor:{ name: 'Interceptor', cls: 'police', color: 0x111111, top: 40, accel: 22, turn: 2.5, seats: 1 },
};

export const WEAPONS = {
  fists:  { name: 'Fists',      slot: 1, auto: false, dmg: 8,  range: 2.2,  rate: 0.45, mag: Infinity, ammo: Infinity },
  pistol: { name: 'P9 Pistol',  slot: 2, auto: false, dmg: 12, range: 60,   rate: 0.28, mag: 12, ammo: 120 },
  smg:    { name: 'K9 SMG',     slot: 3, auto: true,  dmg: 8,  range: 55,   rate: 0.09, mag: 30, ammo: 240 },
  shotgun:{ name: 'Riot 12',    slot: 4, auto: false, dmg: 9,  range: 28,   rate: 0.7,  mag: 6,  ammo: 48, pellets: 6 },
  rifle:  { name: 'Longshot',   slot: 5, auto: false, dmg: 34, range: 110,  rate: 0.9,  mag: 10, ammo: 60 },
};

export const RANKS = [
  { at: 0, name: 'Nobody' },
  { at: 150, name: 'Runner' },
  { at: 400, name: 'Hustler' },
  { at: 700, name: 'Made Man' },
  { at: 1000, name: 'Bay Boss' },
  { at: 1300, name: 'Bay King' },
];

// Mission table. Each mission: id, title, giver, brief, reward {cash, respect},
// stages: [{kind, ...}]. Stage kinds:
//   go {x,z,r} — reach a point (r = radius)
//   drive {x,z,r} — reach a point while driving
//   enter {vehicle} — get into the named vehicle class
//   race {points:[{x,z}], limit} — pass checkpoints in order before the clock
//   kill {count, cx, cz} — clear the crew spawned near (cx,cz)
//   hold {x,z,r,secs} — stay inside the circle for secs
//   escape {x,z,r} — reach a point while wanted >= 3
//   boat {points:[{x,z}], limit} — buoy race in the Marlin
export const MISSIONS = [
  { id: 1, title: 'FIRST WHEELS', giver: 'Mara', brief: 'Go to the parked Kestrel',
    reward: { cash: 500, respect: 60 },
    stages: [
      { kind: 'go', x: -96, z: 96, r: 4, text: 'Go to the parked Kestrel' },
      { kind: 'enter', vehicle: 'kestrel', text: 'Get in the Kestrel' },
      { kind: 'drive', x: 24, z: 0, r: 6, text: "Drive to Mara's Place" },
    ] },
  { id: 2, title: 'THE PACKAGE', giver: 'Mara', brief: 'Pick up the package at the dock office',
    reward: { cash: 800, respect: 80 },
    stages: [
      { kind: 'go', x: 168, z: -48, r: 5, text: 'Pick up the package at the dock office' },
      { kind: 'drive', x: -144, z: 96, r: 6, text: 'Deliver the package to Palm Court' },
    ] },
  { id: 3, title: 'BAY RUN', giver: 'Dario', brief: 'Race the Bay Run circuit',
    reward: { cash: 1500, respect: 120 },
    stages: [
      { kind: 'race', limit: 150, text: 'Race the Bay Run — hit every checkpoint',
        points: [ { x: 96, z: 96 }, { x: 96, z: -96 }, { x: -96, z: -96 }, { x: -96, z: 96 }, { x: 0, z: 0 } ] },
    ] },
  { id: 4, title: 'DOCKSIDE', giver: 'Mara', brief: "Clear the yard of Deke's crew (3 left)",
    reward: { cash: 1200, respect: 110, unlock: 'smg' },
    stages: [
      { kind: 'go', x: 192, z: 48, r: 8, text: 'Get to the container yard' },
      { kind: 'kill', count: 3, cx: 192, cz: 48, text: "Clear the yard of Deke's crew (3 left)" },
    ] },
  { id: 5, title: 'THE GETAWAY', giver: 'Sol', brief: 'Escape to the Pier House',
    reward: { cash: 1800, respect: 130 },
    stages: [
      { kind: 'escape', x: 240, z: 144, r: 8, text: 'Escape to the Pier House', wanted: 3 },
    ] },
  { id: 6, title: 'GRAND THEFT BAY', giver: 'Ivy', brief: 'Steal the Comet GT',
    reward: { cash: 2200, respect: 140 },
    stages: [
      { kind: 'go', x: -48, z: -144, r: 6, text: 'Find the Comet GT in the yards' },
      { kind: 'enter', vehicle: 'comet', text: 'Steal the Comet GT' },
      { kind: 'drive', x: 24, z: 0, r: 6, text: "Bring the Comet to Mara's Place" },
    ] },
  { id: 7, title: 'PAYBACK', giver: 'Dario', brief: "Settle it with Deke's crew (4 left)",
    reward: { cash: 2500, respect: 150, unlock: 'shotgun' },
    stages: [
      { kind: 'go', x: -144, z: -48, r: 8, text: 'Find Deke’s crew in the yards' },
      { kind: 'kill', count: 4, cx: -144, cz: -48, text: "Settle it with Deke's crew (4 left)" },
    ] },
  { id: 8, title: 'THE HEIST', giver: 'Sol', brief: 'Crack the vault, then run',
    reward: { cash: 5000, respect: 200, unlock: 'rifle' },
    stages: [
      { kind: 'go', x: 48, z: 48, r: 8, text: 'Get to the Bay Bank' },
      { kind: 'hold', x: 48, z: 48, r: 30, secs: 12, text: 'Hold F to crack the vault' },
      { kind: 'escape', x: -192, z: 144, r: 8, text: 'Escape to the safehouse', wanted: 3 },
    ] },
  { id: 9, title: 'HIGH TIDE', giver: 'Ivy', brief: 'Race the Marlin through the buoys',
    reward: { cash: 3000, respect: 160 },
    stages: [
      { kind: 'go', x: 288, z: 96, r: 6, text: 'Board the Marlin at the marina' },
      { kind: 'enter', vehicle: 'marlin', text: 'Board the Marlin' },
      { kind: 'boat', limit: 150, text: 'Race the buoys — hit every one',
        points: [ { x: 340, z: 160 }, { x: 380, z: 40 }, { x: 340, z: -80 }, { x: 320, z: 160 } ] },
    ] },
  { id: 10, title: 'KING OF THE BAY', giver: 'Mara', brief: "Finish Deke's crew and take the crown",
    reward: { cash: 8000, respect: 220 },
    stages: [
      { kind: 'go', x: 0, z: -144, r: 8, text: 'Meet Deke’s crew at the north yards' },
      { kind: 'kill', count: 3, cx: 0, cz: -144, text: "Finish Deke's crew (3 left)" },
      { kind: 'go', x: 24, z: 0, r: 6, text: 'Take the crown at Mara’s Place' },
    ] },
];

// Street-race circuits (T while driving) and taxi stands.
export const RACES = [
  { name: 'Bay Run', points: [ { x: 96, z: 96 }, { x: 96, z: -96 }, { x: -96, z: -96 }, { x: -96, z: 96 } ], limit: 150, prize: 1500 },
  { name: 'Downtown Dash', points: [ { x: 48, z: 48 }, { x: -48, z: 48 }, { x: -48, z: -48 }, { x: 48, z: -48 } ], limit: 160, prize: 1200 },
  { name: 'Coast Loop', points: [ { x: 192, z: 144 }, { x: 240, z: 0 }, { x: 192, z: -144 }, { x: 96, z: 0 } ], limit: 150, prize: 1800 },
];
export const TAXI_SPOTS = [
  { x: -96, z: 48 }, { x: 96, z: -48 }, { x: 0, z: 144 }, { x: 192, z: 0 }, { x: -192, z: -96 },
];
export const COIN_SPOTS = [
  [-120, 96], [120, -96], [-48, 192], [192, 192], [48, -192], [-192, -48], [240, 96], [96, 240],
  [-240, 48], [0, 240], [144, -192], [-144, 240], [240, -144], [-96, -240], [48, 144], [144, 48],
  [-240, 192], [192, -240], [-48, -96], [96, 96],
];
export const GARAGE = { x: 48, z: -120, name: "Tessa's Garage" };
export const GUNSHOP = { x: -48, z: 120, name: 'Ammo & Iron' };
export const SAFEHOUSES = [
  { x: 24, z: 0, name: "Mara's Place" },
  { x: -192, z: 144, name: 'Palm Court Flat' },
  { x: 240, z: 144, name: 'Pier House' },
];
