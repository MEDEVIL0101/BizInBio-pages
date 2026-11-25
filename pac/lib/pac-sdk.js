// PAC SDK: the only way a code screen reaches outside its sandbox.
// Every call is a message to PAC, which checks it before doing anything.
(() => {
  "use strict";
  const init = window.__pacInit || {};
  const bridge = window.webkit && window.webkit.messageHandlers;

  function settingValue(x) {
    if (!x) return undefined;
    if (x.kind === "number") { const n = Number(x.value); return Number.isFinite(n) ? n : undefined; }
    if (x.kind === "toggle") return x.value === "true";
    return String(x.value ?? "");
  }

  function call(method, args) {
    if (!bridge || !bridge.pac) return Promise.reject(new Error("PAC isn't available here"));
    return bridge.pac.postMessage({ method, args: args === undefined ? null : args }).then((reply) => {
      if (reply && reply.error) throw new Error(reply.error);
      return reply ? reply.value : undefined;
    });
  }

  // Console, errors and rejections go to PAC's developer console.
  function send(level, parts) {
    try {
      const message = parts.map((p) => {
        if (p instanceof Error) return p.stack || String(p);
        if (typeof p === "object") { try { return JSON.stringify(p); } catch { return String(p); } }
        return String(p);
      }).join(" ").slice(0, 4000);
      bridge && bridge.pacLog && bridge.pacLog.postMessage({ level, message });
    } catch {}
  }
  for (const level of ["log", "info", "warn", "error", "debug"]) {
    const original = console[level].bind(console);
    console[level] = (...parts) => { send(level === "info" || level === "debug" ? "log" : level, parts); original(...parts); };
  }
  window.addEventListener("error", (e) => send("error", [e.error || e.message]));
  window.addEventListener("unhandledrejection", (e) => send("error", [e.reason]));

  const listeners = {};
  const mediaURLs = new Map();
  const mediaKinds = new Map();

  // Sounds and music: the person turns either off in PAC while playing or using an app, and every
  // app follows it without needing to know. Music = an app's music tracks and anything looping;
  // sounds = effects and everything else; the voice reading aloud always plays.
  const audioPrefs = { sounds: true, music: true, ...(init.audio || {}) };
  const playing = new Set();
  function audioKind(el) {
    if (el.dataset && el.dataset.pacAudio) return el.dataset.pacAudio;
    const kind = mediaKinds.get(el.currentSrc || el.src);
    if (kind === "speech") return "voice";
    if (kind === "music" || (!kind && el.loop)) return "music";
    return "sound";
  }
  function applyAudio(el) {
    const kind = audioKind(el);
    el.muted = kind === "music" ? !audioPrefs.music : kind === "sound" ? !audioPrefs.sounds : false;
  }
  try {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!(this instanceof HTMLVideoElement) || this.loop || !this.muted) { playing.add(this); applyAudio(this); }
      return play.apply(this, arguments);
    };
  } catch {}
  function on(event, callback) {
    (listeners[event] = listeners[event] || new Set()).add(callback);
    return () => listeners[event].delete(callback);
  }

  const pac = Object.freeze({
    version: 1,
    /** This app: id, name, summary, collections (with fields), the current screen and theme. */
    app: Object.freeze(init.app || {}),
    /** Screen size, safe areas and dark mode. */
    device: init.device || {},
    /** The person's sound settings in PAC: { sounds, music } (true = on). PAC applies them for you;
     *  pac.on("audio", fn) hears changes. */
    audio: Object.freeze({ get sounds() { return audioPrefs.sounds; }, get music() { return audioPrefs.music; } }),

    records: Object.freeze({
      /** Entries in a collection (the screen's own collection by default), newest first. */
      list: (collectionId) => call("records.list", { collectionId }),
      get: (id) => call("records.get", { id }),
      /** Adds an entry. Values are keyed by field id; dates as "YYYY-MM-DD" or ISO strings. */
      add: (values, collectionId) => call("records.add", { values, collectionId }),
      /** Changes some fields of an entry; other fields are kept. */
      update: (id, values) => call("records.update", { id, values }),
      remove: (id) => call("records.remove", { id }),
      /** Called with the collection's entries whenever they change (here, in PAC or from someone sharing the app). */
      onChange: (callback) => on("records", callback),
    }),

    /** Things the person can adjust without Magic (Customise): difficulty, speed, how many, a title,
     *  sound on or off. get(id) gives the value typed (number, true/false or text); all() gives them all.
     *  They change when the person changes them, and the screen starts again with the new values. */
    settings: Object.freeze({
      get: (id) => settingValue((init.app && init.app.settings || []).find((x) => x.id === id)),
      all: () => Object.fromEntries((init.app && init.app.settings || []).map((x) => [x.id, settingValue(x)])),
    }),

    storage: Object.freeze({
      /** Small private data for this app's code (game saves, settings). JSON values, about 10 MB in all. */
      get: (key) => call("storage.get", { key }),
      set: (key, value) => call("storage.set", { key, value: JSON.stringify(value === undefined ? null : value) }),
      remove: (key) => call("storage.remove", { key }),
      keys: () => call("storage.keys"),
    }),

    ui: Object.freeze({
      toast: (text) => call("ui.toast", { text: String(text) }),
      /** Retired: does nothing. Code screens reach PAC only for data and storage; native feedback comes from built-in rules. */
      haptic: () => Promise.resolve(true),
      /** Opens an entry in PAC's own detail screen. */
      openEntry: (id) => call("ui.openEntry", { id }),
      /** Opens a web page (a new tab, or the browser on a phone), a phone number (tel:) or an email
       *  (mailto:). Call it from a tap. Plain <a href> links open the same way by themselves. */
      open: (url) => openLink(String(url)),
      /** Sets the title shown above the screen. */
      setTitle: (title) => call("ui.setTitle", { title: String(title) }),
    }),

    media: Object.freeze({
      /** A URL for one of the app's pictures or voice clips (pac.app.media), for an <img> src or new
       *  Audio(url). Waits while a picture is still being made. */
      url: (id) => {
        const key = String(id);
        if (!mediaURLs.has(key)) {
          const p = call("media.url", { id: key }).then((v) => (typeof Blob !== "undefined" && v instanceof Blob ? URL.createObjectURL(v) : v))
            .then((u) => { const a = ((init.app && init.app.media) || []).find((m) => m.id === key); if (a && u) mediaKinds.set(u, a.kind); return u; });
          p.catch(() => mediaURLs.delete(key));
          mediaURLs.set(key, p);
        }
        return mediaURLs.get(key);
      },
      /** Natural-voice audio for text (one string or a list), as URLs for new Audio(url), in the same
       *  order. pac-kit's speak() uses it; most screens should just call speak(). */
      speak: (texts) => {
        const list = (Array.isArray(texts) ? texts : [texts]).map(String);
        return call("media.speak", { texts: list }).then((blobs) =>
          (Array.isArray(blobs) ? blobs : [blobs]).map((b) => {
            const u = typeof Blob !== "undefined" && b instanceof Blob ? URL.createObjectURL(b) : b;
            mediaKinds.set(u, "speech");
            return u;
          }));
      },
      /** The app's pictures and voice clips: [{id, kind: "image" | "speech", about}]. */
      list: () => Promise.resolve((init.app && init.app.media) || []),
    }),

    leaderboard: Object.freeze({
      /** Posts the player's score for a game on Discover (keeps their best, all time and this week).
       *  options: {board: "main", lower: true when a lower score wins, like a time}. Needs the player
       *  to be signed in to PAC; resolves with the board, rejects otherwise. */
      submit: (score, options) => call("leaderboard.submit", { score: Number(score), board: options && options.board, lower: !!(options && options.lower) }),
      /** The board: {board, lower, period, top: [{place, name, score, me}], me: {place, score} | null}.
       *  options: {board, period: "all" | "week", limit (up to 100)}. */
      top: (options) => call("leaderboard.top", { board: options && options.board, period: options && options.period, limit: options && options.limit }),
      /** Opens PAC's own leaderboard over the game (all time and this week). */
      show: (options) => call("leaderboard.show", { board: options && options.board }),
    }),

    web: Object.freeze({
      /** Current web results: [{title, url, description, site, age?}]. near: {lat, lon} for local results.
       *  Needs the "internet" permission. */
      search: (q, options) => call("web.search", { q: String(q), count: options && options.count, near: options && options.near }),
      /** Real photos: [{url, thumbnail, width, height, credit, link}]; prefer: ["maker.com"] ranks those
       *  sites first. Show them with <img src=url> and a small credit. Needs "internet". */
      images: (q, options) => call("web.images", { q: String(q), count: options && options.count, prefer: options && options.prefer }),
      /** Reads a public page or data feed: {status, type, text} (parse JSON yourself). Needs "internet". */
      fetch: (url) => call("web.fetch", { url: String(url) }),
      /** Real places near somewhere: [{name, description, cuisine, address, distanceKm, hoursToday, hours,
       *  phone, website, rating, reviews, priceRange, photo, mapUrl}], nearest first. near: a postal code,
       *  address, city or {lat, lon}. Needs "internet". */
      places: (category, options) => call("web.places", { category: String(category), cuisine: options && options.cuisine, near: options && options.near, count: options && options.count, radius: options && options.radius }),
    }),

    device: Object.freeze({
      /** The person's approximate location {lat, lon, accuracy} (about a kilometre), after the
       *  device asks them once. Needs the "location" permission. */
      location: () => call("device.location", {}),
    }),

    textures: Object.freeze({
      /** A URL for one of PAC's real surface textures (equirectangular, for a three.js sphere's map):
       *  sun, mercury, venus, earth, moon, mars, jupiter, saturn, saturn_ring (a ring strip with
       *  transparency), uranus, neptune. */
      url: (name) => {
        const key = "texture:" + String(name);
        if (!mediaURLs.has(key)) {
          const p = call("textures.url", { name: String(name) }).then((v) => (typeof Blob !== "undefined" && v instanceof Blob ? URL.createObjectURL(v) : v));
          p.catch(() => mediaURLs.delete(key));
          mediaURLs.set(key, p);
        }
        return mediaURLs.get(key);
      },
      list: () => Promise.resolve(["sun", "mercury", "venus", "earth", "moon", "mars", "jupiter", "saturn", "saturn_ring", "uranus", "neptune"]),
    }),

    ai: Object.freeze({
      /** Asks PAC Magic (AI); resolves with its reply as text. Needs the "ai" permission. PAC keeps
       *  every answer: asking the same thing again returns it at once, free ({fresh: true} asks anew). */
      ask: (prompt, options) => call("ai.ask", { prompt: String(prompt), system: options && options.system ? String(options.system) : null, fresh: !!(options && options.fresh) }),
    }),

    on,
  });

  // Links open outside the screen (a new tab, or the phone's browser), never inside it.
  function openLink(url) {
    if (!/^(https?:|tel:|mailto:)/i.test(url)) return Promise.resolve(false);
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
    document.body.appendChild(a); a.click(); a.remove();
    return Promise.resolve(true);
  }
  document.addEventListener("click", (e) => {
    const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || !/^(https?:|tel:|mailto:)/i.test(a.getAttribute("href") || "")) return;
    a.target = "_blank"; a.rel = "noopener noreferrer";
  }, true);

  window.pac = pac;
  window.__pac = Object.freeze({
    emit(event, data) {
      if (event === "device") Object.assign(pac.device, data);
      if (event === "audio" && data) {
        Object.assign(audioPrefs, data);
        for (const el of playing) { if (el.isConnected || !el.paused) applyAudio(el); else playing.delete(el); }
      }
      for (const callback of listeners[event] || []) { try { callback(data); } catch (e) { send("error", [e]); } }
    },
  });
})();
