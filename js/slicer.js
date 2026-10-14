/**
 * SLICE IT: Ninja Mode - DOM Target Element Slicer & Clone-and-Clip Engine
 * Safely slices DOM elements into flying halves using CSS clip-path polygons,
 * handles crack overlays for tough elements, critical centered slices,
 * samples element colors, and guarantees 100% lossless DOM page restoration.
 */

(function (window) {
  'use strict';

  class DOMSlicer {
    constructor() {
      this.hiddenOriginals = new Map(); // element -> { visibility, pointerEvents }
      this.elementCrackRecords = new Map(); // element -> { hits, maxHits }
      this.activeHalves = []; // flying half DOM wrappers
      this.maxHalves = 40; // DOM ceiling to prevent lag
      this.halvesContainer = null;
    }

    init(container) {
      this.halvesContainer = container;
      this.hiddenOriginals.clear();
      this.elementCrackRecords.clear();
      this.clearAllHalves();
    }

    clearAllHalves() {
      for (const half of this.activeHalves) {
        if (half.el && half.el.parentNode) {
          half.el.parentNode.removeChild(half.el);
        }
      }
      this.activeHalves = [];
    }

    /**
     * Restore all hidden elements back to pristine condition.
     */
    restoreAll() {
      this.clearAllHalves();

      for (const [el, original] of this.hiddenOriginals) {
        if (el) {
          el.style.visibility = original.visibility || '';
          el.style.pointerEvents = original.pointerEvents || '';
          delete el.dataset.sliceItHidden;
        }
      }
      this.hiddenOriginals.clear();
      this.elementCrackRecords.clear();
      NinjaEffects.clearCracks();
    }

    /**
     * Determine point value based on tag and role.
     */
    getElementPoints(tag, el) {
      switch (tag) {
        case 'BUTTON':
          return 20;
        case 'IMG':
        case 'PICTURE':
        case 'VIDEO':
        case 'SVG':
          return 15;
        case 'H1':
        case 'H2':
        case 'H3':
        case 'H4':
        case 'H5':
        case 'H6':
          return 10;
        case 'P':
          return 5;
        case 'A':
          return 8;
        default:
          return 10;
      }
    }

    /**
     * Sample color from element's computed styling.
     */
    sampleElementColor(el) {
      try {
        const style = window.getComputedStyle(el);
        const bg = style.backgroundColor;
        const color = style.color;

        // Check if bg is non-transparent
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          return bg;
        }
        if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
          return color;
        }
      } catch (e) {}

      // Default vibrant juice palette
      return NinjaMath.randomChoice(['#ff2a51', '#00f0ff', '#ff9900', '#39ff14', '#e040fb']);
    }

    /**
     * Find all candidate sliceable DOM elements currently in viewport.
     */
    findCandidateElements() {
      const candidates = document.querySelectorAll(
        'img, picture, h1, h2, h3, h4, h5, h6, button, p, a, li, blockquote, pre, table, [role="button"], article, section, .card, [class*="card"], [class*="target"], [class*="item"], [class*="box"]'
      );

      const valid = [];
      const vWidth = window.innerWidth || document.documentElement.clientWidth || 1920;
      const vHeight = window.innerHeight || document.documentElement.clientHeight || 1080;

      for (let i = 0; i < candidates.length; i++) {
        const el = candidates[i];

        // Never slice our own extension UI
        if (el.closest('#slice-it-root') || el.closest('#slice-it-halves-container')) continue;

        // Skip already sliced/hidden elements
        if (el.dataset.sliceItHidden === 'true' || el.style.visibility === 'hidden') continue;

        const rect = el.getBoundingClientRect();

        // Must be in viewport and reasonably sized
        if (
          rect.width < 25 ||
          rect.height < 18 ||
          rect.bottom < 0 ||
          rect.top > vHeight ||
          rect.right < 0 ||
          rect.left > vWidth
        ) {
          continue;
        }

        // Avoid slicing parent containers if they contain candidate child elements
        if (el.tagName !== 'BUTTON' && el.tagName !== 'A' && el.children.length > 0) {
          const hasCandidateChild = el.querySelector('img, h1, h2, h3, h4, h5, h6, p, button, a');
          if (hasCandidateChild) continue;
        }

        valid.push({ el, rect, tag: el.tagName });
      }

      return valid;
    }

    /**
     * Check if a slash segment (x1, y1) -> (x2, y2) slices any DOM element.
     */
    checkSlice(x1, y1, x2, y2, slashAngle, slashSpeed) {
      const candidates = this.findCandidateElements();
      const results = [];

      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);

      for (const item of candidates) {
        const { el, rect, tag } = item;

        // Quick AABB overlap check
        if (maxX < rect.left || minX > rect.right || maxY < rect.top || minY > rect.bottom) {
          continue;
        }

        // Test intersection of blade segment with element box
        const hits = NinjaMath.intersectSegmentBox(
          x1,
          y1,
          x2,
          y2,
          rect.left,
          rect.top,
          rect.right,
          rect.bottom
        );

        // A slice cuts completely through or intersects the box
        const centerDist = NinjaMath.distPointToLine(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
          x1,
          y1,
          x2,
          y2
        );

        const insideBlade =
          (x1 >= rect.left && x1 <= rect.right && y1 >= rect.top && y1 <= rect.bottom) ||
          (x2 >= rect.left && x2 <= rect.right && y2 >= rect.top && y2 <= rect.bottom);

        if (hits.length >= 2 || (hits.length >= 1 && insideBlade) || insideBlade) {
          // Check for Critical Slice ("PERFECT!")
          const minDim = Math.min(rect.width, rect.height);
          const isCritical = centerDist < minDim * 0.16;

          // Check if element is "Tough" (needs multiple hits)
          const area = rect.width * rect.height;
          const isTough = area > 45000 || rect.width > 350;

          if (isTough) {
            let crackRec = this.elementCrackRecords.get(el);
            if (!crackRec) {
              crackRec = { hits: 0, maxHits: area > 90000 ? 3 : 2 };
              this.elementCrackRecords.set(el, crackRec);
            }

            crackRec.hits++;

            if (crackRec.hits < crackRec.maxHits) {
              // Add glowing crack line overlay
              const crackColor = this.sampleElementColor(el);
              NinjaEffects.addCrack(x1, y1, x2, y2, crackColor);
              NinjaEffects.spawnSparks((x1 + x2) / 2, (y1 + y2) / 2, 10, crackColor);

              results.push({
                el,
                rect,
                tag,
                isToughHit: true,
                isShattered: false,
                points: 10,
                color: crackColor,
                centerX: rect.left + rect.width / 2,
                centerY: rect.top + rect.height / 2,
                isCritical: false
              });
              continue; // Do not split yet!
            }
          }

          // Element splits!
          const color = this.sampleElementColor(el);
          const basePoints = this.getElementPoints(tag, el);
          const points = isTough ? basePoints + 40 : basePoints + (isCritical ? 50 : 0);

          this.splitElement(el, rect, x1, y1, x2, y2, slashAngle, slashSpeed);

          results.push({
            el,
            rect,
            tag,
            isToughHit: isTough,
            isShattered: true,
            points,
            color,
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
            isCritical
          });
        }
      }

      return results;
    }

    /**
     * Clone-and-Clip DOM splitting: Creates two wrappers, clips them, and launches them.
     */
    splitElement(el, rect, x1, y1, x2, y2, slashAngle, slashSpeed) {
      if (!this.halvesContainer) return;

      // Local cut coords
      const lx1 = x1 - rect.left;
      const ly1 = y1 - rect.top;
      const lx2 = x2 - rect.left;
      const ly2 = y2 - rect.top;

      const clipped = NinjaMath.cutRectangle(rect.width, rect.height, lx1, ly1, lx2, ly2);
      if (!clipped || !clipped.polyA || !clipped.polyB) {
        // Fallback: horizontal split
        clipped.polyA = 'polygon(0% 0%, 100% 0%, 100% 50%, 0% 50%)';
        clipped.polyB = 'polygon(0% 50%, 100% 50%, 100% 100%, 0% 100%)';
      }

      // Hide original safely
      this.hiddenOriginals.set(el, {
        visibility: el.style.visibility,
        pointerEvents: el.style.pointerEvents
      });
      el.dataset.sliceItHidden = 'true';
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';

      // Slicing normal for push separation
      const nx = -Math.sin(slashAngle);
      const ny = Math.cos(slashAngle);
      const pushSpeed = NinjaMath.randomRange(160, 260);

      // Create two clone wrappers
      const createHalf = (polyClip, pushDir, spinDir) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'slice-it-clone-half';
        wrapper.style.position = 'fixed';
        wrapper.style.left = `${rect.left}px`;
        wrapper.style.top = `${rect.top}px`;
        wrapper.style.width = `${rect.width}px`;
        wrapper.style.height = `${rect.height}px`;
        wrapper.style.pointerEvents = 'none';
        wrapper.style.zIndex = '999997';
        wrapper.style.clipPath = polyClip;
        wrapper.style.webkitClipPath = polyClip;
        wrapper.style.overflow = 'hidden';
        wrapper.style.margin = '0';
        wrapper.style.boxSizing = 'border-box';
        wrapper.style.willChange = 'transform, opacity';

        // Deep clone the element
        const clone = el.cloneNode(true);
        // Ensure clone visibility
        clone.style.visibility = 'visible';
        clone.style.margin = '0';
        clone.style.transform = 'none';
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;

        wrapper.appendChild(clone);
        this.halvesContainer.appendChild(wrapper);

        return {
          el: wrapper,
          x: rect.left,
          y: rect.top,
          vx: pushDir * nx * pushSpeed + (Math.cos(slashAngle) * slashSpeed * 0.15) + NinjaMath.randomRange(-30, 30),
          vy: pushDir * ny * pushSpeed + (Math.sin(slashAngle) * slashSpeed * 0.15) - NinjaMath.randomRange(60, 140),
          rotation: 0,
          vRot: spinDir * NinjaMath.randomRange(1.8, 4.2),
          alpha: 1.0,
          life: 1.8,
          maxLife: 1.8
        };
      };

      const halfA = createHalf(clipped.polyA, 1, 1);
      const halfB = createHalf(clipped.polyB, -1, -1);

      this.activeHalves.push(halfA, halfB);

      // Enforce DOM half ceiling
      while (this.activeHalves.length > this.maxHalves) {
        const oldest = this.activeHalves.shift();
        if (oldest && oldest.el && oldest.el.parentNode) {
          oldest.el.parentNode.removeChild(oldest.el);
        }
      }
    }

    update(dt) {
      for (let i = this.activeHalves.length - 1; i >= 0; i--) {
        const h = this.activeHalves[i];
        h.life -= dt;

        if (h.life <= 0) {
          if (h.el && h.el.parentNode) {
            h.el.parentNode.removeChild(h.el);
          }
          this.activeHalves.splice(i, 1);
          continue;
        }

        h.vy += 850 * dt; // Gravity
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        h.rotation += h.vRot * dt;

        if (h.life < 0.6) {
          h.alpha = h.life / 0.6;
        }

        // Apply hardware-accelerated transform
        const dx = h.x - parseFloat(h.el.style.left);
        const dy = h.y - parseFloat(h.el.style.top);
        h.el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) rotate(${h.rotation.toFixed(2)}rad)`;
        h.el.style.opacity = h.alpha.toFixed(2);
      }
    }
  }

  window.NinjaDOMSlicer = new DOMSlicer();
})(window);
