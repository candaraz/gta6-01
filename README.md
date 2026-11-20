# Solmar Bay — Make GTA 6

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/candaraz/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/candaraz/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

An original sun-soaked coastal open-world crime game, built for the
[Make GTA 6](https://make.fun/c/gta6-01) bounty on make.fun. No Rockstar
names, characters, map, art or music — Solmar Bay is its own city, its own
crew, its own story.

## The game

You are a newcomer in Solmar Bay, a coastal city of downtown towers, docks,
beaches and a bay. Mara, Dario, Ivy and Sol pull you into 10 story missions:
steal a van, run a package, win the Harbour Loop, clear the Vultures off the
docks, outrun a 3-star manhunt, steal a Comet GT, crack a vault, and win a
boat race — ending as King of the Bay.

- **Open world**: drive or walk a full city grid — traffic, pedestrians,
  carjacking, 9 vehicle classes (compact to sports car, motorcycle, boat).
- **Wanted**: 5-star police — patrol cars that chase and ram, roadblocks
  from 3 stars, a helicopter from 4, busts on foot, heat that dies down
  when you stay hidden.
- **Combat**: 4 weapons (pistol, SMG, shotgun, rifle) with a weapon wheel,
  ammo, and gang shootouts.
- **Progression**: respect ranks from Street to Bay King, garage upgrades,
  a gun shop, 3 safehouses (save, heal, lose the heat), 3 street-race
  circuits, taxi fares, and 20 Bay Coins to find.
- **Feel**: third-person camera that looks ahead of you, live minimap,
  HUD, start/pause/settings menus, save/load with Continue, 3 synth radio
  stations, engine/siren/gunshot/collision/explosion effects.

## Controls

| Key | Action |
| --- | ------ |
| WASD / arrows | Move / drive (W always moves away from the camera) |
| Mouse | Look (click to lock), click to shoot |
| E | Enter car / board boat / interact / start mission |
| F (hold) | Use — crack the vault |
| T | Street race (in a car) or taxi fare (on foot) |
| 1–4, Q, R | Weapons, cycle, reload |
| C, M | Next radio station, mute |
| Shift | Sprint |
| Esc / P | Pause |

## Play it

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

Static files only — `game/index.html` opens in desktop Chrome with no
network. Three.js 0.160.0 is vendored under `game/vendor/`.

## Build log

See [BUILD-LOG.md](BUILD-LOG.md) for the design, the bugs found while
play-testing, and the verification numbers (every mission played
end-to-end, Continue test, audio test, gate rows).

## Verify it yourself

```sh
node main.ts                                  # writes out/ (or $MAKEFUN_OUTPUT_DIR)
MAKEFUN_OUTPUT_DIR=out2 node main.ts         # run twice, diff -r out out2: identical
node --check game/src/main.js                 # every src file parses as a module
```

The headless play-test driver lives in `test/play.js` (Playwright +
system Chrome): it plays all 10 missions end-to-end, a street race, a
taxi fare, a 3-star chase, the Continue flow, and takes the screenshots.

## License

MIT — see [LICENSE](LICENSE).
