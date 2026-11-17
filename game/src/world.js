// Emberwarden — world.js
// The simulation: the grid, the towers the player builds, the cinders that
// march the ember road, projectiles, particles and the wave economy. It
// knows nothing about drawing or input — main.js feeds it clicks and keys,
// render.js draws what it holds. Each update() drains into this.events so
// the game loop can play the matching sounds.

import {
  CELL,
  FIELD_X,
  FIELD_Y,
  GRID_COLS,
  GRID_ROWS,
  LANTERN_CELL,
  LANTERN_HP,
  MAX_TOWER_LEVEL,
  PATH_CELLS,
  START_GOLD,
  TOTAL_WAVES,
  TOWER_DEFS,
  ENEMY_DEFS,
  WAVE_TABLE,
  sellRefund,
  upgradeCost,
  waveClearBonus,
  waveHpScale,
} from './config.js';

function pathWaypoints() {
  return PATH_CELLS.map(([col, row]) => ({
    x: FIELD_X + col * CELL + CELL / 2,
    y: FIELD_Y + row * CELL + CELL / 2,
  }));
}

function pathLengths(waypoints) {
  const lengths = [0];
  for (let i = 1; i < waypoints.length; i++) {
    const dx = waypoints[i].x - waypoints[i - 1].x;
    const dy = waypoints[i].y - waypoints[i - 1].y;
    lengths.push(lengths[i - 1] + Math.hypot(dx, dy));
  }
  return lengths;
}

export class World {
  constructor(rng) {
    this.rng = rng || Math.random;
    this.waypoints = pathWaypoints();
    this.wayLengths = pathLengths(this.waypoints);
    this.pathLength = this.wayLengths[this.wayLengths.length - 1];
    this.pathSet = new Set(PATH_CELLS.map(([c, r]) => `${c},${r}`));
    this.reset();
  }

  reset() {
    this.gold = START_GOLD;
    this.score = 0;
    this.lanternHp = LANTERN_HP;
    this.wave = 0;
    this.waveState = 'idle'; // idle | spawning | fighting
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.popups = [];
    this.grid = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    this.kills = 0;
    this.goldEarned = 0;
    this.towersBuilt = 0;
    this.time = 0;
    this.shake = 0;
    this.banner = null;
    this.won = false;
    this.lost = false;
    this.events = [];
    this.selectedKind = null;
    this.selectedTower = null;
  }

  cellCenter(col, row) {
    return { x: FIELD_X + col * CELL + CELL / 2, y: FIELD_Y + row * CELL + CELL / 2 };
  }

  isPathCell(col, row) {
    return this.pathSet.has(`${col},${row}`);
  }

  isLanternCell(col, row) {
    return col === LANTERN_CELL[0] && row === LANTERN_CELL[1];
  }

  canBuildAt(col, row) {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
    if (this.isPathCell(col, row)) return false;
    return this.grid[row][col] === null;
  }

  // --- Building ---------------------------------------------------------

  placeTower(col, row) {
    const def = this.selectedKind ? TOWER_DEFS[this.selectedKind] : null;
    if (!def) return false;
    if (!this.canBuildAt(col, row)) {
      this.events.push('denied');
      return false;
    }
    if (this.gold < def.cost) {
      this.events.push('denied');
      return false;
    }
    this.gold -= def.cost;
    const center = this.cellCenter(col, row);
    const tower = {
      col,
      row,
      x: center.x,
      y: center.y,
      def,
      level: 1,
      cooldown: 0,
      angle: -Math.PI / 2,
      invested: def.cost,
      flash: 0,
    };
    this.grid[row][col] = tower;
    this.towers.push(tower);
    this.towersBuilt += 1;
    this.burst(center.x, center.y, def.color, 14, 120);
    this.events.push('place');
    return true;
  }

  towerDamage(tower) {
    return Math.round(tower.def.damage * (1 + 0.6 * (tower.level - 1)));
  }

  towerRange(tower) {
    return tower.def.range * (1 + 0.1 * (tower.level - 1));
  }

  upgradeTower(tower) {
    if (!tower || tower.level >= MAX_TOWER_LEVEL) return false;
    const cost = upgradeCost(tower.def, tower.level);
    if (this.gold < cost) {
      this.events.push('denied');
      return false;
    }
    this.gold -= cost;
    tower.invested += cost;
    tower.level += 1;
    this.burst(tower.x, tower.y, '#ffffff', 18, 160);
    this.popups.push({ x: tower.x, y: tower.y - 26, text: `LEVEL ${tower.level}!`, life: 1.2, maxLife: 1.2, color: '#ffffff' });
    this.events.push('upgrade');
    return true;
  }

