// PAC SDK: the only way a code screen reaches outside its sandbox.
// Every call is a message to PAC, which checks it before doing anything.
(() => {
  "use strict";
  const init = window.__pacInit || {};
  const bridge = window.webkit && window.webkit.messageHandlers;

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

    storage: Object.freeze({
      /** Small private data for this app's code (game saves, settings). JSON values, about 2 MB in all. */
      get: (key) => call("storage.get", { key }),
      set: (key, value) => call("storage.set", { key, value: JSON.stringify(value === undefined ? null : value) }),
      remove: (key) => call("storage.remove", { key }),
      keys: () => call("storage.keys"),
    }),

    ui: Object.freeze({
      toast: (text) => call("ui.toast", { text: String(text) }),
      /** "light", "medium", "heavy", "success", "warning", "error" or "selection". */
      haptic: (kind) => call("ui.haptic", { kind: kind || "light" }),
      /** Opens an entry in PAC's own detail screen. */
      openEntry: (id) => call("ui.openEntry", { id }),
      /** Sets the title shown above the screen. */
      setTitle: (title) => call("ui.setTitle", { title: String(title) }),
    }),

    ai: Object.freeze({
      /** Asks PAC Magic (AI); resolves with its reply as text. Needs the "ai" permission. */
      ask: (prompt, options) => call("ai.ask", { prompt: String(prompt), system: options && options.system ? String(options.system) : null }),
    }),

    on,
  });

  window.pac = pac;
  window.__pac = Object.freeze({
    emit(event, data) {
      if (event === "device") Object.assign(pac.device, data);
      for (const callback of listeners[event] || []) { try { callback(data); } catch (e) { send("error", [e]); } }
    },
  });
})();
