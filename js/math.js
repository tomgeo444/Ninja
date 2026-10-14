/**
 * SLICE IT: Ninja Mode - Math & Geometry Engine
 * Handles polygon clipping, line-box intersection, critical slice metrics,
 * and damped camera shake noise.
 */

(function (window) {
  'use strict';

  const NinjaMath = {
    // Basic utilities
    clamp(val, min, max) {
      return Math.max(min, Math.min(max, val));
    },

    lerp(a, b, t) {
      return a + (b - a) * t;
    },

    dist(x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      return Math.sqrt(dx * dx + dy * dy);
    },

    distSq(x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      return dx * dx + dy * dy;
    },

    randomRange(min, max) {
      return min + Math.random() * (max - min);
    },

    randomChoice(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    },

    /**
     * Compute perpendicular distance from point P to line passing through A and B.
     */
    distPointToLine(px, py, ax, ay, bx, by) {
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.0001) return NinjaMath.dist(px, py, ax, ay);
      return Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
    },

    /**
     * Check if 2D line segment (p1 -> p2) intersects segment (p3 -> p4).
     * Returns { x, y, t } or null.
     */
    segmentIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
      const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
      if (Math.abs(denom) < 1e-6) return null;

      const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
      const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

      if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
        return {
          x: x1 + ua * (x2 - x1),
          y: y1 + ua * (y2 - y1),
          t: ua
        };
      }
      return null;
    },

    /**
     * Finds intersections of line segment (or extended blade ray) with rectangle [left, top, right, bottom].
     * Returns array of intersection points { x, y, edge } (0 to 2 points).
     */
    intersectSegmentBox(x1, y1, x2, y2, left, top, right, bottom) {
      const edges = [
        { name: 'top', x3: left, y3: top, x4: right, y4: top },
        { name: 'right', x3: right, y3: top, x4: right, y4: bottom },
        { name: 'bottom', x3: right, y3: bottom, x4: left, y4: bottom },
        { name: 'left', x3: left, y3: bottom, x4: left, y4: top }
      ];

      const hits = [];
      for (const e of edges) {
        const hit = NinjaMath.segmentIntersection(x1, y1, x2, y2, e.x3, e.y3, e.x4, e.y4);
        if (hit) {
          hits.push({ x: hit.x, y: hit.y, edge: e.name, t: hit.t });
        }
      }
      return hits;
    },

    /**
     * Checks if line segment intersects a circle (used for fruit and bomb hit detection).
     */
    segmentIntersectsCircle(x1, y1, x2, y2, cx, cy, radius) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;

      if (lenSq === 0) {
        return NinjaMath.dist(x1, y1, cx, cy) <= radius;
      }

      // Projection parameter t
      const t = NinjaMath.clamp(((cx - x1) * dx + (cy - y1) * dy) / lenSq, 0, 1);
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;

      return NinjaMath.distSq(cx, cy, projX, projY) <= radius * radius;
    },

    /**
     * Sutherland-Hodgman Polygon Cutter:
     * Cuts a rectangle [0, 0, W, H] along line (x1, y1) -> (x2, y2) in local element coords.
     * Returns two polygon arrays [polyA, polyB] as arrays of { x, y } in percentages [0..100].
     * Used for CSS clip-path polygon:
     * polygon(x1% y1%, x2% y2%, ...)
     */
    cutRectangle(w, h, lx1, ly1, lx2, ly2) {
      // Line equation: A*x + B*y + C = 0
      const A = ly2 - ly1;
      const B = lx1 - lx2;
      const C = lx2 * ly1 - lx1 * ly2;

      // Function to determine which side of the line a point (px, py) is on
      const side = (px, py) => A * px + B * py + C;

      // Rectangle vertices in clockwise order
      const corners = [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h }
      ];

      // Clip polygon by half-plane: side > 0 or side < 0
      const clipPoly = (isPositiveSide) => {
        const out = [];
        for (let i = 0; i < 4; i++) {
          const cur = corners[i];
          const next = corners[(i + 1) % 4];

          const curSide = side(cur.x, cur.y);
          const nextSide = side(next.x, next.y);

          const curIn = isPositiveSide ? curSide >= -1e-4 : curSide <= 1e-4;
          const nextIn = isPositiveSide ? nextSide >= -1e-4 : nextSide <= 1e-4;

          if (curIn) {
            out.push({ x: cur.x, y: cur.y });
          }

          if (curIn !== nextIn) {
            // Compute edge intersection with the cutting line
            const t = curSide / (curSide - nextSide);
            out.push({
              x: cur.x + t * (next.x - cur.x),
              y: cur.y + t * (next.y - cur.y)
            });
          }
        }
        return out;
      };

      const polyA = clipPoly(true);
      const polyB = clipPoly(false);

      // Convert points to percentage strings for CSS clip-path
      const toCssPoly = (poly) => {
        if (!poly || poly.length < 3) return null;
        return (
          'polygon(' +
          poly
            .map((p) => {
              const px = NinjaMath.clamp((p.x / w) * 100, 0, 100).toFixed(2);
              const py = NinjaMath.clamp((p.y / h) * 100, 0, 100).toFixed(2);
              return `${px}% ${py}%`;
            })
            .join(', ') +
          ')'
        );
      };

      return {
        polyA: toCssPoly(polyA),
        polyB: toCssPoly(polyB),
        rawA: polyA,
        rawB: polyB
      };
    },

    /**
     * Damped Screen Shake Trauma:
     * Generates smooth, non-repeating camera shake offsets using pseudo-noise frequencies.
     */
    calculateTraumaShake(trauma, time, maxOffset = 24, maxAngle = 4.5) {
      if (trauma <= 0.001) return { x: 0, y: 0, angle: 0 };
      // Shake magnitude is trauma squared for punchy feel
      const shake = trauma * trauma;
      const x = maxOffset * shake * Math.sin(time * 38.0) * Math.cos(time * 19.0);
      const y = maxOffset * shake * Math.cos(time * 43.0) * Math.sin(time * 23.0);
      const angle = maxAngle * shake * Math.sin(time * 31.0);
      return { x, y, angle };
    }
  };

  window.NinjaMath = NinjaMath;
})(window);