  sellTower(tower) {
    if (!tower) return false;
    const refund = sellRefund(tower);
    this.gold += refund;
    this.grid[tower.row][tower.col] = null;
    this.towers = this.towers.filter((t) => t !== tower);
    if (this.selectedTower === tower) this.selectedTower = null;
    this.burst(tower.x, tower.y, '#9aa5c8', 10, 90);
    this.popups.push({ x: tower.x, y: tower.y - 26, text: `+${refund} gold`, life: 1.0, maxLife: 1.0, color: '#ffc857' });
    this.events.push('coin');
    return true;
  }

  // --- Waves ------------------------------------------------------------

  startWave() {
    if (this.waveState !== 'idle' || this.wave >= TOTAL_WAVES || this.won || this.lost) return false;
    this.wave += 1;
    const table = WAVE_TABLE[this.wave - 1];
    this.spawnQueue = [];
    for (const [key, count, gap] of table.groups) {
      for (let i = 0; i < count; i++) this.spawnQueue.push({ key, gap });
    }
    this.spawnTimer = 0.6;
    this.waveState = 'spawning';
    this.showBanner(`WAVE ${this.wave}`, this.wave === TOTAL_WAVES ? 'The Cinder King comes. Hold the flame!' : `${this.spawnQueue.length} cinders on the road`);
    this.events.push('waveHorn');
    return true;
  }

  spawnEnemy(key) {
    const def = ENEMY_DEFS[key];
    const hp = Math.round(def.hp * waveHpScale(this.wave));
    const start = this.waypoints[0];
    this.enemies.push({
      def,
      hp,
      maxHp: hp,
      dist: 0,
      x: start.x,
      y: start.y,
      slowUntil: 0,
      slowFactor: 1,
      radius: def.radius,
      dead: false,
    });
  }

  enemiesRemaining() {
    return this.spawnQueue.length + this.enemies.length;
  }

  // --- Combat -----------------------------------------------------------

