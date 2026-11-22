// PAC Kit: polish for code screens. Speech, sound effects, celebrations and fonts in one import.
//   import { speak, sfx, celebrate, fonts } from "pac-kit";
// Everything here uses standard web features inside the page; nothing reaches the device or network.

import confetti from "confetti";

// ---------------------------------------------------------------------------------------------
// Audio: one shared context, unlocked by the first touch (browsers start audio suspended).

let ctx = null;
let master = null;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}
for (const type of ["pointerdown", "keydown", "touchstart"]) {
  window.addEventListener(type, () => audio(), { once: true, capture: true, passive: true });
}

let muted = false;

/** Notes as frequencies: note("C5"), note("F#4"). */
export function note(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) return 440;
  const i = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  return 440 * Math.pow(2, (i + (Number(m[3]) - 4) * 12) / 12);
}

function tone(c, { freq, to, type = "sine", start = 0, dur = 0.15, vol = 0.5, attack = 0.005, out = master, detune = 0 }) {
  const t = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.detune.value = detune;
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function hiss(c, { start = 0, dur = 0.2, vol = 0.3, from = 800, to = 4000, q = 1, type = "bandpass" }) {
  const t = c.currentTime + start;
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

function chord(c, names, opts = {}) {
  names.forEach((n, i) => {
    const freq = note(n);
    tone(c, { freq, type: "triangle", vol: 0.22, dur: 0.6, ...opts, start: (opts.start || 0) + i * (opts.step ?? 0.07) });
    tone(c, { freq: freq * 2, type: "sine", vol: 0.06, dur: 0.5, ...opts, start: (opts.start || 0) + i * (opts.step ?? 0.07) });
  });
}

const SOUNDS = {
  tap: (c) => tone(c, { freq: 1200, to: 900, type: "sine", dur: 0.05, vol: 0.25 }),
  click: (c) => { tone(c, { freq: 2000, type: "square", dur: 0.02, vol: 0.08 }); hiss(c, { dur: 0.03, vol: 0.1, from: 3000, to: 5000 }); },
  pop: (c) => tone(c, { freq: 300, to: 900, type: "sine", dur: 0.09, vol: 0.5 }),
  bubble: (c) => { tone(c, { freq: 500, to: 1400, type: "sine", dur: 0.12, vol: 0.35 }); tone(c, { freq: 700, to: 1800, type: "sine", start: 0.07, dur: 0.1, vol: 0.2 }); },
  flip: (c) => hiss(c, { dur: 0.16, vol: 0.25, from: 1200, to: 5000, q: 0.7 }),
  whoosh: (c) => hiss(c, { dur: 0.35, vol: 0.35, from: 300, to: 3000, q: 0.6 }),
  swoosh: (c) => hiss(c, { dur: 0.25, vol: 0.3, from: 4000, to: 500, q: 0.8 }),
  correct: (c) => { tone(c, { freq: note("E5"), type: "triangle", dur: 0.18, vol: 0.35 }); tone(c, { freq: note("B5"), type: "triangle", start: 0.09, dur: 0.3, vol: 0.35 }); },
  wrong: (c) => { tone(c, { freq: 220, to: 180, type: "sawtooth", dur: 0.18, vol: 0.12 }); tone(c, { freq: 196, to: 150, type: "sawtooth", start: 0.14, dur: 0.25, vol: 0.12 }); },
  gentleWrong: (c) => { tone(c, { freq: note("A4"), type: "sine", dur: 0.2, vol: 0.25 }); tone(c, { freq: note("F4"), type: "sine", start: 0.12, dur: 0.3, vol: 0.25 }); },
  success: (c) => chord(c, ["C5", "E5", "G5", "C6"], { step: 0.08, dur: 0.7 }),
  win: (c) => { chord(c, ["G4", "C5", "E5"], { step: 0.1, dur: 0.25 }); chord(c, ["G4", "C5", "E5", "G5", "C6"], { start: 0.36, step: 0.02, dur: 1.1 }); },
  levelUp: (c) => ["C5", "D5", "E5", "G5", "C6", "E6"].forEach((n, i) => tone(c, { freq: note(n), type: "square", start: i * 0.06, dur: 0.12, vol: 0.1 })),
  coin: (c) => { tone(c, { freq: note("B5"), type: "square", dur: 0.07, vol: 0.12 }); tone(c, { freq: note("E6"), type: "square", start: 0.07, dur: 0.3, vol: 0.12 }); },
  sparkle: (c) => [0, 1, 2, 3, 4].forEach((i) => tone(c, { freq: 2000 + Math.random() * 2500, type: "sine", start: i * 0.045, dur: 0.18, vol: 0.12 })),
  chime: (c) => [note("E6"), note("B6")].forEach((f, i) => tone(c, { freq: f, type: "sine", start: i * 0.12, dur: 1.2, vol: 0.2, attack: 0.002 })),
  bell: (c) => { tone(c, { freq: 880, type: "sine", dur: 1.5, vol: 0.3, attack: 0.002 }); tone(c, { freq: 880 * 2.76, type: "sine", dur: 0.6, vol: 0.08, attack: 0.002 }); },
  bounce: (c) => tone(c, { freq: 180, to: 520, type: "sine", dur: 0.15, vol: 0.4 }),
  drop: (c) => tone(c, { freq: 900, to: 120, type: "sine", dur: 0.25, vol: 0.35 }),
  thud: (c) => { tone(c, { freq: 120, to: 50, type: "sine", dur: 0.18, vol: 0.6 }); hiss(c, { dur: 0.08, vol: 0.15, from: 200, to: 100, type: "lowpass" }); },
  unlock: (c) => { tone(c, { freq: note("G5"), type: "triangle", dur: 0.08, vol: 0.25 }); tone(c, { freq: note("D6"), type: "triangle", start: 0.08, dur: 0.25, vol: 0.25 }); hiss(c, { start: 0.08, dur: 0.15, vol: 0.08, from: 5000, to: 8000 }); },
  type: (c) => hiss(c, { dur: 0.025, vol: 0.12, from: 2500 + Math.random() * 1500, to: 3000, q: 2 }),
  tick: (c) => tone(c, { freq: 1500, type: "square", dur: 0.015, vol: 0.06 }),
  countdown: (c) => tone(c, { freq: 660, type: "sine", dur: 0.15, vol: 0.3 }),
  go: (c) => tone(c, { freq: 1320, type: "sine", dur: 0.4, vol: 0.3 }),
  magic: (c) => { [0, 1, 2, 3, 4, 5, 6].forEach((i) => tone(c, { freq: note("C6") * Math.pow(2, i / 7), type: "sine", start: i * 0.05, dur: 0.3, vol: 0.1 })); hiss(c, { dur: 0.5, vol: 0.05, from: 6000, to: 9000 }); },
};

/** Plays a sound effect made on the fly (no files). Names: see sfx.names. Ignored until the first touch. */
export function sfx(name, { volume = 1 } = {}) {
  if (muted) return;
  const c = audio();
  const make = SOUNDS[name];
  if (!c || !make) return;
  const previous = master.gain.value;
  if (volume !== 1) master.gain.setValueAtTime(0.6 * volume, c.currentTime);
  try { make(c); } catch {}
  if (volume !== 1) master.gain.setValueAtTime(previous, c.currentTime + 1.5);
}
sfx.names = Object.keys(SOUNDS);
sfx.mute = (on = true) => { muted = on; };

/** Plays a short melody: [["C5", 0.25], ["E5", 0.25], [null, 0.25], ["G5", 0.5]] (null = rest). */
export function melody(notes, { type = "triangle", volume = 0.25, tempo = 1 } = {}) {
  const c = audio();
  if (!c || muted) return;
  let at = 0;
  for (const [n, beats] of notes) {
    const dur = beats / tempo;
    if (n) tone(c, { freq: note(n), type, start: at, dur: dur * 0.95, vol: volume });
    at += dur;
  }
}

// ---------------------------------------------------------------------------------------------
// Speech: the device's own voices (free, offline). Picks the best-quality voice for the language.

let voiceList = [];
function loadVoices() {
  try { voiceList = window.speechSynthesis ? speechSynthesis.getVoices() : []; } catch { voiceList = []; }
}
loadVoices();
try { window.speechSynthesis && speechSynthesis.addEventListener("voiceschanged", loadVoices); } catch {}

function rank(v) {
  const n = v.name.toLowerCase();
  return (n.includes("premium") ? 4 : 0) + (n.includes("enhanced") ? 3 : 0) + (v.localService ? 1 : 0)
    - (/(novelty|bells|bubbles|boing|whisper|zarvox|trinoids|cellos|bad news|good news|organ|jester|superstar|wobble|albert|bahh|fred|junior|ralph|kathy|grandma|grandpa|rocko|shelley|reed|flo|eddy|sandy)/.test(n) ? 10 : 0);
}

/** The best voice for a language ("en", "en-GB", "fr"…), or null. */
export function bestVoice(lang = navigator.language || "en-US") {
  if (!voiceList.length) loadVoices();
  const base = lang.split("-")[0].toLowerCase();
  const exact = voiceList.filter((v) => v.lang.toLowerCase().replace("_", "-") === lang.toLowerCase());
  const pool = exact.length ? exact : voiceList.filter((v) => v.lang.toLowerCase().startsWith(base));
  return pool.sort((a, b) => rank(b) - rank(a))[0] || null;
}

/** The device's own voice: used when PAC's natural voice isn't available (offline, or not in PAC). */
function deviceSpeak(text, { rate = 1, pitch = 1, lang, voice, volume = 1, interrupt = true } = {}) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis || !text) return resolve(false);
    if (interrupt) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    const v = voice ? voiceList.find((x) => x.name === voice) : bestVoice(lang);
    if (v) { u.voice = v; u.lang = v.lang; } else if (lang) u.lang = lang;
    u.rate = rate; u.pitch = pitch; u.volume = volume;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    speechSynthesis.speak(u);
  });
}

