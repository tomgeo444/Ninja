# ⚔️ SLICE IT: Ninja Mode (Chrome Extension)

Turn any website into a Fruit Ninja-style arcade battlefield packed with cinematic "juice", synthesized Web Audio, and zero external dependencies!

Built strictly with Manifest V3, vanilla JavaScript, HTML5 Canvas, and modern CSS.

---

## 🎮 Features & Juice

- **Tactile Slicing Feel**: Every cut features hit-stops (40–70ms impact freezes), slow-motion ease-ins on multi-target combos, damped camera trauma shake, glowing cut seams, and flying element halves.
- **Dynamic Clone-and-Clip DOM Splitting**: Elements are cloned and clipped along the exact slash angle using CSS `clip-path: polygon(...)` and propelled apart with realistic velocity, angular rotation, and gravity.
- **Tough Elements & Cracks**: Large containers and headers withstand initial blows, displaying glowing neon fractures before exploding on consecutive hits for massive bonus points.
- **Critical Strikes ("PERFECT!")**: Slicing through the exact geometric center of any element triggers a golden shockwave, radiant sparks, and a melodic crystal chime (+50 bonus points).
- **Procedural Canvas Fruits & Bombs**: Flying watermelons, oranges, strawberries, apples, bananas, dragonfruits, and glowing hazard bombs rendered purely with 2D Canvas vector routines (no image assets).
- **Escalating Combo Engine**: Slice 3 or more targets in a continuous stroke to trigger animated typography callouts (`TRIPLE SLICE!`, `QUAD CUT!`, `UNSTOPPABLE!!`) with escalating score multipliers (x2, x3, x5).
- **Fever Mode**: Build up the Fever Meter to unlock 8 seconds of rainbow blade trails, 2x points, electric vignette pulses, and rapid-fire fruit waves.
- **100% Procedurally Synthesized Audio**: Every swoosh, slice transient, crack, bell chime, bomb explosion, and fanfare is synthesized in real-time with the Web Audio API—no audio files needed.
- **Lossless Page Safety**: The underlying page is never permanently altered. Original elements are non-destructively hidden with `visibility: hidden` and are 100% restored upon exiting or clicking "RESTORE PAGE".

---

## 🕹️ Game Modes

1. **Classic (60s Blitz)**: Score as many points as possible in 60 seconds. DOM targets and bonus fruits spawn continuously.
2. **Survival (3 Lives)**: Test your ninja reflexes! Slicing page elements and fruits scores points, but slicing a glowing bomb detonates and costs 1 life.
3. **Zen Mode**: Endless, relaxing slicing battlefield with no timer, no bombs, and no lives. Pure flow state.

---

## ⌨️ Controls & Shortcuts

| Action | Control | Description |
| :--- | :--- | :--- |
| **Slice Target** | `Click & Drag` / `Swipe` | Move the cursor briskly across elements or fruits |
| **Toggle Ninja Mode** | `Alt + S` (or `Option + S` on macOS) | Instantly enters or exits Ninja Mode on the active tab |
| **Emergency Exit** | `Esc` | Immediately halts the game and restores all page elements |
| **Restore Page** | `RESTORE` Button in HUD | Resets and unhides all cut DOM elements while keeping the game active |

---

## 📦 Installation Instructions

1. **Clone or Download** this repository to your local computer.
2. Open Google Chrome (or any Chromium browser such as Brave, Edge, or Opera).
3. Navigate to `chrome://extensions/`.
4. Enable **Developer mode** using the toggle switch in the top-right corner.
5. Click the **Load unpacked** button in the top-left toolbar.
6. Select the extension directory (`/home/tomgeo/exten`).
7. Pin **SLICE IT: Ninja Mode** to your Chrome toolbar for quick access!

---

## 🛡️ Permissions & Privacy Policy

This extension strictly uses the minimal possible permissions required for Manifest V3:

- **`activeTab`**: Grants temporary, sandboxed access to the current active tab only when you explicitly invoke the extension (via the popup or the `Alt+S` shortcut). Zero access to your browsing history or background tabs.
- **`scripting`**: Injects the game canvas, audio engine, and HUD stylesheets on demand when the game is activated.
- **`storage`**: Saves your high scores per mode and your customized preferences (blade color, volume, effect juice intensity) across browser sessions using `chrome.storage.sync` with local fallback.

> **Zero Remote Code**: Contains no third-party CDNs, external scripts, telemetry, or analytics. Everything runs 100% locally on your machine.

