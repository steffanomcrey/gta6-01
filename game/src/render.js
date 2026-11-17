// The painter: camera, city, cars, people, police, effects, menus. It reads
// the state and never changes it; the HUD overlay lives in hud.js.
import {
  WORLD_WIDTH, WORLD_HEIGHT, ROADS_X, ROADS_Y, ROAD_WIDTH, DISTRICTS,
  PARK_RECT, PLAZA_RECT, SEA_RECT, PALETTE, sunsetAmount,
} from './config.js';
import { currentMarker } from './missions.js';
import { drawHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let camX = 0;
  let camY = 0;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { w, h };
  }

  function snapTo(x, y) {
    // Jump the camera straight to the target, clamped to the world: shot
    // staging paints only twice, so a lerping camera would never arrive.
    // Uses the window size, since the canvas is resized on the next draw.
    const w = window.innerWidth;
    const h = window.innerHeight;
    camX = Math.max(0, Math.min(WORLD_WIDTH - w, x - w / 2));
    camY = Math.max(0, Math.min(WORLD_HEIGHT - h, y - h / 2));
    if (WORLD_WIDTH < w) camX = (WORLD_WIDTH - w) / 2;
    if (WORLD_HEIGHT < h) camY = (WORLD_HEIGHT - h) / 2;
  }

  function draw(state, screen, ui) {
    const { w, h } = resize();
    const p = state.player;
    const targetX = p.x - w / 2;
    const targetY = p.y - h / 2;
    camX += (targetX - camX) * 0.12;
    camY += (targetY - camY) * 0.12;
    camX = Math.max(0, Math.min(WORLD_WIDTH - w, camX));
    camY = Math.max(0, Math.min(WORLD_HEIGHT - h, camY));
    // A view smaller than the world still clamps; a bigger one centres.
    if (WORLD_WIDTH < w) camX = (WORLD_WIDTH - w) / 2;
    if (WORLD_HEIGHT < h) camY = (WORLD_HEIGHT - h) / 2;

    drawGround(state, camX, camY, w, h);
    drawPickups(state, camX, camY);
    drawMarker(state, camX, camY, w, h);
    for (const car of state.cars) drawCar(car, camX, camY, state.elapsed, car.driven);
    for (const cruiser of state.cruisers) drawCruiser(cruiser, camX, camY, state.elapsed);
    for (const ped of state.peds) drawPed(ped, camX, camY);
    for (const cop of state.cops) drawCop(cop, camX, camY);
    if (p.onFoot) drawPlayerOnFoot(state, camX, camY);
    drawBullets(state, camX, camY);
    drawParticles(state, camX, camY);
    drawSunset(state, w, h);

    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(ctx, state, w, h, camX, camY);
    }
    if (screen === SCREEN_TITLE) drawTitle(state, w, h, ui);
    if (screen === SCREEN_PAUSED) drawPaused(w, h);
    if (screen === SCREEN_OVER) drawOver(state, w, h);
  }

  function drawGround(state, camX, camY, w, h) {
    ctx.fillStyle = '#c9b183';
    ctx.fillRect(0, 0, w, h);
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.tint;
      for (const r of d.rects) ctx.fillRect(r.x - camX, r.y - camY, r.w, r.h);
    }
    // The sea along the west edge and the sand beside it.
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(SEA_RECT.x - camX, SEA_RECT.y - camY, SEA_RECT.w, SEA_RECT.h);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(96 - camX, 0 - camY, 60, WORLD_HEIGHT);
    ctx.fillStyle = '#d8b878';
    for (let y = 0; y < WORLD_HEIGHT; y += 90) {
      ctx.beginPath();
      ctx.arc(150 - camX, y + 30 - camY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // The park and the plaza stay open ground with their own dressing.
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(PARK_RECT.x - camX, PARK_RECT.y - camY, PARK_RECT.w, PARK_RECT.h);
    ctx.fillStyle = PALETTE.plaza;
    ctx.fillRect(PLAZA_RECT.x - camX, PLAZA_RECT.y - camY, PLAZA_RECT.w, PLAZA_RECT.h);
    ctx.fillStyle = '#7fb5c9';
    ctx.beginPath();
    ctx.arc(PLAZA_RECT.x + PLAZA_RECT.w / 2 - camX, PLAZA_RECT.y + PLAZA_RECT.h / 2 - camY, 26, 0, Math.PI * 2);
    ctx.fill();
    for (const tree of state.trees) {
      ctx.fillStyle = '#3f6b2e';
      ctx.beginPath();
      ctx.arc(tree.x - camX, tree.y - camY, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5d8a4a';
      ctx.beginPath();
      ctx.arc(tree.x - 3 - camX, tree.y - 3 - camY, tree.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Roads: asphalt, pale edges, dashed centre lines.
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_WIDTH / 2 - camX, 0 - camY, ROAD_WIDTH, WORLD_HEIGHT);
    for (const ry of ROADS_Y) ctx.fillRect(0 - camX, ry - ROAD_WIDTH / 2 - camY, WORLD_WIDTH, ROAD_WIDTH);
    ctx.strokeStyle = PALETTE.roadEdge;
    ctx.lineWidth = 3;
    for (const rx of ROADS_X) {
      ctx.beginPath();
      ctx.moveTo(rx - ROAD_WIDTH / 2 - camX, 0 - camY);
      ctx.lineTo(rx - ROAD_WIDTH / 2 - camX, WORLD_HEIGHT - camY);
      ctx.moveTo(rx + ROAD_WIDTH / 2 - camX, 0 - camY);
      ctx.lineTo(rx + ROAD_WIDTH / 2 - camX, WORLD_HEIGHT - camY);
      ctx.stroke();
    }
    for (const ry of ROADS_Y) {
      ctx.beginPath();
      ctx.moveTo(0 - camX, ry - ROAD_WIDTH / 2 - camY);
      ctx.lineTo(WORLD_WIDTH - camX, ry - ROAD_WIDTH / 2 - camY);
      ctx.moveTo(0 - camX, ry + ROAD_WIDTH / 2 - camY);
      ctx.lineTo(WORLD_WIDTH - camX, ry + ROAD_WIDTH / 2 - camY);
      ctx.stroke();
    }
    ctx.strokeStyle = PALETTE.lane;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    for (const rx of ROADS_X) {
      ctx.beginPath();
      ctx.moveTo(rx - camX, 0 - camY);
      ctx.lineTo(rx - camX, WORLD_HEIGHT - camY);
      ctx.stroke();
    }
    for (const ry of ROADS_Y) {
      ctx.beginPath();
      ctx.moveTo(0 - camX, ry - camY);
      ctx.lineTo(WORLD_WIDTH - camX, ry - camY);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Buildings: drop shadow, roof, inner roof line, windows on tall ones.
    for (const b of state.buildings) {
      const bx = b.x - camX;
      const by = b.y - camY;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(bx + 6, by + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(bx, by, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx + 5, by + 5, b.w - 10, b.h - 10);
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        for (let wy = by + 16; wy < by + b.h - 12; wy += 24) {
          for (let wx = bx + 14; wx < bx + b.w - 12; wx += 24) {
            ctx.fillRect(wx, wy, 10, 8);
          }
        }
      }
    }
  }

  function drawPickups(state, camX, camY) {
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      const x = pickup.x - camX;
      const y = pickup.y + Math.sin(pickup.bob) * 3 - camY;
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      if (pickup.kind === 'cash') ctx.fillStyle = '#2e8a4a';
      else if (pickup.kind === 'armor') ctx.fillStyle = '#2e6fc2';
      else if (pickup.kind === 'health') ctx.fillStyle = '#c23b2e';
      else ctx.fillStyle = '#c2a13b';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pickup.kind === 'cash' ? '$' : pickup.kind === 'armor' ? 'A' : pickup.kind === 'health' ? '+' : '»', x, y + 1);
    }
  }

  function drawMarker(state, camX, camY, w, h) {
    const marker = currentMarker(state);
    if (!marker) return;
    const pulse = 1 + Math.sin(state.elapsed * 4) * 0.12;
    const x = marker.x - camX;
    const y = marker.y - camY;
    // Off-screen markers are the HUD arrow's job, not this beacon's.
    if (x < -80 || x > w + 80 || y < -80 || y > h + 80) return;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(x, y, 60 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 22 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#20180a';
    // Keep the label on screen when the marker sits near an edge.
    const labelX = Math.max(70, Math.min(w - 70, x));
    ctx.fillText(marker.label, labelX, y - 34);
  }

  function drawCarShape(x, y, angle, color, kind) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const len = kind === 'truck' ? 58 : 46;
    const wid = kind === 'truck' ? 26 : 22;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
    ctx.fillStyle = '#14141a';
    ctx.fillRect(-len / 2 + 2, -wid / 2 - 4, 10, 6);
    ctx.fillRect(-len / 2 + 2, wid / 2 - 2, 10, 6);
    ctx.fillRect(len / 2 - 12, -wid / 2 - 4, 10, 6);
    ctx.fillRect(len / 2 - 12, wid / 2 - 2, 10, 6);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-len / 2, -wid / 2, len, wid, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,30,50,0.85)';
    ctx.beginPath();
    ctx.roundRect(-6, -wid / 2 + 3, 14, wid - 6, 4);
    ctx.fill();
    if (kind === 'taxi') {
      ctx.fillStyle = '#111111';
      for (let i = 0; i < 6; i += 1) ctx.fillRect(-len / 2 + 4 + i * 7, -wid / 2 + 1, 4, 4);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, -wid / 2 - 6);
    }
    ctx.fillStyle = 'rgba(255,255,200,0.9)';
    ctx.fillRect(len / 2 - 2, -wid / 2 + 4, 3, 5);
    ctx.fillRect(len / 2 - 2, wid / 2 - 9, 3, 5);
    ctx.restore();
  }

  function drawCar(car, camX, camY, time, isPlayer) {
    if (isPlayer) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(car.x - camX, car.y - camY, 34 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawCarShape(car.x - camX, car.y - camY, car.angle, car.color, car.kind);
  }

  function drawCruiser(cruiser, camX, camY, time) {
    drawCarShape(cruiser.x - camX, cruiser.y - camY, cruiser.angle, '#1c1c22', 'sedan');
    ctx.save();
    ctx.translate(cruiser.x - camX, cruiser.y - camY);
    ctx.rotate(cruiser.angle);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-8, -11, 16, 22);
    ctx.fillStyle = '#1c1c22';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
    ctx.restore();
    const flashing = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = flashing ? '#ff2e2e' : '#2e6fff';
    ctx.beginPath();
    ctx.arc(cruiser.x - camX - 8, cruiser.y - camY - 12, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flashing ? '#2e6fff' : '#ff2e2e';
    ctx.beginPath();
    ctx.arc(cruiser.x - camX + 8, cruiser.y - camY - 12, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPed(ped, camX, camY) {
    const x = ped.x - camX;
    const y = ped.y - camY;
    if (ped.down > 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(1.2);
      ctx.fillStyle = ped.color;
      ctx.fillRect(-12, -5, 24, 10);
      ctx.fillStyle = '#e8b88a';
      ctx.beginPath();
      ctx.arc(15, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(x + Math.cos(ped.angle) * 3, y + Math.sin(ped.angle) * 3, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCop(cop, camX, camY) {
    const x = cop.x - camX;
    const y = cop.y - camY;
    ctx.fillStyle = '#1c2a4a';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(x + Math.cos(cop.angle) * 3, y + Math.sin(cop.angle) * 3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c2a4a';
    ctx.fillRect(x - 9, y - 14, 18, 4);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', x, y - 16);
  }

  function drawPlayerOnFoot(state, camX, camY) {
    const p = state.player;
    const x = p.x - camX;
    const y = p.y - camY;
    if (p.invuln > 0 && Math.floor(state.elapsed * 12) % 2 === 0) return;
    if (p.punchT > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, 34, p.angle - 0.6, p.angle + 0.6);
      ctx.stroke();
    }
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(x + Math.cos(p.angle) * 7, y + Math.sin(p.angle) * 7, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBullets(state, camX, camY) {
    ctx.strokeStyle = '#ffe14a';
    ctx.lineWidth = 3;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - camX, b.y - camY);
      ctx.lineTo(b.x - b.vx * 0.02 - camX, b.y - b.vy * 0.02 - camY);
      ctx.stroke();
    }
  }

  function drawParticles(state, camX, camY) {
    for (const part of state.parts) {
      ctx.globalAlpha = Math.max(0, part.life / 0.6);
      ctx.fillStyle = part.color;
      ctx.fillRect(part.x - camX - 2, part.y - camY - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  function drawSunset(state, w, h) {
    const amount = sunsetAmount(state.clock);
    if (amount <= 0) return;
    ctx.fillStyle = `rgba(255,120,40,${(amount * 0.14).toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(60,20,80,0)');
    gradient.addColorStop(1, `rgba(60,20,80,${(amount * 0.16).toFixed(3)})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(12,12,20,0.72)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
  }

  function drawTitle(state, w, h, ui) {
    ctx.fillStyle = 'rgba(10,8,24,0.45)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 92px sans-serif';
    ctx.fillText('NEON BAY', w / 2, h / 2 - 110);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('A sun-soaked open-world crime game', w / 2, h / 2 - 66);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#e8e0cc';
    ctx.fillText('Steal cars. Outrun the law. Run three jobs and own the city.', w / 2, h / 2 - 34);
    panel(w / 2 - 330, h / 2 + 6, 660, 118);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.fillText('WASD / arrows - walk and drive      E - enter / exit a car', w / 2, h / 2 + 34);
    ctx.fillText('J - shoot pistol      K - punch      Q - save      P - pause      M - mute', w / 2, h / 2 + 62);
    ctx.fillText('Stealing cars, hitting people and shooting cops raises your wanted level.', w / 2, h / 2 + 90);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Press ENTER or click to start', w / 2, h / 2 + 158);
    if (ui && ui.saveExists) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px sans-serif';
      ctx.fillText('Press C to continue your saved game', w / 2, h / 2 + 188);
    }
    ctx.fillStyle = '#c9c2ae';
    ctx.font = '14px sans-serif';
    ctx.fillText('An original game. No real city, person or brand appears in it.', w / 2, h - 24);
  }

  function drawPaused(w, h) {
    ctx.fillStyle = 'rgba(10,8,24,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('PAUSED', w / 2, h / 2 - 10);
    ctx.font = '20px sans-serif';
    ctx.fillText('Press P or ENTER to keep playing. Q saves the game.', w / 2, h / 2 + 30);
  }

  function drawOver(state, w, h) {
    ctx.fillStyle = 'rgba(10,8,24,0.72)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    const s = state.stats;
    if (state.over === 'complete') {
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 64px sans-serif';
      ctx.fillText('NEON BAY CONQUERED', w / 2, h / 2 - 90);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('ALL MISSIONS COMPLETE', w / 2, h / 2 - 46);
    } else if (state.over === 'busted') {
      ctx.fillStyle = '#6fb5ff';
      ctx.font = 'bold 72px sans-serif';
      ctx.fillText('BUSTED', w / 2, h / 2 - 90);
      ctx.fillStyle = '#ffffff';
      ctx.font = '22px sans-serif';
      ctx.fillText('The Neon Bay PD caught up with you.', w / 2, h / 2 - 46);
    } else {
      ctx.fillStyle = '#ff5a3c';
      ctx.font = 'bold 72px sans-serif';
      ctx.fillText('WASTED', w / 2, h / 2 - 90);
      ctx.fillStyle = '#ffffff';
      ctx.font = '22px sans-serif';
      ctx.fillText('You went down in the streets of Neon Bay.', w / 2, h / 2 - 46);
    }
    panel(w / 2 - 260, h / 2 - 10, 520, 130);
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px sans-serif';
    ctx.fillText(`Cash banked: $${state.cash}`, w / 2, h / 2 + 26);
    ctx.fillText(`Cars stolen: ${s.carsStolen}    Fares done: ${s.faresDone}    Missions: ${state.missionsDone.length}/3`, w / 2, h / 2 + 58);
    ctx.fillText(`Cops down: ${s.copsDown}    Shots fired: ${s.shotsFired}`, w / 2, h / 2 + 90);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Press ENTER to play again', w / 2, h / 2 + 158);
  }

  return { draw, snapTo };
}