// PAC's natural voice: the text is read in pieces (a short first one, so reading starts quickly),
// each made once by PAC and kept, so reading it again is instant and free. One audio element is
// reused and started on the tap that asked for it, so browsers let it keep playing.
let reading = null;
let player = null;
const SILENCE = "data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

function pieces(text) {
  const sentences = String(text).replace(/\s+/g, " ").trim().match(/[^.!?…]+[.!?…]+["'”’)\]]*\s*|[^.!?…]+$/g) || [];
  const out = [];
  let cur = "";
  for (const s of sentences) {
    const limit = out.length === 0 ? 220 : 900;
    if (cur && (cur + s).length > limit) { out.push(cur.trim()); cur = ""; }
    cur += s;
    while (cur.length > 1700) { out.push(cur.slice(0, 1700)); cur = cur.slice(1700); }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

async function naturalSpeak(text, opts) {
  const me = { stopped: false };
  reading = me;
  if (!player) player = new Audio();
  // Started on the tap itself (silently), so the voice can play when it arrives.
  try { player.src = SILENCE; player.play().catch(() => {}); } catch {}
  const parts = pieces(text);
  if (!parts.length) return false;
  let first, rest;
  try {
    first = window.pac.media.speak([parts[0]]);
    rest = parts.length > 1 ? window.pac.media.speak(parts.slice(1)) : Promise.resolve([]);
    rest.catch(() => {});
    const urls = await first;
    for (let i = 0; i < parts.length; i++) {
      if (me.stopped) return false;
      const url = i === 0 ? urls[0] : (await rest)[i - 1];
      if (me.stopped) return false;
      player.src = url;
      player.playbackRate = Math.max(0.5, Math.min(2, opts.rate ?? 1));
      player.volume = opts.volume ?? 1;
      const finished = await new Promise((resolve) => {
        me.wake = () => resolve(false);
        player.onended = () => resolve(true);
        player.onerror = () => resolve(false);
        player.play().catch(() => resolve(false));
      });
      if (!finished && !me.stopped) throw new Error("couldn't play");
    }
    return !me.stopped;
  } catch {
    if (me.stopped) return false;
    // No natural voice here (offline, a preview, or not set up): the device reads the rest.
    return deviceSpeak(text, opts);
  } finally {
    if (reading === me) reading = null;
  }
}

/** Reads text aloud and resolves when it finishes. In PAC it's PAC's natural voice (a real narrator;
 *  the same text is only made once); elsewhere, or with { natural: false }, the device's best voice.
 *  rate 0.5–2 (0.85 suits young children). */
export function speak(text, { rate = 1, pitch = 1, lang, voice, volume = 1, interrupt = true, natural = true } = {}) {
  if (!text) return Promise.resolve(false);
  if (interrupt) stopSpeaking();
  const opts = { rate, pitch, lang, voice, volume, interrupt };
  if (natural && !voice && window.pac && window.pac.media && window.pac.media.speak) return naturalSpeak(text, opts);
  return deviceSpeak(text, opts);
}
export const stopSpeaking = () => {
  if (reading) { reading.stopped = true; reading.wake?.(); }
  reading = null;
  try { if (player) { player.pause(); player.removeAttribute("src"); } } catch {}
  try { speechSynthesis.cancel(); } catch {}
};
export const isSpeaking = () => !!reading || (!!window.speechSynthesis && speechSynthesis.speaking);
export const canSpeak = () => !!window.speechSynthesis || !!(window.pac && window.pac.media && window.pac.media.speak);

// ---------------------------------------------------------------------------------------------
// Celebrations

const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function themeColors() {
  const s = getComputedStyle(document.documentElement);
  const tint = s.getPropertyValue("--pac-tint").trim() || "#5B5BD6";
  const accent = s.getPropertyValue("--pac-accent").trim() || "#FF8A3D";
  return [tint, accent, "#FFD43B", "#FF6B9A", "#4DD4AC", "#ffffff"];
}

/**
 * A celebration over the whole page. kind: "confetti" (default), "burst" (from a point), "stars",
 * "fireworks", "sparkles", "emoji" (with emoji: "🎉"), "rain" (gentle fall for a few seconds), "side" (cannons from both sides).
 * at: {x, y} 0–1 page fractions or an element to burst from. Respects reduced motion.
 */
export function celebrate(kind = "confetti", { at, colors, emoji = "🎉", sound = true, intensity = 1 } = {}) {
  if (reduceMotion()) { if (sound) sfx("success"); return; }
  const palette = colors || themeColors();
  let origin = { x: 0.5, y: 0.6 };
  if (at instanceof Element) {
    const r = at.getBoundingClientRect();
    origin = { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight };
  } else if (at) origin = at;
  const n = (k) => Math.round(k * intensity);
  switch (kind) {
    case "burst":
      confetti({ particleCount: n(60), spread: 70, startVelocity: 32, origin, colors: palette, scalar: 0.9 });
      if (sound) sfx("pop");
      break;
    case "stars":
      confetti({ particleCount: n(40), spread: 360, startVelocity: 22, gravity: 0.5, decay: 0.92, shapes: ["star"], scalar: 1.3, origin, colors: ["#FFD43B", "#FFE066", "#FFC107", "#fff"] });
      if (sound) sfx("sparkle");
      break;
    case "sparkles":
      confetti({ particleCount: n(30), spread: 360, startVelocity: 12, gravity: 0.2, ticks: 90, shapes: ["circle"], scalar: 0.6, origin, colors: ["#fff", "#FFE066", ...palette.slice(0, 2)] });
      if (sound) sfx("sparkle");
      break;
    case "fireworks": {
      const end = Date.now() + 1600;
      const shoot = () => {
        confetti({ particleCount: n(45), spread: 360, startVelocity: 28, ticks: 70, gravity: 0.8, origin: { x: 0.15 + Math.random() * 0.7, y: 0.15 + Math.random() * 0.35 }, colors: palette });
        if (sound) sfx("pop", { volume: 0.6 });
        if (Date.now() < end) setTimeout(shoot, 280 + Math.random() * 220);
      };
      shoot();
      break;
    }
    case "emoji": {
      const shape = confetti.shapeFromText({ text: emoji, scalar: 2.4 });
      confetti({ particleCount: n(26), spread: 90, startVelocity: 34, shapes: [shape], scalar: 2.4, origin, flat: true });
      if (sound) sfx("bubble");
      break;
    }
    case "rain": {
      const end = Date.now() + 2500;
      (function frame() {
        confetti({ particleCount: 3, angle: 270, spread: 80, startVelocity: 4, gravity: 0.6, origin: { x: Math.random(), y: -0.05 }, colors: palette, ticks: 300 });
        if (Date.now() < end) requestAnimationFrame(frame);
      })();
      if (sound) sfx("chime");
      break;
    }
    case "side":
      confetti({ particleCount: n(70), angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: palette });
      confetti({ particleCount: n(70), angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: palette });
      if (sound) sfx("win");
      break;
    default:
      confetti({ particleCount: n(120), spread: 100, startVelocity: 40, origin, colors: palette });
      if (sound) sfx("success");
  }
}

// ---------------------------------------------------------------------------------------------
// Fonts: bundled, open-licence families (CSS is already on the page). Use the CSS variables or these names.

export const fonts = Object.freeze({
  display: "Fraunces",           // characterful serif headlines
  editorial: "Playfair Display", // elegant, high-contrast
  sans: "Inter",
  rounded: "Nunito",             // friendly
  playful: "Baloo 2",            // bold and bouncy: games, kids
  hand: "Caveat",                // handwriting
  mono: "JetBrains Mono",
  learn: "Andika",               // early readers: school-style a and g
  readable: "Atkinson Hyperlegible",
  reading: "Lexend",             // easier reading
  /** Waits until the named families are loaded (so text measures and canvas drawing are right). */
  async ready(...families) {
    await Promise.all(families.map((f) => document.fonts.load(`700 32px "${f}"`).catch(() => {})));
    await document.fonts.ready;
  },
});

// ---------------------------------------------------------------------------------------------
// Small helpers that come up in nearly every rich screen.

/** Promise-based pause. */
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** Shuffled copy of an array. */
export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** Random item. */
export const pick = (list) => list[Math.floor(Math.random() * list.length)];
/** True when the person prefers less motion: keep transitions short and skip big effects. */
export { reduceMotion };

// ---------------------------------------------------------------------------------------------
// Games: a full-bleed stage, game buttons, score pills, banners, input, juice and progress, so
// every game starts from polished parts. import { stage, gameButton, hud, banner, hint, swipe,
// drag, burst, shake, musicToggle, progress } from "pac-kit".

let gameStyled = false;
function gameStyles() {
  if (gameStyled) return;
  gameStyled = true;
  const css = `
.pk-stage{position:fixed;inset:0;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;background:#0b1020}
.pk-stage>.pk-back{position:absolute;inset:0;background-size:cover;background-position:center;transition:filter .4s}
.pk-stage>.pk-layer{position:absolute;inset:0}
.pk-stage>.pk-ui{position:absolute;inset:0;pointer-events:none;padding:max(14px,env(safe-area-inset-top)) 14px max(14px,env(safe-area-inset-bottom))}
.pk-stage>.pk-ui *{pointer-events:auto}
.pk-btn{--c:#22c55e;--d:color-mix(in srgb,var(--c) 70%,#000);font:800 clamp(18px,4.6vw,26px)/1 var(--pac-font-playful,"Baloo 2",system-ui);letter-spacing:.02em;color:#fff;
  background:linear-gradient(180deg,color-mix(in srgb,var(--c) 85%,#fff),var(--c));border:3px solid rgba(255,255,255,.85);border-radius:22px;
  padding:16px 34px;box-shadow:0 6px 0 var(--d),0 10px 24px rgba(0,0,0,.28);cursor:pointer;display:inline-flex;align-items:center;gap:10px;
  text-shadow:0 2px 0 rgba(0,0,0,.18);transition:transform .08s,box-shadow .08s}
.pk-btn:active{transform:translateY(5px);box-shadow:0 1px 0 var(--d),0 4px 10px rgba(0,0,0,.25)}
.pk-btn.pk-small{font-size:16px;padding:10px 18px;border-radius:16px;box-shadow:0 4px 0 var(--d),0 6px 14px rgba(0,0,0,.25)}
.pk-hud{position:absolute;display:flex;gap:8px;align-items:flex-start}
.pk-hud.top{top:max(14px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);flex-direction:column;align-items:center}
.pk-hud.right{top:max(14px,env(safe-area-inset-top));right:14px;flex-direction:column;align-items:flex-end}
.pk-hud.left{top:max(14px,env(safe-area-inset-top));left:58px}
.pk-pill{background:rgba(20,22,30,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff;border-radius:16px;padding:8px 16px;
  font:800 15px/1.1 var(--pac-font-playful,"Baloo 2",system-ui);text-align:center;min-width:64px;box-shadow:0 4px 14px rgba(0,0,0,.2)}
.pk-pill b{display:block;font-size:30px;line-height:1}
.pk-pill small{display:block;font-size:11px;letter-spacing:.12em;opacity:.75;text-transform:uppercase}
.pk-pill.gold{color:#ffd54a}
.pk-banner{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%) scale(.6);opacity:0;text-align:center;pointer-events:none;
  font:900 clamp(30px,8vw,52px)/1.05 var(--pac-font-playful,"Baloo 2",system-ui);color:#fff;
  text-shadow:0 0 2px rgba(0,0,0,.55),0 3px 0 rgba(0,0,0,.35),0 0 22px rgba(0,0,0,.45),0 8px 30px rgba(0,0,0,.35);
  transition:transform .35s cubic-bezier(.2,1.6,.4,1),opacity .2s;width:90%}
.pk-banner.on{transform:translate(-50%,-50%) scale(1);opacity:1}
.pk-banner small{display:block;font-size:.42em;font-weight:700;margin-top:10px;color:#fff;text-shadow:0 0 2px rgba(0,0,0,.6),0 2px 10px rgba(0,0,0,.55)}
.pk-banner.bad{color:#ff5a5a}.pk-banner.good{color:#6dffa8}.pk-banner.gold{color:#ffd54a}
.pk-hint{position:absolute;left:50%;bottom:max(28px,env(safe-area-inset-bottom));transform:translateX(-50%);color:#fff;white-space:nowrap;
  font:800 clamp(17px,4.4vw,24px)/1 var(--pac-font-playful,"Baloo 2",system-ui);text-shadow:0 2px 10px rgba(0,0,0,.45);animation:pk-bob 1.6s ease-in-out infinite}
@keyframes pk-bob{50%{transform:translate(-50%,-6px)}}
.pk-toast{position:absolute;left:50%;top:calc(max(14px,env(safe-area-inset-top)) + 96px);transform:translate(-50%,-40px);opacity:0;background:rgba(10,30,30,.85);color:#9ff5e1;
  border:1px solid rgba(159,245,225,.5);border-radius:10px;padding:10px 18px;font:600 14px/1.2 var(--pac-font-mono,"JetBrains Mono",monospace);
  letter-spacing:.14em;text-transform:uppercase;transition:transform .45s cubic-bezier(.2,1.4,.4,1),opacity .3s;z-index:5;white-space:nowrap}
.pk-toast.on{transform:translate(-50%,0);opacity:1}
.pk-icon-btn{width:48px;height:48px;border-radius:50%;border:0;background:rgba(20,22,30,.5);backdrop-filter:blur(10px);color:#fff;font-size:22px;cursor:pointer;
  display:grid;place-items:center;box-shadow:0 4px 14px rgba(0,0,0,.25)}
@media (prefers-reduced-motion:reduce){.pk-hint{animation:none}.pk-banner{transition:opacity .2s}}`;
  const tag = document.createElement("style");
  tag.textContent = css;
  document.head.appendChild(tag);
}

/** A full-screen stage: a backdrop picture (or gradient), a layer to draw on, and a UI layer on top.
 *  Returns { el, back, layer, ui, canvas(), size() }. */
export function stage({ background, dim = 0 } = {}) {
  gameStyles();
  const el = document.createElement("div");
  el.className = "pk-stage";
  el.innerHTML = `<div class="pk-back"></div><div class="pk-layer"></div><div class="pk-ui"></div>`;
  document.body.appendChild(el);
  const back = el.querySelector(".pk-back"), layer = el.querySelector(".pk-layer"), ui = el.querySelector(".pk-ui");
  const setBackground = (bg) => {
    if (!bg) return;
    back.style.background = /^(https?:|blob:|data:)/.test(bg) ? `center/cover no-repeat url("${bg}")` : bg;
    if (dim) back.style.filter = `brightness(${1 - dim})`;
  };
  Promise.resolve(background).then(setBackground);
  /** A canvas that fills the stage at the device's pixel density; draw in CSS pixels. */
  const canvas = () => {
    const c = document.createElement("canvas");
    layer.appendChild(c);
    const ctx = c.getContext("2d");
    const fit = () => { const r = devicePixelRatio || 1; c.width = innerWidth * r; c.height = innerHeight * r; c.style.width = innerWidth + "px"; c.style.height = innerHeight + "px"; ctx.setTransform(r, 0, 0, r, 0, 0); };
    fit(); addEventListener("resize", fit);
    return { canvas: c, ctx };
  };
  return { el, back, layer, ui, canvas, setBackground, size: () => ({ width: innerWidth, height: innerHeight }) };
}

/** A chunky game button (PLAY, SHOP…). color: any CSS colour. Returns the element. */
export function gameButton(label, { color = "#22c55e", icon = "", small = false, onClick, parent } = {}) {
  gameStyles();
  const b = document.createElement("button");
  b.className = "pk-btn" + (small ? " pk-small" : "");
  b.style.setProperty("--c", color);
  b.innerHTML = `${icon ? `<span aria-hidden="true">${icon}</span>` : ""}<span>${label}</span>`;
  if (onClick) b.addEventListener("click", (e) => { sfx("click"); onClick(e); });
  if (parent) parent.appendChild(b);
  return b;
}

/** Score pills. hud(ui, "top" | "right" | "left") → { pill(label, value, {gold}) → set(value) }. */
export function hud(parent, where = "top") {
  gameStyles();
  const box = document.createElement("div");
  box.className = `pk-hud ${where}`;
  parent.appendChild(box);
  return {
    el: box,
    pill(label, value = 0, { gold = false } = {}) {
      const p = document.createElement("div");
      p.className = "pk-pill" + (gold ? " gold" : "");
      p.innerHTML = `<b></b><small>${label}</small>`;
      box.appendChild(p);
      const b = p.querySelector("b");
      const set = (v) => { b.textContent = typeof v === "number" ? v.toLocaleString() : String(v); };
      set(value);
      return { el: p, set };
    },
  };
}

/** A big result line over the game ("Landed on its side!"). tone: "good" | "bad" | "gold". */
export function banner(parent, text, { tone = "", sub = "", ms = 1600 } = {}) {
  gameStyles();
  const b = document.createElement("div");
  b.className = `pk-banner ${tone}`;
  b.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ""}`;
  parent.appendChild(b);
  requestAnimationFrame(() => b.classList.add("on"));
  if (ms > 0) setTimeout(() => { b.classList.remove("on"); setTimeout(() => b.remove(), 300); }, ms);
  return b;
}

/** A one-line instruction at the bottom ("Swipe up to flip!"); returns { set(text), hide() }. */
export function hint(parent, text) {
  gameStyles();
  const h = document.createElement("div");
  h.className = "pk-hint";
  h.textContent = text;
  parent.appendChild(h);
  return { set: (t) => { h.textContent = t; h.style.display = ""; }, hide: () => { h.style.display = "none"; } };
}

/** Swipes on an element: onSwipe({dx, dy, speed, angle}) when a finger or mouse is flicked. */
export function swipe(el, onSwipe, { min = 30 } = {}) {
  let start = null;
  el.addEventListener("pointerdown", (e) => { start = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  el.addEventListener("pointerup", (e) => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y, dt = Math.max(16, performance.now() - start.t);
    start = null;
    if (Math.hypot(dx, dy) < min) return;
    onSwipe({ dx, dy, speed: Math.hypot(dx, dy) / dt, angle: Math.atan2(dy, dx) });
  });
}

/** Dragging: onMove({x, y, dx, dy}) while held, onEnd({x, y, vx, vy}) on release (velocity in px/s). */
export function drag(el, { onStart, onMove, onEnd } = {}) {
  let last = null;
  el.addEventListener("pointerdown", (e) => { el.setPointerCapture?.(e.pointerId); last = { x: e.clientX, y: e.clientY, t: performance.now(), vx: 0, vy: 0 }; onStart?.({ x: e.clientX, y: e.clientY }); });
  el.addEventListener("pointermove", (e) => {
    if (!last) return;
    const t = performance.now(), dt = Math.max(1, t - last.t);
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY, t, vx: dx / dt * 1000, vy: dy / dt * 1000 };
    onMove?.({ x: e.clientX, y: e.clientY, dx, dy });
  });
  const end = (e) => { if (!last) return; onEnd?.({ x: e.clientX, y: e.clientY, vx: last.vx, vy: last.vy }); last = null; };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

/** A burst of particles at a point (screen pixels): coins, sparks, dust, splashes. */
export function burst(x, y, { colors = ["#ffd54a", "#ff6b9a", "#6dffa8", "#7cc4ff", "#fff"], count = 28, speed = 7, gravity = 0.28, size = 7, shape = "circle" } = {}) {
  if (reduceMotion()) return;
  const c = document.createElement("canvas");
  Object.assign(c.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: 50 });
  const r = devicePixelRatio || 1;
  c.width = innerWidth * r; c.height = innerHeight * r; c.style.width = innerWidth + "px"; c.style.height = innerHeight + "px";
  document.body.appendChild(c);
  const ctx = c.getContext("2d");
  ctx.scale(r, r);
  const parts = Array.from({ length: count }, () => {
    const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random());
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.5, life: 1, s: size * (0.5 + Math.random()), c: colors[(Math.random() * colors.length) | 0], rot: Math.random() * 6 };
  });
  const step = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    let alive = false;
    for (const p of parts) {
      if (p.life <= 0) continue;
      alive = true;
      p.vy += gravity; p.x += p.vx; p.y += p.vy; p.life -= 0.018; p.rot += 0.2;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.c;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      if (shape === "square") ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
      else { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    if (alive) requestAnimationFrame(step); else c.remove();
  };
  requestAnimationFrame(step);
}

/** A short shake of an element (a hit, a crash). */
export function shake(el, { strength = 10, ms = 380 } = {}) {
  if (reduceMotion() || !el.animate) return;
  const k = [0, -1, 1, -0.7, 0.7, -0.4, 0.4, 0].map((f) => ({ transform: `translate(${f * strength}px, ${f * strength * 0.4}px)` }));
  el.animate(k, { duration: ms, easing: "ease-out" });
}

/** A music on/off button (remembered); plays url looping once the person has tapped anything. */
export function musicToggle(parent, url, { volume = 0.45 } = {}) {
  gameStyles();
  const audio = new Audio();
  audio.loop = true; audio.volume = volume;
  Promise.resolve(url).then((u) => { if (u) audio.src = u; });
  let on = true;
  try { on = localStorage.getItem("pk.music") !== "off"; } catch {}
  const b = document.createElement("button");
  b.className = "pk-icon-btn";
  const paint = () => { b.textContent = on ? "♪" : "♪̸"; b.setAttribute("aria-label", on ? "Music off" : "Music on"); b.style.opacity = on ? 1 : 0.55; };
  paint();
  const start = () => { if (on && audio.src) audio.play().catch(() => {}); };
  addEventListener("pointerdown", start, { once: true });
  b.addEventListener("click", (e) => { e.stopPropagation(); on = !on; try { localStorage.setItem("pk.music", on ? "on" : "off"); } catch {} paint(); on ? audio.play().catch(() => {}) : audio.pause(); });
  parent.appendChild(b);
  return { el: b, audio };
}

/** Saved progress for a game (best, wallet, unlocks, achievements), kept with the app. */
export async function progress(name = "game") {
  const key = `pk.progress.${name}`;
  const pac = window.pac;
  const load = async () => { try { return (pac ? await pac.storage.get(key) : JSON.parse(localStorage.getItem(key) || "null")) || {}; } catch { return {}; } };
  const state = Object.assign({ best: 0, wallet: 0, plays: 0, unlocked: [], achievements: [] }, await load());
  const save = () => { try { pac ? pac.storage.set(key, state) : localStorage.setItem(key, JSON.stringify(state)); } catch {} };
  let toastEl = null;
  return {
    state,
    /** Records a finished round: returns true for a new best. */
    finish(score) { state.plays++; const best = score > state.best; if (best) state.best = score; save(); return best; },
    earn(n) { state.wallet += n; save(); return state.wallet; },
    spend(n) { if (state.wallet < n) return false; state.wallet -= n; save(); return true; },
    unlock(id) { if (!state.unlocked.includes(id)) { state.unlocked.push(id); save(); } },
    has: (id) => state.unlocked.includes(id),
    /** Shows "ACHIEVEMENT: name" once, ever. */
    achieve(id, title, parent = document.body) {
      if (state.achievements.includes(id)) return false;
      state.achievements.push(id); save();
      gameStyles(); sfx("levelUp");
      toastEl?.remove();
      toastEl = document.createElement("div");
      toastEl.className = "pk-toast";
      toastEl.textContent = `Achievement: ${title}`;
      parent.appendChild(toastEl);
      requestAnimationFrame(() => toastEl.classList.add("on"));
      setTimeout(() => { toastEl?.classList.remove("on"); }, 2800);
      return true;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Worlds and sprites: smooth noise, painted terrain, soft fog, and clean cut-out sprites.

/** Smooth noise in 0..1 (seeded, layered): the same x, y and seed always give the same value. */
export function noise(x, y, { seed = 1, octaves = 4, scale = 1 } = {}) {
  const hash = (i, j) => { let h = (i * 374761393 + j * 668265263 + seed * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const smooth = (t) => t * t * (3 - 2 * t);
  const value = (px, py) => {
    const i = Math.floor(px), j = Math.floor(py), fx = smooth(px - i), fy = smooth(py - j);
    const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  let total = 0, amp = 1, freq = scale, norm = 0;
  for (let o = 0; o < octaves; o++) { total += value(x * freq, y * freq) * amp; norm += amp; amp *= 0.5; freq *= 2; }
  return total / norm;
}

const TERRAINS = {
  desert: [[0, "#c8a46a"], [0.42, "#d9b77c"], [0.6, "#c9a066"], [0.75, "#a88356"], [1, "#8c6c48"]],
  grass: [[0, "#2f6f8f"], [0.3, "#3f86a6"], [0.34, "#d8c48a"], [0.38, "#6fa35a"], [0.6, "#4e8a45"], [0.8, "#3d6e3a"], [1, "#7c7c74"]],
  snow: [[0, "#36608a"], [0.32, "#4d7fa8"], [0.36, "#cfd8de"], [0.6, "#eef3f6"], [0.85, "#ffffff"], [1, "#b9c3cc"]],
  lava: [[0, "#ff7a1a"], [0.25, "#c2320c"], [0.3, "#2b1a14"], [0.7, "#3a2a24"], [1, "#59463d"]],
  battlefield: [[0, "#5f6b3a"], [0.35, "#7a8148"], [0.55, "#8c8452"], [0.7, "#a08c5c"], [0.85, "#7a6a4a"], [1, "#5a4e3a"]],
};
function rampColor(stops, v) {
  let i = 0;
  while (i < stops.length - 2 && v > stops[i + 1][0]) i++;
  const [a, ca] = stops[i], [b, cb] = stops[i + 1];
  const t = Math.max(0, Math.min(1, (v - a) / (b - a || 1)));
  const p = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const x = p(ca), y = p(cb);
  return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
}

/**
 * Paints smooth, natural ground onto a canvas (or returns a new one): layered noise through a colour
 * ramp, with soft light from the top-left and fine grain. palette: "grass" | "desert" | "snow" |
 * "lava" | "battlefield", or your own [[0,"#hex"], …, [1,"#hex"]]. Returns { canvas, height(x, y) }
 * where height gives the 0..1 ground level at a pixel (water below the first band, for example).
 */
export function paintTerrain({ width, height: h, palette = "grass", seed = 7, scale = 1 / 260, canvas } = {}) {
  const w = Math.max(1, Math.round(width)), hh = Math.max(1, Math.round(h));
  const c = canvas ?? document.createElement("canvas");
  c.width = w; c.height = hh;
  const ctx = c.getContext("2d");
  const stops = Array.isArray(palette) ? palette : (TERRAINS[palette] ?? TERRAINS.grass);
  const img = ctx.createImageData(w, hh);
  const step = 2;                                 // painted at half resolution, then smoothed by the browser
  // Layered noise sits mostly mid-range; stretched so every band of the palette shows.
  const field = (x, y) => Math.max(0, Math.min(1, (noise(x, y, { seed, scale, octaves: 5 }) - 0.28) / 0.44));
  for (let y = 0; y < hh; y += step) {
    for (let x = 0; x < w; x += step) {
      const v = field(x, y);
      const lx = field(x + 3, y + 3) - v;           // light from the top-left
      const grain = (noise(x, y, { seed: seed + 9, scale: 1 / 3, octaves: 1 }) - 0.5) * 14;
      const [r, g, b] = rampColor(stops, v);
      const shade = Math.max(0.82, Math.min(1.12, 1 - lx * 4));
      for (let dy = 0; dy < step && y + dy < hh; dy++) for (let dx = 0; dx < step && x + dx < w; dx++) {
        const k = ((y + dy) * w + (x + dx)) * 4;
        img.data[k] = r * shade + grain; img.data[k + 1] = g * shade + grain; img.data[k + 2] = b * shade + grain; img.data[k + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: c, height: (x, y) => field(x, y) };
}

/** Soft fog of war over what's already drawn: darkens everything except around the given points
 *  (each {x, y, r}), with feathered edges. */
let fogLayer = null;
export function fog(ctx, width, height, seen, { color = "rgba(8,10,14,0.82)" } = {}) {
  fogLayer ??= document.createElement("canvas");
  if (fogLayer.width !== width || fogLayer.height !== height) { fogLayer.width = width; fogLayer.height = height; }
  const f = fogLayer.getContext("2d");
  f.globalCompositeOperation = "source-over";
  f.clearRect(0, 0, width, height);
  f.fillStyle = color;
  f.fillRect(0, 0, width, height);
  f.globalCompositeOperation = "destination-out";
  for (const p of seen) {
    const g = f.createRadialGradient(p.x, p.y, p.r * 0.55, p.x, p.y, p.r);
    g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
    f.fillStyle = g; f.beginPath(); f.arc(p.x, p.y, p.r, 0, Math.PI * 2); f.fill();
  }
  ctx.drawImage(fogLayer, 0, 0, width, height);
}

const cutCache = new Map();
/**
 * A sprite with its plain background removed: give it the picture's URL (from pac.media.url) and get
 * a URL of the same picture with a transparent background and soft edges. Works for subjects on a
 * plain white, black or flat-coloured background. Cached per URL.
 */
export function cutout(url, { tolerance = 38, feather = 18 } = {}) {
  if (!url) return Promise.resolve(url);
  if (cutCache.has(url)) return cutCache.get(url);
  const job = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const max = 768, k = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * k), h = Math.round(img.height * k);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0, w, h);
        const d = ctx.getImageData(0, 0, w, h), px = d.data;
        // The background colour: the average of the four corners.
        const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(([x, y]) => (y * w + x) * 4);
        const bg = [0, 1, 2].map((i) => corners.reduce((s, o) => s + px[o + i], 0) / 4);
        const dist = (o) => Math.hypot(px[o] - bg[0], px[o + 1] - bg[1], px[o + 2] - bg[2]);
        // Flood from the edges through background-coloured pixels, so the subject's own matching colours stay.
        const seen = new Uint8Array(w * h), stack = [];
        for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
        for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
        while (stack.length) {
          const i = stack.pop();
          if (seen[i]) continue;
          const o = i * 4, dd = dist(o);
          if (dd > tolerance + feather) continue;
          seen[i] = 1;
          px[o + 3] = dd <= tolerance ? 0 : Math.round(255 * (dd - tolerance) / feather);
          const x = i % w;
          if (x > 0) stack.push(i - 1); if (x < w - 1) stack.push(i + 1);
          if (i >= w) stack.push(i - w); if (i < w * (h - 1)) stack.push(i + w);
        }
        ctx.putImageData(d, 0, 0);
        c.toBlob((b) => resolve(b ? URL.createObjectURL(b) : url), "image/png");
      } catch { resolve(url); }
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
  cutCache.set(url, job);
  return job;
}
