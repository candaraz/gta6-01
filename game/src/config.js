// Solmar Bay — configuration and data.
// One job: every number, name and table the game reads. No logic, no rendering.
// The city is an invented sun-soaked coastal town. Every name, character, vehicle,
// weapon, station and story beat is original — nothing from any commercial game.

export const WORLD = {
  blockSize: 52, // metres per city block (road + buildings)
  roadWidth: 14,
  grid: 9, // 9 x 9 blocks, city spans about 470 m
  groundY: 0,
  // Districts by block coordinate (bx, bz in -4..4). The bay is south (z > 0) and east (x > 0).
  downtown: { x0: -1, x1: 1, z0: -2, z1: 1 },
  marina: { x0: 2, x1: 4, z0: 0, z1: 4 },
  beachZ: 3, // blocks with z >= 3 on the south edge are sand
  industrial: { x0: -4, x1: -3, z0: 0, z1: 3 },
  suburb: { x0: -4, x1: 4, z0: -4, z1: -3 },
};

export const SEED = 20261121; // fixed seed: the same city every run, screenshots reproducible

export const PLAYER = {
  walkSpeed: 6,
  sprintSpeed: 10,
  jumpSpeed: 8,
  gravity: 22,
  radius: 0.55,
  height: 1.8,
  maxHealth: 100,
  maxArmour: 100,
  startCash: 500,
};

// Vehicle classes. Each has its own handling so stealing a sports car feels different
// from a truck. topSpeed in m/s, accel in m/s^2, grip 0..1 (higher = less slide).
export const VEHICLES = {
  compact: { label: 'Pipit', topSpeed: 26, accel: 14, grip: 0.9, turn: 2.4, hp: 60, colour: 0xd94f30, price: 1200 },
  sedan: { label: 'Meridian', topSpeed: 32, accel: 16, grip: 0.85, turn: 2.2, hp: 80, colour: 0x3a6fd8, price: 3500 },
  sports: { label: 'Comet GT', topSpeed: 48, accel: 26, grip: 0.8, turn: 2.6, hp: 70, colour: 0xf2c200, price: 18000 },
  muscle: { label: 'Banteng', topSpeed: 42, accel: 24, grip: 0.62, turn: 2.0, hp: 90, colour: 0x7a1f2b, price: 9000 },
  suv: { label: 'Terra', topSpeed: 34, accel: 15, grip: 0.8, turn: 1.9, hp: 120, colour: 0x2f6b4f, price: 8000 },
  truck: { label: 'Hauler', topSpeed: 28, accel: 11, grip: 0.75, turn: 1.6, hp: 160, colour: 0x8a8f96, price: 6000 },
  van: { label: 'Kargo', topSpeed: 30, accel: 12, grip: 0.78, turn: 1.8, hp: 110, colour: 0xe8e2d0, price: 4500 },
  moto: { label: 'Kilat', topSpeed: 52, accel: 30, grip: 0.7, turn: 3.0, hp: 40, colour: 0x1b1b22, price: 7000 },
  boat: { label: 'Marlin', topSpeed: 38, accel: 18, grip: 0.9, turn: 2.0, hp: 90, colour: 0xffffff, price: 15000 },
};
export const VEHICLE_CLASSES = Object.keys(VEHICLES);

// Weapons. damage per hit, rate in shots/sec, spread in radians, range in metres.
export const WEAPONS = {
  pistol: { label: 'P9 Sidearm', damage: 25, rate: 4, spread: 0.02, range: 60, mag: 12, price: 400, ammoPrice: 20 },
  smg: { label: 'Vespa SMG', damage: 14, rate: 11, spread: 0.05, range: 45, mag: 32, price: 1500, ammoPrice: 40 },
  shotgun: { label: 'Boomstick', damage: 16, pellets: 7, rate: 1.2, spread: 0.12, range: 25, mag: 6, price: 2200, ammoPrice: 60 },
  rifle: { label: 'Longshot', damage: 55, rate: 2.2, spread: 0.008, range: 120, mag: 20, price: 4200, ammoPrice: 80 },
};
export const WEAPON_ORDER = ['pistol', 'smg', 'shotgun', 'rifle'];

export const RESPECT_RANKS = [
  { at: 0, name: 'Street' },
  { at: 200, name: 'Hustler' },
  { at: 600, name: 'Player' },
  { at: 1500, name: 'Shot Caller' },
  { at: 3000, name: 'Bay King' },
];

