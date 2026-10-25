// PAC World Kit: block worlds for code screens, on three.js.
//
//   import { World } from "pac-world";
//   const world = new World({ terrain: "hills", save: "main" });
//   world.on("place", (e) => { if (e.block === "tnt") e.cancel(); });
//   await world.start();
//
// Tap to place the selected block, hold to break it. Left side of the screen moves, right side
// looks. Everything is drawn from code, so there are no image files to load.

import * as THREE from "three";

// MARK: Blocks

const BUILTIN_BLOCKS = {
  grass: { top: "#6DAA3C", side: "#8A6642", bottom: "#8A6642", sideTop: "#6DAA3C" },
  dirt: { color: "#8A6642" },
  stone: { color: "#8C8C8C" },
  cobblestone: { color: "#7A7A7A", pattern: "cobble" },
  sand: { color: "#E3D29A" },
  gravel: { color: "#8E8580", pattern: "cobble" },
  wood: { top: "#B48A55", side: "#6E4E2E", bottom: "#B48A55", pattern: "bark" },
  planks: { color: "#B8925A", pattern: "planks" },
  leaves: { color: "#3F8A2E", pattern: "leaves" },
  glass: { color: "#CFEFFF", transparent: true, pattern: "glass" },
  water: { color: "#3A7BD5", transparent: true, solid: false, pattern: "water" },
  brick: { color: "#A24A3A", pattern: "brick" },
  snow: { color: "#F4F8FB" },
  ice: { color: "#A8D4F5", transparent: true },
  gold: { color: "#F2C230", pattern: "ore" },
  diamond: { color: "#4FD8D0", pattern: "ore" },
  coal: { color: "#2E2E2E", pattern: "ore" },
  lava: { color: "#FF6A1A", solid: false, glow: true },
  wool: { color: "#EDEDED" },
  red: { color: "#D23B3B" }, orange: { color: "#EE8A2C" }, yellow: { color: "#F1D33C" },
  green: { color: "#4CB648" }, blue: { color: "#3D6FE0" }, purple: { color: "#8A4FD6" },
  pink: { color: "#EE7FB8" }, black: { color: "#222222" }, white: { color: "#FAFAFA" },
  pumpkin: { top: "#C8741E", side: "#E38A24", bottom: "#C8741E", pattern: "ribs" },
  tnt: { top: "#D9D9D9", side: "#D23B3B", bottom: "#D9D9D9", pattern: "tnt" },
  bookshelf: { top: "#B8925A", side: "#7A4E2A", bottom: "#B8925A", pattern: "books" },
  lamp: { color: "#FFE9A3", glow: true },
};

const DEFAULT_HOTBAR = ["grass", "dirt", "stone", "planks", "wood", "glass", "brick", "sand", "leaves"];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const v = parseInt(String(hex).replace("#", ""), 16) || 0;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

const TILE = 16;

/** Paints one 16×16 tile in a pixel style. */
function paintTile(ctx, ox, color, pattern, random, extra) {
  const [r, g, b] = hexToRgb(color);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      let k = 0.88 + random() * 0.24;
      let a = 1;
      switch (pattern) {
        case "cobble": k *= ((x * 7 + y * 13) % 5 === 0 || (x + y * 3) % 7 === 0) ? 0.72 : 1; break;
        case "planks": k *= y % 4 === 3 ? 0.7 : (x === ((y >> 2) * 5) % 16 ? 0.8 : 1); break;
        case "bark": k *= x % 4 === 0 ? 0.75 : 1; break;
        case "leaves": k *= random() < 0.25 ? 0.6 : 1; break;
        case "brick": k *= (y % 4 === 3 || (x + (((y >> 2) & 1) * 4)) % 8 === 7) ? 1.35 : 1; break;
        case "ore": k *= random() < 0.18 ? 1.4 : 1; break;
        case "ribs": k *= x % 5 === 0 ? 0.8 : 1; break;
        case "glass": a = (x === 0 || y === 0 || x === 15 || y === 15) ? 0.9 : 0.18; k = (x + y) % 9 === 0 ? 1.2 : 1; break;
        case "water": a = 0.62; k = 0.9 + Math.sin((x + y) * 0.7) * 0.06 + random() * 0.05; break;
        case "tnt": k *= (y > 5 && y < 10) ? (x % 3 === 0 ? 0.4 : 1.6) : 1; break;
        case "books": k *= (y > 2 && y < 7) || (y > 9 && y < 14) ? (x % 3 === 0 ? 0.5 : 1.25) : 1; break;
      }
      if (extra && y < extra.rows) {
        const [er, eg, eb] = hexToRgb(extra.color);
        const kk = 0.88 + random() * 0.24;
        ctx.fillStyle = `rgba(${Math.min(255, er * kk) | 0},${Math.min(255, eg * kk) | 0},${Math.min(255, eb * kk) | 0},1)`;
      } else {
        ctx.fillStyle = `rgba(${Math.min(255, r * k) | 0},${Math.min(255, g * k) | 0},${Math.min(255, b * k) | 0},${a})`;
      }
      ctx.fillRect(ox + x, y, 1, 1);
    }
  }
}

/** Paints a hand-made 16×16 face: 256 colours, row by row ("#RRGGBB", or "" for see-through). */
function paintPixels(ctx, ox, pixels) {
  for (let i = 0; i < TILE * TILE; i++) {
    const c = pixels[i];
    if (!c) continue;
    ctx.fillStyle = c;
    ctx.fillRect(ox + (i % TILE), (i / TILE) | 0, 1, 1);
  }
}

/** A built-in block's faces as pixels (top, side, bottom), to start a new design from. */
export function blockPixels(name) {
  const d = BUILTIN_BLOCKS[name];
  if (!d) return null;
  const out = {};
  const canvas = document.createElement("canvas");
  canvas.width = TILE; canvas.height = TILE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  for (const [i, face] of ["top", "side", "bottom"].entries()) {
    ctx.clearRect(0, 0, TILE, TILE);
    const color = d[face] || d.color || "#ff00ff";
    const pattern = face === "side" || !d.top ? d.pattern : (d.pattern === "bark" ? "ribs" : d.pattern);
    paintTile(ctx, 0, color, pattern, rng(7 * 31 + i), face === "side" && d.sideTop ? { color: d.sideTop, rows: 3 } : null);
    const data = ctx.getImageData(0, 0, TILE, TILE).data;
    out[face] = Array.from({ length: TILE * TILE }, (_, j) => data[j * 4 + 3] < 128 ? "" : "#" + [0, 1, 2].map((k) => data[j * 4 + k].toString(16).padStart(2, "0")).join(""));
  }
  return out;
}

export const TILE_SIZE = TILE;

// Each face: outward direction, corners (counter-clockwise from outside), brightness, which texture.
const FACES = [
  { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.8, tex: "side" },
  { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.8, tex: "side" },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0, tex: "top" },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5, tex: "bottom" },
  { dir: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], shade: 0.65, tex: "side" },
  { dir: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.65, tex: "side" },
];
const SIDE_UV = [[0, 0], [0, 1], [1, 1], [1, 0]];
const FLAT_UV = [[0, 0], [1, 0], [1, 1], [0, 1]];

// MARK: Noise

