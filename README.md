[![Competition](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/candaraz/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/candaraz/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# SOLMAR BAY — Sun • Salt • Stolen Cars

An original open-world crime game built for the [make.fun](https://make.fun) **Make GTA 6** bounty ([bounty page](https://make.fun/bounty/gta6-01)). Milo Kade is back in Solmar Bay with an empty wallet and a debt to pay. Mara has the jobs, Tessa has the garage, and Deke Marsh has the whole city scared. Steal cars, run the jobs, shake the heat — and take the Bay back, one sunset at a time.

Everything here is original: the city, the people, the cars, the story, the art and the music were made for this entry. The game runs entirely offline in a desktop browser — no network, no build step.

## Play it

Serve the folder and open it, or just run the included server:

```sh
node serve.ts
# then open http://localhost:8080
```

`?seed=N` fixes the city's random layout. `?shot=<name>&seed=N` stages one of the screenshot scenes (see `shots.json`).

## The city

Solmar Bay is a sun-soaked coastal city on a road grid, built procedurally from a seed: a downtown of tall windowed towers, the marina and docks to the east with cranes, containers and moored boats, Palm Court suburbs to the west, the Dockside Yards industrial north, a beach, the sea, and the lighthouse on the point. Palm trees and lamps line every street, billboards glow on the rooftops, clouds drift over the skyline, and a low golden sun throws long shadows that follow you through the streets.

## What you can do

- **Drive and steal.** Ten vehicle classes with distinct handling — the Kestrel sedan, Bantam hatch, Longhorn pickup, Viceroy luxury, Tide Runner van, Falcon GT and Comet GT sports cars, the police Interceptor, the Stallion motorcycle and the Marlin boat. Take parked cars or pull drivers out of traffic; stealing puts heat on you.
- **Live streets.** Traffic follows the roads, brakes for trouble and turns at intersections. Pedestrians stroll the sidewalks and run when things get loud.
- **Wanted level.** Five stars of heat. Police cruisers pursue along the grid, ram and bust you if you stop; roadblocks go up at three stars and a helicopter circles at four. Hide to fade a star at a time.
- **Ten story missions.** Linked jobs for Mara, Dario, Ivy and Sol with dialogue, waypoints, success and fail states: steal your first car, run a package, race the Bay Run, clear the docks, escape a three-star getaway, steal the Comet GT, pay back Deke's crew, crack the bank vault, race the Marlin through the bay buoys, and take the crown as King of the Bay. Rewards pay out in cash and respect, and unlock the SMG, the shotgun and the rifle.
- **Side activities.** Three street-race circuits (T in a car), taxi fares (T on foot), twenty hidden Bay Coins, a garage with engine upgrades and a gun shop.
- **Combat.** Fists, pistol, SMG, shotgun and rifle against Deke's Vultures, who chase, strafe and shoot back. Health and ammo pickups, muzzle flash, dust, smoke and sparks.
- **HUD and maps.** Health, money, respect rank, wanted stars, objective tracker, speedometer, weapon and ammo, radio station, and a live circular minimap (roads, waypoint, police blips, enemies, north).
- **Menus and saving.** Title screen, pause menu, busted/wasted flows, and saving to localStorage — position, money, story progress, weapons, coins and garage — with Continue on the title screen.
- **Sound.** Every sound is synthesized live with WebAudio: engine, sirens, shots, crashes, pickups, cash, horn, skids, explosions, and three generated radio stations. No audio files.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse drag | Look around |
| E | Enter / exit car, talk, interact |
| Click / F | Shoot / punch |
| 1 2 3 4 5 | Fists, pistol, SMG, shotgun, rifle |
| Q | Cycle weapon |
| R | Reload |
| T | Street race (in a car) / taxi fare (on foot) |
| Space | Handbrake / jump |
| Shift | Sprint |
| H | Horn |
| P / Esc | Pause |

## Structure

The game is plain static files under `game/` — `index.html` plus one-job ES modules under `game/src/`, each named for what it does (`city.js`, `vehicles.js`, `traffic.js`, `pedestrians.js`, `player.js`, `camera.js`, `combat.js`, `police.js`, `missions.js`, `garage.js`, `hud.js`, `minimap.js`, `audio.js`, `effects.js`, `save.js`, `shots.js`, `input.js`, `config.js`, `random.js`, `main.js`). three.js is vendored as its minified module build under `game/vendor/`. `main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes the dossier with the vendored make.fun library.
