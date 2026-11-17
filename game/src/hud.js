// The HUD: cash, health, armor, ammo, wanted stars, clock, mission objective,
// message line, controls hint, and the minimap with the player, cars, police
// and the mission marker. Drawn over the world every play frame.
import { WORLD_WIDTH, WORLD_HEIGHT, ROADS_X, ROADS_Y, clockString } from './config.js';
import { currentMarker, missionObjective } from './missions.js';

const MAP_W = 220;
const MAP_H = 165;

export function drawHud(ctx, state, w, h, camX, camY) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  drawStatus(ctx, state);
  drawWanted(ctx, state, w);
  drawObjective(ctx, state, w);
  drawMinimap(ctx, state, w, h);
  drawMessage(ctx, state, w, h);
  drawHint(ctx, w, h);
  drawOffscreenMarker(ctx, state, w, h, camX, camY);
}

function chip(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(12,12,20,0.72)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
}

function drawStatus(ctx, state) {
  chip(ctx, 14, 14, 250, 96);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(`$${state.cash}`, 26, 46);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('HEALTH', 26, 66);
  bar(ctx, 90, 56, 150, 10, state.health / 100, '#3fd45a');
  ctx.fillText('ARMOR', 26, 86);
  bar(ctx, 90, 76, 150, 10, state.armor / 100, '#4a90e8');
  ctx.fillStyle = state.ammo > 0 ? '#ffd94a' : '#ff5a3c';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`PISTOL  ${state.ammo}`, 26, 100);
}

function drawStar(ctx, x, y, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(angle) * rad;
    const py = y + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd94a' : 'rgba(255,255,255,0.25)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawWanted(ctx, state, w) {
  chip(ctx, w - 264, 14, 250, 66);
  for (let i = 0; i < 5; i += 1) {
    drawStar(ctx, w - 238 + i * 30, 40, 13, i < state.wanted);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(clockString(state.clock), w - 26, 66);
  ctx.textAlign = 'left';
  if (state.wanted >= 3) {
    ctx.fillStyle = '#ff5a3c';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('HEAT IS ON', w - 264, 98);
  }
}

function drawObjective(ctx, state, w) {
  const text = missionObjective(state);
  ctx.font = 'bold 16px sans-serif';
  const textW = ctx.measureText(text).width;
  const boxW = Math.min(w - 560, textW + 28);
  chip(ctx, (w - boxW) / 2, 14, boxW, 36);
  ctx.fillStyle = '#ffd94a';
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, 38);
  ctx.textAlign = 'left';
}

function drawMinimap(ctx, state, w, h) {
  const mx = 14;
  const my = h - MAP_H - 14;
  chip(ctx, mx - 6, my - 6, MAP_W + 12, MAP_H + 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, MAP_W, MAP_H);
  ctx.clip();
  ctx.fillStyle = '#2a2620';
  ctx.fillRect(mx, my, MAP_W, MAP_H);
  const sx = MAP_W / WORLD_WIDTH;
  const sy = MAP_H / WORLD_HEIGHT;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (const rx of ROADS_X) {
    ctx.beginPath();
    ctx.moveTo(mx + rx * sx, my);
    ctx.lineTo(mx + rx * sx, my + MAP_H);
    ctx.stroke();
  }
  for (const ry of ROADS_Y) {
    ctx.beginPath();
    ctx.moveTo(mx, my + ry * sy);
    ctx.lineTo(mx + MAP_W, my + ry * sy);
    ctx.stroke();
  }
  const dot = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx + x * sx, my + y * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const car of state.cars) dot(car.x, car.y, 2.5, car.missionTaxi ? '#7dff8a' : '#e8b81c');
  for (const cruiser of state.cruisers) dot(cruiser.x, cruiser.y, 3, '#ff2e2e');
  for (const cop of state.cops) dot(cop.x, cop.y, 2.5, '#2e6fff');
  const marker = currentMarker(state);
  if (marker) {
    const pulse = 3 + Math.sin(state.elapsed * 5) * 1.5;
    dot(marker.x, marker.y, pulse, '#ffd94a');
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx + marker.x * sx, my + marker.y * sy, pulse + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  const p = state.player;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(mx + p.x * sx, my + p.y * sy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('NEON BAY', mx, my - 10);
}

function drawMessage(ctx, state, w, h) {
  if (state.msgT <= 0 || !state.msg) return;
  ctx.font = 'bold 18px sans-serif';
  const textW = ctx.measureText(state.msg).width;
  chip(ctx, (w - textW) / 2 - 14, h - 96, textW + 28, 34);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(state.msg, w / 2, h - 72);
  ctx.textAlign = 'left';
}

function drawHint(ctx, w, h) {
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('WASD move/drive - E car - J shoot - K punch - Q save - P pause', w - 16, h - 18);
  ctx.textAlign = 'left';
}

function drawOffscreenMarker(ctx, state, w, h, camX, camY) {
  const marker = currentMarker(state);
  if (!marker) return;
  const p = state.player;
  const dx = marker.x - p.x;
  const dy = marker.y - p.y;
  const distToMarker = Math.sqrt(dx * dx + dy * dy);
  if (distToMarker < 500) return;
  const angle = Math.atan2(dy, dx);
  const cx = w / 2 + Math.cos(angle) * (Math.min(w, h) / 2 - 70);
  const cy = h / 2 + Math.sin(angle) * (Math.min(w, h) / 2 - 70);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffd94a';
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(marker.label, cx, cy + 30);
  ctx.textAlign = 'left';
}