function makeNoise(seed) {
  const random = rng(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = (random() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const value = (x, z) => perm[(perm[x & 255] + z) & 255] / 255;
  const smooth = (t) => t * t * (3 - 2 * t);
  function noise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = smooth(x - xi), zf = smooth(z - zi);
    const a = value(xi, zi), b = value(xi + 1, zi), c = value(xi, zi + 1), d = value(xi + 1, zi + 1);
    return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf;
  }
  return function fbm(x, z, octaves = 4) {
    let total = 0, amp = 1, freq = 1, max = 0;
    for (let o = 0; o < octaves; o++) { total += noise(x * freq, z * freq) * amp; max += amp; amp *= 0.5; freq *= 2; }
    return total / max;
  };
}

// MARK: World

export class World {
  constructor(options = {}) {
    this.options = options;
    this.sizeX = Math.min(Math.max(options.size ?? 64, 16), 160);
    this.sizeZ = Math.min(Math.max(options.depth ?? options.size ?? 64, 16), 160);
    this.sizeY = Math.min(Math.max(options.height ?? 40, 16), 64);
    this.seed = options.seed ?? 1234;
    this.waterLevel = options.waterLevel ?? (options.terrain === "islands" ? 11 : 8);
    this.container = options.container || document.body;
    this.listeners = {};
    this.blockIds = { air: 0 };
    this.blockDefs = [null];
    for (const [name, def] of Object.entries(BUILTIN_BLOCKS)) this.defineBlock(name, def);
    for (const [name, def] of Object.entries(options.blocks || {})) this.defineBlock(name, def);
    this.data = new Uint8Array(this.sizeX * this.sizeY * this.sizeZ);
    this.edits = {};
    this.entities = [];
    this.hotbar = (options.hotbar || DEFAULT_HOTBAR).filter((b) => this.blockIds[b]);
    this.selected = 0;
    this.time = options.sky === "night" ? 0.0 : options.sky === "sunset" ? 0.23 : 0.5;
    this.player = new Player(this);
    this.flyAllowed = options.fly !== false;
    // HUD text, messages and buttons asked for before start() are shown once the controls exist.
    this.pendingUI = [];
  }

  /** Adds or replaces a block type: { color } or { top, side, bottom }, plus transparent, solid, glow, pattern. */
  defineBlock(name, def) {
    if (this.atlas) throw new Error("Define blocks before world.start()");
    const id = this.blockIds[name] ?? this.blockDefs.length;
    if (id > 255) throw new Error("Too many block types (255 at most)");
    this.blockIds[name] = id;
    this.blockDefs[id] = { name, solid: def.solid !== false, transparent: !!def.transparent, glow: !!def.glow, ...def };
  }

  on(event, callback) {
    (this.listeners[event] = this.listeners[event] || new Set()).add(callback);
    return () => this.listeners[event].delete(callback);
  }

  emit(event, data) {
    for (const callback of this.listeners[event] || []) {
      try { callback(data); } catch (e) { console.error(e); }
    }
  }

  // MARK: Blocks

  index(x, y, z) { return x + this.sizeX * (z + this.sizeZ * y); }
  inside(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.sizeX && y < this.sizeY && z < this.sizeZ; }
  id(x, y, z) { return this.inside(x, y, z) ? this.data[this.index(x, y, z)] : 0; }
  def(x, y, z) { return this.blockDefs[this.id(x, y, z)]; }
  isSolid(x, y, z) {
    if (y < 0) return true;
    if (!this.inside(x, y, z)) return x < 0 || z < 0 || x >= this.sizeX || z >= this.sizeZ; // invisible walls
    const d = this.blockDefs[this.data[this.index(x, y, z)]];
    return !!(d && d.solid);
  }

  /** The block's name at a position, or null for air. */
  getBlock(x, y, z) { const d = this.def(Math.floor(x), Math.floor(y), Math.floor(z)); return d ? d.name : null; }

  /** Sets a block by name (null or "air" clears it). Saved with the world. */
  setBlock(x, y, z, name, { save = true } = {}) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (!this.inside(x, y, z)) return false;
    const id = name == null || name === "air" ? 0 : this.blockIds[name];
    if (id === undefined) { console.warn(`Unknown block "${name}"`); return false; }
    const i = this.index(x, y, z);
    if (this.data[i] === id) return true;
    this.data[i] = id;
    if (save && this.started) { this.edits[`${x},${y},${z}`] = id; this.scheduleSave(); }
    this.markDirty(x, z);
    return true;
  }

  /** Fills a box of blocks, inclusive. */
  fill(x1, y1, z1, x2, y2, z2, name) {
    const [ax, bx] = [Math.min(x1, x2), Math.max(x1, x2)], [ay, by] = [Math.min(y1, y2), Math.max(y1, y2)], [az, bz] = [Math.min(z1, z2), Math.max(z1, z2)];
    if ((bx - ax + 1) * (by - ay + 1) * (bz - az + 1) > 200000) throw new Error("fill is limited to 200,000 blocks");
    for (let y = ay; y <= by; y++) for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) this.setBlock(x, y, z, name);
  }

  /** Height of the highest solid block in a column, plus one (where you'd stand). */
  surface(x, z) {
    for (let y = this.sizeY - 1; y >= 0; y--) if (this.isSolid(Math.floor(x), y, Math.floor(z))) return y + 1;
    return 0;
  }

  // MARK: Terrain

  generate() {
    const terrain = this.options.terrain || "hills";
    const random = rng(this.seed * 7 + 3);
    const custom = typeof this.options.generate === "function" ? this.options.generate : null;
    if (custom) {
      const fbm = makeNoise(this.seed);
      for (let y = 0; y < this.sizeY; y++) for (let z = 0; z < this.sizeZ; z++) for (let x = 0; x < this.sizeX; x++) {
        const name = custom(x, y, z, fbm);
        if (name) { const id = this.blockIds[name]; if (id) this.data[this.index(x, y, z)] = id; }
      }
      return;
    }
    const B = this.blockIds;
    if (terrain === "empty") {
      const cx = this.sizeX >> 1, cz = this.sizeZ >> 1;
      for (let z = cz - 4; z <= cz + 4; z++) for (let x = cx - 4; x <= cx + 4; x++) this.data[this.index(x, 0, z)] = B.stone;
      return;
    }
    if (terrain === "flat") {
      for (let z = 0; z < this.sizeZ; z++) for (let x = 0; x < this.sizeX; x++) {
        this.data[this.index(x, 0, z)] = B.stone;
        for (let y = 1; y < 3; y++) this.data[this.index(x, y, z)] = B.dirt;
        this.data[this.index(x, 3, z)] = B.grass;
      }
      return;
    }
    const fbm = makeNoise(this.seed);
    const islands = terrain === "islands";
    const heights = new Int16Array(this.sizeX * this.sizeZ);
    for (let z = 0; z < this.sizeZ; z++) for (let x = 0; x < this.sizeX; x++) {
      let n = fbm(x / 28, z / 28, 4);
      if (islands) {
        const dx = (x - this.sizeX / 2) / (this.sizeX / 2), dz = (z - this.sizeZ / 2) / (this.sizeZ / 2);
        n = n * 1.2 - Math.sqrt(dx * dx + dz * dz) * 0.55;
      }
      const h = Math.max(1, Math.min(this.sizeY - 8, Math.floor(4 + n * (islands ? 22 : 18))));
      heights[x + z * this.sizeX] = h;
      for (let y = 0; y < h; y++) {
        let id = B.stone;
        if (y === h - 1) id = h <= this.waterLevel + 1 ? B.sand : (h > this.sizeY - 14 ? B.snow : B.grass);
        else if (y >= h - 4) id = h <= this.waterLevel + 1 ? B.sand : B.dirt;
        else if (random() < 0.012) id = random() < 0.25 ? B.gold : random() < 0.3 ? B.diamond : B.coal;
        this.data[this.index(x, y, z)] = id;
      }
      for (let y = h; y <= this.waterLevel; y++) this.data[this.index(x, y, z)] = B.water;
    }
    if (this.options.trees !== false) {
      for (let z = 3; z < this.sizeZ - 3; z++) for (let x = 3; x < this.sizeX - 3; x++) {
        const h = heights[x + z * this.sizeX];
        if (this.data[this.index(x, h - 1, z)] !== B.grass || random() > 0.018) continue;
        const trunk = 4 + ((random() * 2) | 0);
        for (let y = h; y < h + trunk && y < this.sizeY; y++) this.data[this.index(x, y, z)] = B.wood;
        for (let dy = -2; dy <= 1; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
          const r = Math.abs(dx) + Math.abs(dz) + Math.max(0, dy);
          const y = h + trunk + dy;
          if (r > 3 || !this.inside(x + dx, y, z + dz) || this.data[this.index(x + dx, y, z + dz)]) continue;
          if (dy === 1 && r > 1) continue;
          this.data[this.index(x + dx, y, z + dz)] = B.leaves;
        }
      }
    }
  }

  // MARK: Saving

  get saveKey() { return this.options.save ? `world:${this.options.save}` : null; }

  async load() {
    if (!this.saveKey || !window.pac) return;
    try {
      const saved = await pac.storage.get(this.saveKey);
      if (!saved || saved.seed !== this.seed) return;
      const names = saved.names || {};
      for (const [key, raw] of Object.entries(saved.edits || {})) {
        const [x, y, z] = key.split(",").map(Number);
        const name = names[raw] ?? raw;
        const id = name === 0 || name === "air" ? 0 : this.blockIds[name];
        if (id === undefined || !this.inside(x, y, z)) continue;
        this.data[this.index(x, y, z)] = id;
        this.edits[key] = id;
      }
      if (saved.player) this.player.position.set(saved.player[0], saved.player[1], saved.player[2]);
      this.restored = true;
    } catch (e) { console.warn("Couldn't load the saved world", e); }
  }

  scheduleSave() {
    if (!this.saveKey) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 1500);
  }

  /** Saves the world now (it also saves itself a moment after each change). */
  async save() {
    if (!this.saveKey || !window.pac) return;
    const names = {};
    const edits = {};
    for (const [key, id] of Object.entries(this.edits)) { edits[key] = id; names[id] = id === 0 ? "air" : this.blockDefs[id].name; }
    const p = this.player.position;
    try { await pac.storage.set(this.saveKey, { seed: this.seed, edits, names, player: [p.x, p.y, p.z] }); }
    catch (e) { console.warn("Couldn't save the world", e); }
  }

  // MARK: Start

  /** Builds the world, the view and the controls. Resolves when the first frame is drawn. */
  async start() {
    this.root = document.createElement("div");
    this.root.style.cssText = "position:fixed;inset:0;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;background:#9fd3ff";
    const loading = document.createElement("div");
    loading.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:600 17px -apple-system,system-ui;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.4)";
    loading.textContent = "Building world…";
    this.root.appendChild(loading);
    this.container.appendChild(this.root);
    document.body.style.padding = "0";
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

    this.generate();
    this.placePlayer();
    await this.load();
    this.started = true;

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.root.appendChild(this.renderer.domElement);
    loading.remove();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 400);
    this.scene.fog = new THREE.Fog(0x9fd3ff, this.sizeX * 0.45, this.sizeX * 1.15);
    this.buildAtlas();
    this.opaque = new THREE.MeshBasicMaterial({ map: this.texture, vertexColors: true, alphaTest: 0.5 });
    this.clear = new THREE.MeshBasicMaterial({ map: this.texture, vertexColors: true, transparent: true, depthWrite: false });
    this.chunks = new Map();
    this.dirty = new Set();
    for (let cz = 0; cz < Math.ceil(this.sizeZ / 16); cz++) for (let cx = 0; cx < Math.ceil(this.sizeX / 16); cx++) this.dirty.add(`${cx},${cz}`);
    while (this.dirty.size) this.rebuildNext();

    const box = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.highlight = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    for (const entity of this.entities) {
      if (entity.autoY) entity.position.y = this.surface(entity.position.x, entity.position.z);
      this.scene.add(entity.mesh);
    }
    this.controls = new Controls(this);
    this.controls.yaw = this.player.yaw;
    for (const run of this.pendingUI.splice(0)) run();
    this.resize();
    this.onResize = () => this.resize();
    window.addEventListener("resize", this.onResize);
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
    this.emit("ready", this);
    if (this.restored) this.message("Welcome back", 1.5);
    return this;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  buildAtlas() {
    this.tiles = [];
    const tileFor = [];
    const canvas = document.createElement("canvas");
    const faces = [];
    for (let id = 1; id < this.blockDefs.length; id++) {
      const d = this.blockDefs[id];
      if (!d) continue;
      const top = d.top || d.color || "#ff00ff", side = d.side || d.color || "#ff00ff", bottom = d.bottom || d.color || "#ff00ff";
      const entry = {};
      for (const [face, color] of [["top", top], ["side", side], ["bottom", bottom]]) {
        entry[face] = faces.length;
        const pixels = d.pixels && (d.pixels[face] || d.pixels.side || d.pixels.top);
        faces.push({ color, pixels, pattern: face === "side" || !d.top ? d.pattern : (d.pattern === "bark" ? "ribs" : d.pattern), extra: face === "side" && d.sideTop ? { color: d.sideTop, rows: 3 } : null, id });
      }
      tileFor[id] = entry;
    }
    canvas.width = faces.length * TILE;
    canvas.height = TILE;
    const ctx = canvas.getContext("2d");
    faces.forEach((f, i) => (f.pixels ? paintPixels(ctx, i * TILE, f.pixels) : paintTile(ctx, i * TILE, f.color, f.pattern, rng(f.id * 31 + i), f.extra)));
    this.tileCount = faces.length;
    this.tileFor = tileFor;
    this.atlasCanvas = canvas;
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.atlas = true;
  }

  /** A small picture of a block, for hotbars and menus. */
  swatch(name) {
    const id = this.blockIds[name];
    if (!id || !this.atlasCanvas) return "";
    const c = document.createElement("canvas");
    c.width = c.height = TILE;
    c.getContext("2d").drawImage(this.atlasCanvas, this.tileFor[id].side * TILE, 0, TILE, TILE, 0, 0, TILE, TILE);
    return c.toDataURL();
  }

  markDirty(x, z) {
    if (!this.chunks) return;
    const cx = x >> 4, cz = z >> 4;
    this.dirty.add(`${cx},${cz}`);
    if ((x & 15) === 0 && cx > 0) this.dirty.add(`${cx - 1},${cz}`);
    if ((x & 15) === 15) this.dirty.add(`${cx + 1},${cz}`);
    if ((z & 15) === 0 && cz > 0) this.dirty.add(`${cx},${cz - 1}`);
    if ((z & 15) === 15) this.dirty.add(`${cx},${cz + 1}`);
  }

  rebuildNext() {
    const key = this.dirty.values().next().value;
    this.dirty.delete(key);
    const [cx, cz] = key.split(",").map(Number);
    if (cx * 16 >= this.sizeX || cz * 16 >= this.sizeZ) return;
    const old = this.chunks.get(key);
    if (old) for (const mesh of old) { this.scene.remove(mesh); mesh.geometry.dispose(); }
    const meshes = [];
    for (const transparentPass of [false, true]) {
      const pos = [], uv = [], col = [], idx = [];
      for (let y = 0; y < this.sizeY; y++) for (let z = cz * 16; z < Math.min(cz * 16 + 16, this.sizeZ); z++) for (let x = cx * 16; x < Math.min(cx * 16 + 16, this.sizeX); x++) {
        const id = this.data[this.index(x, y, z)];
        if (!id) continue;
        const d = this.blockDefs[id];
        if (d.transparent !== transparentPass) continue;
        for (const face of FACES) {
          const nx = x + face.dir[0], ny = y + face.dir[1], nz = z + face.dir[2];
          const nid = this.inside(nx, ny, nz) ? this.data[this.index(nx, ny, nz)] : 0;
          if (nid && (nid === id || !this.blockDefs[nid].transparent)) continue;
          if (ny < 0) continue;
          const tile = this.tileFor[id][face.tex];
          const u0 = (tile * TILE + 0.01) / (this.tileCount * TILE), u1 = ((tile + 1) * TILE - 0.01) / (this.tileCount * TILE);
          const uvs = face.tex === "side" ? SIDE_UV : FLAT_UV;
          const base = pos.length / 3;
          const light = d.glow ? 1.15 : face.shade;
          const top = d.name === "water" && face.dir[1] === 1 ? -0.12 : 0;
          face.corners.forEach((c, i) => {
            pos.push(x + c[0], y + c[1] + (c[1] === 1 ? top : 0), z + c[2]);
            uv.push(uvs[i][0] ? u1 : u0, uvs[i][1]);
            col.push(light, light, light);
          });
          idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
      if (!idx.length) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      geometry.setIndex(idx);
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, transparentPass ? this.clear : this.opaque);
      if (transparentPass) mesh.renderOrder = 1;
      this.scene.add(mesh);
      meshes.push(mesh);
    }
    this.chunks.set(key, meshes);
  }

  // MARK: Looking at blocks

  /** The block under the crosshair: { x, y, z, block, place: [x, y, z] } or null. */
  raycast(maxDistance = 6) {
    const origin = this.camera.position;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const step = [Math.sign(dir.x), Math.sign(dir.y), Math.sign(dir.z)];
    const tDelta = [dir.x ? Math.abs(1 / dir.x) : Infinity, dir.y ? Math.abs(1 / dir.y) : Infinity, dir.z ? Math.abs(1 / dir.z) : Infinity];
    const frac = (v, s) => (s > 0 ? Math.floor(v) + 1 - v : v - Math.floor(v));
    const tMax = [0, 1, 2].map((a) => (step[a] ? tDelta[a] * frac([origin.x, origin.y, origin.z][a], step[a]) : Infinity));
    let prev = null;
    let t = 0;
    while (t <= maxDistance) {
      const id = this.id(x, y, z);
      if (id && this.blockDefs[id].name !== "water") return { x, y, z, block: this.blockDefs[id].name, place: prev, distance: t };
      prev = [x, y, z];
      const axis = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : (tMax[1] < tMax[2] ? 1 : 2);
      t = tMax[axis];
      tMax[axis] += tDelta[axis];
      if (axis === 0) x += step[0]; else if (axis === 1) y += step[1]; else z += step[2];
    }
    return null;
  }

  entityUnderCrosshair(maxDistance = 6) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    ray.far = maxDistance;
    const hit = ray.intersectObjects(this.entities.map((e) => e.mesh), false)[0];
    return hit ? this.entities.find((e) => e.mesh === hit.object) : null;
  }

  /** Tap: place the selected block (or tap a creature). */
  use() {
    const entity = this.entityUnderCrosshair();
    if (entity) { this.emit("tap", { entity }); entity.emit("tap"); return; }
    const hit = this.raycast();
    if (!hit) return;
    let cancelled = false;
    this.emit("tap", { x: hit.x, y: hit.y, z: hit.z, block: hit.block, cancel: () => { cancelled = true; } });
    if (cancelled || !hit.place) return;
    const [x, y, z] = hit.place;
    const block = this.hotbar[this.selected];
    if (!block || this.player.overlaps(x, y, z)) return;
    const event = { x, y, z, block, cancel: () => { cancelled = true; } };
    this.emit("place", event);
    if (cancelled) return;
    this.setBlock(x, y, z, block);
    pacHaptic("light");
  }

  /** Hold (or right-click): hit the creature in front, else break the block under the crosshair. */
  breakBlock() {
    const creature = this.entityUnderCrosshair(4);
    const hit = this.raycast();
    if (creature && (!hit || creature.position.distanceTo(this.player.position) < Math.hypot(hit.x + 0.5 - this.player.position.x, hit.y + 0.5 - this.player.position.y - this.player.eye, hit.z + 0.5 - this.player.position.z) + 0.5)) {
      if (creature.hit(1)) pacHaptic("medium");
      return;
    }
    if (!hit) return;
    // TNT lights instead of breaking, unless explosions are off.
    if (hit.block === "tnt" && this.options.explosions !== false) { this.prime(hit.x, hit.y, hit.z, 1.6); pacHaptic("medium"); return; }
    let cancelled = false;
    const event = { x: hit.x, y: hit.y, z: hit.z, block: hit.block, cancel: () => { cancelled = true; } };
    this.emit("break", event);
    if (cancelled) return;
    const def = this.blockDefs[this.data[this.index(hit.x, hit.y, hit.z)]];
    this.setBlock(hit.x, hit.y, hit.z, null);
    if (def) this.burst(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, def.side || def.color || "#888888", 8);
    pacHaptic("medium");
  }

  // MARK: Bits, fuses and bangs

  /** A puff of little cubes, for broken blocks and creatures. */
  burst(x, y, z, color, count = 10) {
    if (!this.scene) return;
    this.particles ||= [];
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
    const geometry = this.particleGeometry ||= new THREE.BoxGeometry(0.14, 0.14, 0.14);
    for (let i = 0; i < count && this.particles.length < 400; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, z + (Math.random() - 0.5) * 0.6);
      this.scene.add(mesh);
      this.particles.push({ mesh, v: new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 5 + 1, (Math.random() - 0.5) * 5), life: 0.5 + Math.random() * 0.5 });
    }
  }

  /** Lights the TNT at a spot: it flashes, then goes off. */
  prime(x, y, z, fuse = 1.6) {
    this.fuses ||= [];
    if (this.fuses.some((f) => f.x === x && f.y === y && f.z === z)) return;
    const glow = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 1.02), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    glow.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.scene && this.scene.add(glow);
    this.fuses.push({ x, y, z, left: fuse, glow });
  }

  /** A bang: clears a ball of blocks, sets off nearby TNT, knocks back everyone near. */
  explode(x, y, z, radius = 3) {
    const event = { x, y, z, radius, cancel: () => { event.cancelled = true; } };
    this.emit("explode", event);
    if (event.cancelled) return;
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      const d2 = dx * dx + dy * dy + dz * dz;
      const bx = x + dx, by = y + dy, bz = z + dz;
      // The very bottom layer stays, so nobody falls out of the world.
      if (d2 > r2 + Math.random() * 2 || by <= 0 || !this.inside(bx, by, bz)) continue;
      const name = this.getBlock(bx, by, bz);
      if (!name) continue;
      if (name === "tnt" && (dx || dy || dz)) { this.prime(bx, by, bz, 0.25 + Math.random() * 0.4); continue; }
      this.setBlock(bx, by, bz, null);
    }
    this.burst(x + 0.5, y + 0.5, z + 0.5, "#555555", 30);
    this.burst(x + 0.5, y + 0.5, z + 0.5, "#FF9A2E", 20);
    const centre = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
    for (const e of [...this.entities]) {
      const d = e.position.distanceTo(centre);
      if (d < radius * 2) e.hit(d < radius ? 3 : 1, centre);
    }
    const p = this.player.position, d = p.distanceTo(centre);
    if (d < radius * 2.5 && !this.player.flying) {
      const push = new THREE.Vector3().subVectors(p, centre).normalize().multiplyScalar(Math.max(0, 1 - d / (radius * 2.5)) * 14);
      this.player.velocity.y = Math.max(this.player.velocity.y, push.y + 6);
      this.player.knock = new THREE.Vector3(push.x, 0, push.z);
    }
    this.shake = Math.max(this.shake || 0, Math.max(0, 1 - d / 20) * 0.5);
    boom(Math.max(0.15, 1 - d / 30));
    pacHaptic("heavy");
  }

  updateEffects(dt) {
    for (const f of [...(this.fuses || [])]) {
      f.left -= dt;
      f.glow.visible = Math.floor(f.left * (f.left < 0.6 ? 12 : 5)) % 2 === 0;
      if (f.left <= 0) {
        this.fuses.splice(this.fuses.indexOf(f), 1);
        this.scene.remove(f.glow);
        if (this.getBlock(f.x, f.y, f.z) === "tnt") { this.setBlock(f.x, f.y, f.z, null); this.explode(f.x, f.y, f.z); }
      }
    }
    for (const q of [...(this.particles || [])]) {
      q.life -= dt;
      q.v.y -= 18 * dt;
      q.mesh.position.addScaledVector(q.v, dt);
      q.mesh.scale.setScalar(Math.max(0.01, q.life * 1.6));
      if (q.life <= 0) { this.scene.remove(q.mesh); this.particles.splice(this.particles.indexOf(q), 1); }
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
    }
  }

  // MARK: Creatures

  /** Adds a creature: { name, color, size: [w, h, d], x, y, z, behavior: "wander" | "follow" | "still", speed, face }. */
  spawn(options = {}) {
    const entity = new Entity(this, options);
    this.entities.push(entity);
    this.scene && this.scene.add(entity.mesh);
    return entity;
  }

  // MARK: On-screen bits

  /** A line of text in the top corner (score, coins, a goal). Pass "" to hide it. */
  hud(text) { this.controls ? this.controls.setHud(text) : this.pendingUI.push(() => this.hud(text)); }
  /** A message in the middle of the screen for a few seconds. */
  message(text, seconds = 2.5) { this.controls ? this.controls.flash(text, seconds) : this.pendingUI.push(() => this.message(text, seconds)); }
  /** A button on the right; returns a function that removes it. */
  button(label, onPress) {
    if (this.controls) return this.controls.addButton(label, onPress);
    let remove = null, cancelled = false;
    this.pendingUI.push(() => { if (!cancelled) remove = this.controls.addButton(label, onPress); });
    return () => { cancelled = true; remove && remove(); };
  }

  /** Starts the player on open ground near the middle, facing the most open direction. */
  placePlayer() {
    const cx = this.sizeX >> 1, cz = this.sizeZ >> 1;
    let best = null;
    for (let r = 0; r < Math.min(cx, cz) - 2 && !best; r++) {
      for (let dz = -r; dz <= r && !best; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = cx + dx, z = cz + dz, y = this.surface(x, z);
        const ground = this.getBlock(x, y - 1, z);
        if (ground === "water" || ground === "leaves" || ground === "wood" || y >= this.sizeY - 3) continue;
        let clear = true;
        for (let yy = y; yy < this.sizeY && clear; yy++) if (this.id(x, yy, z)) clear = false; // open sky above
        for (let ox = -1; ox <= 1 && clear; ox++) for (let oz = -1; oz <= 1; oz++) {
          if (this.isSolid(x + ox, y, z + oz) || this.isSolid(x + ox, y + 1, z + oz)) { clear = false; break; }
        }
        if (clear) best = [x, y, z];
      }
    }
    const [x, y, z] = best || [cx, this.surface(cx, cz), cz];
    this.player.position.set(x + 0.5, y + 0.01, z + 0.5);
    // Face whichever way has the longest clear view.
    let longest = -1;
    for (let i = 0; i < 8; i++) {
      const yaw = (i / 8) * Math.PI * 2, sx = -Math.sin(yaw), sz = -Math.cos(yaw);
      let d = 1;
      while (d < 30 && !this.isSolid(Math.floor(x + 0.5 + sx * d), y + 1, Math.floor(z + 0.5 + sz * d))) d++;
      if (d > longest) { longest = d; this.player.yaw = yaw; }
    }
  }

  /** Closes the world: stops drawing, saves, and removes it and its controls from the page. */
  async stop() {
    clearTimeout(this.saveTimer);
    if (this.started) await this.save();
    if (document.pointerLockElement) document.exitPointerLock();
    this.renderer?.setAnimationLoop(null);
    this.controls?.stop();
    window.removeEventListener("resize", this.onResize);
    this.renderer?.dispose();
    this.root?.remove();
    this.started = false;
  }

  /** A small picture of what the player sees (a JPEG data URL), for a saved build's card. */
  snapshot(width = 360) {
    if (!this.renderer) return null;
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement;
    const c = document.createElement("canvas");
    c.width = width;
    c.height = Math.round((width * src.height) / Math.max(src.width, 1));
    c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
    try { return c.toDataURL("image/jpeg", 0.7); } catch { return null; }
  }

  /** How many blocks have been changed from the generated world. */
  get changes() { return Object.keys(this.edits).length; }

  /** Sets the time of day: 0 midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset. */
  setTime(t) { this.time = ((t % 1) + 1) % 1; }

  // MARK: Every frame

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.options.sky === "cycle") this.time = (this.time + dt / (this.options.dayLength ?? 600)) % 1;
    this.updateSky();
    this.controls.update(dt);
    this.player.update(dt, this.controls);
    for (const entity of this.entities) entity.update(dt);
    for (let i = 0; i < 2 && this.dirty.size; i++) this.rebuildNext();
    const hit = this.raycast();
    this.highlight.visible = !!hit;
    if (hit) this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    this.updateEffects(dt);
    this.emit("tick", dt);
    this.renderer.render(this.scene, this.camera);
  }

  updateSky() {
    const sun = Math.max(0.12, Math.min(1, Math.sin(this.time * Math.PI * 2 - Math.PI / 2) * 0.9 + 0.55));
    const day = new THREE.Color(0x9fd3ff), dusk = new THREE.Color(0xf2a36b), night = new THREE.Color(0x0b1026);
    const sky = sun > 0.6 ? day.clone().lerp(dusk, (1 - sun) / 0.4 * 0.6) : night.clone().lerp(dusk, Math.max(0, (sun - 0.12) / 0.48));
    this.scene.background = sky;
    this.scene.fog.color = sky;
    if (this.opaque) { this.opaque.color.setScalar(sun); this.clear.color.setScalar(Math.max(sun, 0.4)); }
  }
}

