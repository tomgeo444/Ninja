/**
 * SLICE IT: Ninja Mode - Popup Controller
 * Manages configuration settings, high scores persistence,
 * tab state detection, and dynamic injection.
 */

(function () {
  'use strict';

  const DEFAULT_SETTINGS = {
    mode: 'classic',
    bladeColor: 'neon_cyan',
    effectIntensity: 'high',
    soundVolume: 0.7,
    dismissAlert: false
  };

  let currentSettings = { ...DEFAULT_SETTINGS };
  let isGameActiveOnTab = false;
  let activeTabId = null;

  // DOM Elements
  const modeCards = document.querySelectorAll('.mode-card');
  const themePills = document.querySelectorAll('.theme-pill');
  const intensityPills = document.querySelectorAll('.btn-pill');
  const volumeSlider = document.getElementById('volume-slider');
  const volumeVal = document.getElementById('volume-val');
  const btnLaunch = document.getElementById('btn-launch');
  const alertBox = document.getElementById('photosensitivity-alert');
  const closeAlertBtn = document.getElementById('close-alert-btn');
  const scoreClassic = document.getElementById('score-classic');
  const scoreSurvival = document.getElementById('score-survival');
  const scoreZen = document.getElementById('score-zen');

  // Load saved settings & high scores
  function init() {
    loadSettings();
    loadScores();
    checkActiveTab();
    bindEvents();
  }

  function loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['sliceIt_settings'], (res) => {
        if (res && res.sliceIt_settings) {
          currentSettings = { ...DEFAULT_SETTINGS, ...res.sliceIt_settings };
        }
        applySettingsToUI();
      });
    } else {
      try {
        const local = localStorage.getItem('sliceIt_settings');
        if (local) currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
      } catch (e) {}
      applySettingsToUI();
    }
  }

  function saveSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ sliceIt_settings: currentSettings });
    } else {
      try {
        localStorage.setItem('sliceIt_settings', JSON.stringify(currentSettings));
      } catch (e) {}
    }

    // Propagate settings if game is active on tab
    if (activeTabId && isGameActiveOnTab) {
      chrome.tabs.sendMessage(activeTabId, {
        action: 'UPDATE_SETTINGS',
        settings: currentSettings
      }).catch(() => {});
    }
  }

  let audioCtx = null;
  function play8BitBeep(freq1 = 440, freq2 = null, type = 'square', duration = 0.08) {
    if (currentSettings.soundVolume <= 0.01) return;
    try {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioClass) return;
      if (!audioCtx) audioCtx = new AudioClass();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq1, now);
      if (freq2) {
        osc.frequency.exponentialRampToValueAtTime(freq2, now + duration);
      }

      const vol = currentSettings.soundVolume * 0.22;
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch (e) {}
  }

  function loadScores() {
    const padScore = (num) => String(num || 0).padStart(6, '0');
    const applyScores = (scores) => {
      if (!scores) return;
      if (scoreClassic) scoreClassic.textContent = padScore(scores.classic);
      if (scoreSurvival) scoreSurvival.textContent = padScore(scores.survival);
      if (scoreZen) scoreZen.textContent = padScore(scores.zen);

      const top = Math.max(scores.classic || 0, scores.survival || 0, scores.zen || 0);
      const marqueeTop = document.getElementById('marquee-top-score');
      if (marqueeTop) marqueeTop.textContent = padScore(top);
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['sliceIt_scores'], (res) => {
        if (res && res.sliceIt_scores) applyScores(res.sliceIt_scores);
      });
    } else {
      try {
        const saved = localStorage.getItem('sliceIt_scores');
        if (saved) applyScores(JSON.parse(saved));
      } catch (e) {}
    }
  }

  function applySettingsToUI() {
    // Mode
    modeCards.forEach((card) => {
      const mode = card.dataset.mode;
      const isSelected = mode === currentSettings.mode;
      card.classList.toggle('active', isSelected);
      card.querySelector('input').checked = isSelected;
    });

    // Theme
    themePills.forEach((pill) => {
      pill.classList.toggle('active', pill.dataset.theme === currentSettings.bladeColor);
    });

    // Intensity
    intensityPills.forEach((pill) => {
      pill.classList.toggle('active', pill.dataset.intensity === currentSettings.effectIntensity);
    });

    // Volume
    const volPct = Math.round(currentSettings.soundVolume * 100);
    volumeSlider.value = volPct;
    volumeVal.textContent = `${volPct}%`;

    // Alert
    if (currentSettings.dismissAlert && alertBox) {
      alertBox.style.display = 'none';
    }
  }

  function checkActiveTab() {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) return;
      const tab = tabs[0];
      activeTabId = tab.id;

      // Check if restricted URL
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        btnLaunch.disabled = true;
        btnLaunch.innerHTML = '<span class="btn-label">NOT AVAILABLE ON THIS PAGE</span>';
        btnLaunch.style.fontSize = '11px';
        btnLaunch.style.background = '#1e2638';
        btnLaunch.style.color = '#64748b';
        btnLaunch.style.cursor = 'not-allowed';
        return;
      }

      // Ping tab to check status
      chrome.tabs.sendMessage(tab.id, { action: 'PING' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          isGameActiveOnTab = false;
        } else {
          isGameActiveOnTab = !!response.active;
        }
        updateLaunchButton();
      });
    });
  }

  function updateLaunchButton() {
    if (isGameActiveOnTab) {
      btnLaunch.innerHTML = '<span class="btn-icon">⏹️</span><span class="btn-label">■ ABORT MISSION ■</span>';
      btnLaunch.classList.add('active-state');
    } else {
      btnLaunch.innerHTML = '<span class="btn-icon">🕹️</span><span class="btn-label">► PUSH 1P START ◄</span>';
      btnLaunch.classList.remove('active-state');
    }
  }

  function bindEvents() {
    // Mode Selection
    modeCards.forEach((card) => {
      card.addEventListener('click', () => {
        play8BitBeep(520, 880, 'square', 0.07);
        modeCards.forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        currentSettings.mode = card.dataset.mode;
        saveSettings();
      });
    });

    // Theme Selection
    themePills.forEach((pill) => {
      pill.addEventListener('click', () => {
        play8BitBeep(780, 1170, 'triangle', 0.08);
        themePills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        currentSettings.bladeColor = pill.dataset.theme;
        saveSettings();
      });
    });

    // Intensity Selection
    intensityPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        play8BitBeep(440, 660, 'square', 0.05);
        intensityPills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        currentSettings.effectIntensity = pill.dataset.intensity;
        saveSettings();
      });
    });

    // Volume Slider
    let lastVolSoundTime = 0;
    volumeSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      volumeVal.textContent = `${val}%`;
      currentSettings.soundVolume = val / 100;
      saveSettings();

      const now = performance.now();
      if (now - lastVolSoundTime > 100) {
        lastVolSoundTime = now;
        play8BitBeep(300 + val * 6, null, 'square', 0.03);
      }
    });

    // Dismiss Alert
    if (closeAlertBtn && alertBox) {
      closeAlertBtn.addEventListener('click', () => {
        play8BitBeep(330, 220, 'triangle', 0.06);
        alertBox.style.display = 'none';
        currentSettings.dismissAlert = true;
        saveSettings();
      });
    }

    // Launch Button
    btnLaunch.addEventListener('click', () => {
      if (!activeTabId) return;
      play8BitBeep(523.25, 1046.5, 'square', 0.16);

      if (isGameActiveOnTab) {
        chrome.tabs.sendMessage(activeTabId, { action: 'STOP_GAME' }, () => {
          isGameActiveOnTab = false;
          updateLaunchButton();
          window.close();
        });
      } else {
        // Ping tab first; if not responding, inject scripts and css
        chrome.tabs.sendMessage(activeTabId, { action: 'PING' }, (resp) => {
          if (chrome.runtime.lastError || !resp) {
            // Need injection
            injectAndStart(activeTabId);
          } else {
            // Already loaded, start game
            chrome.tabs.sendMessage(activeTabId, {
              action: 'START_GAME',
              settings: currentSettings
            }, () => {
              window.close();
            });
          }
        });
      }
    });
  }

  function injectAndStart(tabId) {
    chrome.scripting.insertCSS({
      target: { tabId },
      files: ['css/content.css']
    }, () => {
      chrome.scripting.executeScript({
        target: { tabId },
        files: [
          'js/math.js',
          'js/audio.js',
          'js/particles.js',
          'js/fruits.js',
          'js/slicer.js',
          'js/hud.js',
          'js/engine.js',
          'js/content.js'
        ]
      }, () => {
        // Send start game after injection
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, {
            action: 'START_GAME',
            settings: currentSettings
          }, () => {
            window.close();
          });
        }, 80);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
