[![Competition](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/candaraz/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/candaraz/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# SOLMAR BAY — Sun • Salt • Stolen Cars

An original open-world crime game built for the [make.fun](https://make.fun) **Make GTA 6** bounty. Milo Kade is back in Solmar Bay with an empty wallet and a debt to pay. Pearl Ochoa has the jobs, Tessa Lindqvist has the garage, and Deke Marsh has the whole city scared. Steal cars, run the jobs, shake the heat — and take the Bay back, one sunset at a time.

Everything here is original: the city, the people, the cars, the story, the art and the music were made for this entry. The game runs entirely offline in a desktop browser — no network, no build step.

## Play it

Serve the folder and open it, or just run the included server:

```sh
node serve.ts
# then open http://localhost:8080
```

`?seed=N` fixes the city's random layout. `?shot=<name>&seed=N` stages one of the screenshot scenes (see `shots.json`).

## The city

Solmar Bay is a sun-soaked coastal city on a road grid, built procedurally from a seed: downtown towers, the marina and docks to the east, Palm Court suburbs to the west, the Dockside Yards industrial north, a beach, the sea, and Lighthouse Point. Palm trees, lamps, billboards, cranes, boats, drifting clouds, a day sun with shadows that follow you, and fog over the skyline.

## What you can do

- **Drive and steal.** Seven vehicle classes with distinct handling — the Kestrel sedan, Bantam hatch, Longhorn pickup, Viceroy luxury, Tide Runner van, Falcon GT sports car and the police Interceptor. Take parked cars or pull drivers out of traffic; stealing puts heat on you.
- **Live streets.** Traffic follows the roads, brakes for obstacles and turns at intersections. Pedestrians stroll the sidewalks and run when things get loud.
- **Wanted level.** Five stars of heat. Police cruisers pursue, ram and bust you if you stop; hide in alleys to fade a star at a time, or pay $100 at Tessa's spray shop for fresh paint and a clean slate.
- **Six story missions.** Linked jobs for Pearl with dialogue, waypoints, success and fail states: steal your first car, cover a marina meet, take back the stolen crates, beat the clock in the Payback Lap, swap a Viceroy from the hotel valet, and hold the marina for the sunset getaway. Rewards pay out in cash and unlock the pistol, the SMG and the Falcon GT.
- **Side activities.** Three stunt ramps, twelve hidden sun medallions, and two repeatable time trials with best times.
- **Combat.** Fists, a pistol and an SMG against Deke's crew, who chase, strafe and shoot back. Health, pickups, muzzle flash, dust, smoke and sparks.
- **HUD and maps.** Health, money, wanted stars, objective tracker, speedometer, weapon and ammo, a live canvas minimap (roads, waypoint, police blips, goons, north) and a fullscreen city map on M.
- **Menus and saving.** Title screen, pause menu, busted/wasted flows, and automatic saving to localStorage — position, money, story progress, weapons, owned cars, medallions and best times.
- **Sound.** Every sound is synthesized live with WebAudio: engine, sirens, shots, crashes, pickups, cash, horn, skids, explosions, and a generated music loop. No audio files.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse drag | Look around |
| E | Enter / exit car, talk, start job |
| Click / F | Shoot / punch |
| 1 2 3 | Fists, pistol, SMG |
| Space | Handbrake / jump |
| Shift | Sprint |
| H | Horn |
| M | City map |
| P / Esc | Pause |

## Structure

The game is plain static files under `game/` — `index.html` plus one-job ES modules under `game/src/`, each named for what it does (`city.js`, `traffic.js`, `pedestrians.js`, `police.js`, `missions.js`, `combat.js`, `hud.js`, `minimap.js`, `audio.js`, `save.js`, `player.js`, `vehicles.js`, `input.js`, `camera.js`, `effects.js`, `activities.js`, `config.js`, `random.js`, `shots.js`, `main.js`). three.js is vendored as its minified module build under `game/vendor/`. `main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes the dossier with the vendored make.fun library.