// MARK: Player

class Player {
  constructor(world) {
    this.world = world;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = -0.15;
    this.flying = false;
    this.onGround = false;
    this.width = 0.6;
    this.height = 1.8;
    this.eye = 1.62;
    this.speed = world.options.speed ?? 4.3;
  }

  static jumpSpeed = Math.sqrt(2 * 28 * 1.45);

  /** A block one high just ahead, with room above it to stand. */
  stepAhead(move) {
    const len = Math.hypot(move.x, move.z) || 1;
    const x = Math.floor(this.position.x + (move.x / len) * (this.width / 2 + 0.3));
    const z = Math.floor(this.position.z + (move.z / len) * (this.width / 2 + 0.3));
    const y = Math.floor(this.position.y + 0.01);
    const w = this.world;
    return w.isSolid(x, y, z) && !w.isSolid(x, y + 1, z) && !w.isSolid(x, y + 2, z)
      && !w.isSolid(Math.floor(this.position.x), y + 2, Math.floor(this.position.z));
  }

  /** Moves the player to a spot (feet position). */
  teleport(x, y, z) { this.position.set(x, y, z); this.velocity.set(0, 0, 0); }

  overlaps(x, y, z) {
    const p = this.position, w = this.width / 2;
    return x + 1 > p.x - w && x < p.x + w && z + 1 > p.z - w && z < p.z + w && y + 1 > p.y && y < p.y + this.height;
  }

