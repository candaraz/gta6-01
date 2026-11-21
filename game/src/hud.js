// hud.js — Solmar Bay v3: the on-screen HUD and the menus.
// One job: every number, bar and word the player sees — cash, stars,
// mission, health, weapon, speed, radio, minimap — plus the title, pause,
// busted and wasted screens. Layout follows the v1 shots that read well:
// minimap top-left, cash + stars top-right, mission + health bottom-left,
// weapon + speed bottom-right.

export function createHud(G) {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="minimap-wrap"><canvas id="minimap" width="200" height="200"></canvas></div>
    <div id="topright">
      <div id="cash">$500</div>
      <div id="stars">☆☆☆☆☆</div>
      <div id="coins">◉ 0/20</div>
    </div>
    <div id="bottomleft">
      <div id="mission-name">SOLMAR BAY</div>
      <div id="mission-obj">Press Enter to play</div>
      <div id="mission-dist"></div>
      <div id="health-row"><span id="health-label">HEALTH 100</span><div id="health-bar"><div id="health-fill"></div></div></div>
    </div>
    <div id="bottomright">
      <div id="radio">♪ SOL FM</div>
      <div id="weapon">P9 Pistol</div>
      <div id="ammo">12 rounds</div>
      <div id="speed">0 <span>KM/H</span></div>
      <div id="vehname">on foot</div>
    </div>
    <div id="crosshair">+</div>
    <div id="prompt"></div>
    <div id="dialogue"><div id="dlg-who"></div><div id="dlg-text"></div></div>
    <div id="announce"></div>
    <div id="damage"></div>
    <div id="title" class="overlay">
      <div class="panel">
        <h1>SOLMAR BAY</h1>
        <div class="sub">Sun &bull; Salt &bull; Stolen Cars</div>
        <p>Milo Kade is back in Solmar Bay with an empty wallet and a debt to pay.
        Pearl has the jobs, Tessa has the garage, and Deke Marsh has the whole city scared.
        Steal cars, run the jobs, shake the heat — and take the Bay back.</p>
        <div id="title-buttons"></div>
        <div class="controls">W A S D move / drive &nbsp;·&nbsp; Mouse drag look &nbsp;·&nbsp; E enter / talk &nbsp;·&nbsp; Click / F shoot &nbsp;·&nbsp; 1-4 weapons &nbsp;·&nbsp; Q cycle &nbsp;·&nbsp; R reload &nbsp;·&nbsp; T race / taxi &nbsp;·&nbsp; Space handbrake / jump &nbsp;·&nbsp; Shift sprint &nbsp;·&nbsp; H horn &nbsp;·&nbsp; P pause</div>
      </div>
    </div>
    <div id="pause" class="overlay" style="display:none">
      <div class="panel"><h1>PAUSED</h1><div id="pause-buttons"></div></div>
    </div>
    <div id="busted" class="overlay" style="display:none">
      <div class="panel"><h1>BUSTED</h1><p>The Solmar PD hauled you in. $150 gone, heat cleared.</p><div id="busted-buttons"></div></div>
    </div>
    <div id="wasted" class="overlay" style="display:none">
      <div class="panel"><h1>WASTED</h1><p>Deke's crew left you in the gutter. $100 gone.</p><div id="wasted-buttons"></div></div>
    </div>
  `;
  const el = (id) => document.getElementById(id);
  let announceTimer = null, dialogueTimer = null, promptText = '';

  function showOverlay(id) {
    for (const o of ['title', 'pause', 'busted', 'wasted']) el(o).style.display = o === id ? 'flex' : 'none';
  }
  function hideOverlays() { for (const o of ['title', 'pause', 'busted', 'wasted']) el(o).style.display = 'none'; }

  return {
    el,
    setStars(n) {
      el('stars').textContent = '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(n);
      el('stars').style.color = n > 0 ? '#ffd94a' : '#8a8a8a';
    },
    setMission(name, obj) {
      el('mission-name').textContent = name.toUpperCase();
      el('mission-obj').textContent = obj;
    },
    setObjective(text, dist, wp) {
      el('mission-obj').textContent = text;
      el('mission-dist').textContent = dist < 1e8 ? `${Math.round(dist)}m` : '';
    },
    dialogue(who, text) {
      el('dlg-who').textContent = who;
      el('dlg-text').textContent = text;
      el('dialogue').style.display = 'block';
      clearTimeout(dialogueTimer);
      dialogueTimer = setTimeout(() => { el('dialogue').style.display = 'none'; }, 6500);
    },
    announce(text, ms = 2500) {
      el('announce').textContent = text;
      el('announce').style.display = 'block';
      clearTimeout(announceTimer);
      announceTimer = setTimeout(() => { el('announce').style.display = 'none'; }, ms);
    },
    prompt(text) { promptText = text; el('prompt').textContent = text; el('prompt').style.display = text ? 'block' : 'none'; },
    clearPrompt() { promptText = ''; el('prompt').style.display = 'none'; },
    flashCash(n) {
      el('cash').style.color = n >= 0 ? '#7aff7a' : '#ff7a7a';
      setTimeout(() => { el('cash').style.color = '#7aff7a'; }, 700);
    },
    damageFlash() {
      el('damage').style.opacity = '0.55';
      setTimeout(() => { el('damage').style.opacity = '0'; }, 180);
    },
    showTitle(hasSave, onPlay, onContinue) {
      showOverlay('title');
      const b = el('title-buttons');
      b.innerHTML = '';
      const mk = (label, fn) => {
        const btn = document.createElement('button');
        btn.textContent = label; btn.onclick = fn;
        b.appendChild(btn);
      };
      if (hasSave) mk('CONTINUE', onContinue);
      mk(hasSave ? 'NEW GAME' : 'PLAY', onPlay);
    },
    showPause(onResume, onSaveQuit, onQuit) {
      showOverlay('pause');
      const b = el('pause-buttons');
      b.innerHTML = '';
      const mk = (label, fn) => { const btn = document.createElement('button'); btn.textContent = label; btn.onclick = fn; b.appendChild(btn); };
      mk('RESUME', onResume);
      mk('SAVE & QUIT TO TITLE', onSaveQuit);
      mk('QUIT TO TITLE', onQuit);
    },
    showBusted(onContinue) {
      showOverlay('busted');
      const b = el('busted-buttons'); b.innerHTML = '';
      const btn = document.createElement('button'); btn.textContent = 'BACK ON THE STREET'; btn.onclick = onContinue;
      b.appendChild(btn);
    },
    showWasted(onContinue) {
      showOverlay('wasted');
      const b = el('wasted-buttons'); b.innerHTML = '';
      const btn = document.createElement('button'); btn.textContent = 'GET UP'; btn.onclick = onContinue;
      b.appendChild(btn);
    },
    hideOverlays,
    // Per-frame refresh of the numbers from the game state.
    update() {
      const p = G.player.p;
      el('cash').textContent = `$${Math.floor(p.cash).toLocaleString()}`;
      el('coins').textContent = `◉ ${p.coins}/20`;
      el('health-label').textContent = `HEALTH ${Math.ceil(p.health)}`;
      el('health-fill').style.width = `${Math.max(0, p.health)}%`;
      const w = G.player.p.weapons[p.weapon];
      const wdef = { fists: 'Fists', pistol: 'P9 Pistol', smg: 'SMG', shotgun: 'Shotgun', rifle: 'Rifle' }[p.weapon];
      el('weapon').textContent = wdef;
      el('ammo').textContent = w && w.ammo === Infinity ? '∞' : `${w ? w.ammo : 0} rounds`;
      const speed = p.car ? Math.abs(p.car.speed) * 3.6 : 0;
      el('speed').innerHTML = `${Math.round(speed)} <span>KM/H</span>`;
      el('vehname').textContent = p.car ? p.car.def.name : 'on foot';
      el('radio').textContent = `♪ ${G.audio.stationName}`;
      el('crosshair').style.display = (p.onFoot && G.state === 'playing') ? 'block' : 'none';
      // Damage vignette fades on its own; low health keeps a faint red edge.
      if (p.health < 30 && G.state === 'playing') el('damage').style.opacity = '0.18';
    },
  };
}
