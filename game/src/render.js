// Emberwarden — render.js
// Everything the player sees: the field, the towers, the cinders, the HUD,
// the shop panel and every screen (title, pause, game over, victory).
// getButtons() lists the clickable rectangles for the current state so
// main.js can hit-test mouse clicks against exactly what is drawn.

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  CELL,
  FIELD_X,
  FIELD_Y,
  FIELD_WIDTH,
  FIELD_HEIGHT,
  GRID_COLS,
  GRID_ROWS,
  LANTERN_CELL,
  LANTERN_HP,
  MAX_TOWER_LEVEL,
  PANEL_X,
  PANEL_WIDTH,
  PALETTE,
  TOWER_DEFS,
  TOWER_ORDER,
  TOTAL_WAVES,
  upgradeCost,
  sellRefund,
} from './config.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, font, color, align, baseline) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = baseline || 'alphabetic';
  ctx.fillText(str, x, y);
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    // Fixed star positions for the night sky behind the field.
    this.stars = [];
    let seed = 1234567;
    for (let i = 0; i < 90; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      this.stars.push({
        x: (seed % 1280),
        y: (seed % 720),
        r: 0.6 + ((seed >>> 8) % 10) / 10,
        tw: ((seed >>> 16) % 100) / 100,
      });
    }
  }

  draw(game) {
    const ctx = this.ctx;
    const { world, state, input, time } = game;
    ctx.save();
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.drawBackground(time);
    ctx.save();
    if (world.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
    }
    this.drawField(world, input, state, time);
    ctx.restore();
    this.drawBottomBar(world, state);
    this.drawHud(world, state);
    this.drawPanel(world, state, input);
    if (world.banner && state === 'playing') this.drawBanner(world);
    if (state === 'title') this.drawTitle(game);
    if (state === 'paused') this.drawPaused();
    if (state === 'gameover') this.drawGameOver(world);
    if (state === 'victory') this.drawVictory(world);
    ctx.restore();
  }

  // --- Backdrop ---------------------------------------------------------

  drawBackground(time) {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(1, PALETTE.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#ffffff';
    for (const star of this.stars) {
      ctx.globalAlpha = 0.25 + 0.55 * Math.abs(Math.sin(time * 0.7 + star.tw * 6));
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // --- Field ------------------------------------------------------------

  drawField(world, input, state, time) {
    const ctx = this.ctx;
    // Checkerboard ground.
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        ctx.fillStyle = (col + row) % 2 === 0 ? PALETTE.ground : PALETTE.groundAlt;
        ctx.fillRect(FIELD_X + col * CELL, FIELD_Y + row * CELL, CELL, CELL);
      }
    }
    // The ember road.
    ctx.fillStyle = PALETTE.path;
    ctx.strokeStyle = PALETTE.pathEdge;
    ctx.lineWidth = 2;
    for (let i = 0; i < world.waypoints.length - 1; i++) {
      const a = world.waypoints[i];
      const b = world.waypoints[i + 1];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = CELL - 10;
      ctx.strokeStyle = PALETTE.path;
      ctx.stroke();
    }
    // Path edge dots so the road reads at a glance.
    ctx.fillStyle = PALETTE.pathEdge;
    for (const wp of world.waypoints) {
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Grid lines.
    ctx.strokeStyle = PALETTE.gridLine;
    ctx.lineWidth = 1;
    for (let col = 0; col <= GRID_COLS; col++) {
      ctx.beginPath();
      ctx.moveTo(FIELD_X + col * CELL, FIELD_Y);
      ctx.lineTo(FIELD_X + col * CELL, FIELD_Y + FIELD_HEIGHT);
      ctx.stroke();
    }
    for (let row = 0; row <= GRID_ROWS; row++) {
      ctx.beginPath();
      ctx.moveTo(FIELD_X, FIELD_Y + row * CELL);
      ctx.lineTo(FIELD_X + FIELD_WIDTH, FIELD_Y + row * CELL);
      ctx.stroke();
    }

    this.drawLantern(world, time);
    this.drawPlacementGhost(world, input, state);
    for (const tower of world.towers) this.drawTower(tower, world, time);
    for (const enemy of world.enemies) this.drawEnemy(enemy, time);
    for (const proj of world.projectiles) this.drawProjectile(proj);
    for (const p of world.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const p of world.popups) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      text(this.ctx, p.text, p.x, p.y - (1 - p.life / p.maxLife) * 24, 'bold 15px system-ui, sans-serif', p.color, 'center');
    }
    ctx.globalAlpha = 1;
  }

  drawLantern(world, time) {
    const ctx = this.ctx;
    const cx = FIELD_X + LANTERN_CELL[0] * CELL + CELL / 2;
    const cy = FIELD_Y + LANTERN_CELL[1] * CELL + CELL / 2;
    const healthFrac = world.lanternHp / LANTERN_HP;
    const flicker = 0.85 + Math.sin(time * 7) * 0.08 + Math.sin(time * 13.7) * 0.07;
    // Glow.
    const glowR = 70 + 26 * healthFrac * flicker;
    const glow = ctx.createRadialGradient(cx, cy, 6, cx, cy, glowR);
    glow.addColorStop(0, PALETTE.lanternGlow);
    glow.addColorStop(1, 'rgba(255, 200, 90, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fill();
    // Stone base.
    ctx.fillStyle = '#3d4458';
    roundRect(ctx, cx - 22, cy + 6, 44, 22, 5);
    ctx.fill();
    ctx.fillStyle = '#232838';
    roundRect(ctx, cx - 16, cy - 26, 32, 34, 4);
    ctx.fill();
    // The flame itself, shrinking as the lantern loses hit points.
    const flameH = 6 + 22 * healthFrac * flicker;
    ctx.fillStyle = healthFrac > 0 ? PALETTE.lantern : '#5a5148';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 26 - flameH);
    ctx.quadraticCurveTo(cx + 11, cy - 12, cx, cy - 2);
    ctx.quadraticCurveTo(cx - 11, cy - 12, cx, cy - 26 - flameH);
    ctx.fill();
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(cx, cy - 14, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Hit-point pips under the lantern.
    for (let i = 0; i < LANTERN_HP; i++) {
      ctx.fillStyle = i < world.lanternHp ? PALETTE.hpGood : 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(cx - 27 + i * 6, cy + 36, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPlacementGhost(world, input, state) {
    if (state !== 'playing' || !world.selectedKind || !input.mouseInside) return;
    const col = Math.floor((input.mouseX - FIELD_X) / CELL);
    const row = Math.floor((input.mouseY - FIELD_Y) / CELL);
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;
    const ctx = this.ctx;
    const center = world.cellCenter(col, row);
    const def = TOWER_DEFS[world.selectedKind];
    const ok = world.canBuildAt(col, row) && world.gold >= def.cost;
    // Range ring.
    ctx.beginPath();
    ctx.arc(center.x, center.y, def.range, 0, Math.PI * 2);
    ctx.fillStyle = ok ? 'rgba(120, 200, 255, 0.10)' : 'rgba(255, 80, 60, 0.10)';
    ctx.fill();
    ctx.strokeStyle = ok ? 'rgba(120, 200, 255, 0.5)' : 'rgba(255, 80, 60, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Ghost cell.
    ctx.fillStyle = ok ? PALETTE.buildableHover : PALETTE.blocked;
    ctx.fillRect(FIELD_X + col * CELL + 2, FIELD_Y + row * CELL + 2, CELL - 4, CELL - 4);
    ctx.globalAlpha = 0.75;
    this.drawTowerShape(center.x, center.y, def, 1, -Math.PI / 2, 0);
    ctx.globalAlpha = 1;
  }

  drawTowerShape(x, y, def, level, angle, flash) {
    const ctx = this.ctx;
    // Stone base.
    ctx.fillStyle = '#2e3550';
    roundRect(ctx, x - 22, y - 18, 44, 40, 6);
    ctx.fill();
    ctx.fillStyle = '#46527a';
    roundRect(ctx, x - 22, y - 18, 44, 10, 5);
    ctx.fill();
    // Barrel toward the aim angle.
    ctx.strokeStyle = def.dark;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * 20, y + Math.sin(angle) * 20);
    ctx.stroke();
    // Coloured crystal.
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.moveTo(x, y - 16);
    ctx.lineTo(x + 12, y);
    ctx.lineTo(x, y + 12);
    ctx.lineTo(x - 12, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x + 5, y - 1);
    ctx.lineTo(x, y + 4);
    ctx.lineTo(x - 5, y - 1);
    ctx.closePath();
    ctx.fill();
    if (flash > 0) {
      ctx.globalAlpha = flash * 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Level pips.
    for (let i = 0; i < level; i++) {
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(x - 10 + i * 10, y + 27, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawTower(tower, world, time) {
    const selected = world.selectedTower === tower;
    if (selected) {
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, world.towerRange(tower), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 200, 87, 0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 200, 87, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(FIELD_X + tower.col * CELL + 2, FIELD_Y + tower.row * CELL + 2, CELL - 4, CELL - 4);
    }
    this.drawTowerShape(tower.x, tower.y, tower.def, tower.level, tower.angle, tower.flash);
  }

  drawEnemy(enemy, time) {
    const ctx = this.ctx;
    const slowed = time < enemy.slowUntil;
    const wobble = Math.sin(time * 9 + enemy.dist * 0.05) * 2;
    // Glow.
    const glow = ctx.createRadialGradient(enemy.x, enemy.y, 2, enemy.x, enemy.y, enemy.radius + 12);
    glow.addColorStop(0, enemy.def.color + '55');
    glow.addColorStop(1, enemy.def.color + '00');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 12, 0, Math.PI * 2);
    ctx.fill();
    // Body.
    const body = ctx.createRadialGradient(enemy.x - 4, enemy.y - 5, 2, enemy.x, enemy.y, enemy.radius);
    body.addColorStop(0, '#ffe9c9');
    body.addColorStop(0.35, enemy.def.color);
    body.addColorStop(1, '#3a1408');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y + wobble * 0.3, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    // Boss crown.
    if (enemy.def.key === 'boss') {
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.35;
        ctx.lineTo(enemy.x + Math.cos(a) * (enemy.radius + 8), enemy.y + wobble * 0.3 + Math.sin(a) * (enemy.radius + 8));
      }
      ctx.closePath();
      ctx.fill();
    }
    // Eyes, looking down the road.
    ctx.fillStyle = '#1a0b06';
    ctx.beginPath();
    ctx.arc(enemy.x - 5, enemy.y - 2 + wobble * 0.3, 2.6, 0, Math.PI * 2);
    ctx.arc(enemy.x + 5, enemy.y - 2 + wobble * 0.3, 2.6, 0, Math.PI * 2);
    ctx.fill();
    // Frost ring while chilled.
    if (slowed) {
      ctx.strokeStyle = PALETTE.frost;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y + wobble * 0.3, enemy.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Health bar when hurt.
    if (enemy.hp < enemy.maxHp) {
      const w = enemy.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 11, w, 5);
      ctx.fillStyle = enemy.hp / enemy.maxHp > 0.4 ? PALETTE.hpGood : PALETTE.hp;
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 11, w * (enemy.hp / enemy.maxHp), 5);
    }
  }

  drawProjectile(proj) {
    const ctx = this.ctx;
    ctx.fillStyle = proj.color;
    ctx.shadowColor = proj.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.kind === 'ember' ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // --- HUD (top bar over the field) -------------------------------------

  drawHud(world, state) {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.hudBg;
    ctx.fillRect(0, 0, FIELD_WIDTH, 64);
    ctx.fillStyle = PALETTE.hudLine;
    ctx.fillRect(0, 63, FIELD_WIDTH, 1);
    // Gold.
    text(ctx, '◆', 20, 40, 'bold 22px system-ui, sans-serif', PALETTE.gold);
    text(ctx, `${world.gold}`, 46, 40, 'bold 24px system-ui, sans-serif', PALETTE.text);
    text(ctx, 'GOLD', 46, 56, '11px system-ui, sans-serif', PALETTE.textDim);
    // Score.
    text(ctx, 'SCORE', 200, 26, '11px system-ui, sans-serif', PALETTE.textDim);
    text(ctx, `${world.score}`, 200, 50, 'bold 22px system-ui, sans-serif', PALETTE.text);
    // Wave.
    text(ctx, 'WAVE', 380, 26, '11px system-ui, sans-serif', PALETTE.textDim);
    text(ctx, `${Math.max(1, world.wave)}/${TOTAL_WAVES}`, 380, 50, 'bold 22px system-ui, sans-serif', PALETTE.text);
    // Lantern hit points.
    text(ctx, 'LANTERN', 520, 26, '11px system-ui, sans-serif', PALETTE.textDim);
    for (let i = 0; i < LANTERN_HP; i++) {
      ctx.fillStyle = i < world.lanternHp ? '#ff9d5c' : 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.arc(528 + i * 17, 42, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cinders left this wave.
    const left = world.enemiesRemaining();
    text(ctx, 'CINDERS LEFT', 730, 26, '11px system-ui, sans-serif', PALETTE.textDim);
    text(ctx, `${left}`, 730, 50, 'bold 22px system-ui, sans-serif', left > 0 ? PALETTE.text : PALETTE.textDim);
    // Wave button.
    const btn = this.waveButtonRect();
    const fighting = world.waveState !== 'idle';
    ctx.fillStyle = fighting ? '#232a4a' : PALETTE.button;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 8);
    ctx.fill();
    ctx.strokeStyle = fighting ? PALETTE.hudLine : PALETTE.gold;
    ctx.lineWidth = 1.5;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 8);
    ctx.stroke();
    const label = fighting
      ? `WAVE ${world.wave}…`
      : world.wave >= TOTAL_WAVES
        ? 'FINAL WAVE ▶'
        : `START WAVE ${world.wave + 1} ▶`;
    text(ctx, label, btn.x + btn.w / 2, btn.y + 25, 'bold 15px system-ui, sans-serif', fighting ? PALETTE.textDim : PALETTE.buttonText, 'center');
  }

  waveButtonRect() {
    return { x: 880, y: 12, w: 136, h: 40 };
  }

  // --- Bottom strip -------------------------------------------------------

  drawBottomBar(world, state) {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.hudBg;
    ctx.fillRect(0, 648, FIELD_WIDTH, 72);
    ctx.fillStyle = PALETTE.hudLine;
    ctx.fillRect(0, 648, FIELD_WIDTH, 1);
    let hint = 'Pick a tower on the right, then click a glowing plot to build it.  [1/2/3] pick tower   [Space] start wave   [P] pause   [M] mute';
    if (state === 'playing' && world.waveState === 'idle' && world.wave === 0) {
      hint = 'Build your first towers, then press SPACE or START WAVE 1 when ready.';
    } else if (state === 'playing' && world.waveState !== 'idle') {
      hint = `Wave ${world.wave} in progress — ${world.enemiesRemaining()} cinders left. Frost slows them; Ember Cannon bursts groups.`;
    } else if (state === 'playing' && world.wave > 0 && world.wave < TOTAL_WAVES) {
      hint = 'Wave cleared! Spend the bonus gold, then start the next wave when ready.';
    }
    text(ctx, hint, 16, 690, '14px system-ui, sans-serif', PALETTE.textDim);
    text(ctx, `Kills ${world.kills}   •   Gold earned ${world.goldEarned}   •   Towers built ${world.towersBuilt}`, 16, 710, '12px system-ui, sans-serif', PALETTE.textDim);
  }

  // --- Shop panel (right) -------------------------------------------------

  drawPanel(world, state, input) {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.panelBg;
    ctx.fillRect(PANEL_X, 0, PANEL_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = PALETTE.panelLine;
    ctx.fillRect(PANEL_X, 0, 1, CANVAS_HEIGHT);
    text(ctx, 'BUILD', PANEL_X + 16, 30, 'bold 18px system-ui, sans-serif', PALETTE.text);
    text(ctx, 'click a card, then a plot', PANEL_X + 16, 48, '12px system-ui, sans-serif', PALETTE.textDim);

    TOWER_ORDER.forEach((key, i) => {
      const def = TOWER_DEFS[key];
      const y = 60 + i * 118;
      const card = { x: PANEL_X + 10, y, w: PANEL_WIDTH - 20, h: 106 };
      const selected = world.selectedKind === key;
      const afford = world.gold >= def.cost;
      ctx.fillStyle = selected ? '#2a3766' : '#1a2140';
      roundRect(ctx, card.x, card.y, card.w, card.h, 8);
      ctx.fill();
      ctx.strokeStyle = selected ? PALETTE.gold : PALETTE.panelLine;
      ctx.lineWidth = selected ? 2 : 1;
      roundRect(ctx, card.x, card.y, card.w, card.h, 8);
      ctx.stroke();
      // Colour chip.
      ctx.fillStyle = def.color;
      roundRect(ctx, card.x + 10, card.y + 10, 34, 34, 6);
      ctx.fill();
      text(ctx, def.short[0], card.x + 27, card.y + 35, 'bold 20px system-ui, sans-serif', '#1a0b06', 'center');
      text(ctx, def.name, card.x + 54, card.y + 26, 'bold 15px system-ui, sans-serif', PALETTE.text);
      text(ctx, `◆ ${def.cost} gold`, card.x + 54, card.y + 46, 'bold 13px system-ui, sans-serif', afford ? PALETTE.gold : PALETTE.danger);
      text(ctx, `DMG ${def.damage}  •  RNG ${(def.range / CELL).toFixed(1)}`, card.x + 12, card.y + 68, '12px system-ui, sans-serif', PALETTE.textDim);
      text(ctx, def.blurb, card.x + 12, card.y + 88, '12px system-ui, sans-serif', PALETTE.textDim);
      // Hotkey badge.
      ctx.fillStyle = '#0d1226';
      roundRect(ctx, card.x + card.w - 30, card.y + 8, 22, 22, 5);
      ctx.fill();
      text(ctx, def.hotkey, card.x + card.w - 19, card.y + 24, 'bold 13px system-ui, sans-serif', PALETTE.textDim, 'center');
    });

    // Selected tower box.
    const boxY = 424;
    text(ctx, 'TOWER', PANEL_X + 16, boxY, 'bold 14px system-ui, sans-serif', PALETTE.textDim);
    if (world.selectedTower) {
      const t = world.selectedTower;
      text(ctx, `${t.def.name}  •  Lv ${t.level}`, PANEL_X + 16, boxY + 24, 'bold 16px system-ui, sans-serif', PALETTE.text);
      text(ctx, `Damage ${world.towerDamage(t)}   Range ${(world.towerRange(t) / CELL).toFixed(1)}`, PANEL_X + 16, boxY + 46, '13px system-ui, sans-serif', PALETTE.textDim);
      const up = this.upgradeButtonRect();
      const maxed = t.level >= MAX_TOWER_LEVEL;
      const cost = maxed ? 0 : upgradeCost(t.def, t.level);
      const afford = !maxed && world.gold >= cost;
      ctx.fillStyle = maxed ? '#232a4a' : afford ? PALETTE.button : '#3a2030';
      roundRect(ctx, up.x, up.y, up.w, up.h, 8);
      ctx.fill();
      text(ctx, maxed ? 'MAX LEVEL' : `UPGRADE ◆ ${cost}`, up.x + up.w / 2, up.y + 24, 'bold 14px system-ui, sans-serif', maxed ? PALETTE.textDim : PALETTE.buttonText, 'center');
      const sell = this.sellButtonRect();
      ctx.fillStyle = '#40202c';
      roundRect(ctx, sell.x, sell.y, sell.w, sell.h, 8);
      ctx.fill();
      text(ctx, `SELL +${sellRefund(t)}`, sell.x + sell.w / 2, sell.y + 24, 'bold 14px system-ui, sans-serif', '#ffb3ab', 'center');
    } else {
      text(ctx, 'Click a built tower to', PANEL_X + 16, boxY + 26, '13px system-ui, sans-serif', PALETTE.textDim);
      text(ctx, 'upgrade or sell it.', PANEL_X + 16, boxY + 46, '13px system-ui, sans-serif', PALETTE.textDim);
    }

    // Pause and mute at the bottom of the panel.
    const pause = this.pauseButtonRect();
    ctx.fillStyle = PALETTE.button;
    roundRect(ctx, pause.x, pause.y, pause.w, pause.h, 8);
    ctx.fill();
    text(ctx, state === 'paused' ? 'RESUME' : 'PAUSE [P]', pause.x + pause.w / 2, pause.y + 24, 'bold 13px system-ui, sans-serif', PALETTE.buttonText, 'center');
    const mute = this.muteButtonRect();
    ctx.fillStyle = PALETTE.button;
    roundRect(ctx, mute.x, mute.y, mute.w, mute.h, 8);
    ctx.fill();
    text(ctx, 'SOUND [M]', mute.x + mute.w / 2, mute.y + 24, 'bold 13px system-ui, sans-serif', PALETTE.buttonText, 'center');
    text(ctx, 'Goal: survive all 10 waves.', PANEL_X + 16, 672, '12px system-ui, sans-serif', PALETTE.textDim);
    text(ctx, 'If a cinder reaches the lantern,', PANEL_X + 16, 690, '12px system-ui, sans-serif', PALETTE.textDim);
    text(ctx, 'the flame loses 1 HP.', PANEL_X + 16, 708, '12px system-ui, sans-serif', PALETTE.textDim);
  }

  upgradeButtonRect() {
    return { x: PANEL_X + 10, y: 478, w: PANEL_WIDTH - 20, h: 34 };
  }

  sellButtonRect() {
    return { x: PANEL_X + 10, y: 520, w: PANEL_WIDTH - 20, h: 34 };
  }

  pauseButtonRect() {
    return { x: PANEL_X + 10, y: 580, w: 108, h: 34 };
  }

  muteButtonRect() {
    return { x: PANEL_X + 122, y: 580, w: 108, h: 34 };
  }

  // --- Banners ------------------------------------------------------------

  drawBanner(world) {
    const ctx = this.ctx;
    const b = world.banner;
    const alpha = Math.min(1, b.timer / 0.6, (b.maxTimer - b.timer) / 0.25 + 0.2);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    const cx = FIELD_WIDTH / 2;
    text(ctx, b.text, cx, 180, 'bold 44px Georgia, serif', PALETTE.gold, 'center');
    if (b.sub) text(ctx, b.sub, cx, 210, '16px system-ui, sans-serif', PALETTE.text, 'center');
    ctx.globalAlpha = 1;
  }

  // --- Screens ------------------------------------------------------------

  drawTitle(game) {
    const ctx = this.ctx;
    const { world, bestScore, time } = game;
    ctx.fillStyle = 'rgba(5, 8, 20, 0.72)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    // Lantern emblem.
    const cx = CANVAS_WIDTH / 2;
    const glow = ctx.createRadialGradient(cx, 218, 4, cx, 218, 120);
    glow.addColorStop(0, 'rgba(255, 200, 90, 0.5)');
    glow.addColorStop(1, 'rgba(255, 200, 90, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, 218, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.lantern;
    ctx.beginPath();
    ctx.moveTo(cx, 178);
    ctx.quadraticCurveTo(cx + 18, 210, cx, 236);
    ctx.quadraticCurveTo(cx - 18, 210, cx, 178);
    ctx.fill();
    text(ctx, 'EMBERWARDEN', cx, 300, 'bold 64px Georgia, serif', PALETTE.text, 'center');
    text(ctx, 'Defend the Last Lantern', cx, 336, 'italic 22px Georgia, serif', PALETTE.gold, 'center');
    text(ctx, 'Cinders march the ember road. Build towers, hold 10 waves, keep the flame alive.', cx, 380, '17px system-ui, sans-serif', PALETTE.textDim, 'center');
    text(ctx, 'Mouse: pick a tower, click a plot to build  •  1/2/3 pick tower  •  Space starts a wave  •  P pauses', cx, 408, '15px system-ui, sans-serif', PALETTE.textDim, 'center');
    if (bestScore > 0) {
      text(ctx, `Best score: ${bestScore}`, cx, 444, 'bold 16px system-ui, sans-serif', PALETTE.gold, 'center');
    }
    const btn = this.titleButtonRect();
    const pulse = 0.85 + Math.sin(time * 3) * 0.15;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.button;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 10);
    ctx.fill();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 10);
    ctx.stroke();
    ctx.globalAlpha = 1;
    text(ctx, 'BEGIN THE DEFENCE', btn.x + btn.w / 2, btn.y + 36, 'bold 22px system-ui, sans-serif', PALETTE.buttonText, 'center');
    text(ctx, 'or press Enter', cx, btn.y + btn.h + 26, '13px system-ui, sans-serif', PALETTE.textDim, 'center');
  }

  titleButtonRect() {
    return { x: CANVAS_WIDTH / 2 - 160, y: 480, w: 320, h: 56 };
  }

  drawPaused() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(5, 8, 20, 0.66)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    text(ctx, 'PAUSED', CANVAS_WIDTH / 2, 330, 'bold 56px Georgia, serif', PALETTE.text, 'center');
    text(ctx, 'Press P or click RESUME to keep defending.', CANVAS_WIDTH / 2, 372, '16px system-ui, sans-serif', PALETTE.textDim, 'center');
    const btn = this.resumeButtonRect();
    ctx.fillStyle = PALETTE.button;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 10);
    ctx.fill();
    text(ctx, 'RESUME', btn.x + btn.w / 2, btn.y + 34, 'bold 20px system-ui, sans-serif', PALETTE.buttonText, 'center');
  }

  resumeButtonRect() {
    return { x: CANVAS_WIDTH / 2 - 110, y: 400, w: 220, h: 52 };
  }

  drawEndStats(world, y) {
    const ctx = this.ctx;
    const cx = CANVAS_WIDTH / 2;
    const rows = [
      ['Waves held', `${Math.min(world.wave, TOTAL_WAVES)} / ${TOTAL_WAVES}`],
      ['Score', `${world.score}`],
      ['Cinders destroyed', `${world.kills}`],
      ['Gold earned', `${world.goldEarned}`],
      ['Towers built', `${world.towersBuilt}`],
    ];
    rows.forEach(([label, value], i) => {
      text(ctx, label, cx - 170, y + i * 32, '16px system-ui, sans-serif', PALETTE.textDim);
      text(ctx, value, cx + 170, y + i * 32, 'bold 16px system-ui, sans-serif', PALETTE.text, 'right');
    });
  }

  drawGameOver(world) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(20, 4, 8, 0.78)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    text(ctx, 'THE FLAME HAS DIED', CANVAS_WIDTH / 2, 210, 'bold 56px Georgia, serif', PALETTE.danger, 'center');
    text(ctx, 'The cinders snuffed out the Last Lantern.', CANVAS_WIDTH / 2, 250, '18px Georgia, serif', PALETTE.text, 'center');
    this.drawEndStats(world, 300);
    const btn = this.retryButtonRect();
    ctx.fillStyle = PALETTE.button;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 10);
    ctx.fill();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 10);
    ctx.stroke();
    text(ctx, 'TRY AGAIN', btn.x + btn.w / 2, btn.y + 36, 'bold 22px system-ui, sans-serif', PALETTE.buttonText, 'center');
    text(ctx, 'or press Enter', CANVAS_WIDTH / 2, btn.y + btn.h + 26, '13px system-ui, sans-serif', PALETTE.textDim, 'center');
  }

  retryButtonRect() {
    return { x: CANVAS_WIDTH / 2 - 140, y: 500, w: 280, h: 56 };
  }

  drawVictory(world) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10, 14, 4, 0.72)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    text(ctx, '★  THE LANTERN ENDURES  ★', CANVAS_WIDTH / 2, 210, 'bold 48px Georgia, serif', PALETTE.gold, 'center');
    text(ctx, 'All 10 waves held. Dawn breaks over the ember road.', CANVAS_WIDTH / 2, 250, '18px Georgia, serif', PALETTE.text, 'center');
    this.drawEndStats(world, 300);
    const btn = this.retryButtonRect();
    ctx.fillStyle = PALETTE.button;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 10);
    ctx.fill();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 10);
    ctx.stroke();
    text(ctx, 'PLAY AGAIN', btn.x + btn.w / 2, btn.y + 36, 'bold 22px system-ui, sans-serif', PALETTE.buttonText, 'center');
    text(ctx, 'or press Enter', CANVAS_WIDTH / 2, btn.y + btn.h + 26, '13px system-ui, sans-serif', PALETTE.textDim, 'center');
  }
}