  update(dt, controls) {
    const world = this.world;
    this.yaw = controls.yaw;
    this.pitch = controls.pitch;
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = forward.multiplyScalar(controls.move.y).add(right.multiplyScalar(controls.move.x));
    const speed = this.speed * (this.flying ? 2 : 1);
    this.velocity.x = move.x * speed;
    this.velocity.z = move.z * speed;
    // Thrown by a blast: the push fades over half a second.
    if (this.knock) { this.velocity.x += this.knock.x; this.velocity.z += this.knock.z; this.knock.multiplyScalar(Math.max(0, 1 - dt * 4)); if (this.knock.lengthSq() < 0.05) this.knock = null; }
    const inWater = world.getBlock(this.position.x, this.position.y + 0.4, this.position.z) === "water";
    const gravity = inWater ? 8 : 28;
    const wasOnGround = this.onGround;
    if (this.flying) {
      this.velocity.y = (controls.up ? 6 : 0) - (controls.down ? 6 : 0);
    } else {
      // Half the pull before moving and half after, so a jump reaches the same height at any frame rate.
      this.velocity.y -= gravity * dt / 2;
      if (inWater) this.velocity.y = Math.max(this.velocity.y, -3);
      // A jump clears about 1.45 blocks: enough to get up onto the next one with room to spare.
      if (controls.up && (this.onGround || inWater)) this.velocity.y = inWater ? 4 : Player.jumpSpeed;
    }
    this.onGround = false;
    this.blocked = false;
    collide(world, this, dt);
    if (!this.flying) {
      this.velocity.y -= gravity * dt / 2;
      // Walking into a one-block step jumps it, like Minecraft's auto-jump.
      if (wasOnGround && this.blocked && (move.x || move.z) && this.stepAhead(move)) this.velocity.y = Player.jumpSpeed;
    }
    if (this.position.y < -20) { const s = world.surface(world.sizeX / 2, world.sizeZ / 2); this.teleport(world.sizeX / 2, s + 1, world.sizeZ / 2); }
    const cam = world.camera;
    cam.position.set(this.position.x, this.position.y + this.eye, this.position.z);
    cam.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }
}

