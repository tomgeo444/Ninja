/**
 * SLICE IT: Ninja Mode - Core Game Engine & Central Time Architecture
 * Manages the high-frequency animation loop, central TimeManager (hit-stop,
 * slow-motion easing), stroke tracking, combos, fever mode, camera shake,
 * multi-layer neon blade trail, and high scores.
 */

(function (window) {
  'use strict';

  class TimeManager {
    constructor() {
      this.timeScale = 1.0;
      this.targetTimeScale = 1.0;
      this.hitStopTimer = 0;
      this.slowMoTimer = 0;
    }

    reset() {
      this.timeScale = 1.0;
      this.targetTimeScale = 1.0;
      this.hitStopTimer = 0;
      this.slowMoTimer = 0;
    }

    hitStop(durationMs = 55) {
      this.hitStopTimer = durationMs / 1000;
    }

    slowMotion(durationMs = 400, scale = 0.3) {
      this.slowMoTimer = durationMs / 1000;
      this.targetTimeScale = scale;
    }

    update(rawDt) {
      // Hit-stop takes absolute precedence: complete freeze of world simulation
      if (this.hitStopTimer > 0) {
        this.hitStopTimer -= rawDt;
        return 0;
      }

      // Smooth slow-mo easing
      if (this.slowMoTimer > 0) {
        this.slowMoTimer -= rawDt;
        this.timeScale += (this.targetTimeScale - this.timeScale) * Math.min(1, rawDt * 14);
      } else {
        this.timeScale += (1.0 - this.timeScale) * Math.min(1, rawDt * 10);
      }

      return rawDt * this.timeScale;
    }
  }

  class NinjaEngine {
    constructor() {
      this.timeManager = new TimeManager();
      this.canvas = null;
      this.ctx = null;
      this.viewport = null;

      // Settings
      this.gameMode = 'classic'; // 'classic' | 'survival' | 'zen'
      this.bladeColorTheme = 'neon_cyan';
      this.effectIntensity = 'high'; // 'low' | 'medium' | 'high'
      this.soundVolume = 0.7;
      this.prefersReducedMotion = false;

      // Game State
      this.isRunning = false;
      this.isPaused = false;
      this.score = 0;
      this.bestScores = { classic: 0, survival: 0, zen: 0 };
      this.timeLeft = 60;
      this.lives = 3;
      this.totalSlices = 0;
      this.maxCombo = 0;

      // Fever State
      this.feverMeter = 0; // 0..100
      this.isFeverActive = false;
      this.feverTimer = 0;
      this.feverDuration = 8.0;

      // Combo Tracking
      this.strokePoints = [];
      this.strokeTargetsCount = 0;
      this.strokeTimer = 0;
      this.strokeActive = false;

      // Camera Shake
      this.trauma = 0;
      this.shakeTime = 0;

      // Loop
      this.lastTime = 0;
      this.animFrameId = null;

      // Pointer tracking
      this.bladePoints = []; // [{x, y, time, speed}]
      this.lastPointerPos = null;
    }

    init(canvas, viewport, settings = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: true });
      this.viewport = viewport;

      this.applySettings(settings);
      this.checkReducedMotion();
      this.loadHighScores();
      this.resizeCanvas();
    }

    applySettings(settings) {
      if (settings.mode) this.gameMode = settings.mode;
      if (settings.bladeColor) {
        this.bladeColorTheme = settings.bladeColor;
        NinjaEffects.setBladeTheme(this.bladeColorTheme);
      }
      if (settings.effectIntensity) this.effectIntensity = settings.effectIntensity;
      if (typeof settings.soundVolume === 'number') {
        this.soundVolume = settings.soundVolume;
        NinjaAudio.setVolume(this.soundVolume);
      }
    }

    checkReducedMotion() {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.prefersReducedMotion = true;
      }
    }

    loadHighScores() {
      const storage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync ? chrome.storage.sync : null;
      if (storage) {
        storage.get(['sliceIt_scores'], (res) => {
          if (res && res.sliceIt_scores) {
            this.bestScores = Object.assign(this.bestScores, res.sliceIt_scores);
            NinjaHUD.updateScore(this.score, this.bestScores[this.gameMode] || 0);
          }
        });
      } else {
        try {
          const saved = localStorage.getItem('sliceIt_scores');
          if (saved) {
            this.bestScores = Object.assign(this.bestScores, JSON.parse(saved));
            NinjaHUD.updateScore(this.score, this.bestScores[this.gameMode] || 0);
          }
        } catch (e) {}
      }
    }

    saveHighScore() {
      const currentBest = this.bestScores[this.gameMode] || 0;
      let isNew = false;
      if (this.score > currentBest) {
        this.bestScores[this.gameMode] = this.score;
        isNew = true;

        const storage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync ? chrome.storage.sync : null;
        if (storage) {
          storage.set({ sliceIt_scores: this.bestScores });
        } else {
          try {
            localStorage.setItem('sliceIt_scores', JSON.stringify(this.bestScores));
          } catch (e) {}
        }
      }
      return isNew;
    }

    resizeCanvas() {
      if (!this.canvas) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    startGame() {
      NinjaAudio.init();
      NinjaAudio.setVolume(this.soundVolume);

      this.score = 0;
      this.totalSlices = 0;
      this.maxCombo = 0;
      this.timeLeft = 60;
      this.lives = 3;
      this.feverMeter = 0;
      this.isFeverActive = false;
      this.feverTimer = 0;
      this.trauma = 0;
      this.timeManager.reset();
      this.bladePoints = [];
      this.strokePoints = [];

      NinjaEffects.setBladeTheme(this.bladeColorTheme);
      NinjaEffects.setFever(false);
      NinjaFruitManager.reset(this.gameMode);
      NinjaDOMSlicer.clearAllHalves();

      NinjaHUD.updateScore(0, this.bestScores[this.gameMode] || 0);
      NinjaHUD.updateTimerOrLives(this.gameMode, this.timeLeft, this.lives);
      NinjaHUD.setFeverState(false, 0);
      NinjaHUD.hideGameOver();

      this.isPaused = true;
      NinjaHUD.startCountdown(() => {
        this.isPaused = false;
        this.isRunning = true;
        this.lastTime = performance.now();
        if (!this.animFrameId) {
          this.animFrameId = requestAnimationFrame((t) => this.loop(t));
        }
      });
    }

    stopGame() {
      this.isRunning = false;
      this.isPaused = false;
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
      if (this.viewport) {
        this.viewport.style.transform = 'none';
      }
      NinjaDOMSlicer.restoreAll();
      const root = document.getElementById('slice-it-root');
      if (root && root.parentNode) {
        root.parentNode.removeChild(root);
      }
    }

    triggerGameOver(isTimeUp = false) {
      this.isRunning = false;
      const isNewRecord = this.saveHighScore();
      NinjaHUD.showGameOver({
        score: this.score,
        bestScore: this.bestScores[this.gameMode] || 0,
        totalSlices: this.totalSlices,
        maxCombo: this.maxCombo,
        isNewRecord,
        isTimeUp
      });
    }

    addTrauma(amount) {
      if (this.prefersReducedMotion || this.effectIntensity === 'low') return;
      const mult = this.effectIntensity === 'medium' ? 0.6 : 1.0;
      this.trauma = Math.min(1.0, this.trauma + amount * mult);
    }

    addScore(pts, x, y, label = null, isCritical = false) {
      const finalPts = this.isFeverActive ? pts * 2 : pts;
      this.score += finalPts;
      this.totalSlices++;

      const text = label ? `${label} +${finalPts}` : `+${finalPts}`;
      const color = isCritical ? '#ffe600' : '#ffffff';
      const glow = isCritical ? '#ffcc00' : (this.isFeverActive ? '#ff00ff' : '#00f0ff');

      NinjaEffects.spawnFloatingText(x, y, text, color, glow, isCritical);
      NinjaHUD.updateScore(this.score, this.bestScores[this.gameMode] || 0);

      // Increase fever meter
      if (!this.isFeverActive) {
        this.feverMeter = Math.min(100, this.feverMeter + (isCritical ? 8 : 4));
        NinjaHUD.setFeverState(false, this.feverMeter / 100);
        if (this.feverMeter >= 100) {
          this.activateFever();
        }
      }
    }

    activateFever() {
      this.isFeverActive = true;
      this.feverTimer = this.feverDuration;
      NinjaAudio.playFeverStart();
      NinjaEffects.setFever(true);
      NinjaFruitManager.setFever(true);
      NinjaHUD.setFeverState(true, 1.0);
      NinjaEffects.triggerScreenFlash(0.4);
      NinjaEffects.triggerChromaticAberration(0.5);
    }

    endFever() {
      this.isFeverActive = false;
      this.feverMeter = 0;
      NinjaEffects.setFever(false);
      NinjaFruitManager.setFever(false);
      NinjaHUD.setFeverState(false, 0);
    }

    /**
     * Mouse & Pointer Move Handler
     */
    handlePointerMove(x, y) {
      const now = performance.now();

      if (!this.lastPointerPos) {
        this.lastPointerPos = { x, y, time: now };
        this.bladePoints.push({ x, y, time: now, speed: 0 });
        return;
      }

      const dx = x - this.lastPointerPos.x;
      const dy = y - this.lastPointerPos.y;
      const dt = Math.max(0.001, (now - this.lastPointerPos.time) / 1000);
      const speed = Math.sqrt(dx * dx + dy * dy) / dt;

      this.bladePoints.push({ x, y, time: now, speed });
      this.lastPointerPos = { x, y, time: now };

      // Swoosh sound if moving briskly
      if (speed > 450) {
        NinjaAudio.playSwoosh(speed);
      }

      // Shed sparks from blade tip at high speed
      if (speed > 700) {
        NinjaEffects.spawnSparks(x, y, 2);
      }

      // Only slice if blade speed is sufficient (ninja stroke)
      if (speed > 180 && this.isRunning && !this.isPaused) {
        this.executeSliceSegment(this.bladePoints[this.bladePoints.length - 2], { x, y, speed }, now);
      }
    }

    executeSliceSegment(p1, p2, now) {
      if (!p1) return;

      const slashAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const slashSpeed = p2.speed;

      // Stroke tracking for combos
      if (!this.strokeActive) {
        this.strokeActive = true;
        this.strokeTargetsCount = 0;
      }
      this.strokeTimer = now;

      // 1. Check DOM elements
      const domHits = NinjaDOMSlicer.checkSlice(p1.x, p1.y, p2.x, p2.y, slashAngle, slashSpeed);
      for (const hit of domHits) {
        this.strokeTargetsCount++;

        if (hit.isToughHit && !hit.isShattered) {
          NinjaAudio.playCrack();
          this.addTrauma(0.2);
          this.addScore(hit.points, hit.centerX, hit.centerY, 'CRACK!');
        } else {
          // Normal or shattered element
          if (hit.isCritical) {
            NinjaAudio.playPerfect();
            NinjaEffects.spawnShockwave(hit.centerX, hit.centerY, '#ffe600', 140);
            NinjaEffects.spawnSparks(hit.centerX, hit.centerY, 16, '#ffe600');
            this.timeManager.hitStop(50);
            this.addTrauma(0.35);
            this.addScore(hit.points, hit.centerX, hit.centerY, 'PERFECT!', true);
          } else {
            NinjaAudio.playSlice(this.strokeTargetsCount);
            NinjaEffects.spawnCutSeam(p1.x, p1.y, p2.x, p2.y, '#ffffff');
            NinjaEffects.spawnJuiceExplosion(hit.centerX, hit.centerY, hit.color, 16, slashAngle);
            this.addTrauma(0.18);
            this.addScore(hit.points, hit.centerX, hit.centerY);
          }

          if (hit.isToughHit && hit.isShattered) {
            this.timeManager.hitStop(65);
            this.addTrauma(0.45);
            NinjaEffects.spawnShockwave(hit.centerX, hit.centerY, '#00f0ff', 180);
          }
        }
      }

      // 2. Check Fruits and Bombs
      const fruitHits = NinjaFruitManager.checkSlice(p1.x, p1.y, p2.x, p2.y, slashAngle, slashSpeed);
      for (const fHit of fruitHits) {
        if (fHit.isBomb) {
          // BOMB DETONATION!
          NinjaAudio.playBombExplosion();
          this.timeManager.hitStop(75);
          this.addTrauma(0.85);
          NinjaEffects.triggerScreenFlash(0.7);
          NinjaEffects.triggerChromaticAberration(0.4);
          NinjaEffects.spawnShockwave(fHit.x, fHit.y, '#ff0033', 240, 0.5);
          NinjaEffects.spawnJuiceExplosion(fHit.x, fHit.y, '#ff1100', 30, slashAngle);
          NinjaEffects.spawnFloatingText(fHit.x, fHit.y, 'BOMB! -1 LIFE', '#ff0033', '#ff0000', true);

          this.lives--;
          NinjaHUD.updateTimerOrLives(this.gameMode, this.timeLeft, this.lives);
          if (this.lives <= 0) {
            this.triggerGameOver(false);
          }
        } else {
          this.strokeTargetsCount++;
          NinjaAudio.playSlice(this.strokeTargetsCount);
          NinjaEffects.spawnCutSeam(p1.x, p1.y, p2.x, p2.y, '#ffffff');
          NinjaEffects.spawnJuiceExplosion(fHit.x, fHit.y, fHit.color, 20, slashAngle);
          this.addTrauma(0.2);
          this.addScore(fHit.points, fHit.x, fHit.y, fHit.fruit.name.toUpperCase());
        }
      }
    }

    evaluateStrokeEnd() {
      if (!this.strokeActive) return;
      this.strokeActive = false;

      if (this.strokeTargetsCount >= 3) {
        // COMBO TRIGGERED!
        const count = this.strokeTargetsCount;
        if (count > this.maxCombo) this.maxCombo = count;

        let multiplier = 2;
        if (count === 4) multiplier = 3;
        else if (count === 5) multiplier = 4;
        else if (count >= 6) multiplier = 5;

        const bonus = count * 15 * multiplier;
        this.score += bonus;
        NinjaHUD.updateScore(this.score, this.bestScores[this.gameMode] || 0);

        NinjaAudio.playCombo(count);
        NinjaHUD.showCombo(count, multiplier);

        // Slow motion crunch on big combos!
        this.timeManager.slowMotion(400, 0.28);
        this.addTrauma(0.4);

        if (!this.isFeverActive) {
          this.feverMeter = Math.min(100, this.feverMeter + count * 6);
          NinjaHUD.setFeverState(false, this.feverMeter / 100);
          if (this.feverMeter >= 100) this.activateFever();
        }
      }
    }

    loop(currentTime) {
      if (!this.isRunning && !this.isPaused) return;

      const rawDt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
      this.lastTime = currentTime;

      // Check stroke expiration
      if (this.strokeActive && currentTime - this.strokeTimer > 160) {
        this.evaluateStrokeEnd();
      }

      // Update TimeManager
      const dt = this.timeManager.update(rawDt);

      if (this.isRunning && !this.isPaused) {
        // Mode logic
        if (this.gameMode === 'classic') {
          this.timeLeft -= rawDt;
          if (this.timeLeft <= 0) {
            this.timeLeft = 0;
            NinjaHUD.updateTimerOrLives(this.gameMode, 0, this.lives);
            this.triggerGameOver(true);
            return;
          }
          NinjaHUD.updateTimerOrLives(this.gameMode, this.timeLeft, this.lives);
        }

        // Fever logic
        if (this.isFeverActive) {
          this.feverTimer -= rawDt;
          NinjaHUD.setFeverState(true, this.feverTimer / this.feverDuration);
          if (this.feverTimer <= 0) {
            this.endFever();
          }
        }

        // Update systems using time-scaled dt
        NinjaDOMSlicer.update(dt);
        NinjaFruitManager.update(dt);
        NinjaEffects.update(dt);
        NinjaHUD.update(rawDt);

        // Update camera trauma shake
        this.updateCameraShake(rawDt);
      }

      // Render visuals
      this.render();

      this.animFrameId = requestAnimationFrame((t) => this.loop(t));
    }

    updateCameraShake(rawDt) {
      if (this.trauma > 0) {
        this.trauma = Math.max(0, this.trauma - rawDt * 1.6);
        this.shakeTime += rawDt;
        const shake = NinjaMath.calculateTraumaShake(this.trauma, this.shakeTime, 20, 3.5);
        if (this.viewport) {
          this.viewport.style.transform = `translate3d(${shake.x.toFixed(1)}px, ${shake.y.toFixed(1)}px, 0) rotate(${shake.angle.toFixed(2)}deg)`;
        }
      } else if (this.viewport && this.viewport.style.transform !== 'none') {
        this.viewport.style.transform = 'none';
      }
    }

    render() {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      ctx.clearRect(0, 0, w, h);

      // 1. Dynamic Background Dimming & Vignette
      ctx.save();
      const vignetteGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.85);
      const dimAlpha = this.isFeverActive ? 0.65 : 0.35 + (this.strokeTargetsCount > 2 ? 0.15 : 0);
      vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignetteGrad.addColorStop(1, `rgba(5, 8, 16, ${dimAlpha.toFixed(2)})`);
      ctx.fillStyle = vignetteGrad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // 2. Render Flying Fruits & Bombs
      NinjaFruitManager.draw(ctx);

      // 3. Render Particles, Sparks, Seams & Floating Text
      NinjaEffects.draw(ctx);

      // 4. Render Multi-Layer Glowing Neon Blade Trail
      this.renderBladeTrail(ctx);
    }

    renderBladeTrail(ctx) {
      const now = performance.now();
      // Discard points older than 180ms
      while (this.bladePoints.length > 0 && now - this.bladePoints[0].time > 180) {
        this.bladePoints.shift();
      }

      const pts = this.bladePoints;
      if (pts.length < 2) return;

      const colors = NinjaEffects.getBladeColors();
      const numPts = pts.length;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Pass 1: Outer Wide Colored Glow
      for (let i = 1; i < numPts; i++) {
        const p1 = pts[i - 1];
        const p2 = pts[i];
        const progress = i / numPts; // 0 at tail, 1 at tip
        const alpha = Math.max(0, 1 - (now - p2.time) / 180) * progress;

        ctx.strokeStyle = colors.outer;
        ctx.lineWidth = 18 * progress;
        ctx.shadowColor = colors.mid;
        ctx.shadowBlur = 18;
        ctx.globalAlpha = alpha;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // Pass 2: Mid Saturated Core
      for (let i = 1; i < numPts; i++) {
        const p1 = pts[i - 1];
        const p2 = pts[i];
        const progress = i / numPts;
        const alpha = Math.max(0, 1 - (now - p2.time) / 180) * progress;

        ctx.strokeStyle = colors.mid;
        ctx.lineWidth = 9 * progress;
        ctx.shadowColor = colors.mid;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = alpha;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // Pass 3: Ultra-bright White Core (Tapered)
      for (let i = 1; i < numPts; i++) {
        const p1 = pts[i - 1];
        const p2 = pts[i];
        const progress = i / numPts;
        const alpha = Math.max(0, 1 - (now - p2.time) / 180) * progress;

        ctx.strokeStyle = colors.core;
        ctx.lineWidth = Math.max(1.5, 3.5 * progress);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = alpha;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  window.NinjaEngine = new NinjaEngine();
})(window);
