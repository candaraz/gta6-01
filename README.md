[![Competition](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/candaraz/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/candaraz/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# SOLMAR BAY — Sun • Salt • Stolen Cars

An original open-world crime game built for the [make.fun](https://make.fun) **Make GTA 6** bounty. Rook is back in Solmar Bay with an empty wallet and a crew to build. Mara Voss runs the garage, Dario Kline handles the muscle, Ivy Chen plans the jobs, and Sol finds the work. The Vultures own the docks and Captain Rourke's Bay PD owns the streets. Steal cars, run the jobs, shake the heat — and take the Bay back, one golden hour at a time.

Everything here is original: the city, the people, the cars, the story, the art and the music were made for this entry. The game runs entirely offline in a desktop browser — no network, no build step.

## Play it

```sh
node serve.ts
# then open http://localhost:8080
```

`?shot=<name>` stages one of the screenshot scenes (see `shots.json`): `start`, `drive`, `chase`, `mission`.

## The city

Solmar Bay is a sun-soaked coastal city on a road grid, built procedurally from a seed: downtown towers around Solmar Tower, the marina and docks to the east, Palm Court suburbs to the west, the Dockside Yards industrial north, a beach, the bay itself, and Lighthouse Point. Palm trees, lamps, piers, a golden-hour sun with real shadows, and fog over the skyline.

## What you can do

- **Drive and steal.** Nine vehicle classes with distinct handling — the Pipit compact, Meridian sedan, Comet GT sports, Banteng muscle, Terra SUV, Hauler truck, Kargo van, Kilat motorcycle and the Marlin boat. Pull drivers out of traffic; stealing puts heat on you.
- **Live streets.** Traffic follows the roads, slows for the cars ahead and turns at intersections. Pedestrians stroll the sidewalks and run when things get loud.
- **Wanted level.** Five stars of heat. Bay PD cruisers pursue and ram, roadblocks go up at three stars, and the Air One helicopter joins at four. Break line of sight and stay hidden to cool down, star by star.
- **Ten story missions.** A linked campaign with dialogue, waypoints, success and fail states: steal your first wheels, run a pickup, race the coast, take the docks back from the Vultures, pull a getaway, steal the Bay's fastest car, pay the Vultures back, hit the marina vault, ride out the high tide, and take the crown. Rewards pay cash and respect, and unlock weapons, cars and safehouses.
- **Side activities.** Street races on three circuits, taxi fares, and twenty Bay Coins hidden around the city.
- **Garage and shops.** Buy engine, armour, nitro and paint upgrades at Mara's garage, weapons and ammo at Bay Arms, and safehouses to save and heal at.
- **Combat.** Four weapons — pistol, SMG, shotgun and rifle — against Vulture crews who strafe, reposition and shoot back. Health and armour, muzzle flash, tracers, blood, smoke, sparks and exploding wrecks.
- **HUD and maps.** Health, armour, money, respect rank, wanted stars, objective tracker with distance, speedometer, weapon and ammo, radio station, and a live canvas minimap (roads, mission marker, police blips, traffic, north).
- **Menus and saving.** Start screen, pause menu, settings (volume, quality, sensitivity), wasted flow, and saving to localStorage — position, money, respect, story progress, weapons, ammo, owned cars and upgrades. Continue resumes a real save.
- **Sound.** Every sound is synthesized live with WebAudio: three radio stations (SOL FM synthwave, Bay Bass funk, Golden Hour chill), engine, sirens, shots, crashes, pickups, cash, mission stings and explosions. No audio files.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Right-drag | Orbit camera |
| Mouse wheel | Zoom camera |
| Mouse (hold) / J | Shoot |
| E | Enter / exit car, steal a car |
| F | Interact (save, shop, start mission) |
| 1 2 3 4 | Pistol, SMG, shotgun, rifle |
| Q | Cycle weapon |
| Space | Handbrake / jump |
| Shift | Sprint / nitro |
| R | Next radio station |
| C | Camera mode |
| M | Mute |
| P / Esc | Pause |

## Structure

The game is plain static files under `game/` — `index.html` plus one-job ES modules under `game/src/`, each named for what it does (`config.js`, `random.js`, `input.js`, `city.js`, `vehicles.js`, `player.js`, `camera.js`, `traffic.js`, `police.js`, `combat.js`, `effects.js`, `audio.js`, `save.js`, `missions.js`, `garage.js`, `hud.js`, `shots.js`, `main.js`). three.js is vendored as its minified module build under `game/vendor/`. `main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes the dossier with the vendored make.fun library.