/** Moves a box (player or creature) through the world one axis at a time, stopping at solid blocks. */
function collide(world, body, dt) {
  const half = body.width / 2;
  for (const axis of ["x", "y", "z"]) {
    const delta = body.velocity[axis] * dt;
    if (!delta) continue;
    body.position[axis] += delta;
    const p = body.position;
    const minX = Math.floor(p.x - half), maxX = Math.floor(p.x + half - 1e-6);
    const minY = Math.floor(p.y), maxY = Math.floor(p.y + body.height - 1e-6);
    const minZ = Math.floor(p.z - half), maxZ = Math.floor(p.z + half - 1e-6);
    let hit = false;
    for (let y = minY; y <= maxY && !hit; y++) for (let z = minZ; z <= maxZ && !hit; z++) for (let x = minX; x <= maxX; x++) {
      if (world.isSolid(x, y, z)) { hit = true; break; }
    }
    if (!hit) continue;
    if (axis === "y") {
      if (delta < 0) { p.y = minY + 1; body.onGround = true; } else { p.y = maxY - body.height; }
    } else if (axis === "x") {
      p.x = delta > 0 ? maxX - half - 1e-4 : minX + 1 + half + 1e-4;
      body.blocked = true;
    } else {
      p.z = delta > 0 ? maxZ - half - 1e-4 : minZ + 1 + half + 1e-4;
      body.blocked = true;
    }
    body.velocity[axis] = 0;
  }
}

