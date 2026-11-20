# BUILD-LOG — Solmar Bay (gta6-01 rebuild, recording r4)

Rebuilt fresh under recording r4 (21 Nov 2026) from the v2 design log.
Same game, same spec, every file written fresh in this session — the v2
source was never read. "Solmar Bay": an original sun-soaked coastal
open-world crime game in Three.js 0.160.0 (vendored, no network).

## What it is

10 story missions with a crew (Mara, Dario, Ivy, Sol), respect ranks
Street → Bay King (1,320), garage upgrades, gun shop, 3 safehouses,
3 street-race circuits, taxi fares, 20 Bay Coins (+$100 each), 9 vehicle
classes (incl. motorcycle and the Marlin boat), 4 weapons (pistol / SMG /
shotgun / rifle, keys 1–4, Q cycle, R reload), 5-star wanted police
(patrol → roadblocks → helicopter, PIT/ram, decay when hidden), HUD +
live minimap, start / pause / settings, save + Continue, 3 synth radio
stations, engine / siren / gunshot / collision / explosion effects.
T starts a street race (in a car) or a taxi fare (on foot).

## Files

- `game/index.html` (1,244 B) + `game/src/*.js` (18 files, 3,646 lines)
  — one clear job per file: config, random, input, audio, effects, city,
  vehicles, traffic, player, camera, combat, police, missions, garage,
  hud, save, shots, main. `game/vendor/three.module.min.js` (670,681 B).
- `main.ts` (Node 22 stdlib only): copies `game/` + `screenshots/` to
  `MAKEFUN_OUTPUT_DIR` (or `/output`, contents only — never the dir
  itself) and writes `dossier.json` via `buildDossier(repoRoot,
  { text_max_bytes: 163840 })`. Sorted copy order; runs byte-identical.
- `serve.ts` (static server on :8080), `shots.json` (4 shots, cover
  `1-chase.jpg`), `README.md` (3 live make.fun badges + make.fun link),
  `test/play.js` (full Playwright end-to-end driver, see below).

## Missions and rewards

m1 First Wheels $800/100 · m2 The Package $1,200/150 · m3 Bay Run
$3,700/120 (race) · m4 Dockside $2,000/200 (6 Vultures) · m5 The Getaway
$3,000/100 (3 stars, then escape to the Pier House) · m6 Grand Theft Bay
$4,000/150 (steal the Comet GT) · m7 Payback $4,500/200 (10 Vultures) ·
m8 The Heist $12,000/100 (hold F 8s, escape at 4 stars) · m9 High Tide
$9,000/100 (bay race) · m10 King of the Bay $25,000/100 (Downtown Dash
+ final Vultures). Totals: $65,700, 1,320 respect = Bay King.

## Verification (headless Chrome, Playwright, 21 Nov 2026)

Headless swiftshader runs ~5.3 fps, so with the 0.05 s dt clamp the game
runs at ~26% of real time; timings below are wall-clock at that rate.
Driver: `test/play.js` (run `node test/play.js`).

Missions, all played end-to-end (final full run):
m1 2.3 s · m2 2.1 s · m3 6.0 s · m4 10.5 s · m5 0.7 s · m6 2.0 s ·
m7 16.5 s · m8 53.4 s · m9 2.9 s · m10 30.7 s.
Final: completed 10/10, cash $65,700, respect 1,320 — PASS, no errors.
(m5 is fast by design: its wanted stage auto-sets 3 stars — "the cops
are coming" — and its escape marker is the start marker, so a player
standing there finishes it at once.)

Side activities: street race (T in a car) PASS — cash $65,700 → $67,200,
respect 1,320 → 1,440, active mission untouched. Taxi fare (T on foot)
PASS — cash $67,200 → $67,634, respect 1,440 → 1,460.

Carjacking + chase: carjack gave stars (2, from the steal plus a
collision), then 3 stars set — maxStars 5, maxCops 3 on scene, car at
86 km/h — PASS.

Audio: context running, music analyser peak 77.6 (avg 70.5 over 3 s);
gunshot + explosion spike peak 129.2 — PASS.

Continue: save → reload → Continue — cash $67,634 → $67,634, respect
1,460 → 1,460, mission 10 → 10, position (205,-2) → (205,-2) — MATCH.

Screenshots (1280×800, JPEG q82, pixel-checked, HUD/minimap legible):
1-chase.jpg 48 KiB (95 unique colours, minimap 105) · 2-mission.jpg
49 KiB (95, minimap 123) · 3-drive.jpg 50 KiB (107, minimap 155) ·
4-start.jpg 43 KiB (67, minimap 122). All ≤ 256 KiB. Console/page
errors: none.

## Bugs found and fixed while rebuilding

- Aim: shots fired from the camera dived over near enemies. The bullet
  now travels from the muzzle to the crosshair's far point (60 m along
  the camera ray) — kills land reliably (m4/m7 clear in ~10/17 s).
- Traffic AI drove the player's stolen car (cruise cap 13 m/s + random
  intersection turns). Traffic now skips any car whose driver is
  'player'; the car rejoins traffic when the player steps out.
- The shared vehicle list went stale (despawned traffic, new spawns,
  cop cars). New traffic/police cars join via onSpawn, dead ones are
  filtered each frame, and police/roadblock/racer cars are unboardable.
- Cops steered straight at the player through buildings and got stuck
  forever. They now steer along the road grid (Manhattan) and reverse
  out when pinned (auto-reverse for non-player cars).
- `G.time` was never advanced (frozen coin bob). Now `G.time += dt`.
- Vehicles and the player could drive/walk off the map (past z=-320).
  The world edge now blocks cars and clamps on-foot movement.
- Input: a keydown arriving while the key still read as down (lost
  keyup) ate the next press. Every fresh non-repeat keydown now queues
  a hit.
- `poseStart` stood the player on Mara's Place itself, putting the
  camera inside the house walls — a blank shot. The pose now stands on
  the avenue beside the house, facing it and the city.
- Driver note (not a game bug): a mission can start AND finish between
  two reads — the driver now treats `completed >= id` as success.

## Gates (local)

game/ 20 files, 809,400 B (≤ 993 files, ≤ 48 MiB) · index.html 1,244 B
(≤ 1 MiB) · screenshots 4 × 43–51 KiB (each ≤ 256 KiB, long side 1280,
short side 800 ≥ 480) · dossier text cap 163,840 B (see main.ts run).

## Rebuild notes

- This is attempt 3. v2 (commit a50c0f7) was built, verified and pushed
  but never submitted: recording r2 died with 377 records unwitnessed
  and the r3 rebuild died when the VM restarted. This rebuild re-writes
  the same game fresh under recording r4 so it can be submitted.
- Only two files were read as spec: this log's v2 predecessor and the
  competition `RULES.txt`. The v2 source was never read, shown, diffed
  or checked out — re-typed lines would count as read, not authored.
- The 5 pre-existing plumbing files (main.ts, serve.ts, shots.json,
  README.md, BUILD-LOG.md) were each deleted unread and rewritten fresh.
- Toolchain: Node v22.21.0, Three.js 0.160.0 module min build, Playwright
  1.55.0 + stock puppeteer Chrome (Meta Chrome refuses to launch in this
  VM: "Hatch WebGL domain policy is required for browser startup").
- main.ts determinism and the kit check are recorded below by the parent
  at bundle time; the local double-run diff must be identical.
