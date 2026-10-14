/**
 * SLICE IT: Ninja Mode - Procedural Canvas Fruits & Bombs
 * Zero image assets: 100% vector-rendered arcade fruits (Watermelon,
 * Orange, Strawberry, Green Apple, Banana, Dragonfruit) and glowing Bombs
 * with arc physics, rotation, half-tumble splitting, and sparking fuses.
 */

(function (window) {
  'use strict';

  const FRUIT_TYPES = [
    {
      type: 'watermelon',
      name: 'Watermelon',
      radius: 44,
      points: 50,
      color: '#ff2247',
      rindColor: '#1d8348',
      juiceColor: '#ff2247',
      fleshColor: '#ff2e55'
    },
    {
      type: 'orange',
      name: 'Orange',
      radius: 36,
      points: 30,
      color: '#ff7700',
      rindColor: '#ff9900',
      juiceColor: '#ff8800',
      fleshColor: '#ffaa00'
    },
    {
      type: 'strawberry',
      name: 'Strawberry',
      radius: 32,
      points: 35,
      color: '#e60039',
      rindColor: '#27ae60',
      juiceColor: '#e60039',
      fleshColor: '#ff3366'
    },
    {
      type: 'apple',
      name: 'Green Apple',
      radius: 35,
      points: 25,
      color: '#76d7c4',
      rindColor: '#52be80',
      juiceColor: '#82e0aa',
      fleshColor: '#e8f8f5'
    },
    {
      type: 'banana',
      name: 'Banana',
      radius: 38,
      points: 30,
      color: '#f4d03f',
      rindColor: '#f7dc6f',
      juiceColor: '#f9e79f',
      fleshColor: '#fffde7'
    },
    {
      type: 'dragonfruit',
      name: 'Dragonfruit',
      radius: 40,
      points: 100,
      color: '#e91e63',
      rindColor: '#2ecc71',
      juiceColor: '#e91e63',
      fleshColor: '#f5f5f5'
    }
  ];

  class FruitHalf {
    constructor(def, x, y, vx, vy, rotation, vRot, isLeftHalf, cutAngle) {
      this.def = def;
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.rotation = rotation;
      this.vRot = vRot;
      this.isLeftHalf = isLeftHalf;
      this.cutAngle = cutAngle;
      this.alpha = 1.0;
      this.life = 1.6;
      this.maxLife = 1.6;
      this.active = true;
    }

    update(dt) {
      this.life -= dt;
      if (this.life <= 0) {
        this.active = false;
        return;
      }
      this.vy += 800 * dt; // Gravity
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rotation += this.vRot * dt;

      if (this.life < 0.5) {
        this.alpha = this.life / 0.5;
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      // Clip half along local horizontal cut line
      ctx.beginPath();
      if (this.isLeftHalf) {
        ctx.rect(-this.def.radius * 1.5, -this.def.radius * 1.5, this.def.radius * 3, this.def.radius * 1.5);
      } else {
        ctx.rect(-this.def.radius * 1.5, 0, this.def.radius * 3, this.def.radius * 1.5);
      }
      ctx.clip();

      // Render the original fruit appearance
      FruitRenderer.drawFruit(ctx, this.def);

      ctx.restore();
    }
  }

  class Fruit {
    constructor(def, x, y, vx, vy) {
      this.def = def;
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.radius = def.radius;
      this.rotation = Math.random() * Math.PI * 2;
      this.vRot = NinjaMath.randomRange(-3.5, 3.5);
      this.sliced = false;
      this.active = true;
      this.isBomb = false;
    }

    update(dt) {
      if (!this.active || this.sliced) return;

      this.vy += 700 * dt; // Gravity
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rotation += this.vRot * dt;

      // Deactivate if fallen off bottom
      if (this.vy > 0 && this.y > window.innerHeight + 120) {
        this.active = false;
      }
    }

    draw(ctx) {
      if (!this.active || this.sliced) return;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      FruitRenderer.drawFruit(ctx, this.def);

      ctx.restore();
    }

    slice(slashAngle, slashSpeed) {
      this.sliced = true;
      this.active = false;

      // Normal vector
      const nx = -Math.sin(slashAngle);
      const ny = Math.cos(slashAngle);
      const pushSpeed = NinjaMath.randomRange(180, 280);

      // Half 1
      const h1 = new FruitHalf(
        this.def,
        this.x,
        this.y,
        this.vx + nx * pushSpeed,
        this.vy + ny * pushSpeed,
        this.rotation,
        this.vRot + NinjaMath.randomRange(1.5, 3.5),
        true,
        slashAngle
      );

      // Half 2
      const h2 = new FruitHalf(
        this.def,
        this.x,
        this.y,
        this.vx - nx * pushSpeed,
        this.vy - ny * pushSpeed,
        this.rotation,
        this.vRot - NinjaMath.randomRange(1.5, 3.5),
        false,
        slashAngle
      );

      return [h1, h2];
    }
  }

  class Bomb {
    constructor(x, y, vx, vy) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.radius = 38;
      this.rotation = 0;
      this.vRot = NinjaMath.randomRange(-2, 2);
      this.fuseTime = 0;
      this.sliced = false;
      this.active = true;
      this.isBomb = true;
      this.pulsePhase = 0;
    }

    update(dt) {
      if (!this.active || this.sliced) return;

      this.vy += 650 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rotation += this.vRot * dt;
      this.fuseTime += dt;
      this.pulsePhase += dt * 8;

      if (this.vy > 0 && this.y > window.innerHeight + 120) {
        this.active = false;
      }
    }

    draw(ctx) {
      if (!this.active || this.sliced) return;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      const r = this.radius;

      // Ominous pulsating red aura
      const pulse = 0.5 + 0.5 * Math.sin(this.pulsePhase);
      ctx.shadowColor = `rgba(255, 30, 30, ${0.4 + pulse * 0.5})`;
      ctx.shadowBlur = 15 + pulse * 18;

      // Iron sphere
      const sphereGrad = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
      sphereGrad.addColorStop(0, '#555e69');
      sphereGrad.addColorStop(0.5, '#1e2229');
      sphereGrad.addColorStop(1, '#0d0f12');

      ctx.fillStyle = sphereGrad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // Red Hazard Emblem / Skull ring in center
      ctx.strokeStyle = `rgba(255, 50, 50, ${0.7 + pulse * 0.3})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      ctx.stroke();

      // Hazard Cross / "X"
      ctx.beginPath();
      const crossSize = r * 0.22;
      ctx.moveTo(-crossSize, -crossSize);
      ctx.lineTo(crossSize, crossSize);
      ctx.moveTo(crossSize, -crossSize);
      ctx.lineTo(-crossSize, crossSize);
      ctx.stroke();

      // Specular highlight on shell
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.4, -r * 0.4, r * 0.3, r * 0.15, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();

      // Brass fuse collar
      ctx.fillStyle = '#b7950b';
      ctx.fillRect(-r * 0.2, -r - 6, r * 0.4, 8);

      // Fuse rope
      ctx.strokeStyle = '#d4ac0d';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -r - 6);
      ctx.bezierCurveTo(8, -r - 18, -12, -r - 28, 4, -r - 36);
      ctx.stroke();

      // Burning spark at fuse tip
      const fuseTipX = 4;
      const fuseTipY = -r - 36;
      const sparkR = 5 + Math.random() * 5;
      const sparkGrad = ctx.createRadialGradient(fuseTipX, fuseTipY, 0, fuseTipX, fuseTipY, sparkR * 2);
      sparkGrad.addColorStop(0, '#ffffff');
      sparkGrad.addColorStop(0.3, '#ffff00');
      sparkGrad.addColorStop(0.8, '#ff3300');
      sparkGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = sparkGrad;
      ctx.beginPath();
      ctx.arc(fuseTipX, fuseTipY, sparkR * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  /**
   * Procedural Fruit Renderer (Crisp Canvas Vector Graphics)
   */
  const FruitRenderer = {
    drawFruit(ctx, def) {
      switch (def.type) {
        case 'watermelon':
          this.drawWatermelon(ctx, def.radius);
          break;
        case 'orange':
          this.drawOrange(ctx, def.radius);
          break;
        case 'strawberry':
          this.drawStrawberry(ctx, def.radius);
          break;
        case 'apple':
          this.drawApple(ctx, def.radius);
          break;
        case 'banana':
          this.drawBanana(ctx, def.radius);
          break;
        case 'dragonfruit':
          this.drawDragonfruit(ctx, def.radius);
          break;
      }
    },

    drawWatermelon(ctx, r) {
      // Outer dark green rind
      ctx.fillStyle = '#196f3d';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // Wavy rind stripes
      ctx.strokeStyle = '#0e4422';
      ctx.lineWidth = 4.5;
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
        ctx.stroke();
      }

      // Light green inner rind
      ctx.fillStyle = '#a9dfbf';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
      ctx.fill();

      // Red Juicy flesh
      ctx.fillStyle = '#ff2a51';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
      ctx.fill();

      // Black seeds
      ctx.fillStyle = '#1c2833';
      for (let i = 0; i < 7; i++) {
        const ang = (i * Math.PI * 2) / 7 + 0.2;
        const dist = r * 0.52;
        ctx.beginPath();
        ctx.ellipse(Math.cos(ang) * dist, Math.sin(ang) * dist, 4, 2.5, ang, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    drawOrange(ctx, r) {
      // Orange Peel
      ctx.fillStyle = '#f39c12';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // White Pith
      ctx.fillStyle = '#fdebd0';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      ctx.fill();

      // Citrus wedges
      ctx.fillStyle = '#e67e22';
      const numSegments = 8;
      for (let i = 0; i < numSegments; i++) {
        const startAng = (i * Math.PI * 2) / numSegments + 0.08;
        const endAng = ((i + 1) * Math.PI * 2) / numSegments - 0.08;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r * 0.76, startAng, endAng);
        ctx.closePath();
        ctx.fill();
      }

      // Center core
      ctx.fillStyle = '#fdebd0';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    },

    drawStrawberry(ctx, r) {
      // Berry silhouette
      ctx.fillStyle = '#d81b60';
      ctx.beginPath();
      ctx.moveTo(0, r * 1.05);
      ctx.bezierCurveTo(-r * 1.1, r * 0.3, -r * 0.9, -r * 0.7, 0, -r * 0.8);
      ctx.bezierCurveTo(r * 0.9, -r * 0.7, r * 1.1, r * 0.3, 0, r * 1.05);
      ctx.fill();

      // Yellow seed pips
      ctx.fillStyle = '#f7dc6f';
      const seeds = [
        { x: 0, y: r * 0.5 },
        { x: -r * 0.4, y: r * 0.2 },
        { x: r * 0.4, y: r * 0.2 },
        { x: -r * 0.3, y: -r * 0.3 },
        { x: r * 0.3, y: -r * 0.3 },
        { x: 0, y: -r * 0.1 }
      ];
      for (const s of seeds) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Green leafy calyx on top
      ctx.fillStyle = '#27ae60';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.9);
      ctx.lineTo(-r * 0.6, -r * 0.65);
      ctx.lineTo(-r * 0.2, -r * 0.75);
      ctx.lineTo(0, -r * 1.15);
      ctx.lineTo(r * 0.2, -r * 0.75);
      ctx.lineTo(r * 0.6, -r * 0.65);
      ctx.closePath();
      ctx.fill();
    },

    drawApple(ctx, r) {
      // Apple heart shape
      ctx.fillStyle = '#58d68d';
      ctx.beginPath();
      ctx.arc(-r * 0.45, -r * 0.2, r * 0.65, 0, Math.PI * 2);
      ctx.arc(r * 0.45, -r * 0.2, r * 0.65, 0, Math.PI * 2);
      ctx.arc(0, r * 0.25, r * 0.75, 0, Math.PI * 2);
      ctx.fill();

      // Glossy sheen
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.4, -r * 0.3, r * 0.35, r * 0.18, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();

      // Brown Stem
      ctx.strokeStyle = '#784212';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.65);
      ctx.bezierCurveTo(4, -r * 0.95, -6, -r * 1.15, 2, -r * 1.25);
      ctx.stroke();

      // Green Leaf
      ctx.fillStyle = '#229954';
      ctx.beginPath();
      ctx.ellipse(r * 0.3, -r * 0.95, r * 0.25, r * 0.12, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
    },

    drawBanana(ctx, r) {
      // Curved yellow banana
      ctx.fillStyle = '#f4d03f';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.1, r * 0.45, -Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();

      // Brown ends
      ctx.fillStyle = '#784212';
      ctx.beginPath();
      ctx.arc(-r * 0.85, r * 0.4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(r * 0.85, -r * 0.4, 5, 0, Math.PI * 2);
      ctx.fill();
    },

    drawDragonfruit(ctx, r) {
      // Magenta outer body
      ctx.fillStyle = '#c2185b';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.9, r * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();

      // Green flame scales
      ctx.fillStyle = '#00e676';
      const scales = [-0.6, -0.2, 0.2, 0.6];
      for (const yFrac of scales) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.85, yFrac * r);
        ctx.lineTo(-r * 1.2, (yFrac - 0.2) * r);
        ctx.lineTo(-r * 0.7, (yFrac - 0.3) * r);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(r * 0.85, yFrac * r);
        ctx.lineTo(r * 1.2, (yFrac - 0.2) * r);
        ctx.lineTo(r * 0.7, (yFrac - 0.3) * r);
        ctx.closePath();
        ctx.fill();
      }

      // White flesh center
      ctx.fillStyle = '#fdfefe';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.68, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();

      // Black sesame dots
      ctx.fillStyle = '#212121';
      for (let i = 0; i < 14; i++) {
        const ang = (i * Math.PI * 2) / 14 + (i % 3) * 0.2;
        const dist = ((i % 4) + 1) * (r * 0.12);
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist * 1.2, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  /**
   * Spawner & Lifecycle Manager for Fruits and Bombs
   */
  class FruitManager {
    constructor() {
      this.fruits = [];
      this.halves = [];
      this.spawnTimer = 0;
      this.spawnInterval = 2.4; // Seconds between fruit launches
      this.gameMode = 'classic'; // 'classic' | 'survival' | 'zen'
      this.isFeverActive = false;
    }

    reset(mode = 'classic') {
      this.fruits = [];
      this.halves = [];
      this.spawnTimer = 0.8; // Quick first spawn
      this.gameMode = mode;
      this.isFeverActive = false;
    }

    setFever(active) {
      this.isFeverActive = !!active;
    }

    update(dt) {
      // In Zen mode, we don't spawn bombs, but fruits still appear!
      // In Fever mode, fruits launch like crazy!
      const currentInterval = this.isFeverActive ? 0.75 : this.spawnInterval;
      this.spawnTimer += dt;
      if (this.spawnTimer >= currentInterval) {
        this.spawnTimer = 0;
        this.launchWave();
      }

      // Update active fruits
      for (let i = this.fruits.length - 1; i >= 0; i--) {
        const f = this.fruits[i];
        f.update(dt);
        if (!f.active) {
          this.fruits.splice(i, 1);
        }
      }

      // Update tumbling halves
      for (let i = this.halves.length - 1; i >= 0; i--) {
        const h = this.halves[i];
        h.update(dt);
        if (!h.active) {
          this.halves.splice(i, 1);
        }
      }
    }

    launchWave() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const waveCount = this.isFeverActive ? NinjaMath.randomChoice([2, 3, 4]) : NinjaMath.randomChoice([1, 2]);

      for (let i = 0; i < waveCount; i++) {
        const x = NinjaMath.randomRange(w * 0.15, w * 0.85);
        const y = h + 50;

        // Velocity aimed toward center of screen
        const targetX = NinjaMath.randomRange(w * 0.3, w * 0.7);
        const timeToApex = NinjaMath.randomRange(0.9, 1.25);
        const vx = (targetX - x) / timeToApex;
        const vy = -700 * timeToApex; // vy = -g * t

        // Determine if bomb: ONLY in Survival mode, ~25% chance
        const isSurvivalBomb = this.gameMode === 'survival' && Math.random() < 0.28 && !this.isFeverActive;

        if (isSurvivalBomb) {
          this.fruits.push(new Bomb(x, y, vx, vy));
        } else {
          // In Fever, much higher chance for Dragonfruit!
          let fruitDef;
          if (this.isFeverActive && Math.random() < 0.5) {
            fruitDef = FRUIT_TYPES.find((f) => f.type === 'dragonfruit') || FRUIT_TYPES[0];
          } else {
            fruitDef = NinjaMath.randomChoice(FRUIT_TYPES);
          }
          this.fruits.push(new Fruit(fruitDef, x, y, vx, vy));
        }
      }
    }

    /**
     * Check if blade segment (x1, y1) -> (x2, y2) slices any fruit or bomb.
     */
    checkSlice(x1, y1, x2, y2, slashAngle, slashSpeed) {
      const slicedTargets = [];

      for (const entity of this.fruits) {
        if (!entity.active || entity.sliced) continue;

        if (NinjaMath.segmentIntersectsCircle(x1, y1, x2, y2, entity.x, entity.y, entity.radius)) {
          if (entity.isBomb) {
            entity.sliced = true;
            entity.active = false;
            slicedTargets.push({
              isBomb: true,
              x: entity.x,
              y: entity.y
            });
          } else {
            const newHalves = entity.slice(slashAngle, slashSpeed);
            this.halves.push(...newHalves);
            slicedTargets.push({
              isBomb: false,
              fruit: entity.def,
              x: entity.x,
              y: entity.y,
              points: entity.def.points,
              color: entity.def.juiceColor
            });
          }
        }
      }

      return slicedTargets;
    }

    draw(ctx) {
      // Draw flying intact fruits & bombs
      for (const f of this.fruits) {
        f.draw(ctx);
      }
      // Draw tumbling halves
      for (const h of this.halves) {
        h.draw(ctx);
      }
    }
  }

  window.NinjaFruitManager = new FruitManager();
})(window);
