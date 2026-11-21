# SOLMAR BAY — Build Log (v3, rebuilt under recording r6)

Rebuild of the v3 design ("dense sun-soaked city, 10 missions, rebuilt
visuals") fresh under recording r6 (01a1fcf4), because v3's recording r5
died and its build could not be submitted. Same design, same visuals,
written fresh in this session. v2 scored 0.980820 (rank #6811) with
flat/sparse screenshots; v3's visuals fix exactly that.

## The game

Open-world GTA-style game in Three.js (vendored), golden-hour Solmar Bay:
downtown towers 30–72 m with 4 window-facade palettes, shopfronts,
parapets and rooftop props; marina/docks with cranes, containers and
boats; Palm Court suburbs, Dockside Yards, beach + sea + lighthouse;
palms, lamps and traffic lights on every street; drifting clouds;
golden-hour sun with real shadows; fog; ~35 draw calls.

Systems: 10 story missions (driving, races, escape, boat race, kill
stages), 9 vehicle classes, 4 weapons + fists, 5-star police with
cruisers, roadblocks and helicopter, garage tuning, gun shop,
safehouses, 3 street-race circuits, taxi fares, 20 Bay Coins, 3 radio
stations (WebAudio synth), save/load (localStorage), live minimap.

## Verification (headless Chrome, Playwright, SwiftShader)

### Full play-through (test/play.js, 640x400, ?low=1)

The game keeps real time via sub-stepped physics (see "Bugs fixed").
Campaign played end to end, seed 7:

- **Missions 10/10**, cash $1,250 -> $29,000, respect 0 -> 1,370, 630 s.
  m1 First Wheels, m2, m3, m4 Dockside (kill), m5, m6 (enter Comet),
  m7 (kill), m8 The Heist (hold vault + escape), m9 High Tide (boat),
  m10 King of the Bay (kill) — all completed.
- **Kill stages (aim probe)**: m4 3 kills, 5/6 hits; m7 4 kills, 7/9
  hits; m10 3 kills, 6/7 hits. Enemies hold ground, HP 16, damage 1.
- **Carjacking**: stole a moving Tide from a driver on the avenue —
  wanted 1 star, 1 Interceptor pursuing. (One earlier run missed the
  carjack on timing; the mechanic itself works and was verified twice.)
- **Audio**: context running; music analyser peak 44, gunshot spike 176.
- **Side race** (T in car): 4 checkpoints, done, cash $29,000 -> $30,200.
- **Taxi** (T on foot): fare completed, cash $30,200 -> $30,369.
- **Continue**: save -> reload to title -> Continue visible; cash,
  respect, mission and position identical after the fix below
  (probe: cash $30,369, respect 1,420, mission 10, pos (192,2) — MATCH).
- **Errors: none** (no page errors, no console errors).

### Screenshots (test/smoke.js, 1280x800, full quality)

Pixel-checked by eye; all dense, HUD + minimap + stars + mission
readable. SMOKE PASS, errors: none.

| shot | size | colours | what it shows |
| --- | --- | --- | --- |
| 1-chase.jpg | 103 KiB | 20,389 | Comet at 71 KM/H, 2 Interceptors flanking with red light bars, 3 stars, objective beam ahead, towers + palms |
| 2-mission.jpg | 83 KiB | 13,010 | On foot in the container yard: gold objective beam + diamond, Deke's crew, crane, containers, sea behind |
| 3-drive.jpg | 123 KiB | 17,873 | Kestrel at 53 KM/H down a downtown avenue, traffic ahead, peds on sidewalks, windowed towers |
| 4-start.jpg | 104 KiB | 16,508 | On foot on the avenue facing downtown towers, waypoint on the minimap |

### Gates

- game/: 23 files, 2.2 MiB; index.html 5,769 B (<= 1 MiB).
- screenshots/: 4 files, 420 KiB total, each < 256 KiB.
- main.ts double run: byte-identical (dossier.json 687,418 B both runs).
- Kit check (`node cli/makefun.mjs check --repo ... --kit ...`):
  **4 passed, 0 failed, 16 skipped, 5 checked at submission**.
  The 5 at-submission checks (repo public/owner/created-after-open,
  commit in repo, duplicate snapshot) are the site's at submit time.

## Bugs fixed in this rebuild

1. **Slow-motion in headless (main.js).** The loop clamped dt to 0.05 s,
   so at ~1 FPS (SwiftShader) the game ran at ~0.05x real time and no
   driver timeout could ever be long enough. Fixed by stepping the
   world in fixed 0.05 s slices (sub-stepping), so game time tracks
   real time at any frame rate. Added `?low=1` (no shadows/antialias)
   so the play-test runs at ~3.4 FPS; the shipped default is full
   quality and the screenshots are taken at full quality.
2. **Driver cut through buildings (test/play.js).** Straight-line
   navigation wedged the player/car against buildings. The driver now
   follows the road grid (Manhattan waypoints via intersections).
3. **Carjack chased a moving car (test/play.js).** A traffic car
   outruns the player on foot. The driver now stands on a busy avenue
   and taps E repeatedly as cars pass (one tap lands in the 5.5 m
   enter range despite the ~3 FPS frame rate).
4. **Marlin unboardable (player.js).** The Marlin is moored at
   (300,104), past the player's world-edge clamp (290), so the m9
   enter stage could never reach it. The east clamp is now pier-aware:
   306 while on the pier band (z 86–108), 290 elsewhere, so the player
   can walk the pier out to the boat and board it. Verified by probe:
   player reached 1.1 m from the Marlin and boarded.
5. **Boat race routed via roads (test/play.js).** goTo sent the Marlin
   to land intersections it is clamped away from (boat x >= 300).
   The driver now steers the boat straight at its buoy (open water).
6. **HUD null error after campaign complete (hud.js).**
   updateMission replaced #mission's innerHTML (destroying the #dist
   span), then the completed-campaign branch set textContent on the
   now-null #dist — 3,152 page errors per run. Removed the dead line;
   the recreated span keeps id="dist".
7. **Continue resurrected m10 (save.js).** loadGame clamped the saved
   mission index to 9, so a completed campaign (10) reloaded as m10.
   Clamped to 10 instead; startMission(10) is the Bay King state.
8. **Staged cars read parked (test/smoke.js, game/src/shots.js).**
   The staged speed bled to 0 within half a second (strong drag) and
   the key was released before the shutter. The smoke test now holds W
   through both screenshots. The chase police were re-staged further
   ahead and nearer the centreline so they flank with red light bars
   in frame without covering the HUD corners.

## Notes

- Kill stages are verified with the aim probe only (per the build
  brief): the full driver re-aims every ~250 ms and lands far fewer
  hits, but a focused probe hits ~40%+ and the crew dies, proving the
  mechanics. A human aiming with the mouse does not hit this artifact.
- The v3 fixed-bug list was respected: waypoints on street points
  (m1/m6/m10), garage/gun-shop/coin spots on roads, camera yaw, shot
  far-point clamp to ground hit y=0.3, enemy line-of-sight, bust
  grace (12 s vault + 4 s exit), mission vehicle preferred on E,
  turn anticipation in the driver, race clocks (Bay Run 150 s,
  Downtown Dash 160 s).