// Garage upgrades. Each level multiplies the stat on the player's current car.
export const UPGRADES = {
  engine: { label: 'Engine', levels: 3, cost: [1500, 3500, 8000], topMul: 1.18, accelMul: 1.2 },
  armour: { label: 'Armour Plating', levels: 3, cost: [1200, 2800, 6000], hpMul: 1.5 },
  nitro: { label: 'Nitro', levels: 2, cost: [2000, 5000], boost: 12 },
  paint: { label: 'Paint Job', levels: 1, cost: [800], colours: [0xf2c200, 0xd94f30, 0x3a6fd8, 0x2f6b4f, 0x7a1f2b, 0x1b1b22, 0xe8e2d0, 0xff7ad9] },
};

// Radio stations. All music is synthesised live (Web Audio) — no audio files.
export const RADIO = [
  { id: 'solfm', name: 'SOL FM', desc: 'Synthwave', bpm: 100, root: 45, mode: 'minor', bass: 'sawtooth' },
  { id: 'baybass', name: 'Bay Bass', desc: 'Funk', bpm: 112, root: 41, mode: 'dorian', bass: 'square' },
  { id: 'golden', name: 'Golden Hour', desc: 'Chill', bpm: 78, root: 48, mode: 'major', bass: 'sine' },
];

// The crew. Original characters, original story.
export const CREW = {
  rook: { name: 'Rook', role: 'You — new in Solmar Bay' },
  mara: { name: 'Mara Voss', role: 'Driver & garage owner' },
  dario: { name: 'Dario Kline', role: 'Muscle' },
  ivy: { name: 'Ivy Chen', role: 'Planner & hacker' },
  sol: { name: 'Sol', role: 'Fixer — knows everyone' },
};

export const RIVALS = {
  vultures: { name: 'The Vultures', desc: 'Rival gang holding the docks' },
  baypd: { name: 'Bay PD', desc: 'Captain Rourke runs the harbour precinct' },
};

// Safehouses. Saving the game happens here (and in the pause menu).
export const SAFEHOUSES = [
  { id: 'garage', name: "Mara's Garage", x: -26, z: -78, price: 0 },
  { id: 'beach', name: 'Beach House', x: 104, z: 182, price: 8000 },
  { id: 'marina', name: 'Marina Loft', x: 156, z: 52, price: 15000 },
];

// Weapon shop.
export const GUN_SHOP = { name: 'Bay Arms', x: 26, z: -26 };

// Street-race circuits (each is a loop of waypoints).
export const RACES = [
  { id: 'harbour', name: 'Harbour Loop', fee: 200, prize: 1200, laps: 2 },
  { id: 'coast', name: 'Coast Run', fee: 500, prize: 3000, laps: 2 },
  { id: 'downtown', name: 'Downtown Dash', fee: 1000, prize: 6000, laps: 3 },
];

export const SAVE_KEY = 'solmarbay.save.v2';
export const SETTINGS_KEY = 'solmarbay.settings.v2';

export const WANTED = {
  // stars: how many police cars chase, whether a helicopter flies, roadblock chance
  0: { cars: 0, heli: false, roadblock: 0 },
  1: { cars: 2, heli: false, roadblock: 0 },
  2: { cars: 3, heli: false, roadblock: 0.25 },
  3: { cars: 4, heli: true, roadblock: 0.4 },
  4: { cars: 5, heli: true, roadblock: 0.55 },
  5: { cars: 6, heli: true, roadblock: 0.7 },
};

