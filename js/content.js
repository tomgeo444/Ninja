/**
 * SLICE IT: Ninja Mode - Main Content Script & Lifecycle Controller
 * Sets up DOM isolation, high-frequency pointer capture (with coalesced events),
 * global keyboard shortcuts (Alt+S toggle, Esc exit), and extension messaging.
 */

(function () {
  'use strict';

  if (window.__SLICE_IT_CONTROLLER__) {
    // Already injected in this frame
    return;
  }

  class ContentController {
    constructor() {
      this.root = null;
      this.viewport = null;
      this.canvas = null;
      this.halvesContainer = null;
      this.boundPointerMove = null;
      this.boundPointerDown = null;
      this.boundPointerUp = null;
      this.boundKeyDown = null;
      this.boundResize = null;
      this.isInitialized = false;

      this.setupGlobalKeyListener();
      this.setupMessageListener();
    }

    setupGlobalKeyListener() {
      // Global Alt+S toggle and Esc exit
      window.addEventListener(
        'keydown',
        (e) => {
          // Alt+S (or Option+S on Mac)
          if (e.altKey && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            e.stopPropagation();
            this.toggleGame();
            return;
          }

          // Esc exits Ninja Mode
          if (e.key === 'Escape' && window.NinjaEngine && window.NinjaEngine.isRunning) {
            e.preventDefault();
            e.stopPropagation();
            this.stopGame();
          }
        },
        true
      );
    }

    setupMessageListener() {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
          if (msg.action === 'PING') {
            sendResponse({
              status: 'READY',
              active: !!(window.NinjaEngine && window.NinjaEngine.isRunning)
            });
            return true;
          }

          if (msg.action === 'START_GAME') {
            this.startGame(msg.settings || {});
            sendResponse({ status: 'STARTED' });
            return true;
          }

          if (msg.action === 'STOP_GAME') {
            this.stopGame();
            sendResponse({ status: 'STOPPED' });
            return true;
          }

          if (msg.action === 'TOGGLE_GAME') {
            const isActive = this.toggleGame(msg.settings || {});
            sendResponse({ status: isActive ? 'STARTED' : 'STOPPED' });
            return true;
          }

          if (msg.action === 'UPDATE_SETTINGS') {
            if (window.NinjaEngine) {
              window.NinjaEngine.applySettings(msg.settings || {});
            }
            sendResponse({ status: 'UPDATED' });
            return true;
          }
        });
      }
    }

    buildDOM() {
      // Ensure any existing root is cleaned up
      const oldRoot = document.getElementById('slice-it-root');
      if (oldRoot) oldRoot.remove();

      const root = document.createElement('div');
      root.id = 'slice-it-root';

      const viewport = document.createElement('div');
      viewport.id = 'slice-it-viewport';

      const halves = document.createElement('div');
      halves.id = 'slice-it-halves-container';

      const canvas = document.createElement('canvas');
      canvas.id = 'slice-it-canvas';

      viewport.appendChild(halves);
      viewport.appendChild(canvas);
      root.appendChild(viewport);

      document.body.appendChild(root);

      this.root = root;
      this.viewport = viewport;
      this.canvas = canvas;
      this.halvesContainer = halves;
    }

    bindEvents() {
      // High-precision pointer tracking supporting coalesced gaming mouse events
      this.boundPointerMove = (e) => {
        if (!window.NinjaEngine) return;
        const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
        for (const ev of events) {
          window.NinjaEngine.handlePointerMove(ev.clientX, ev.clientY);
        }
      };

      this.boundPointerDown = (e) => {
        if (window.NinjaAudio) {
          window.NinjaAudio.init();
        }
        if (window.NinjaEngine) {
          window.NinjaEngine.handlePointerMove(e.clientX, e.clientY);
        }
      };

      this.boundPointerUp = () => {
        if (window.NinjaEngine) {
          window.NinjaEngine.evaluateStrokeEnd();
        }
      };

      this.boundResize = () => {
        if (window.NinjaEngine) {
          window.NinjaEngine.resizeCanvas();
        }
      };

      // Block right-clicks & text drag on the battlefield
      const blockEvent = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };

      this.canvas.addEventListener('pointermove', this.boundPointerMove, { passive: true });
      this.canvas.addEventListener('pointerdown', this.boundPointerDown);
      window.addEventListener('pointerup', this.boundPointerUp);
      window.addEventListener('resize', this.boundResize);

      this.root.addEventListener('contextmenu', blockEvent);
      this.root.addEventListener('selectstart', blockEvent);
      this.root.addEventListener('dragstart', blockEvent);
    }

    startGame(settings = {}) {
      this.buildDOM();
      this.bindEvents();

      // Initialize sub-systems
      window.NinjaHUD.init(this.root);
      window.NinjaDOMSlicer.init(this.halvesContainer);
      window.NinjaEngine.init(this.canvas, this.viewport, settings);
      window.NinjaEngine.startGame();
    }

    stopGame() {
      if (window.NinjaEngine) {
        window.NinjaEngine.stopGame();
      }
      if (this.root && this.root.parentNode) {
        this.root.parentNode.removeChild(this.root);
      }
      this.root = null;
    }

    toggleGame(settings = {}) {
      if (window.NinjaEngine && window.NinjaEngine.isRunning) {
        this.stopGame();
        return false;
      } else {
        this.startGame(settings);
        return true;
      }
    }
  }

  window.__SLICE_IT_CONTROLLER__ = new ContentController();
})();
