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

function noise(c, { start = 0, dur = 0.2, vol = 0.3, from = 800, to = 4000, q = 1, type = "bandpass" }) {
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
  click: (c) => { tone(c, { freq: 2000, type: "square", dur: 0.02, vol: 0.08 }); noise(c, { dur: 0.03, vol: 0.1, from: 3000, to: 5000 }); },
  pop: (c) => tone(c, { freq: 300, to: 900, type: "sine", dur: 0.09, vol: 0.5 }),
  bubble: (c) => { tone(c, { freq: 500, to: 1400, type: "sine", dur: 0.12, vol: 0.35 }); tone(c, { freq: 700, to: 1800, type: "sine", start: 0.07, dur: 0.1, vol: 0.2 }); },
  flip: (c) => noise(c, { dur: 0.16, vol: 0.25, from: 1200, to: 5000, q: 0.7 }),
  whoosh: (c) => noise(c, { dur: 0.35, vol: 0.35, from: 300, to: 3000, q: 0.6 }),
  swoosh: (c) => noise(c, { dur: 0.25, vol: 0.3, from: 4000, to: 500, q: 0.8 }),
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
  thud: (c) => { tone(c, { freq: 120, to: 50, type: "sine", dur: 0.18, vol: 0.6 }); noise(c, { dur: 0.08, vol: 0.15, from: 200, to: 100, type: "lowpass" }); },
  unlock: (c) => { tone(c, { freq: note("G5"), type: "triangle", dur: 0.08, vol: 0.25 }); tone(c, { freq: note("D6"), type: "triangle", start: 0.08, dur: 0.25, vol: 0.25 }); noise(c, { start: 0.08, dur: 0.15, vol: 0.08, from: 5000, to: 8000 }); },
  type: (c) => noise(c, { dur: 0.025, vol: 0.12, from: 2500 + Math.random() * 1500, to: 3000, q: 2 }),
  tick: (c) => tone(c, { freq: 1500, type: "square", dur: 0.015, vol: 0.06 }),
  countdown: (c) => tone(c, { freq: 660, type: "sine", dur: 0.15, vol: 0.3 }),
  go: (c) => tone(c, { freq: 1320, type: "sine", dur: 0.4, vol: 0.3 }),
  magic: (c) => { [0, 1, 2, 3, 4, 5, 6].forEach((i) => tone(c, { freq: note("C6") * Math.pow(2, i / 7), type: "sine", start: i * 0.05, dur: 0.3, vol: 0.1 })); noise(c, { dur: 0.5, vol: 0.05, from: 6000, to: 9000 }); },
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