// Story missions. Each is a list of stages; a stage completes when its goal is met.
// Stage types: goto (reach a marker), talk (reach + press F), race (checkpoints in
// order against AI racers), kill (defeat N enemies), collect (grab an item, carry it
// to a marker), survive (reach a marker while wanted), deliver (drive a named car
// to a marker). Coordinates are world x,z in metres.
export const MISSIONS = [
  {
    id: 'm1', name: 'First Wheels', giver: 'Mara Voss',
    brief: 'New in town, no wheels. Steal any car and bring it to my garage.',
    reward: { cash: 800, respect: 100 },
    stages: [
      { type: 'steal', text: 'Steal a car (walk up to one and press E)' },
      { type: 'goto', x: -26, z: -78, text: "Drive to Mara's Garage", radius: 8 },
    ],
  },
  {
    id: 'm2', name: 'The Pickup', giver: 'Sol',
    brief: 'Dario is stuck at the docks with Bay PD sniffing around. Pick him up, then lose the heat.',
    reward: { cash: 1200, respect: 150 },
    stages: [
      { type: 'goto', x: 130, z: 130, text: 'Drive to the docks', radius: 8 },
      { type: 'talk', x: 130, z: 130, text: 'Pick up Dario (press F)', radius: 6 },
      { type: 'survive', x: -26, z: -78, text: 'Lose the cops and reach the garage', radius: 8, wanted: 1 },
    ],
  },
  {
    id: 'm3', name: 'Bay Run', giver: 'Mara Voss',
    brief: 'The harbour crew races every night. Beat them and the Bay learns your name.',
    reward: { cash: 2500, respect: 250 },
    grant: 'smg', // Mara hands you a Vespa SMG for the dock job ahead
    stages: [
      { type: 'race', race: 'harbour', text: 'Win the Harbour Loop (2 laps)', laps: 2 },
    ],
  },
  {
    id: 'm4', name: 'Dockside', giver: 'Ivy Chen',
    brief: 'The Vultures took our shipment. Clear the dock, grab the package, bring it back.',
    reward: { cash: 2000, respect: 200 },
    stages: [
      { type: 'goto', x: 130, z: 130, text: 'Go to the docks', radius: 10 },
      { type: 'kill', count: 6, x: 130, z: 130, text: 'Clear the Vultures (0/6)', radius: 30 },
      { type: 'collect', x: 130, z: 130, text: 'Grab the package (press F)', radius: 5 },
      { type: 'deliver', x: -26, z: -78, text: 'Deliver the package to the garage', radius: 8 },
    ],
  },
  {
    id: 'm5', name: 'The Getaway', giver: 'Sol',
    brief: 'The job went loud. Three stars and a chopper. Get to the beach house — do not get caught.',
    reward: { cash: 3000, respect: 300 },
    stages: [
      { type: 'survive', x: 104, z: 182, text: 'Escape to the Beach House (3 stars)', radius: 10, wanted: 3 },
    ],
  },
  {
    id: 'm6', name: 'Grand Theft Bay', giver: 'Mara Voss',
    brief: 'A Comet GT sits in the marina lot, guarded. Take it. Quietly or loudly — your call.',
    reward: { cash: 4000, respect: 350 },
    stages: [
      { type: 'goto', x: 156, z: 52, text: 'Go to the marina lot', radius: 10 },
      { type: 'stealNamed', vehicle: 'sports', x: 156, z: 52, text: 'Steal the Comet GT (press E)', radius: 12 },
      { type: 'deliver', x: -26, z: -78, text: 'Deliver the Comet GT to the garage', radius: 8 },
    ],
  },
  {
    id: 'm7', name: 'Payback', giver: 'Dario Kline',
    brief: 'The Vultures hit our garage. Hit their hideout twice as hard.',
    reward: { cash: 4500, respect: 400 },
    stages: [
      { type: 'goto', x: -156, z: 104, text: 'Go to the Vulture hideout', radius: 10 },
      { type: 'kill', count: 10, x: -156, z: 104, text: 'Clear the hideout (0/10)', radius: 35 },
      { type: 'collect', x: -156, z: 104, text: 'Plant the charge (press F)', radius: 5 },
      { type: 'goto', x: -104, z: 52, text: 'Get clear of the blast', radius: 12 },
    ],
  },
  {
    id: 'm8', name: 'The Heist', giver: 'Ivy Chen',
    brief: 'Bay Trust, downtown. Grab the vault cash, then run — the whole precinct will come.',
    reward: { cash: 12000, respect: 600 },
    stages: [
      { type: 'goto', x: 0, z: -26, text: 'Go to Bay Trust', radius: 8 },
      { type: 'collect', x: 0, z: -26, text: 'Grab the vault cash (hold F)', radius: 5, hold: 3 },
      { type: 'survive', x: 156, z: 130, text: 'Escape to the marina boat (4 stars)', radius: 10, wanted: 4 },
    ],
  },
  {
    id: 'm9', name: 'High Tide', giver: 'Sol',
    brief: 'The cash goes out by water. Take the Marlin, run the buoys, lose the harbour patrol.',
    reward: { cash: 6000, respect: 500 },
    stages: [
      { type: 'boat', x: 156, z: 130, text: 'Board the Marlin (press E)', radius: 8 },
      { type: 'race', race: 'coast', boat: true, text: 'Run the buoys (2 laps)', laps: 2 },
    ],
  },
  {
    id: 'm10', name: 'King of the Bay', giver: 'Mara Voss',
    brief: 'Rourke and the Vultures, one night, the tower. Win the race, take the roof, own the Bay.',
    reward: { cash: 25000, respect: 1200 },
    stages: [
      { type: 'race', race: 'downtown', text: 'Win the Downtown Dash (3 laps)', laps: 3 },
      { type: 'goto', x: 0, z: -78, text: 'Go to the Solmar Tower', radius: 16 }, // radius clears the tower's own collider (push-out is ~14 m)
      { type: 'kill', count: 12, x: 0, z: -78, text: 'Take the roof (0/12)', radius: 35 },
      { type: 'goto', x: -26, z: -78, text: 'Return to the garage — Bay King', radius: 8 },
    ],
  },
];

