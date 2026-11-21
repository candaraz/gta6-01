// Staged screenshot scenes (?shot=<name>&seed=N): each puts the
// player, the right vehicle, police and the objective exactly where
// the shot needs them, then snaps the camera. The play-test (and the
// maker) shoots all four and pixel-checks them.
import { makeVehicle, nearestVehicle } from './vehicles.js';
import { dist } from './random.js';

export const SHOTS = {
  chase: {
    title: 'THE GETAWAY',
    setup(G) {
      // Player in the Comet on a downtown avenue, 4 Interceptors
      // flanking with red light bars, 3 stars, traffic ahead.
      let comet = nearestVehicle(G, 0, 0, 500, 'comet');
      if (!comet) comet = makeVehicle(G, 'comet', 0, 0, 0, 'traffic');
      comet.x = 0; comet.z = 0; comet.heading = 0; comet.speed = 18;
      comet.driver = 'player';
      G.player.vehicle = comet;
      G.player.x = 0; G.player.z = 0; G.player.heading = 0;
      G.police.setWanted(3);
      // Flank ahead of the Comet, so they read as a pursuit and never
      // sit on top of the chase camera. Placed well ahead (the Comet
      // covers ~20 m in the second before the shutter) and near the
      // centreline, so they stay in frame with lights on without
      // covering the HUD corners.
      const spots = [[30, -5], [30, 5], [42, 0]];
      G.police.cops.forEach((c, i) => {
        const s = spots[i % spots.length];
        c.x = s[0]; c.z = s[1]; c.heading = 0; c.speed = 18;
      });
      G.missions.setObjective(200, 0, 'Escape to the Pier House');
      G.cameraRig.snapBehind(0);
      G.hud.toast('THE GETAWAY — Escape to the Pier House');
    },
  },
  mission: {
    title: 'DOCKSIDE',
    setup(G) {
      // On foot in the container yard: gold beam + diamond, the crew,
      // containers and a crane in frame. Stand in the yard (off the
      // road) and face the crew on the road ahead.
      G.player.vehicle = null;
      G.player.x = 180; G.player.z = 54; G.player.heading = -0.3;
      G.player.mesh.position.set(180, 0, 54);
      G.combat.spawnCrew(3, 192, 48);
      G.missions.setObjective(192, 48, "Clear the yard of Deke's crew (3 left)");
      G.cameraRig.snapBehind(-0.3);
      G.hud.toast("DOCKSIDE — Clear the yard of Deke's crew (3 left)");
    },
  },
  drive: {
    title: 'THE PACKAGE',
    setup(G) {
      // Driving the yellow Kestrel down a downtown street, traffic
      // ahead, palms and towers both sides.
      let k = nearestVehicle(G, 0, 0, 500, 'kestrel');
      if (!k) k = makeVehicle(G, 'kestrel', 0, 0, 0, 'traffic');
      k.x = 0; k.z = 48; k.heading = Math.PI / 2; k.speed = 14;
      k.driver = 'player';
      G.player.vehicle = k;
      G.player.x = 0; G.player.z = 48; G.player.heading = Math.PI / 2;
      G.police.setWanted(0);
      // Traffic ahead on the same street, so the shot reads busy.
      const ahead = [['bantam', 0, 78], ['tide', -2, 108], ['falcon', 2, 138]];
      for (const [type, ax, az] of ahead) {
        const t = makeVehicle(G, type, ax, az, Math.PI / 2, 'traffic');
        t.driver = 'npc'; t.cruise = 10; t.nextTurn = 60; t.horiz = false;
        G.traffic.push(t);
      }
      G.missions.setObjective(168, -48, 'Pick up the package at the dock office');
      G.cameraRig.snapBehind(Math.PI / 2);
      G.hud.toast('THE PACKAGE — Pick up the package at the dock office');
    },
  },
  start: {
    title: 'FIRST WHEELS',
    setup(G) {
      // On foot on the avenue facing downtown towers, a pedestrian
      // on the sidewalk, traffic ahead, waypoint on the minimap.
      G.player.vehicle = null;
      G.player.x = 0; G.player.z = 48; G.player.heading = -Math.PI / 2;
      G.player.mesh.position.set(0, 0, 48);
      G.police.setWanted(0);
      G.missions.setObjective(-96, 96, 'Go to the parked Kestrel');
      G.cameraRig.snapBehind(-Math.PI / 2);
      G.hud.toast('FIRST WHEELS — Go to the parked Kestrel');
    },
  },
};

export function applyShot(G, name) {
  const s = SHOTS[name];
  if (!s) return false;
  // Mission text shown by the shot, without starting the story.
  G.missions.clearObjective();
  G.missions.shotTitle = s.title;
  s.setup(G);
  return true;
}
