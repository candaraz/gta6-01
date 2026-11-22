[![Competition](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/candaraz/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/candaraz/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# MIRADOR KEYS — Sun, Chrome & Sirens

An original 3D sun-soaked coastal open-world crime game built for the [make.fun](https://make.fun) **Make GTA 6** bounty ([bounty page](https://make.fun/bounty/gta6-01)). Mateo Vega and Elena Cruz are taking the Mirador Keys back — one sunset at a time. Steal cars, run the jobs, shake the MKPD — and wear the Crown of Mirador.

Everything here is original: the city, the people, the cars, the story, the art and the music were made for this entry. The game runs entirely offline in a desktop browser — no network, no build step.

## Play it

Serve the folder and open it, or just run the included server:

```sh
node serve.ts
# then open http://localhost:8080
```

`?seed=N` fixes the city's random layout. `?shot=<name>&seed=N` stages one of the screenshot scenes (see `shots.json`).

## The city

The Mirador Keys are a Caribbean-inspired coastal peninsula and causeway archipelago with five distinct districts: the **Mirador Strip** (beachfront boardwalk, art-deco hotels, turquoise animated ocean), **Centro Financiero** (glass skyscrapers, Solaris Bank plaza, traffic lights and crosswalks), **Puerto Viejo** (marina piers, yachts, shipping containers, gantry cranes, stunt ramps), **Barrio Neon** (cyan/magenta/amber neon storefronts, billboards, the chop shop), and **Mirador Heights** (hillside villas and the causeway bridge to the keys). Golden-hour light, a gradient sunset sky dome, real-time shadows, and palm-lined streets throughout.

## What you can do

- **Drive and steal.** Seven vehicle classes with distinct handling — the Veloz GT sports coupe, Bruja 440 muscle car, Coastal X SUV, armored van, MKPD patrol cruiser, MKPD interceptor, and the OSPREY-1 police helicopter overhead. Take parked cars or carjack traffic; stealing puts heat on you.
- **Live streets.** 20+ traffic vehicles follow road lanes, stop at red lights and panic when shots are fired. 30+ pedestrians stroll the sidewalks and flee gunfire and sirens.
- **Wanted level.** Five stars of MKPD heat: patrol cruisers pursue, interceptors PIT and RAM, roadblocks go up at three stars, tactical vans arrive at four, and OSPREY-1 circles overhead at five with its searchlight tracking you. Break line of sight to cool down, or hit a Pay-n-Spray / chop shop.
- **Eight story missions.** Sunset Boost, Pier 4 Smugglers, Solaris Vault Heist, Causeway Intercept, Neon Syndicate Ambush, Osprey Down, Harbor Extraction, and Crown of Mirador — with mission markers, dialogue, GPS route, cash and District Respect rewards.
- **Side activities.** Stunt jumps with slow-mo air-time popups, street races, chop shop upgrades (armor, turbo, respray), and crew abilities — press G to call Elena for a getaway distraction.
- **Combat.** Five weapons on a radial wheel (1–5 or Tab): 9mm pistol, Micro SMG, tactical shotgun, carbine rifle, frag grenade — against rival crew and armed MKPD officers, with muzzle flash, bullet tracers, explosions and drifting tire smoke.
- **HUD and maps.** Wanted stars, cash, respect rank, mission banner, dispatch radio ticker, health/armor, weapon and ammo, speedometer, radio station, and a live circular minimap (roads, water, GPS route, police blips, enemies, north).
- **Menus and saving.** Glassmorphic title screen with three save slots (mission progress, cash, respect rank), Continue / New Game, controls guide, pause menu, City District Atlas (M), and busted/wasted flows. Saves persist in localStorage.
- **Sound.** Every sound is synthesized live with WebAudio: engine RPM hum, tire screech, police sirens, gunshots, explosions, UI clicks — and three switchable synth radio stations (R): Mirador Synthwave FM, Tropico Bass, MKPD Scanner. No audio files.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse drag / click | Look around / aim (pointer lock) |
| Shift | Sprint / handbrake drift (in a car) |
| Space | Jump |
| F | Enter / exit / carjack |
| Left click | Shoot / horn (in a car) |
| Right click | Aim |
| 1–5 / Tab | Weapon wheel |
| R | Switch radio station |
| G | Call Elena (getaway distraction) |
| C | Switch character (Mateo / Elena) |
| M | City District Atlas |
| Esc / P | Pause |

## Structure

The game is plain static files under `game/` — `index.html` plus one-job ES modules under `game/src/`, each named for what it does (`world/textures.js`, `world/cityBuilder.js`, `world/environment.js`, `entities/player.js`, `entities/vehicles.js`, `entities/traffic.js`, `entities/pedestrians.js`, `systems/policeDispatch.js`, `systems/combat.js`, `systems/missions.js`, `systems/audioRadio.js`, `systems/saveSystem.js`, `ui/hudMinimap.js`, `main.js`). three.js is vendored as its minified module build under `game/vendor/`. `main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes the dossier with the vendored make.fun library.