// The clickable rectangles for a state, so main.js hit-tests exactly what
// is drawn. Each entry: { id, x, y, w, h, enabled }. The rect helpers live
// on the Renderer prototype, so a throwaway instance is enough to read them.
const rectReader = new Renderer(document.createElement('canvas'));

export function getButtons(state, world) {
  const renderer = rectReader;
  const buttons = [];
  const wave = renderer.waveButtonRect();
  buttons.push({ id: 'wave', ...wave, enabled: state === 'playing' && world.waveState === 'idle' && world.wave < TOTAL_WAVES });
  const pause = renderer.pauseButtonRect();
  buttons.push({ id: 'pause', ...pause, enabled: state === 'playing' || state === 'paused' });
  const mute = renderer.muteButtonRect();
  buttons.push({ id: 'mute', ...mute, enabled: true });
  for (let i = 0; i < TOWER_ORDER.length; i++) {
    buttons.push({ id: `shop:${TOWER_ORDER[i]}`, x: PANEL_X + 10, y: 60 + i * 118, w: PANEL_WIDTH - 20, h: 106, enabled: state === 'playing' });
  }
  const up = renderer.upgradeButtonRect();
  buttons.push({ id: 'upgrade', ...up, enabled: state === 'playing' && !!world.selectedTower && world.selectedTower.level < MAX_TOWER_LEVEL });
  const sell = renderer.sellButtonRect();
  buttons.push({ id: 'sell', ...sell, enabled: state === 'playing' && !!world.selectedTower });
  buttons.push({ id: 'title', ...renderer.titleButtonRect(), enabled: state === 'title' });
  buttons.push({ id: 'resume', ...renderer.resumeButtonRect(), enabled: state === 'paused' });
  buttons.push({ id: 'retry', ...renderer.retryButtonRect(), enabled: state === 'gameover' || state === 'victory' });
  return buttons;
}