---

## ⚙️ Architecture & Implementation Highlights

### 1. Slice Geometry: Sutherland-Hodgman Polygon Clipping
When the blade travels from point $P_1(x_1, y_1)$ to $P_2(x_2, y_2)$, it defines a cutting line $A x + B y + C = 0$.
In [`js/math.js`](file:///home/tomgeo/exten/js/math.js), the function `cutRectangle(w, h, lx1, ly1, lx2, ly2)` tests the four corners and edge intersections of the target element's bounding rectangle against the line's half-planes ($> 0$ and $< 0$).
This generates two independent convex polygons formatted directly as CSS percentage clip-paths:
```css
clip-path: polygon(x1% y1%, x2% y2%, x3% y3%, ...);
```
Both halves receive opposite normal impulse velocities:
$$\vec{v}_A = \vec{n} \cdot v_{\text{push}} + \vec{v}_{\text{slash}} \cdot 0.15$$
$$\vec{v}_B = -\vec{n} \cdot v_{\text{push}} + \vec{v}_{\text{slash}} \cdot 0.15$$

### 2. Time-Scale & Juice Architecture
The central `TimeManager` in [`js/engine.js`](file:///home/tomgeo/exten/js/engine.js) scales all physics:
- **Hit-Stop**: On critical cuts or tough element breaks, `hitStop(55)` sets `dt = 0` for 55 milliseconds, locking all particles, halves, and fruits in place for satisfying tactile crunch.
- **Slow-Motion**: On 3+ combos, `slowMotion(400, 0.3)` smoothly eases the global timeScale down to $0.3\times$, then eases back up to $1.0\times$.
- **Camera Shake**: A damped trauma system (`trauma = min(1.0, trauma + hitTrauma)`) calculates non-linear camera displacement using multi-frequency harmonic trigonometric noise:
  $$x = \text{trauma}^2 \times \text{maxOffset} \times \sin(t \cdot 38) \cos(t \cdot 19)$$

### 3. Procedural Web Audio Synthesis
In [`js/audio.js`](file:///home/tomgeo/exten/js/audio.js):
- **Swoosh**: Bandpass-filtered white noise buffer (`BiquadFilterNode`, Q=2.5) swept from $500\text{Hz}$ to $2400\text{Hz}$ with volume and pitch tied dynamically to blade velocity.
- **Slice**: Dual-layer synthesis combining a sharp highpass noise transient (3000Hz, 40ms) with a descending tonal sweep (850Hz to 220Hz) with random pitch micro-detuning ($\pm 5\%$).
- **Bomb Detonation**: Sub-bass sine oscillator dropping from $160\text{Hz}$ to $28\text{Hz}$ layered with low-pass filtered noise rumble.
- **Critical Chime**: Dual crystal sine waves in a pure harmonic fifth (E6 1318.5Hz + B6 1975.5Hz) with long exponential decay.

### 4. Accessibility & Performance
- **Reduced Motion**: Automatically detects `prefers-reduced-motion` and scales down shake and flashes.
- **Photosensitivity Guard**: Caps flash brightness and displays a warning in the settings popup.
- **Object Pooling**: Pre-allocates a pool of 600 particles and 50 text objects in [`js/particles.js`](file:///home/tomgeo/exten/js/particles.js), avoiding runtime garbage collection pauses for a silky 60 FPS.

---

## 🧪 Testing the Extension

We have bundled dedicated test pages inside [`test/`](file:///home/tomgeo/exten/test):
- **[`test/automated_suite.html`](file:///home/tomgeo/exten/test/automated_suite.html)**: 24 automated unit and integration tests verifying math, audio, particle pools, fruit physics, DOM slicing, and restoration.
- **[`test/test_page.html`](file:///home/tomgeo/exten/test/test_page.html)**: Interactive dojo playground featuring image cards, text blocks, sticky headers, and buttons.

To test standalone in any browser:
Simply open `test/test_page.html` or `test/automated_suite.html` directly in your browser.

---

## 🔮 Roadmap & Future Horizons

- [ ] **Multi-Touch & Mobile Support**: Support for dual-finger slicing on touchscreens and Chromebooks.
- [ ] **Custom Blade Trails**: Particle ribbons, lightning arcs, and cherry blossom leaf streams.
- [ ] **Boss Battles**: Huge multi-stage boss elements that shoot bouncing projectiles.
- [ ] **Global Online Leaderboards**: Optional WebRTC / Firebase arcade leaderboard rooms.
