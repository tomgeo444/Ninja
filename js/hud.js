/**
 * SLICE IT: Ninja Mode - HUD & UI Overlay Manager
 * Renders arcade-grade HUD pinned to corners, 3-2-1 countdown,
 * animated combo callouts, fever meter bar, game over modal,
 * and page restore controls.
 */

(function (window) {
  'use strict';

  class NinjaHUD {
    constructor() {
      this.root = null;
      this.hudContainer = null;
      this.countdownOverlay = null;
      this.gameOverModal = null;
      this.scoreEl = null;
      this.bestScoreEl = null;
      this.modeHeaderEl = null;
      this.timerLivesEl = null;
      this.comboCalloutEl = null;
      this.feverBarFillEl = null;
      this.feverBannerEl = null;

      this.displayedScore = 0;
      this.targetScore = 0;
      this.comboTimeout = null;
    }

    init(root) {
      this.root = root;
      this.createHUD();
      this.createCountdownOverlay();
      this.createGameOverModal();
    }

    createHUD() {
      const hud = document.createElement('div');
      hud.className = 'slice-it-hud';
      hud.innerHTML = `
        <!-- Top Left: Score & Record -->
        <div class="slice-it-hud-box slice-it-hud-top-left">
          <div class="slice-it-label">SCORE</div>
          <div class="slice-it-score" id="slice-it-hud-score">0</div>
          <div class="slice-it-best-score">BEST: <span id="slice-it-hud-best">0</span></div>
        </div>

        <!-- Top Center: Timer or Lives -->
        <div class="slice-it-hud-box slice-it-hud-top-center">
          <div class="slice-it-mode-badge" id="slice-it-hud-mode">CLASSIC</div>
          <div class="slice-it-timer-lives" id="slice-it-hud-timer-lives">60s</div>
        </div>

        <!-- Top Right: Audio & Controls -->
        <div class="slice-it-hud-box slice-it-hud-top-right">
          <button class="slice-it-hud-btn" id="slice-it-mute-btn" title="Toggle Sound">🔊</button>
          <button class="slice-it-hud-btn slice-it-restore-btn" id="slice-it-hud-restore-btn" title="Restore Page">RESTORE</button>
          <button class="slice-it-hud-btn slice-it-exit-btn" id="slice-it-exit-btn" title="Exit Ninja Mode (Esc)">✕</button>
        </div>

        <!-- Bottom Left: Fever Meter -->
        <div class="slice-it-hud-box slice-it-hud-bottom-left">
          <div class="slice-it-fever-label">
            <span>FEVER METER</span>
            <span id="slice-it-fever-percent">0%</span>
          </div>
          <div class="slice-it-fever-bar">
            <div class="slice-it-fever-fill" id="slice-it-fever-fill"></div>
          </div>
        </div>

        <!-- Center: Dynamic Combo Callout -->
        <div class="slice-it-combo-callout" id="slice-it-combo-callout"></div>

        <!-- Fever Mode Banner -->
        <div class="slice-it-fever-banner" id="slice-it-fever-banner">⚡ FEVER MODE ACTIVE! 2X POINTS ⚡</div>
      `;

      this.root.appendChild(hud);
      this.hudContainer = hud;

      this.scoreEl = hud.querySelector('#slice-it-hud-score');
      this.bestScoreEl = hud.querySelector('#slice-it-hud-best');
      this.modeHeaderEl = hud.querySelector('#slice-it-hud-mode');
      this.timerLivesEl = hud.querySelector('#slice-it-hud-timer-lives');
      this.comboCalloutEl = hud.querySelector('#slice-it-combo-callout');
      this.feverBarFillEl = hud.querySelector('#slice-it-fever-fill');
      this.feverBannerEl = hud.querySelector('#slice-it-fever-banner');

      // Wire HUD buttons
      const muteBtn = hud.querySelector('#slice-it-mute-btn');
      muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isMuted = !NinjaAudio.isMuted;
        NinjaAudio.setMuted(isMuted);
        muteBtn.textContent = isMuted ? '🔇' : '🔊';
      });

      hud.querySelector('#slice-it-hud-restore-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        NinjaDOMSlicer.restoreAll();
        NinjaEffects.spawnFloatingText(
          window.innerWidth / 2,
          window.innerHeight / 2,
          'PAGE RESTORED!',
          '#00f0ff',
          '#00f0ff'
        );
      });

      hud.querySelector('#slice-it-exit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.NinjaEngine) {
          window.NinjaEngine.stopGame();
        }
      });
    }

    createCountdownOverlay() {
      const cd = document.createElement('div');
      cd.className = 'slice-it-countdown-overlay';
      cd.style.display = 'none';
      cd.innerHTML = `<div class="slice-it-countdown-text" id="slice-it-countdown-text">3</div>`;
      this.root.appendChild(cd);
      this.countdownOverlay = cd;
    }

    createGameOverModal() {
      const modal = document.createElement('div');
      modal.className = 'slice-it-gameover-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="slice-it-modal-card">
          <div class="slice-it-modal-title" id="slice-it-gameover-title">GAME OVER</div>
          <div class="slice-it-new-record-badge" id="slice-it-new-record" style="display: none;">★ NEW HIGH SCORE! ★</div>
          
          <div class="slice-it-modal-score-box">
            <div class="slice-it-modal-score-label">FINAL SCORE</div>
            <div class="slice-it-modal-score" id="slice-it-final-score">0</div>
          </div>

          <div class="slice-it-stats-grid">
            <div class="slice-it-stat-item">
              <div class="slice-it-stat-val" id="slice-it-stat-slices">0</div>
              <div class="slice-it-stat-lbl">TOTAL SLICES</div>
            </div>
            <div class="slice-it-stat-item">
              <div class="slice-it-stat-val" id="slice-it-stat-combo">0</div>
              <div class="slice-it-stat-lbl">MAX COMBO</div>
            </div>
            <div class="slice-it-stat-item">
              <div class="slice-it-stat-val" id="slice-it-stat-best">0</div>
              <div class="slice-it-stat-lbl">ALL-TIME BEST</div>
            </div>
          </div>

          <div class="slice-it-modal-actions">
            <button class="slice-it-modal-btn slice-it-btn-play" id="slice-it-play-again-btn">PLAY AGAIN</button>
            <button class="slice-it-modal-btn slice-it-btn-restore" id="slice-it-modal-restore-btn">RESTORE PAGE</button>
            <button class="slice-it-modal-btn slice-it-btn-exit" id="slice-it-modal-exit-btn">EXIT</button>
          </div>
        </div>
      `;
      this.root.appendChild(modal);
      this.gameOverModal = modal;

      modal.querySelector('#slice-it-play-again-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideGameOver();
        if (window.NinjaEngine) {
          window.NinjaEngine.startGame();
        }
      });

      modal.querySelector('#slice-it-modal-restore-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        NinjaDOMSlicer.restoreAll();
        modal.querySelector('#slice-it-modal-restore-btn').textContent = 'RESTORED ✓';
      });

      modal.querySelector('#slice-it-modal-exit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.NinjaEngine) {
          window.NinjaEngine.stopGame();
        }
      });
    }

    startCountdown(onComplete) {
      if (!this.countdownOverlay) return;
      this.countdownOverlay.style.display = 'flex';
      const textEl = this.countdownOverlay.querySelector('#slice-it-countdown-text');

      const steps = ['3', '2', '1', 'SLICE IT!'];
      let idx = 0;

      const runStep = () => {
        if (idx < steps.length) {
          const val = steps[idx];
          textEl.textContent = val;
          textEl.className = 'slice-it-countdown-text pop-anim';
          const isGo = idx === steps.length - 1;
          NinjaAudio.playCountdownTick(isGo);

          idx++;
          setTimeout(runStep, isGo ? 650 : 800);
        } else {
          this.countdownOverlay.style.display = 'none';
          if (onComplete) onComplete();
        }
      };

      runStep();
    }

    showCombo(count, multiplier) {
      if (!this.comboCalloutEl) return;

      let calloutText = `${count}x COMBO!`;
      let subText = `x${multiplier} MULTIPLIER`;
      let glowColor = '#00f0ff';

      if (count === 3) {
        calloutText = 'TRIPLE SLICE!';
        glowColor = '#00f0ff';
      } else if (count === 4) {
        calloutText = 'QUAD CUT!';
        glowColor = '#39ff14';
      } else if (count === 5) {
        calloutText = 'MEGA COMBO!';
        glowColor = '#ffaa00';
      } else if (count >= 6) {
        calloutText = 'UNSTOPPABLE!!';
        glowColor = '#ff0055';
      }

      this.comboCalloutEl.innerHTML = `
        <div class="combo-title" style="color: #ffffff; text-shadow: 0 0 25px ${glowColor}, 0 0 50px ${glowColor};">
          ${calloutText}
        </div>
        <div class="combo-sub" style="color: ${glowColor};">
          ${subText}
        </div>
      `;

      this.comboCalloutEl.classList.remove('active');
      void this.comboCalloutEl.offsetWidth; // Trigger reflow for restart
      this.comboCalloutEl.classList.add('active');

      if (this.comboTimeout) clearTimeout(this.comboTimeout);
      this.comboTimeout = setTimeout(() => {
        this.comboCalloutEl.classList.remove('active');
      }, 900);
    }

    setFeverState(isActive, progress) {
      if (this.feverBarFillEl) {
        this.feverBarFillEl.style.width = `${Math.min(100, Math.max(0, progress * 100)).toFixed(1)}%`;
      }
      const pctEl = this.root ? this.root.querySelector('#slice-it-fever-percent') : null;
      if (pctEl) {
        pctEl.textContent = `${Math.round(progress * 100)}%`;
      }
      if (this.feverBannerEl) {
        this.feverBannerEl.style.display = isActive ? 'block' : 'none';
      }
    }

    updateScore(score, bestScore) {
      this.targetScore = score;
      if (this.bestScoreEl) {
        this.bestScoreEl.textContent = bestScore.toLocaleString();
      }
    }

    updateTimerOrLives(mode, timeLeft, lives) {
      if (!this.timerLivesEl || !this.modeHeaderEl) return;
      this.modeHeaderEl.textContent = mode.toUpperCase();

      if (mode === 'classic') {
        const seconds = Math.max(0, Math.ceil(timeLeft));
        this.timerLivesEl.textContent = `${seconds}s`;
        this.timerLivesEl.style.color = seconds <= 10 ? '#ff2a51' : '#ffffff';
      } else if (mode === 'survival') {
        let stars = '';
        for (let i = 0; i < 3; i++) {
          stars += i < lives ? ' ❤️ ' : ' 🖤 ';
        }
        this.timerLivesEl.textContent = stars.trim();
        this.timerLivesEl.style.color = '#ff2a51';
      } else {
        this.timerLivesEl.textContent = 'ZEN ☯';
        this.timerLivesEl.style.color = '#a8ff78';
      }
    }

    update(dt) {
      // Smooth score roll
      if (this.displayedScore < this.targetScore) {
        const step = Math.max(1, Math.ceil((this.targetScore - this.displayedScore) * 15 * dt));
        this.displayedScore = Math.min(this.targetScore, this.displayedScore + step);
        if (this.scoreEl) {
          this.scoreEl.textContent = this.displayedScore.toLocaleString();
        }
      } else if (this.displayedScore > this.targetScore) {
        this.displayedScore = this.targetScore;
        if (this.scoreEl) {
          this.scoreEl.textContent = this.displayedScore.toLocaleString();
        }
      }
    }

    showGameOver(stats) {
      if (!this.gameOverModal) return;
      this.gameOverModal.style.display = 'flex';

      const titleEl = this.gameOverModal.querySelector('#slice-it-gameover-title');
      const scoreEl = this.gameOverModal.querySelector('#slice-it-final-score');
      const recordEl = this.gameOverModal.querySelector('#slice-it-new-record');
      const slicesEl = this.gameOverModal.querySelector('#slice-it-stat-slices');
      const comboEl = this.gameOverModal.querySelector('#slice-it-stat-combo');
      const bestEl = this.gameOverModal.querySelector('#slice-it-stat-best');

      titleEl.textContent = stats.isTimeUp ? "TIME'S UP!" : 'GAME OVER';
      scoreEl.textContent = stats.score.toLocaleString();
      slicesEl.textContent = stats.totalSlices;
      comboEl.textContent = stats.maxCombo;
      bestEl.textContent = stats.bestScore.toLocaleString();

      recordEl.style.display = stats.isNewRecord ? 'block' : 'none';
      NinjaAudio.playGameOver();
    }

    hideGameOver() {
      if (this.gameOverModal) {
        this.gameOverModal.style.display = 'none';
      }
    }
  }

  window.NinjaHUD = new NinjaHUD();
})(window);