  positionOnPath(dist) {
    const lengths = this.wayLengths;
    let i = 1;
    while (i < lengths.length - 1 && lengths[i] < dist) i += 1;
    const segStart = lengths[i - 1];
    const segLen = lengths[i] - segStart || 1;
    const t = Math.min(1, Math.max(0, (dist - segStart) / segLen));
    const a = this.waypoints[i - 1];
    const b = this.waypoints[i];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  damageEnemy(enemy, amount, sourceKind) {
    if (enemy.dead) return;
    enemy.hp -= amount;
    this.events.push('hit');
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  killEnemy(enemy) {
    if (enemy.dead) return;
    enemy.dead = true;
    this.kills += 1;
    this.gold += enemy.def.reward;
    this.goldEarned += enemy.def.reward;
    this.score += enemy.def.score;
    this.burst(enemy.x, enemy.y, enemy.def.color, enemy.def.key === 'boss' ? 46 : 16, 170);
    this.popups.push({ x: enemy.x, y: enemy.y - 18, text: `+${enemy.def.reward}`, life: 0.9, maxLife: 0.9, color: '#ffc857' });
    if (enemy.def.key === 'boss') {
      this.shake = Math.max(this.shake, 10);
      this.events.push('explode');
    } else {
      this.events.push('coin');
    }
  }

  burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const angle = this.rng() * Math.PI * 2;
      const velocity = speed * (0.3 + this.rng() * 0.7);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: 0.45 + this.rng() * 0.4,
        maxLife: 0.85,
        size: 2 + this.rng() * 3,
        color,
      });
    }
  }

  showBanner(text, sub) {
    this.banner = { text, sub: sub || '', timer: 2.2, maxTimer: 2.2 };
  }

  // --- Update -----------------------------------------------------------

  update(dt) {
    this.time += dt;
    this.events = [];
    if (this.banner) {
      this.banner.timer -= dt;
      if (this.banner.timer <= 0) this.banner = null;
    }
    this.shake = Math.max(0, this.shake - dt * 22);

    // Spawning.
    if (this.waveState === 'spawning') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const next = this.spawnQueue.shift();
        if (next) {
          this.spawnEnemy(next.key);
          this.spawnTimer = next.gap;
        }
        if (this.spawnQueue.length === 0) this.waveState = 'fighting';
      }
    }

    // Towers acquire the furthest-along enemy in range and fire.
    for (const tower of this.towers) {
      tower.cooldown -= dt;
      tower.flash = Math.max(0, tower.flash - dt * 6);
      let target = null;
      let bestDist = -1;
      const range = this.towerRange(tower);
      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        const dx = enemy.x - tower.x;
        const dy = enemy.y - tower.y;
        if (dx * dx + dy * dy <= range * range && enemy.dist > bestDist) {
          bestDist = enemy.dist;
          target = enemy;
        }
      }
      if (target) {
        tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
        if (tower.cooldown <= 0) {
          tower.cooldown = 1 / tower.def.rate;
          tower.flash = 1;
          this.projectiles.push({
            x: tower.x + Math.cos(tower.angle) * 20,
            y: tower.y + Math.sin(tower.angle) * 20,
            target,
            speed: tower.def.projectileSpeed,
            damage: this.towerDamage(tower),
            kind: tower.def.key,
            splash: tower.def.splash || 0,
            slowFactor: tower.def.slowFactor || 1,
            slowSeconds: tower.def.slowSeconds || 0,
            color: tower.def.color,
          });
          this.events.push(`shoot:${tower.def.key}`);
        }
      }
    }

    // Projectiles chase their target and burst on arrival.
    for (const proj of this.projectiles) {
      if (proj.target.dead) {
        proj.spent = true;
        continue;
      }
      const dx = proj.target.x - proj.x;
      const dy = proj.target.y - proj.y;
      const dist = Math.hypot(dx, dy);
      const step = proj.speed * dt;
      if (dist <= step + 6) {
        proj.spent = true;
        if (proj.splash > 0) {
          this.burst(proj.target.x, proj.target.y, proj.color, 12, 130);
          this.events.push('explode');
          for (const enemy of this.enemies) {
            if (enemy.dead) continue;
            const ex = enemy.x - proj.target.x;
            const ey = enemy.y - proj.target.y;
            if (Math.hypot(ex, ey) <= proj.splash + enemy.radius) {
              this.damageEnemy(enemy, proj.damage, proj.kind);
            }
          }
        } else {
          this.damageEnemy(proj.target, proj.damage, proj.kind);
          if (proj.slowFactor < 1) {
            proj.target.slowUntil = this.time + proj.slowSeconds;
            proj.target.slowFactor = proj.slowFactor;
          }
          this.burst(proj.target.x, proj.target.y, proj.color, 4, 70);
        }
      } else {
        proj.x += (dx / dist) * step;
        proj.y += (dy / dist) * step;
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.spent);

    // Enemies walk the road; reaching the lantern costs a hit point.
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      let speed = enemy.def.speed * CELL;
      if (this.time < enemy.slowUntil) speed *= enemy.slowFactor;
      enemy.dist += speed * dt;
      if (enemy.dist >= this.pathLength) {
        enemy.dead = true;
        this.lanternHp -= 1;
        this.shake = Math.max(this.shake, 8);
        this.events.push('lanternHit');
        const lantern = this.cellCenter(LANTERN_CELL[0], LANTERN_CELL[1]);
        this.burst(lantern.x, lantern.y, '#ff6b5e', 20, 180);
        if (this.lanternHp <= 0) {
          this.lanternHp = 0;
          this.lost = true;
          this.events.push('defeat');
        }
        continue;
      }
      const pos = this.positionOnPath(enemy.dist);
      enemy.x = pos.x;
      enemy.y = pos.y;
    }
    this.enemies = this.enemies.filter((e) => !e.dead);

    // Particles and popups fade.
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.2 * dt;
      p.vy *= 1 - 2.2 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.popups) p.life -= dt;
    this.popups = this.popups.filter((p) => p.life > 0);

    // Wave cleared: bonus gold and, after the last wave, victory.
    if ((this.waveState === 'fighting' || this.waveState === 'spawning') && this.enemies.length === 0 && this.spawnQueue.length === 0) {
      this.waveState = 'idle';
      if (!this.lost) {
        const bonus = waveClearBonus(this.wave);
        this.gold += bonus;
        this.goldEarned += bonus;
        this.score += this.wave * 100;
        this.showBanner(`WAVE ${this.wave} CLEAR`, `+${bonus} gold bonus`);
        if (this.wave >= TOTAL_WAVES) {
          this.won = true;
          this.events.push('victory');
        } else {
          this.events.push('coin');
        }
      }
    }
  }
}
