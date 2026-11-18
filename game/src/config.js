// Solmar Bay: the numbers every other file agrees on. One grid, one set of
// district bounds, one table of vehicle classes and weapons, so the city, the
// traffic, the missions and the minimap all describe the same place.

export const WORLD = {
  // Roads run on this grid; blocks sit between the lines.
  roadLines: [-180, -120, -60, 0, 60, 120, 180],
  roadHalf: 6,
  sidewalk: 4,
  bound: 210,
  beachStart: 210,
  waterStart: 246,
  // The playable sand strip and the water beyond it.
  beachEnd: 246,
};

// Where the story's places are, in world coordinates (x east, z south).
export const PLACES = {
  pearlsOffice: { x: -60, z: -30, name: "Pearl's Office" },
  tessasGarage: { x: 60, z: 120, name: "Tessa's Garage" },
  marinaMeet: { x: 186, z: 120, name: 'Marina Meet' },
  docks: { x: 196, z: 150, name: 'Dockside Yards' },
  hotelValet: { x: 120, z: -60, name: 'Hotel Palmera' },
  lockup: { x: -120, z: -180, name: 'The Lockup' },
  hospital: { x: -120, z: 60, name: 'Solmar General' },
  policeStation: { x: 0, z: -180, name: 'Central Precinct' },
  lighthouse: { x: 226, z: -150, name: 'Lighthouse Point' },
  startSpot: { x: -48, z: -18, name: 'Calle Verde' },
};

export const HIDING_SPOTS = [
  { x: -30, z: 90, radius: 7, name: 'Alley off Calle Verde' },
  { x: 90, z: -30, radius: 7, name: 'Service alley' },
  { x: 150, z: 150, radius: 7, name: 'Marina back alley' },
];

// Ramps the player can launch off; heading is the launch direction in
// radians, aligned with the road the ramp sits on.
export const STUNT_RAMPS = [
  { x: 30, z: 0, heading: Math.PI / 2, name: 'Canal jump' },
  { x: 120, z: 30, heading: 0, name: 'Marina kicker' },
  { x: -60, z: -120, heading: Math.PI, name: 'Yards ramp' },
];

// The twelve sun medallions hidden around the city.
export const MEDALLIONS = [
  { x: -174, z: -174 }, { x: -174, z: 174 }, { x: 174, z: -174 }, { x: 174, z: 60 },
  { x: -30, z: -150 }, { x: 90, z: -150 }, { x: -150, z: 30 }, { x: 30, z: 150 },
  { x: 150, z: -90 }, { x: -90, z: -90 }, { x: 222, z: 30 }, { x: 222, z: -60 },
];

export const VEHICLE_CLASSES = {
  sedan: {
    label: 'Kestrel', topSpeed: 34, accel: 16, brake: 30, steer: 1.9, grip: 6.5,
    length: 4.4, width: 1.9, height: 1.35, mass: 1.0, colors: [0x3d6e9e, 0xb8b0a2, 0x7a4a3a, 0x4a4a52],
  },
  hatch: {
    label: 'Bantam', topSpeed: 29, accel: 14, brake: 28, steer: 2.2, grip: 7.0,
    length: 3.7, width: 1.75, height: 1.45, mass: 0.85, colors: [0xd9a441, 0x5f8f5a, 0xc2c2c2, 0x8a5a9e],
  },
  pickup: {
    label: 'Longhorn', topSpeed: 31, accel: 15, brake: 26, steer: 1.7, grip: 6.0,
    length: 5.0, width: 2.0, height: 1.7, mass: 1.25, colors: [0x8a3b2e, 0x2e4a3a, 0xd8d3c8, 0x3a3a44],
  },
  luxury: {
    label: 'Viceroy', topSpeed: 38, accel: 19, brake: 32, steer: 1.9, grip: 7.2,
    length: 4.9, width: 1.95, height: 1.3, mass: 1.1, colors: [0x1c1c22, 0xe8e4da, 0x5a2e3a, 0x2e4a6e],
  },
  van: {
    label: 'Tide Runner', topSpeed: 26, accel: 11, brake: 24, steer: 1.5, grip: 5.4,
    length: 4.8, width: 2.0, height: 2.1, mass: 1.45, colors: [0xe8e4da, 0x4a6e8a, 0xc25a3a, 0x6e6e6e],
  },
  sports: {
    label: 'Falcon GT', topSpeed: 46, accel: 24, brake: 36, steer: 2.3, grip: 8.0,
    length: 4.2, width: 1.9, height: 1.1, mass: 0.9, colors: [0xc22e2e, 0xe8a81c, 0x2266aa, 0x222226],
  },
  police: {
    label: 'Interceptor', topSpeed: 40, accel: 21, brake: 34, steer: 2.1, grip: 7.6,
    length: 4.6, width: 1.95, height: 1.4, mass: 1.1, colors: [0x14161c],
  },
};

export const WEAPONS = {
  fists: { label: 'Fists', damage: 12, range: 2.4, rate: 0.38, ammo: Infinity, auto: false, melee: true },
  pistol: { label: 'P9 Pistol', damage: 22, range: 55, rate: 0.26, ammo: 48, auto: false, melee: false },
  smg: { label: 'K-9 SMG', damage: 13, range: 45, rate: 0.09, ammo: 120, auto: true, melee: false },
};

export const WANTED = {
  maxStars: 5,
  stealCar: 1,
  hitPedestrian: 1,
  shootLoud: 1,
  hitPolice: 1,
  evadeSecondsPerStar: 14,
  bustDistance: 9,
  bustSeconds: 2.6,
};

export const SAVE_KEY = 'solmar-bay-save-v1';
export const STEP = 1 / 60;
