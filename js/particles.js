/**
 * SLICE IT: Ninja Mode - High-Performance Particle & Visual Effects Engine
 * Uses object pooling to ensure 60fps without GC stutter.
 * Manages juice droplets, sparks, glowing cut seams, shockwaves,
 * crack overlays, and floating combat text.
 */

(function (window) {
  'use strict';

  class Particle {
    constructor() {
      this.active = false;
      this.type = 'juice'; // 'juice' | 'spark' | 'shockwave' | 'seam' | 'smoke'
      this.x = 0;
      this.y = 0;
      this.vx = 0;
      this.vy = 0;
      this.size = 6;
      this.color = '#ff3366';
      this.alpha = 1;
      this.life = 1;
      this.maxLife = 1;
      this.gravity = 600;
      this.drag = 0.98;
      this.rotation = 0;
      this.vRot = 0;
      // Extra fields for seams or shockwaves
      this.x2 = 0;
      this.y2 = 0;
      this.lineWidth = 4;
      this.maxRadius = 60;
    }

    reset() {
      this.active = false;
    }
  }

  class FloatingText {
    constructor() {
      this.active = false;
      this.x = 0;
      this.y = 0;
      this.vy = -70;
      this.text = '';
      this.color = '#ffffff';
      this.glowColor = '#00f0ff';
      this.alpha = 1;
      this.life = 0;
      this.maxLife = 0.9;
      this.scale = 1;
      this.targetScale = 1;
    }

    reset() {
      this.active = false;
    }
  }

  class CrackLine {
    constructor(x1, y1, x2, y2, color = '#00f0ff') {
      this.segments = [];
      this.color = color;
      this.alpha = 1.0;
      this.life = 3.0; // Persists until element shatters or resets
      this.generate(x1, y1, x2, y2);
    }

    generate(x1, y1, x2, y2) {
      // Create jagged lightning-style crack segments
      const dist = NinjaMath.dist(x1, y1, x2, y2);
      const steps = Math.max(3, Math.floor(dist / 25));
      let curX = x1;
      let curY = y1;

      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const targetX = x1 + (x2 - x1) * t;
        const targetY = y1 + (y2 - y1) * t;
        const normalX = -(y2 - y1) / (dist || 1);
        const normalY = (x2 - x1) / (dist || 1);
        const jitter = (i === steps) ? 0 : NinjaMath.randomRange(-12, 12);

        const nextX = targetX + normalX * jitter;
        const nextY = targetY + normalY * jitter;

        this.segments.push({ x1: curX, y1: curY, x2: nextX, y2: nextY });
        curX = nextX;
        curY = nextY;
      }
    }
  }

  class EffectsManager {
    constructor() {
      this.maxParticles = 600;
      this.particles = [];
      for (let i = 0; i < this.maxParticles; i++) {
        this.particles.push(new Particle());
      }

      this.maxTexts = 50;
      this.texts = [];
      for (let i = 0; i < this.maxTexts; i++) {
        this.texts.push(new FloatingText());
      }

      this.cracks = []; // Active crack lines on tough elements
      this.flashAlpha = 0;
      this.chromaticPulse = 0;
      this.bladeColorTheme = 'neon_cyan'; // 'neon_cyan' | 'dragon_fire' | 'toxic_green' | 'prismatic_rainbow'
      this.isFeverActive = false;
      this.time = 0;
    }

    setBladeTheme(theme) {
      this.bladeColorTheme = theme || 'neon_cyan';
    }

    setFever(active) {
      this.isFeverActive = !!active;
    }

    triggerScreenFlash(intensity = 0.5) {
      this.flashAlpha = Math.max(this.flashAlpha, intensity);
    }

    triggerChromaticAberration(duration = 0.3) {
      this.chromaticPulse = duration;
    }

    getBladeColors() {
      if (this.isFeverActive || this.bladeColorTheme === 'prismatic_rainbow') {
        const hue = (this.time * 240) % 360;
        return {
          core: '#ffffff',
          mid: `hsl(${hue}, 100%, 65%)`,
          outer: `hsla(${hue}, 100%, 50%, 0.45)`,
          spark: `hsl(${(hue + 40) % 360}, 100%, 75%)`
        };
      }

      switch (this.bladeColorTheme) {
        case 'dragon_fire':
          return {
            core: '#ffffff',
            mid: '#ff9900',
            outer: 'rgba(255, 60, 0, 0.45)',
            spark: '#ffcc00'
          };
        case 'toxic_green':
          return {
            core: '#ffffff',
            mid: '#39ff14',
            outer: 'rgba(20, 255, 70, 0.45)',
            spark: '#aaff00'
          };
        case 'neon_cyan':
        default:
          return {
            core: '#ffffff',
            mid: '#00f0ff',
            outer: 'rgba(0, 220, 255, 0.45)',
            spark: '#80ffff'
          };
      }
    }

    /**
     * Spawn an inactive particle from pool.
     */
    spawnParticle() {
      for (let i = 0; i < this.maxParticles; i++) {
        if (!this.particles[i].active) {
          this.particles[i].active = true;
          return this.particles[i];
        }
      }
      // Re-use first particle if pool exhausted
      const p = this.particles[0];
      p.active = true;
      return p;
    }

    /**
     * Spawn juice droplets sampled from sliced element or fruit.
     */
    spawnJuiceExplosion(x, y, color, count = 18, slashAngle = 0) {
      for (let i = 0; i < count; i++) {
        const p = this.spawnParticle();
        p.type = 'juice';
        p.x = x + NinjaMath.randomRange(-8, 8);
        p.y = y + NinjaMath.randomRange(-8, 8);
        // Spray outwards along normal of slash plus radial scatter
        const angle = slashAngle + Math.PI / 2 + NinjaMath.randomRange(-0.8, 0.8) + (Math.random() > 0.5 ? 0 : Math.PI);
        const speed = NinjaMath.randomRange(150, 520);
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed - NinjaMath.randomRange(40, 180);
        p.size = NinjaMath.randomRange(3.5, 9);
        p.color = color || '#ff2d55';
        p.alpha = 1.0;
        p.life = NinjaMath.randomRange(0.6, 1.1);
        p.maxLife = p.life;
        p.gravity = 650;
        p.drag = 0.97;
      }
    }

    /**
     * Sparks emitting from blade or impacts.
     */
    spawnSparks(x, y, count = 12, baseColor = null) {
      const colors = this.getBladeColors();
      const sparkColor = baseColor || colors.spark;

      for (let i = 0; i < count; i++) {
        const p = this.spawnParticle();
        p.type = 'spark';
        p.x = x;
        p.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = NinjaMath.randomRange(180, 650);
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.size = NinjaMath.randomRange(1.8, 3.8);
        p.color = sparkColor;
        p.alpha = 1.0;
        p.life = NinjaMath.randomRange(0.2, 0.55);
        p.maxLife = p.life;
        p.gravity = 350;
        p.drag = 0.94;
      }
    }

    /**
     * Expanding shockwave ring.
     */
    spawnShockwave(x, y, color = '#00f0ff', maxRadius = 120, duration = 0.4) {
      const p = this.spawnParticle();
      p.type = 'shockwave';
      p.x = x;
      p.y = y;
      p.color = color;
      p.size = 5;
      p.maxRadius = maxRadius;
      p.lineWidth = 8;
      p.alpha = 1.0;
      p.life = duration;
      p.maxLife = duration;
      p.gravity = 0;
      p.drag = 1.0;
      p.vx = 0;
      p.vy = 0;
    }

    /**
     * Glowing seam along the exact cut line.
     */
    spawnCutSeam(x1, y1, x2, y2, color = '#ffffff') {
      const p = this.spawnParticle();
      p.type = 'seam';
      p.x = x1;
      p.y = y1;
      p.x2 = x2;
      p.y2 = y2;
      p.color = color;
      p.lineWidth = 6;
      p.alpha = 1.0;
      p.life = 0.28;
      p.maxLife = 0.28;
      p.gravity = 0;
      p.drag = 1;
      p.vx = 0;
      p.vy = 0;
    }

    /**
     * Floating combat score or message text.
     */
    spawnFloatingText(x, y, text, color = '#ffffff', glow = '#00f0ff', isCritical = false) {
      for (let i = 0; i < this.maxTexts; i++) {
        if (!this.texts[i].active) {
          const t = this.texts[i];
          t.active = true;
          t.x = x;
          t.y = y - 10;
          t.vy = isCritical ? -110 : -80;
          t.text = text;
          t.color = color;
          t.glowColor = glow;
          t.alpha = 1.0;
          t.life = 0;
          t.maxLife = isCritical ? 1.2 : 0.85;
          t.scale = 0.4;
          t.targetScale = isCritical ? 1.4 : 1.0;
          return;
        }
      }
    }

    /**
     * Add crack lines for tough elements.
     */
    addCrack(x1, y1, x2, y2, color) {
      this.cracks.push(new CrackLine(x1, y1, x2, y2, color));
    }

    clearCracks() {
      this.cracks = [];
    }

    update(dt) {
      this.time += dt;

      // Update screen flash
      if (this.flashAlpha > 0) {
        this.flashAlpha = Math.max(0, this.flashAlpha - dt * 4.5);
      }

      // Update chromatic aberration
      if (this.chromaticPulse > 0) {
        this.chromaticPulse = Math.max(0, this.chromaticPulse - dt);
      }

      // Update particles
      for (let i = 0; i < this.maxParticles; i++) {
        const p = this.particles[i];
        if (!p.active) continue;

        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }

        p.alpha = NinjaMath.clamp(p.life / p.maxLife, 0, 1);

        if (p.type === 'shockwave') {
          const progress = 1 - p.life / p.maxLife;
          p.size = 10 + progress * (p.maxRadius - 10);
          p.lineWidth = Math.max(1, 8 * (1 - progress));
          continue;
        }

        if (p.type === 'seam') {
          const progress = 1 - p.life / p.maxLife;
          p.lineWidth = Math.max(0.5, 6 * (1 - progress));
          continue;
        }

        // Physics for juice & sparks
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.vRot * dt;
      }

      // Update floating texts
      for (let i = 0; i < this.maxTexts; i++) {
        const t = this.texts[i];
        if (!t.active) continue;

        t.life += dt;
        if (t.life >= t.maxLife) {
          t.active = false;
          continue;
        }

        t.y += t.vy * dt;
        t.vy += 35 * dt; // Slow down ascent

        // Pop in scale then fade
        const progress = t.life / t.maxLife;
        if (progress < 0.2) {
          t.scale = NinjaMath.lerp(0.4, t.targetScale * 1.2, progress / 0.2);
        } else if (progress < 0.4) {
          t.scale = NinjaMath.lerp(t.targetScale * 1.2, t.targetScale, (progress - 0.2) / 0.2);
        } else {
          t.scale = t.targetScale;
        }

        if (progress > 0.6) {
          t.alpha = 1 - (progress - 0.6) / 0.4;
        }
      }
    }

    draw(ctx) {
      ctx.save();

      // Draw active crack lines on tough elements
      if (this.cracks.length > 0) {
        ctx.save();
        for (const crack of this.cracks) {
          ctx.strokeStyle = crack.color;
          ctx.lineWidth = 3.5;
          ctx.shadowColor = crack.color;
          ctx.shadowBlur = 10;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'miter';
          ctx.beginPath();
          for (const seg of crack.segments) {
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
          }
          ctx.stroke();

          // White hot core
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.shadowBlur = 0;
          ctx.stroke();
        }
        ctx.restore();
      }

      // Draw cut seams (plasma scars)
      for (let i = 0; i < this.maxParticles; i++) {
        const p = this.particles[i];
        if (!p.active || p.type !== 'seam') continue;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.lineWidth * 2.5;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 16;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();

        // White core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, p.lineWidth * 0.8);
        ctx.shadowBlur = 4;
        ctx.stroke();
        ctx.restore();
      }

      // Draw shockwaves
      for (let i = 0; i < this.maxParticles; i++) {
        const p = this.particles[i];
        if (!p.active || p.type !== 'shockwave') continue;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.lineWidth;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Draw juice droplets
      for (let i = 0; i < this.maxParticles; i++) {
        const p = this.particles[i];
        if (!p.active || p.type !== 'juice') continue;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;

        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const stretch = NinjaMath.clamp(speed / 120, 1, 2.5);
        const angle = Math.atan2(p.vy, p.vx);

        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * stretch, p.size / stretch, 0, 0, Math.PI * 2);
        ctx.fill();

        // Shiny specular dot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(-p.size * 0.3, -p.size * 0.2, p.size * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // Draw sparks
      for (let i = 0; i < this.maxParticles; i++) {
        const p = this.particles[i];
        if (!p.active || p.type !== 'spark') continue;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.strokeStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';

        // Draw spark streak pointing back from velocity
        const len = Math.min(24, Math.sqrt(p.vx * p.vx + p.vy * p.vy) * 0.04);
        const normVx = p.vx / (Math.hypot(p.vx, p.vy) || 1);
        const normVy = p.vy / (Math.hypot(p.vx, p.vy) || 1);

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - normVx * len, p.y - normVy * len);
        ctx.stroke();

        ctx.restore();
      }

      // Draw floating combat text
      for (let i = 0; i < this.maxTexts; i++) {
        const t = this.texts[i];
        if (!t.active) continue;

        ctx.save();
        ctx.globalAlpha = t.alpha;
        ctx.translate(t.x, t.y);
        ctx.scale(t.scale, t.scale);

        ctx.font = '900 24px "Impact", "Montserrat", "Arial Black", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Dark outline
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.strokeText(t.text, 0, 0);

        // Neon Glow
        ctx.shadowColor = t.glowColor;
        ctx.shadowBlur = 14;
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, 0, 0);

        ctx.restore();
      }

      // Screen flash overlay
      if (this.flashAlpha > 0.01) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${this.flashAlpha})`;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();
      }

      ctx.restore();
    }
  }

  window.NinjaEffects = new EffectsManager();
})(window);
