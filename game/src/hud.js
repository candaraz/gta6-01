// The HUD: every DOM element over the 3D view — health, money, wanted stars,
// the objective tracker, the speedometer, the dialogue box, the prompts and
// the menus. The game calls these setters once a frame; the DOM only changes
// when a value does, so the overlay costs nothing when the game is calm.

import * as THREE from 'three';

function el(id) {
  return document.getElementById(id);
}

export function createHud() {
  const refs = {
    money: el('money'),
    stars: el('stars'),
    healthFill: el('health-fill'),
    healthText: el('health-text'),
    objectiveTitle: el('objective-title'),
    objectiveText: el('objective-text'),
    objectiveDist: el('objective-dist'),
    timer: el('timer'),
    speedo: el('speedo'),
    speedValue: el('speed-value'),
    carName: el('car-name'),
    weaponBox: el('weapon-box'),
    weaponName: el('weapon-name'),
    ammo: el('ammo'),
    prompt: el('prompt'),
    dialogue: el('dialogue'),
    dialogueSpeaker: el('dialogue-speaker'),
    dialogueText: el('dialogue-text'),
    toast: el('toast'),
    vignette: el('vignette'),
    crosshair: el('crosshair'),
    waypointArrow: el('waypoint-arrow'),
    bustMeter: el('bust-meter'),
    bustFill: el('bust-fill'),
    evadeLabel: el('evade-label'),
    startScreen: el('start-screen'),
    pauseMenu: el('pause-menu'),
    endScreen: el('end-screen'),
    endTitle: el('end-title'),
    endText: el('end-text'),
    bigmap: el('bigmap'),
    pauseStats: el('pause-stats'),
    medallionCount: el('medallion-count'),
  };
  let last = {};
  let toastTimer = null;
  const projected = new THREE.Vector3();

  function setText(ref, key, value) {
    if (last[key] !== value) {
      last[key] = value;
      ref.textContent = value;
    }
  }

  return {
    setMoney(value) {
      setText(refs.money, 'money', `$${Math.round(value).toLocaleString('en-US')}`);
    },
    setStars(count, evading) {
      const filled = '★'.repeat(count);
      const empty = '☆'.repeat(5 - count);
      setText(refs.stars, 'stars', filled + empty);
      refs.stars.classList.toggle('evading', evading && count > 0);
      refs.stars.style.visibility = count > 0 ? 'visible' : 'hidden';
      refs.evadeLabel.style.display = evading && count > 0 ? 'block' : 'none';
    },
    setHealth(value) {
      const pct = Math.max(0, Math.min(100, Math.round(value)));
      if (last.health !== pct) {
        last.health = pct;
        refs.healthFill.style.width = `${pct}%`;
        refs.healthFill.style.background = pct > 50 ? '#3ecf6e' : pct > 25 ? '#e8a81c' : '#d93a3a';
        refs.healthText.textContent = `${pct}`;
      }
    },
    setObjective(title, text, distance) {
      setText(refs.objectiveTitle, 'objTitle', title || '');
      setText(refs.objectiveText, 'objText', text || '');
      setText(refs.objectiveDist, 'objDist', distance == null ? '' : `${Math.round(distance)}m`);
      refs.objectiveTitle.parentElement.style.display = text ? 'block' : 'none';
    },
    setTimer(seconds, countingUp) {
      if (seconds == null) {
        refs.timer.style.display = 'none';
        return;
      }
      refs.timer.style.display = 'block';
      const total = Math.max(0, seconds);
      const minutes = Math.floor(total / 60);
      const secs = Math.floor(total % 60);
      const text = countingUp ? `${minutes}:${String(secs).padStart(2, '0')}` : `⏱ ${minutes}:${String(secs).padStart(2, '0')}`;
      setText(refs.timer, 'timer', text);
      refs.timer.classList.toggle('urgent', !countingUp && total < 20);
    },
    setDriving(carName, kmh) {
      if (carName) {
        refs.speedo.style.display = 'block';
        setText(refs.speedValue, 'speed', String(kmh));
        setText(refs.carName, 'carName', carName);
      } else {
        refs.speedo.style.display = 'none';
      }
    },
    setWeapon(name, ammoText) {
      setText(refs.weaponName, 'weapon', name);
      setText(refs.ammo, 'ammo', ammoText);
    },
    setPrompt(text) {
      if (last.prompt !== text) {
        last.prompt = text;
        refs.prompt.textContent = text;
        refs.prompt.style.display = text ? 'block' : 'none';
      }
    },
    setDialogue(line) {
      if (!line) {
        refs.dialogue.style.display = 'none';
        return;
      }
      refs.dialogue.style.display = 'block';
      setText(refs.dialogueSpeaker, 'speaker', line[0]);
      setText(refs.dialogueText, 'dialogue', line[1]);
    },
    toast(text, seconds = 3) {
      refs.toast.textContent = text;
      refs.toast.style.display = 'block';
      refs.toast.classList.remove('show');
      void refs.toast.offsetWidth;
      refs.toast.classList.add('show');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        refs.toast.style.display = 'none';
      }, seconds * 1000);
    },
    flashDamage() {
      refs.vignette.classList.add('hurt');
      setTimeout(() => refs.vignette.classList.remove('hurt'), 220);
    },
    setCrosshair(visible) {
      refs.crosshair.style.display = visible ? 'block' : 'none';
    },
    setBustProgress(value) {
      if (value > 0.02) {
        refs.bustMeter.style.display = 'block';
        refs.bustFill.style.width = `${Math.round(value * 100)}%`;
      } else {
        refs.bustMeter.style.display = 'none';
      }
    },
    setMedallions(found, total) {
      setText(refs.medallionCount, 'medals', `☀ ${found}/${total}`);
    },
    // The edge arrow: points at the waypoint when it is off-screen.
    updateWaypointArrow(camera, waypoint) {
      if (!waypoint) {
        refs.waypointArrow.style.display = 'none';
        return;
      }
      projected.set(waypoint.x, 4, waypoint.z).project(camera);
      const behind = projected.z > 1;
      const onScreen = !behind && Math.abs(projected.x) < 0.92 && Math.abs(projected.y) < 0.88;
      if (onScreen) {
        refs.waypointArrow.style.display = 'none';
        return;
      }
      let x = projected.x;
      let y = projected.y;
      if (behind) {
        // A point behind the camera projects mirrored: flip both axes so the
        // arrow points the way the player must turn, not the mirror of it.
        x = -x;
        y = -y;
      }
      const angle = Math.atan2(y, x);
      const edgeX = 50 + Math.cos(angle) * 44;
      const edgeY = 50 - Math.sin(angle) * 44;
      const arrow = refs.waypointArrow;
      arrow.style.display = 'block';
      arrow.style.left = `${edgeX}%`;
      arrow.style.top = `${edgeY}%`;
      arrow.style.transform = `translate(-50%, -50%) rotate(${(-angle * 180) / Math.PI + 90}deg)`;
    },
    showStart(hasSave) {
      refs.startScreen.style.display = 'flex';
      el('continue-btn').style.display = hasSave ? 'block' : 'none';
    },
    hideStart() {
      refs.startScreen.style.display = 'none';
    },
    showPause(statsText) {
      refs.pauseMenu.style.display = 'flex';
      refs.pauseStats.textContent = statsText;
    },
    hidePause() {
      refs.pauseMenu.style.display = 'none';
    },
    showEnd(title, text) {
      refs.endScreen.style.display = 'flex';
      refs.endTitle.textContent = title;
      refs.endText.textContent = text;
    },
    hideEnd() {
      refs.endScreen.style.display = 'none';
    },
    showBigmap(visible) {
      refs.bigmap.style.display = visible ? 'flex' : 'none';
    },
    setHudVisible(visible) {
      el('hud').style.display = visible ? 'block' : 'none';
    },
    bindButtons(handlers) {
      el('start-btn').addEventListener('click', handlers.onStart);
      el('continue-btn').addEventListener('click', handlers.onContinue);
      el('resume-btn').addEventListener('click', handlers.onResume);
      el('save-btn').addEventListener('click', handlers.onSave);
      el('restart-btn').addEventListener('click', handlers.onRestart);
      el('end-btn').addEventListener('click', handlers.onRespawn);
      el('close-map-btn').addEventListener('click', handlers.onCloseMap);
    },
  };
}