// MARK: Creatures

class Entity {
  constructor(world, o) {
    this.world = world;
    this.name = o.name || "creature";
    this.behavior = o.behavior || "wander";
    this.speed = o.speed ?? 1.6;
    const size = o.size || [0.8, 0.8, 0.8];
    this.width = Math.max(size[0], size[2]);
    this.height = size[1];
    this.position = new THREE.Vector3(o.x ?? world.sizeX / 2 + 3, o.y ?? 0, o.z ?? world.sizeZ / 2 + 3);
    // Placed on the ground; before the world starts, start() puts it there.
    if (o.y == null) { this.autoY = !world.started; this.position.y = world.surface(this.position.x, this.position.z); }
    this.velocity = new THREE.Vector3();
    this.listeners = {};
    const color = new THREE.Color(o.color || "#F2F2F2");
    const shade = (k) => new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(k) });
    const face = o.face ? faceMaterial(o.face, color) : shade(0.65);
    // +x, -x, +y, -y, +z (front), -z
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), [shade(0.8), shade(0.8), shade(1), shade(0.5), face, shade(0.65)]);
    this.heading = Math.random() * Math.PI * 2;
    this.turnIn = 1;
    this.touchedAt = 0;
    // Hits: a few knocks and it's gone (in a puff), unless it's made invincible.
    this.health = this.maxHealth = o.health ?? 3;
    this.invincible = !!o.invincible;
    this.hurtFor = 0;
    this.color = color;
  }

  /** Knocks the creature back from `from` (a point); at no health left it vanishes in a puff. */
  hit(amount = 1, from = this.world.player.position) {
    const now = performance.now();
    if (now - (this.hitAt || 0) < 150) return false;
    this.hitAt = now;
    const push = new THREE.Vector3().subVectors(this.position, from).setY(0);
    if (push.lengthSq() < 1e-6) push.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    push.normalize().multiplyScalar(7);
    this.knock = push;
    this.velocity.y = 6;
    this.hurtFor = 0.4;
    this.fleeFor = 3;
    const event = { entity: this, amount, cancel: () => { event.cancelled = true; } };
    this.emit("hit", event); this.world.emit("hit", event);
    if (event.cancelled || this.invincible) return true;
    this.health -= amount;
    if (this.health <= 0) {
      this.world.burst(this.position.x, this.position.y + this.height / 2, this.position.z, "#" + this.color.getHexString(), 18);
      this.emit("defeat", { entity: this }); this.world.emit("defeat", { entity: this });
      this.remove();
    }
    return true;
  }

  on(event, callback) { (this.listeners[event] = this.listeners[event] || new Set()).add(callback); return this; }
  emit(event, data) { for (const c of this.listeners[event] || []) { try { c(data); } catch (e) { console.error(e); } } }

  /** Takes the creature out of the world. */
  remove() {
    this.world.scene && this.world.scene.remove(this.mesh);
    this.world.entities = this.world.entities.filter((e) => e !== this);
  }

  /** Shows a speech bubble over the creature. */
  say(text, seconds = 2.5) { this.world.message(`${this.name}: ${text}`, seconds); }

  update(dt) {
    const player = this.world.player;
    const toPlayer = new THREE.Vector3().subVectors(player.position, this.position);
    const distance = toPlayer.length();
    let dir = null;
    if (this.behavior === "follow" && distance < 20 && distance > 1.6) dir = toPlayer.setY(0).normalize();
    else if (this.behavior === "flee" && distance < 8) dir = toPlayer.setY(0).normalize().negate();
    else if (this.behavior === "wander") {
      this.turnIn -= dt;
      if (this.turnIn <= 0) { this.heading += (Math.random() - 0.5) * 2.4; this.turnIn = 1.5 + Math.random() * 3; this.resting = Math.random() < 0.3; }
      if (!this.resting) dir = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    }
    // Just hit: run away for a bit.
    if (this.fleeFor > 0) { this.fleeFor -= dt; if (distance < 12) dir = toPlayer.clone().setY(0).normalize().negate(); }
    this.velocity.x = dir ? dir.x * this.speed * (this.fleeFor > 0 ? 1.8 : 1) : 0;
    this.velocity.z = dir ? dir.z * this.speed * (this.fleeFor > 0 ? 1.8 : 1) : 0;
    if (this.knock) { this.velocity.x += this.knock.x; this.velocity.z += this.knock.z; this.knock.multiplyScalar(Math.max(0, 1 - dt * 6)); if (this.knock.lengthSq() < 0.05) this.knock = null; }
    this.velocity.y -= 28 * dt;
    if (this.blocked && this.onGround) this.velocity.y = 8;
    this.blocked = false;
    this.onGround = false;
    collide(this.world, this, dt);
    if (dir) this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    // Flashes red while hurt.
    if (this.hurtFor > 0) {
      this.hurtFor -= dt;
      const red = this.hurtFor > 0 && Math.floor(this.hurtFor * 12) % 2 === 0;
      for (const m of this.mesh.material) { m.userData.base ||= m.color.clone(); m.color.copy(red ? new THREE.Color(0xff4040) : m.userData.base); }
    }
    this.mesh.position.set(this.position.x, this.position.y + this.height / 2, this.position.z);
    if (distance < (this.width + player.width) / 2 + 0.3 && Math.abs(player.position.y - this.position.y) < 1.5) {
      const now = performance.now();
      if (now - this.touchedAt > 1000) { this.touchedAt = now; this.emit("touch"); this.world.emit("touch", { entity: this }); }
    }
  }
}

function faceMaterial(emoji, color) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#" + color.getHexString();
  ctx.fillRect(0, 0, 64, 64);
  ctx.font = "44px -apple-system, system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 32, 36);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture });
}

/** A short rumble made on the spot (no sound files). */
let audio = null;
function boom(volume = 1) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime, len = 0.9, buffer = audio.createBuffer(1, audio.sampleRate * len, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.5);
    const src = audio.createBufferSource(); src.buffer = buffer;
    const filter = audio.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.setValueAtTime(900, t); filter.frequency.exponentialRampToValueAtTime(120, t + len);
    const gain = audio.createGain(); gain.gain.value = 0.9 * volume;
    src.connect(filter).connect(gain).connect(audio.destination);
    src.start(t);
  } catch { /* no sound here */ }
}

function pacHaptic(kind) { try { window.pac && pac.ui.haptic(kind); } catch {} }

// MARK: Controls

