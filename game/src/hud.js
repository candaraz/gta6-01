// HUD: cash, stars, coins, health, mission tracker, speed, weapon,
// radio — plain DOM over the canvas, plus toasts and banners.
import { RANKS } from './config.js';
import { respawnPlayer } from './player.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const H = {
    toastTimer: null,
  };
  G.hud = H;

  H.update = function () {
    const P = G.player;
    $('cash').firstChild.textContent = '$' + G.cash.toLocaleString('en-US');
    const stars = '★'.repeat(G.police.wanted) + '☆'.repeat(5 - G.police.wanted);
    $('stars').textContent = stars;
    $('coins').textContent = `◉ ${G.activities.coins}/20`;
    const hp = Math.round(P.health);
    $('health').firstChild.textContent = 'HEALTH ' + hp;
    $('healthfill').style.width = hp + '%';
    $('healthfill').style.background = hp > 50 ? '#37e05a' : hp > 25 ? '#ffb02e' : '#e03a3a';
    const kmh = P.vehicle ? Math.round(Math.abs(P.vehicle.speed) * 3.6) : 0;
    $('kmh').textContent = kmh;
    $('veh').textContent = P.vehicle ? P.vehicle.def.name : 'on foot';
    const w = G.combat.weaponDef();
    $('wname').textContent = w.name;
    $('ammo').textContent = G.combat.ammoText();
    $('radio').textContent = '♪ ' + G.audio.stationName();
    $('cross').style.display = (!P.vehicle && G.state === 'playing') ? 'block' : 'none';
    H.updateMission();
  };

  H.updateMission = function () {
    const M = G.missions;
    const m = M.mission();
    const st = M.currentStage();
    const obj = M.objective;
    if (!m) {
      $('mission').innerHTML = '<b>BAY KING</b><br><span>You took the Bay back.</span>';
      return;
    }
    const race = M.race || (G.activities && (G.activities.race || G.activities.taxi));
    let text = obj ? obj.text : (st ? st.text : m.brief);
    let d = '';
    if (obj) {
      const dd = Math.hypot(G.player.x - obj.x, G.player.z - obj.z);
      d = Math.round(dd) + 'm';
    }
    const title = race && G.activities.race ? 'STREET RACE' : race && G.activities.taxi ? 'TAXI FARE' : (M.shotTitle || m.title);
    $('mission').innerHTML = `<b>${title}</b><br><span>${text}</span><br><span class="dist" id="dist">${d}</span>`;
  };

  H.toast = function (msg) {
    const t = $('toast');
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(H.toastTimer);
    H.toastTimer = setTimeout(() => { t.style.display = 'none'; }, 2600);
  };
  H.showBanner = function (msg) {
    const b = $('banner');
    b.textContent = msg;
    b.style.display = 'block';
  };
  H.hideBanner = function () { $('banner').style.display = 'none'; };

  H.showScreen = function (which) {
    $('screen').style.display = which === 'title' ? 'flex' : 'none';
    $('pause').style.display = which === 'pause' ? 'flex' : 'none';
    $('contBtn').style.display = (which === 'title' && G.save.hasSave()) ? 'block' : 'none';
  };
  H.respawn = function () {
    // Called after the BUSTED / WASTED banner: wake up at a safehouse.
    respawnPlayer(G);
  };
  return H;
}