class Controls {
  constructor(world) {
    this.world = world;
    this.move = { x: 0, y: 0 };
    this.yaw = 0;
    this.pitch = -0.15;
    this.up = false;
    this.down = false;
    this.keys = new Set();
    this.touches = new Map();
    const root = world.root;
    const css = document.createElement("style");
    css.textContent = `
      .pw-ui { position:absolute; font:600 15px -apple-system,system-ui; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,.6); }
      .pw-btn { position:absolute; width:64px; height:64px; border-radius:32px; background:rgba(0,0,0,.28); border:2px solid rgba(255,255,255,.55);
                display:flex; align-items:center; justify-content:center; font:700 22px -apple-system,system-ui; color:#fff; backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); }
      .pw-btn.on { background:rgba(255,255,255,.4); }
      .pw-hotbar { position:absolute; left:50%; transform:translateX(-50%); display:flex; gap:4px; padding:4px; border-radius:12px; background:rgba(0,0,0,.3); max-width:calc(100vw - 150px); overflow-x:auto; scrollbar-width:none; }
      .pw-slot { flex:none; cursor:pointer; }
      .pw-touch .pw-slot { width:46px; height:46px; }
      .pw-hotbar { -webkit-overflow-scrolling:touch; touch-action:pan-x; }
      .pw-picker { position:absolute; inset:0; background:rgba(0,0,0,.55); display:none; align-items:center; justify-content:center; z-index:20; }
      .pw-picker.open { display:flex; }
      .pw-picker-box { background:rgba(30,30,34,.92); border-radius:20px; padding:18px; width:min(720px,92vw); box-sizing:border-box; max-height:80vh; overflow:auto; }
      .pw-picker-box h3 { margin:0 0 12px; font:700 18px -apple-system,system-ui; color:#fff; }
      .pw-picker-grid { display:grid; grid-template-columns:repeat(auto-fill,64px); gap:10px; }
      .pw-pick { width:64px; height:64px; border-radius:12px; border:3px solid transparent; background-size:cover; image-rendering:pixelated; cursor:pointer; padding:0; }
      .pw-pick.on { border-color:#fff; }
      .pw-pick-name { font:600 11px -apple-system,system-ui; color:#ddd; text-align:center; margin-top:3px; max-width:64px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .pw-slot { width:38px; height:38px; border-radius:8px; border:2px solid transparent; image-rendering:pixelated; background-size:cover; }
      .pw-slot.on { border-color:#fff; }
      .pw-cross { position:absolute; left:50%; top:50%; width:22px; height:22px; margin:-11px 0 0 -11px; pointer-events:none; }
      .pw-cross:before, .pw-cross:after { content:""; position:absolute; background:rgba(255,255,255,.85); box-shadow:0 0 2px rgba(0,0,0,.6); }
      .pw-cross:before { left:10px; top:0; width:2px; height:22px; } .pw-cross:after { top:10px; left:0; height:2px; width:22px; }
      .pw-stick { position:absolute; width:120px; height:120px; margin:-60px 0 0 -60px; border-radius:60px; background:rgba(255,255,255,.12); border:2px solid rgba(255,255,255,.35); pointer-events:none; display:none; }
      .pw-knob { position:absolute; left:50%; top:50%; width:52px; height:52px; margin:-26px 0 0 -26px; border-radius:26px; background:rgba(255,255,255,.55); }
      .pw-flash { position:absolute; left:50%; top:30%; transform:translateX(-50%); padding:10px 16px; border-radius:14px; background:rgba(0,0,0,.45); opacity:0; transition:opacity .25s; text-align:center; max-width:80%; }
      .pw-side { position:absolute; right:12px; display:flex; flex-direction:column; gap:8px; align-items:flex-end; }
      .pw-side button { font:600 14px -apple-system,system-ui; color:#fff; background:rgba(0,0,0,.35); border:1px solid rgba(255,255,255,.4); border-radius:12px; padding:8px 12px; }
    `;
    root.appendChild(css);
    const el = (cls, html = "") => { const d = document.createElement("div"); d.className = cls; d.innerHTML = html; root.appendChild(d); return d; };
    el("pw-cross");
    this.stick = el("pw-stick", '<div class="pw-knob"></div>');
    this.knob = this.stick.firstChild;
    const safeBottom = "calc(env(safe-area-inset-bottom) + 14px)";
    this.jump = el("pw-btn", "⤒");
    this.jump.style.cssText = `right:22px; bottom:calc(env(safe-area-inset-bottom) + 72px)`;
    this.fly = el("pw-btn", "✈︎");
    this.fly.style.cssText = `right:96px; bottom:calc(env(safe-area-inset-bottom) + 72px); width:48px; height:48px; font-size:18px`;
    if (!world.flyAllowed) this.fly.style.display = "none";
    this.downBtn = el("pw-btn", "⤓");
    this.downBtn.style.cssText = `right:22px; bottom:calc(env(safe-area-inset-bottom) + 146px); display:none`;
    this.hotbarEl = el("pw-hotbar");
    this.hotbarEl.style.bottom = safeBottom;
    this.hudEl = el("pw-ui");
    this.hudEl.style.cssText = "left:14px; top:calc(env(safe-area-inset-top) + 12px)";
    this.flashEl = el("pw-ui pw-flash");
    this.side = el("pw-side");
    this.side.style.top = "calc(env(safe-area-inset-top) + 12px)";
    // 🧱 opens the chooser: every block, big enough to tap.
    this.blocksBtn = el("pw-btn", "🧱");
    this.blocksBtn.title = "Choose a block (E)";
    this.blocksBtn.style.cssText = `left:14px; bottom:calc(env(safe-area-inset-bottom) + 14px); width:52px; height:52px; font-size:24px; cursor:pointer`;
    this.blocksBtn.addEventListener("click", (e) => { e.stopPropagation(); this.openPicker(); });
    this.blocksBtn.addEventListener("touchend", (e) => { e.preventDefault(); e.stopPropagation(); this.openPicker(); });
    if ("ontouchstart" in window || navigator.maxTouchPoints > 0) root.classList.add("pw-touch");
    this.picker = el("pw-picker", '<div class="pw-picker-box"><h3>Choose a block</h3><div class="pw-picker-grid"></div></div>');
    this.picker.addEventListener("click", (e) => { if (e.target === this.picker) this.closePicker(); });
    this.picker.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
    this.picker.addEventListener("mousedown", (e) => e.stopPropagation());
    this.renderHotbar();
    this.bindTouches(root);
    this.bindKeys();
    // A computer: the mouse looks once it's captured, like any first-person game.
    this.desktop = !("ontouchstart" in window) && window.matchMedia && matchMedia("(pointer: fine)").matches;
    if (this.desktop) this.jump.style.display = "none";
    if (!world.options.hideHelp) this.flash(this.desktop
      ? "Click to play · mouse looks · WASD moves · Space jumps · F flies<br>Click builds · right-click breaks or hits · hit TNT to light it<br>Click a block in the bar, or press E for all blocks · 1–9 or scroll picks one · Esc frees the mouse"
      : "Left side moves · right side looks<br>Tap to build · hold to break · tap a block below (🧱 for all) to choose it", this.desktop ? 7 : 4);
  }

  /** Adds a listener on the page that stop() takes away again. */
  listen(target, type, fn, options) {
    (this.cleanups ||= []).push(() => target.removeEventListener(type, fn, options));
    target.addEventListener(type, fn, options);
  }

  stop() { for (const undo of this.cleanups || []) undo(); this.cleanups = []; }

  /** A big grid of every block: tap one to build with it. Opens with the 🧱 button, E or Tab. */
  openPicker() {
    const world = this.world;
    if (document.pointerLockElement) { this.relock = true; document.exitPointerLock(); } else this.relock = false;
    const grid = this.picker.querySelector(".pw-picker-grid");
    grid.innerHTML = "";
    world.hotbar.forEach((name, i) => {
      const cell = document.createElement("div");
      const b = document.createElement("button");
      b.className = "pw-pick" + (i === world.selected ? " on" : "");
      b.style.backgroundImage = `url(${world.swatch(name)})`;
      b.title = name;
      b.addEventListener("click", (e) => { e.stopPropagation(); this.select(i); this.closePicker(); });
      b.addEventListener("touchend", (e) => { e.preventDefault(); e.stopPropagation(); this.select(i); this.closePicker(); });
      const label = document.createElement("div");
      label.className = "pw-pick-name";
      label.textContent = name.startsWith("my-") ? "yours" : name;
      cell.append(b, label);
      grid.appendChild(cell);
    });
    this.picker.classList.add("open");
    this.flashEl.style.opacity = 0;
  }

  closePicker() {
    this.picker.classList.remove("open");
    if (this.relock && this.world.root.requestPointerLock) { try { this.world.root.requestPointerLock(); } catch {} }
  }

  /** Chooses a block from the bar and keeps it in view. */
  select(i) {
    const world = this.world;
    if (i < 0 || i >= world.hotbar.length) return;
    world.selected = i;
    this.renderHotbar();
    const slot = this.hotbarEl.children[i];
    if (slot && slot.scrollIntoView) slot.scrollIntoView({ block: "nearest", inline: "nearest" });
    pacHaptic("selection");
  }

  renderHotbar() {
    const world = this.world;
    this.hotbarEl.innerHTML = "";
    this.hotbarEl.style.display = world.hotbar.length ? "flex" : "none";
    world.hotbar.forEach((name, i) => {
      const slot = document.createElement("div");
      slot.className = "pw-slot" + (i === world.selected ? " on" : "");
      slot.style.backgroundImage = `url(${world.swatch(name)})`;
      slot.dataset.slot = i;
      this.hotbarEl.appendChild(slot);
    });
  }

  setHud(text) { this.hudEl.textContent = text || ""; }

  flash(html, seconds) {
    this.flashEl.innerHTML = html;
    this.flashEl.style.opacity = 1;
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => { this.flashEl.style.opacity = 0; }, seconds * 1000);
  }

  addButton(label, onPress) {
    const b = document.createElement("button");
    b.textContent = label;
    b.addEventListener("touchstart", (e) => { e.stopPropagation(); }, { passive: true });
    b.addEventListener("click", (e) => { e.stopPropagation(); try { onPress(); } catch (err) { console.error(err); } });
    this.side.appendChild(b);
    return () => b.remove();
  }

  bindTouches(root) {
    const world = this.world;
    const isButton = (t) => t.closest && (t.closest(".pw-btn") || t.closest(".pw-side") || t.closest(".pw-hotbar") || t.closest(".pw-picker"));
    root.addEventListener("touchstart", (e) => {
      for (const t of e.changedTouches) {
        const target = t.target;
        if (target.closest && target.closest(".pw-hotbar")) { this.touches.set(t.identifier, { kind: "bar", x: t.clientX, slot: target.dataset ? target.dataset.slot : undefined }); continue; }
        if (target === this.jump) { this.up = true; this.jump.classList.add("on"); this.touches.set(t.identifier, { kind: "jump" }); continue; }
        if (target === this.downBtn) { this.down = true; this.touches.set(t.identifier, { kind: "down" }); continue; }
        if (target === this.fly) { this.toggleFly(); continue; }
        if (isButton(target)) continue;
        if (t.clientX < window.innerWidth * 0.4 && !this.stickTouch) {
          this.stickTouch = t.identifier;
          this.stickOrigin = { x: t.clientX, y: t.clientY };
          this.stick.style.display = "block";
          this.stick.style.left = t.clientX + "px";
          this.stick.style.top = t.clientY + "px";
          this.touches.set(t.identifier, { kind: "stick" });
        } else {
          const info = { kind: "look", x: t.clientX, y: t.clientY, startX: t.clientX, startY: t.clientY, at: performance.now(), moved: false };
          info.hold = setTimeout(() => { if (!info.moved) { info.broke = true; world.breakBlock(); } }, 420);
          this.touches.set(t.identifier, info);
        }
      }
      if (![...e.changedTouches].some((t) => t.target.closest && t.target.closest(".pw-hotbar"))) e.preventDefault();
    }, { passive: false });
    root.addEventListener("touchmove", (e) => {
      let bar = false;
      for (const t of e.changedTouches) {
        const info = this.touches.get(t.identifier);
        if (!info) continue;
        if (info.kind === "bar") { bar = true; continue; }
        if (info.kind === "stick") {
          let dx = t.clientX - this.stickOrigin.x, dy = t.clientY - this.stickOrigin.y;
          const len = Math.hypot(dx, dy), max = 50;
          if (len > max) { dx *= max / len; dy *= max / len; }
          this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
          this.move = { x: dx / max, y: -dy / max };
        } else if (info.kind === "look") {
          const dx = t.clientX - info.x, dy = t.clientY - info.y;
          info.x = t.clientX; info.y = t.clientY;
          if (Math.hypot(t.clientX - info.startX, t.clientY - info.startY) > 10) { info.moved = true; clearTimeout(info.hold); }
          this.look(dx, dy);
        }
      }
      if (!bar) e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        const info = this.touches.get(t.identifier);
        if (!info) continue;
        this.touches.delete(t.identifier);
        if (info.kind === "bar") { if (info.slot !== undefined && Math.abs(t.clientX - info.x) < 12) this.select(Number(info.slot)); continue; }
        if (info.kind === "stick") { this.stickTouch = null; this.move = { x: 0, y: 0 }; this.stick.style.display = "none"; this.knob.style.transform = ""; }
        else if (info.kind === "jump") { this.up = false; this.jump.classList.remove("on"); }
        else if (info.kind === "down") { this.down = false; }
        else if (info.kind === "look") {
          clearTimeout(info.hold);
          if (!info.moved && !info.broke && performance.now() - info.at < 400) world.use();
        }
      }
    };
    root.addEventListener("touchend", end);
    root.addEventListener("touchcancel", end);

    // Mouse: click to capture it, then it looks around; click builds, right-click (or shift-click)
    // breaks; the wheel picks a block. Without capture, dragging looks, as before.
    let dragging = null;
    const locked = () => document.pointerLockElement === root;
    root.addEventListener("mousedown", (e) => {
      if (isButton(e.target)) return;
      if (locked()) { if (e.button === 2 || e.shiftKey) world.breakBlock(); else world.use(); return; }
      dragging = { x: e.clientX, y: e.clientY, moved: false };
    });
    this.listen(window, "mousemove", (e) => {
      if (locked()) { this.look(e.movementX * 0.6, e.movementY * 0.6); return; }
      if (!dragging) return;
      const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) dragging.moved = true;
      dragging.x = e.clientX; dragging.y = e.clientY;
      this.look(dx, dy);
    });
    this.listen(window, "mouseup", (e) => {
      if (dragging && !dragging.moved && !isButton(e.target)) {
        if (this.desktop && !this.lockRefused && root.requestPointerLock && e.button === 0 && !e.shiftKey) {
          // Ask to capture the mouse; if the browser says no, this click builds and clicks keep building.
          const asked = performance.now();
          const refused = () => { if (performance.now() - asked < 1500 && !locked()) { this.lockRefused = true; world.use(); } };
          try { const p = root.requestPointerLock(); if (p && p.catch) p.catch(refused); } catch { refused(); }
          setTimeout(() => { if (!locked()) refused(); }, 400);
        }
        else if (e.button === 2 || e.shiftKey) world.breakBlock(); else world.use();
      }
      dragging = null;
    });
    root.addEventListener("wheel", (e) => {
      const n = world.hotbar.length;
      if (!n) return;
      e.preventDefault();
      world.selected = (world.selected + (e.deltaY > 0 ? 1 : -1) + n) % n;
      this.select(world.selected);
    }, { passive: false });
    root.addEventListener("click", (e) => {
      const slot = e.target.dataset && e.target.dataset.slot;
      if (slot !== undefined) this.select(Number(slot));
    });
    root.addEventListener("contextmenu", (e) => e.preventDefault());
    this.listen(document, "pointerlockerror", () => { this.lockRefused = true; });
  }

  bindKeys() {
    this.listen(window, "keydown", (e) => {
      if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.code === "KeyF") this.toggleFly();
      if (e.code === "KeyE" || e.code === "Tab") { e.preventDefault(); this.picker.classList.contains("open") ? this.closePicker() : this.openPicker(); return; }
      if (e.code === "Escape" && this.picker.classList.contains("open")) { this.relock = false; this.closePicker(); }
      const n = Number(e.key);
      if (n >= 1 && n <= this.world.hotbar.length) this.select(n - 1);
    });
    this.listen(window, "keyup", (e) => this.keys.delete(e.code));
    // Keys released while the world didn't have focus never arrive: forget them, so nothing sticks.
    this.listen(window, "blur", () => { this.keys.clear(); this.up = false; this.down = false; if (this.stickTouch == null) this.move = { x: 0, y: 0 }; });
    this.listen(document, "visibilitychange", () => { if (document.hidden) this.keys.clear(); });
  }

  toggleFly() {
    const p = this.world.player;
    p.flying = !p.flying;
    p.velocity.y = 0;
    this.fly.classList.toggle("on", p.flying);
    this.downBtn.style.display = p.flying ? "flex" : "none";
    pacHaptic("selection");
  }

  look(dx, dy) {
    const s = 0.0055;
    this.yaw -= dx * s;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - dy * s));
  }

  update() {
    // Letting go of the last key stops walking (it used to keep the last direction).
    if (!this.keys.size && this.keyDriven) { this.keyDriven = false; if (this.stickTouch == null) this.move = { x: 0, y: 0 }; if (!this.touches.size) { this.up = false; this.down = false; } }
    if (this.keys.size) {
      this.keyDriven = true;
      const k = this.keys;
      const x = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
      const y = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
      if (this.stickTouch == null) this.move = { x, y };
      this.up = k.has("Space") || this.up;
      this.down = k.has("ShiftLeft");
      if (!k.has("Space") && !this.touches.size) this.up = false;
    }
  }
}

export const blocks = Object.keys(BUILTIN_BLOCKS);
