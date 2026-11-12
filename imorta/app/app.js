// Imorta on the web. The archive lives in this browser; the account only
// says who you are and which plan you're on.
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_JS } from "./config.js";
import { openArchive } from "./db.js";
import * as L from "./logic.js";

const root = document.getElementById("root");
const sheetEl = document.getElementById("sheet");
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
const DEV = LOCAL && new URLSearchParams(location.search).has("dev");
const fmtDate = new Intl.DateTimeFormat(undefined, { dateStyle: "long" });
const fmtShort = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const S = {
  supa: null, user: null, account: null, db: null,
  children: [], photos: [], faces: [], milestones: [], growth: [], records: [],
  childId: null, milestoneFilter: "all", authMode: "signin", authMessage: "", authError: "",
  viewer: null, picker: null, adding: null,
};
const urls = new Map();
function blobUrl(key, blob) {
  if (!blob) return "";
  if (!urls.has(key)) urls.set(key, URL.createObjectURL(blob));
  return urls.get(key);
}
const thumb = (photo) => blobUrl("p" + photo.id, photo.thumb);
const faceImg = (face) => blobUrl("f" + face.id, face.crop);

// ---------------------------------------------------------------- start

boot().catch((error) => {
  root.innerHTML = `<div class="wrap" style="padding-top:18vh"><div class="card"><h2>Imorta couldn't open</h2><p class="muted" style="margin-top:8px">${esc(error.message || error)}</p></div></div>`;
});

async function boot() {
  const wanted = (location.hash.match(/plan=(family|vault)/) || [])[1];
  if (wanted) sessionStorage.setItem("imorta.plan", wanted);
  if (location.hash.startsWith("#signup")) S.authMode = "signup";
  if (DEV) {
    S.user = { id: "dev", email: "dev@localhost" };
    S.account = { plan: "free", plan_interest: null };
    return enter();
  }
  const { createClient } = await import(SUPABASE_JS);
  S.supa = createClient(SUPABASE_URL, SUPABASE_KEY);
  // Trying it out without an account: an archive kept on this device only.
  if (localStorage.getItem("imorta.guest")) return enterAsGuest();
  S.supa.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") return openSheet(newPasswordSheet());
    if (event === "SIGNED_OUT") { S.user = null; S.db = null; renderAuth(); }
    if (event === "SIGNED_IN" && session && (!S.user || S.user.guest)) { localStorage.removeItem("imorta.guest"); S.user = session.user; loadAccount().then(enter); }
  });
  const { data } = await S.supa.auth.getSession();
  if (data.session) { S.user = data.session.user; await loadAccount(); await enter(); }
  else renderAuth();
}

async function enterAsGuest() {
  localStorage.setItem("imorta.guest", "1");
  S.user = { id: "guest", email: "No account yet", guest: true };
  S.account = { plan: "free", plan_interest: null };
  await enter();
}

async function loadAccount() {
  const interest = sessionStorage.getItem("imorta.plan");
  let { data } = await S.supa.from("imorta_accounts").select("plan, plan_interest, display_name").eq("user_id", S.user.id).maybeSingle();
  if (!data) {
    await S.supa.from("imorta_accounts").insert({ user_id: S.user.id, plan_interest: interest });
    data = { plan: "free", plan_interest: interest, display_name: null };
  } else if (interest && data.plan_interest !== interest) {
    await S.supa.from("imorta_accounts").update({ plan_interest: interest, updated_at: new Date().toISOString() }).eq("user_id", S.user.id);
    data.plan_interest = interest;
  }
  sessionStorage.removeItem("imorta.plan");
  S.account = data;
}

async function enter() {
  S.db = await openArchive(S.user.id);
  await reload();
  const saved = Number(localStorage.getItem("imorta.child." + S.user.id));
  S.childId = S.children.some((c) => c.id === saved) ? saved : S.children[0]?.id ?? null;
  if (!location.hash || location.hash.startsWith("#signup") || location.hash.includes("access_token")) history.replaceState(null, "", location.pathname + location.search + "#/");
  window.addEventListener("hashchange", render);
  render();
}

async function reload() {
  const [children, photos, faces, milestones, growth, records] = await Promise.all(
    ["children", "photos", "faces", "milestones", "growth", "records"].map((s) => S.db.all(s)));
  Object.assign(S, { children, photos, faces, milestones, growth, records });
}

// ---------------------------------------------------------------- helpers over the archive

const child = () => S.children.find((c) => c.id === S.childId) || null;
const first = (c) => (c?.name || "them").split(" ")[0];
const birthOf = (c) => (c?.birth ? L.parseDay(c.birth) : null);
function photosOf(c) {
  const ids = new Set(S.faces.filter((f) => f.childId === c.id).map((f) => f.photoId));
  return S.photos.filter((p) => ids.has(p.id));
}
const photoDates = () => new Map(S.photos.map((p) => [p.id, p.takenAt]));
function avatarOf(c) {
  const theirs = S.faces.filter((f) => f.childId === c.id);
  if (!theirs.length) return null;
  const pinned = theirs.find((f) => f.id === c.avatarFaceId);
  if (pinned) return pinned;
  const dates = photoDates();
  const newestYear = Math.max(...theirs.map((f) => new Date(dates.get(f.photoId)).getFullYear()));
  return theirs.filter((f) => new Date(dates.get(f.photoId)).getFullYear() === newestYear).sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)[0];
}
function growFrames(c) {
  const dates = photoDates(), birth = birthOf(c), byAge = new Map();
  for (const f of S.faces.filter((x) => x.childId === c.id)) {
    const date = new Date(dates.get(f.photoId));
    const key = birth ? Math.max(0, L.ageAt(birth, date).years) : date.getFullYear();
    const best = byAge.get(key);
    if (!best || f.box.w * f.box.h * f.score > best.box.w * best.box.h * best.score) byAge.set(key, f);
  }
  return [...byAge.entries()].sort((a, b) => a[0] - b[0]).map(([key, face]) => ({
    face, label: birth ? (key === 0 ? "Newborn" : key === 1 ? "1 year" : `${key} years`) : String(key),
    section: birth ? (key === 0 ? null : "y" + key) : "c" + key,
  }));
}
async function follow() {
  const filed = L.followChildren(S.children, S.faces, photoDates());
  if (filed.length) await S.db.putAll("faces", filed);
  return filed;
}

// ---------------------------------------------------------------- sign in

function renderAuth() {
  const up = S.authMode === "signup";
  root.innerHTML = `
  <div class="wrap">
    <nav class="nav"><a class="brand" href="../"><img src="../assets/icon.png" alt="">Imorta</a><div class="nav-links"><a href="../plans.html">Plans</a></div></nav>
    <div class="auth">
      <div class="eyebrow">${up ? "Create your account" : "Welcome back"}</div>
      <h1>${up ? "Start their archive." : "Sign in to Imorta."}</h1>
      <p class="muted" style="margin-top:10px">${up ? "Your account says who you are. Your photos stay on this device." : "Your archive opens on the device it was made on."}</p>
      <form data-submit="auth">
        <label>Email<input name="email" type="email" autocomplete="email" required></label>
        <label>Password<input name="password" type="password" autocomplete="${up ? "new-password" : "current-password"}" minlength="8" required>${up ? "<small>At least 8 characters.</small>" : ""}</label>
        ${S.authError ? `<p class="error">${esc(S.authError)}</p>` : ""}
        ${S.authMessage ? `<p class="notice">${esc(S.authMessage)}</p>` : ""}
        <button class="btn" type="submit">${up ? "Create account" : "Sign in"}</button>
      </form>
      <p class="switch" style="margin-top:22px"><button class="link" data-do="guest">Try it without an account</button><br><span style="font-size:13px">Your archive is kept on this device only.</span></p>
      <p class="switch">${up ? `Already have an account? <button class="link" data-do="auth-mode" data-mode="signin">Sign in</button>`
        : `New to Imorta? <button class="link" data-do="auth-mode" data-mode="signup">Create an account</button> · <button class="link" data-do="forgot">Forgot password</button>`}</p>
    </div>
  </div>`;
}

function newPasswordSheet() {
  return `<h2>Choose a new password</h2>
    <form data-submit="new-password" class="stack">
      <label>New password<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
      <div class="actions"><button class="btn" type="submit">Save password</button></div>
    </form>`;
}

// ---------------------------------------------------------------- frame

function render() {
  if (!S.user || !S.db) return;
  const route = (location.hash.replace(/^#\/?/, "").split("?")[0]) || "home";
  const c = child();
  let body;
  if (!S.children.length || route === "children") body = childrenView(!S.children.length);
  else if (route === "album") body = albumView(c);
  else if (route === "settings") body = settingsView();
  else body = homeView(c);
  const tab = (name, label) => `<a href="#/${name === "home" ? "" : name}" ${route === name ? 'aria-current="page"' : ""}>${label}</a>`;
  root.innerHTML = `
  <header class="app-bar"><div class="wrap">
    <a class="brand" href="#/"><img src="../assets/icon.png" alt=""><span>Imorta</span></a>
    ${S.children.length ? `<nav class="tabs">${tab("home", "Home")}${tab("album", "Album")}${tab("settings", "Settings")}</nav>` : ""}
    <span class="spacer"></span>
    ${S.children.length > 1 ? `<select class="plain" data-change="pick-child" aria-label="Child">${S.children.map((k) => `<option value="${k.id}" ${k.id === S.childId ? "selected" : ""}>${esc(k.name)}</option>`).join("")}</select>` : ""}
    ${S.children.length ? `<button class="btn small" data-do="add-photos">Add photos</button>` : ""}
  </div></header>
  <main><div class="wrap">${body}</div></main>`;
}

// ---------------------------------------------------------------- children

function childrenView(firstTime) {
  return `<div class="stack" style="max-width:620px">
    <div><div class="eyebrow">${firstTime ? "Step 1 of 3" : "Children"}</div>
      <h1 style="font-size:36px;margin-top:10px">Who are we keeping photos for?</h1>
      <p class="muted" style="margin-top:8px">Add each child with their birthday. Imorta uses it to tell siblings apart: a photo from before they were born can't be them.</p></div>
    ${S.children.length ? `<div class="card list">${S.children.map((k) => `
      <div class="item"><div class="grow1"><b>${esc(k.name)}</b><span>${k.birth ? "Born " + fmtDate.format(L.parseDay(k.birth)) : "No birthday"}</span></div>
      <button class="link" data-do="edit-child" data-id="${k.id}">Edit</button></div>`).join("")}</div>` : ""}
    <form class="card stack" data-submit="add-child">
      <div class="formgrid">
        <label>Name<input name="name" required autocomplete="off"></label>
        <label>Birthday<input name="birth" type="date" required max="${L.dayText(new Date())}"></label>
        <label>Sex <select name="sex"><option value="">Not set</option><option value="girl">Girl</option><option value="boy">Boy</option></select></label>
      </div>
      <div><button class="btn secondary" type="submit">Add child</button></div>
    </form>
    ${S.children.length ? `<div><a class="btn" href="#/">${firstTime ? "Continue" : "Done"}</a></div>` : ""}
  </div>`;
}

function childSheet(k) {
  return `<h2>${esc(k.name)}</h2>
  <form class="stack" data-submit="save-child" data-id="${k.id}">
    <div class="formgrid">
      <label>Name<input name="name" required value="${esc(k.name)}"></label>
      <label>Birthday<input name="birth" type="date" value="${esc(k.birth || "")}" max="${L.dayText(new Date())}"></label>
      <label>Sex <select name="sex"><option value="">Not set</option><option value="girl" ${k.sex === "girl" ? "selected" : ""}>Girl</option><option value="boy" ${k.sex === "boy" ? "selected" : ""}>Boy</option></select></label>
    </div>
    <p class="hint">Changing the birthday takes out any of their photos from before it.</p>
    <div class="actions"><button class="link danger" type="button" data-do="remove-child" data-id="${k.id}">Remove ${esc(first(k))}</button><span class="spacer"></span>
      <button class="btn secondary" type="button" data-do="close-sheet">Cancel</button><button class="btn" type="submit">Save</button></div>
  </form>`;
}

// ---------------------------------------------------------------- home

function homeView(c) {
  if (!c) return "";
  const photos = photosOf(c).sort((a, b) => b.takenAt - a.takenAt);
  const birth = birthOf(c), avatar = avatarOf(c);
  const next = birth ? L.nextBirthday(birth) : null;
  return `<div class="stack">
    <div class="who">
      ${avatar ? `<img class="avatar" src="${faceImg(avatar)}" alt="">` : `<div class="avatar"></div>`}
      <div><h1>${esc(c.name)}</h1>
        ${birth ? `<p class="muted" style="font-size:18px;margin-top:4px">${esc(L.ageText(birth))}</p>
        <div class="pillrow">${esc(fmtShort.format(birth))} · ${next.days === 0 ? `${next.turning} today` : `${next.days} day${next.days === 1 ? "" : "s"} until ${next.turning}`}</div>` : ""}
      </div>
    </div>
    ${findCard(c, photos)}
    ${guessCard(c)}
    ${albumCard(c, photos)}
    ${onThisDayCard(c, photos)}
    ${aboutCard(c)}
    ${growthCard(c)}
    ${milestonesCard(c)}
    ${recordsCard(c)}
    <div class="card soon"><h2>A vault of ${esc(first(c))}'s own</h2>
      <p class="muted" style="margin-top:8px">A vault that belongs to ${esc(first(c))}. You look after it and add to it each year; one day it's theirs to claim, from you or on their own.</p>
      <p style="margin-top:12px"><span class="pill">Coming soon</span></p></div>
  </div>`;
}

function findCard(c, photos) {
  if (photos.length) return "";
  const unfiled = S.faces.filter((f) => f.childId == null).length;
  if (!S.photos.length) {
    return `<div class="card stack"><div><div class="eyebrow">Step 2 of 3</div><h2 style="margin-top:8px">Show Imorta your photos</h2>
      <p class="muted" style="margin-top:6px">Choose photos or a whole folder. They're read here in your browser and stay on this device.</p></div>
      <div><button class="btn" data-do="add-photos">Add photos</button></div></div>`;
  }
  return `<div class="card stack"><div><div class="eyebrow">Step 3 of 3</div><h2 style="margin-top:8px">Which of these is ${esc(first(c))}?</h2>
    <p class="muted" style="margin-top:6px">${unfiled ? `Imorta found ${unfiled} face${unfiled === 1 ? "" : "s"} it hasn't placed. Point out ${esc(first(c))} once and it follows them through the rest.` : `No faces left to place. Add more photos of ${esc(first(c))}.`}</p></div>
    <div class="row">${unfiled ? `<button class="btn" data-do="pick-faces">Find ${esc(first(c))}</button>` : ""}<button class="btn secondary" data-do="add-photos">Add photos</button></div></div>`;
}

function guessCard(c) {
  const guesses = S.faces.filter((f) => f.childId === c.id && f.by === "auto").length;
  if (!guesses) return "";
  return `<div class="notice row"><span class="grow1" style="flex:1">Imorta placed ${guesses} photo${guesses === 1 ? "" : "s"} of ${esc(first(c))} on its own.</span>
    <a class="link" href="#/album?check">Check them</a><button class="link" data-do="confirm-guesses">They're right</button></div>`;
}

function albumCard(c, photos) {
  if (!photos.length) return "";
  const years = [new Date(photos[photos.length - 1].takenAt).getFullYear(), new Date(photos[0].takenAt).getFullYear()];
  const unfiled = S.faces.filter((f) => f.childId == null).length;
  return `<div class="card stack">
    <div class="strip">${photos.slice(0, 4).map((p) => `<button class="tile" data-do="open-photo" data-id="${p.id}"><img src="${thumb(p)}" alt="" loading="lazy"></button>`).join("")}</div>
    <div class="row"><div class="grow1" style="flex:1"><b style="font-size:19px">${esc(first(c))}'s album</b><br>
      <span class="muted">${photos.length} photo${photos.length === 1 ? "" : "s"} · ${years[0] === years[1] ? years[0] : years[0] + " – " + years[1]}</span></div>
      ${unfiled ? `<button class="link" data-do="pick-faces">Find more of ${esc(first(c))}</button>` : ""}
      <a class="btn small secondary" href="#/album">Open album</a></div>
  </div>`;
}

function onThisDayCard(c, photos) {
  const days = L.onThisDay(photos);
  const today = new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(new Date());
  return `<div class="card stack"><h2>This week, years ago <span class="muted" style="font:400 14px var(--sans)">${esc(today)}</span></h2>
    ${days.length ? days.map((d) => `<div><p class="muted" style="font-size:14px;margin-bottom:6px">${new Date().getFullYear() - d.year} year${new Date().getFullYear() - d.year === 1 ? "" : "s"} ago · ${d.year}</p>
      <div class="grid">${d.photos.map((p) => `<button class="tile" data-do="open-photo" data-id="${p.id}"><img src="${thumb(p)}" alt="" loading="lazy"></button>`).join("")}</div></div>`).join("")
      : `<p class="muted">Nothing of ${esc(first(c))} from this time of year yet. Each day Imorta picks out their photos from the same date in years gone by.</p>`}
  </div>`;
}

function aboutCard(c) {
  const t = c.traits || {};
  const worked = L.season(t.eye, t.hair, t.skin, t.undertone);
  const season = t.season || worked;
  const options = (list, value, blank) => `<option value="">${blank}</option>` + list.map((o) => `<option ${o === value ? "selected" : ""}>${esc(o)}</option>`).join("");
  const palette = season ? L.PALETTES[season] : null;
  const skinColour = t.skin ? L.skinHex(t.skin, t.undertone || "neutral") : null;
  const swatch = (hex) => `<div class="swatch" style="background:${hex || "color-mix(in srgb, var(--muted) 35%, transparent)"}">${hex ? "" : "?"}</div>`;
  return `<div class="card stack"><h2>About ${esc(first(c))}</h2>
    <div class="traits">
      <div class="trait">${swatch(L.EYES[t.eye])}<span class="name">Eyes</span><select data-change="set-trait" data-field="eye" aria-label="Eye colour">${options(Object.keys(L.EYES), t.eye, "Choose")}</select></div>
      <div class="trait">${swatch(L.HAIR[t.hair])}<span class="name">Hair</span><select data-change="set-trait" data-field="hair" aria-label="Hair colour">${options(Object.keys(L.HAIR), t.hair, "Choose")}</select></div>
      <div class="trait">${swatch(skinColour)}<span class="name">Skin</span>
        <select data-change="set-trait" data-field="skin" aria-label="Complexion">${options(L.SKIN_DEPTHS, t.skin, "Complexion")}</select>
        <select data-change="set-trait" data-field="undertone" aria-label="Undertone">${L.UNDERTONES.map((u) => `<option value="${u}" ${(t.undertone || "neutral") === u ? "selected" : ""}>${u[0].toUpperCase() + u.slice(1)} undertone</option>`).join("")}</select></div>
    </div>
    <div class="season">
      <div class="row"><div style="flex:1"><div class="name" style="font:600 10px var(--sans);letter-spacing:.1em;color:var(--muted)">COLOUR SEASON</div>
        <h3 class="${season ? "" : "muted"}">${esc(season || "Not known yet")}</h3></div>
        <select data-change="set-trait" data-field="season" aria-label="Colour season"><option value="">${t.season ? "Let Imorta work it out" : "Worked out for you"}</option>${L.SEASONS.map((s) => `<option ${s === t.season ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      ${palette ? `<p style="font-size:14px">${esc(palette[2])}</p>
        <div><p class="muted" style="font-size:12px;font-weight:600;margin-bottom:8px">Colours that suit ${esc(first(c))}</p><div class="dots">${palette[0].map((h) => `<i style="background:${h}"></i>`).join("")}</div></div>
        <div class="row"><span class="muted" style="font-size:12px;font-weight:600">Wear less of</span><div class="dots small">${palette[1].map((h) => `<i style="background:${h}"></i>`).join("")}</div></div>`
        : `<p class="muted" style="font-size:14px">Choose ${esc(first(c))}'s eyes, hair and skin, and their season and the colours that suit them appear here.</p>`}
    </div>
    <p class="hint">On iPhone, Imorta reads these from photos. On the web you choose them.</p>
  </div>`;
}

function growthCard(c) {
  const rows = S.growth.filter((g) => g.childId === c.id).sort((a, b) => b.date.localeCompare(a.date));
  const line = (g) => [g.weightKg && `${g.weightKg} kg`, g.heightCm && `${g.heightCm} cm`, g.headCm && `head ${g.headCm} cm`].filter(Boolean).join(" · ");
  return `<div class="card stack"><h2>Growth</h2>
    ${rows.length ? `<div class="list">${rows.map((g) => `<div class="item"><div class="grow1"><b>${esc(line(g))}</b><span>${esc(fmtShort.format(L.parseDay(g.date)))}${birthOf(c) ? " · " + esc(L.ageText(birthOf(c), L.parseDay(g.date)).replace(" old", "")) : ""}</span></div>
      <button class="link danger" data-do="del-growth" data-id="${g.id}">Remove</button></div>`).join("")}</div>`
      : `<p class="muted">Add ${esc(first(c))}'s weight and height over the years to see them grow.</p>`}
    <form class="formgrid" data-submit="add-growth">
      <label>Date<input name="date" type="date" required value="${L.dayText(new Date())}" max="${L.dayText(new Date())}"></label>
      <label>Weight (kg)<input name="weightKg" type="number" step="0.01" min="0" inputmode="decimal"></label>
      <label>Height (cm)<input name="heightCm" type="number" step="0.1" min="0" inputmode="decimal"></label>
      <label>Head (cm)<input name="headCm" type="number" step="0.1" min="0" inputmode="decimal"></label>
      <div style="align-self:end"><button class="btn small secondary" type="submit">Add measurement</button></div>
    </form></div>`;
}

function milestonesCard(c) {
  const all = S.milestones.filter((m) => m.childId === c.id);
  const born = c.birth ? [{ id: "born", category: "personal", title: "Born", date: c.birth, fixed: true }] : [];
  const shown = [...all, ...born].filter((m) => S.milestoneFilter === "all" || m.category === S.milestoneFilter)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const chip = (key, label) => `<button class="chip" data-do="milestone-filter" data-key="${key}" aria-pressed="${S.milestoneFilter === key}">${label}</button>`;
  return `<div class="card stack"><h2>Milestones<span class="spacer"></span><button class="link" data-do="add-milestone">Add</button></h2>
    <div class="chips">${chip("all", "All")}${Object.entries(L.MILESTONE_CATEGORIES).map(([k, v]) => chip(k, v)).join("")}</div>
    <div class="list">${shown.map((m) => `<div class="item"><div class="grow1"><b>${esc(m.title)}</b><span>${esc(L.MILESTONE_CATEGORIES[m.category])}${m.date ? " · " + esc(fmtShort.format(L.parseDay(m.date))) : ""}${m.note ? " · " + esc(m.note) : ""}</span></div>
      ${m.fixed ? "" : `<button class="link" data-do="edit-milestone" data-id="${m.id}">Edit</button>`}</div>`).join("") || `<p class="muted">Nothing here yet.</p>`}</div></div>`;
}

function milestoneSheet(m) {
  return `<h2>${m.id ? "Milestone" : "New milestone"}</h2>
  <form class="stack" data-submit="save-milestone" data-id="${m.id || ""}">
    <label>What happened<input name="title" required value="${esc(m.title || "")}" placeholder="First steps"></label>
    <div class="formgrid">
      <label>Kind <select name="category">${Object.entries(L.MILESTONE_CATEGORIES).map(([k, v]) => `<option value="${k}" ${m.category === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label>Date<input name="date" type="date" value="${esc(m.date || "")}"></label>
    </div>
    <label>Note<textarea name="note" rows="2">${esc(m.note || "")}</textarea></label>
    <div class="actions">${m.id ? `<button class="link danger" type="button" data-do="del-milestone" data-id="${m.id}">Delete</button><span class="spacer"></span>` : ""}
      <button class="btn secondary" type="button" data-do="close-sheet">Cancel</button><button class="btn" type="submit">Save</button></div>
  </form>`;
}

function recordsCard(c) {
  const rows = S.records.filter((r) => r.childId === c.id).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return `<div class="card stack"><h2>Documents &amp; records<span class="spacer"></span><button class="link" data-do="add-record">Add</button></h2>
    ${rows.length ? `<div class="list">${rows.map((r) => `<div class="item"><div class="grow1"><b>${esc(r.title)}</b><span>${esc(L.RECORD_KINDS[r.kind])}${r.date ? " · " + esc(fmtShort.format(L.parseDay(r.date))) : ""}</span></div>
      <button class="link" data-do="open-record" data-id="${r.id}">Open</button><button class="link danger" data-do="del-record" data-id="${r.id}">Remove</button></div>`).join("")}</div>`
      : `<p class="muted">Birth certificate, school reports, awards, test results, licences. Add a scan or a photo of each.</p>`}</div>`;
}

function recordSheet() {
  return `<h2>Add a document</h2>
  <form class="stack" data-submit="save-record">
    <label>File<input name="file" type="file" accept="image/*,application/pdf" required><small>A photo, a scan or a PDF. It's kept in this browser.</small></label>
    <label>Title<input name="title" required placeholder="Birth certificate"></label>
    <div class="formgrid">
      <label>Kind <select name="kind">${Object.entries(L.RECORD_KINDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
      <label>Date<input name="date" type="date"></label>
    </div>
    <div class="actions"><button class="btn secondary" type="button" data-do="close-sheet">Cancel</button><button class="btn" type="submit">Save</button></div>
  </form>`;
}

// ---------------------------------------------------------------- album

function albumList(c) {
  const checking = location.hash.includes("?check");
  let photos = photosOf(c);
  if (checking) {
    const ids = new Set(S.faces.filter((f) => f.childId === c.id && f.by === "auto").map((f) => f.photoId));
    photos = photos.filter((p) => ids.has(p.id));
  }
  return { photos, checking };
}

function albumView(c) {
  if (!c) return "";
  const { photos, checking } = albumList(c);
  const sections = L.albumSections(birthOf(c), photos);
  const frames = checking ? [] : growFrames(c);
  const guessed = new Set(S.faces.filter((f) => f.childId === c.id && f.by === "auto").map((f) => f.photoId));
  const span = photos.length ? [...new Set([Math.min(...photos.map((p) => p.takenAt)), Math.max(...photos.map((p) => p.takenAt))].map((t) => new Date(t).getFullYear()))].join(" – ") : "";
  return `<div class="stack">
    <div><div class="eyebrow">${checking ? "Imorta's guesses" : "A life in pictures"}</div>
      <h1 style="font-size:40px;margin-top:8px">${esc(c.name)}</h1>
      <p class="muted" style="margin-top:4px">${photos.length ? `${photos.length} photo${photos.length === 1 ? "" : "s"} · ${span}` : "No photos yet"}</p></div>
    ${checking ? `<div class="notice row"><span style="flex:1">These are the photos Imorta placed on its own. Open any that isn't ${esc(first(c))} and say so.</span>
      <button class="link" data-do="confirm-guesses">They're all right</button><a class="link" href="#/album">Whole album</a></div>` : ""}
    ${frames.length > 1 ? `<div><p class="muted" style="font:600 13px var(--sans);margin-bottom:8px">Watch them grow</p>
      <div class="grow">${frames.map((f) => `<button data-do="jump" data-key="${f.section || ""}"><img class="face" src="${faceImg(f.face)}" alt="">${esc(f.label)}</button>`).join("")}</div></div>` : ""}
    ${sections.length > 3 ? `<label style="max-width:240px">Jump to <select data-change="jump-select"><option value="">An age…</option>${sections.map((s) => `<option value="${s.key}">${esc(s.title)}</option>`).join("")}</select></label>` : ""}
    <div>${sections.map((s) => `<section id="age-${s.key}">
      <div class="age-head"><h3>${esc(s.title)}</h3><span class="muted" style="font-size:13px">${esc(s.range)}</span></div>
      <div class="grid">${s.photos.map((p) => `<button class="tile" data-do="open-photo" data-id="${p.id}"><img src="${thumb(p)}" alt="" loading="lazy">
        ${s.birthdayIds.has(p.id) ? `<span class="badge" title="Birthday">🎂</span>` : ""}${guessed.has(p.id) ? `<span class="guess">Imorta's guess</span>` : ""}</button>`).join("")}</div></section>`).join("")}</div>
    ${!photos.length ? `<div class="card"><p class="muted">${checking ? "Nothing left to check." : `Nothing of ${esc(first(c))} yet.`}</p><p style="margin-top:12px"><a class="btn small" href="#/">Back</a></p></div>` : ""}
  </div>`;
}

// ---------------------------------------------------------------- the photo, full screen

async function openViewer(photoId) {
  const c = child();
  let list = location.hash.startsWith("#/album") ? albumList(c).photos : photosOf(c);
  list = list.sort((a, b) => b.takenAt - a.takenAt);
  if (!list.some((p) => p.id === photoId)) list = S.photos.filter((p) => p.id === photoId);
  S.viewer = { ids: list.map((p) => p.id), index: Math.max(0, list.findIndex((p) => p.id === photoId)) };
  await renderViewer();
}

async function renderViewer() {
  const v = S.viewer;
  if (!v) return;
  if (v.url) { URL.revokeObjectURL(v.url); v.url = null; }
  const photo = S.photos.find((p) => p.id === v.ids[v.index]);
  if (!photo) return closeViewer();
  const original = await S.db.get("originals", photo.id);
  v.url = original?.blob ? URL.createObjectURL(original.blob) : null;
  const c = child(), birth = birthOf(c), date = new Date(photo.takenAt);
  const faces = S.faces.filter((f) => f.photoId === photo.id).sort((a, b) => a.box.x - b.box.x);
  const mine = faces.some((f) => f.childId === c?.id);
  let el = document.querySelector(".viewer");
  if (!el) { el = document.createElement("div"); el.className = "viewer"; document.body.appendChild(el); }
  el.innerHTML = `
    <div class="bar"><button data-do="close-viewer" aria-label="Close">Close</button>
      <span>${esc(fmtDate.format(date))}${birth && date >= birth ? " · " + esc(L.ageText(birth, date).replace(" old", "")) : ""}</span><span class="spacer" style="flex:1"></span>
      <span style="opacity:.7">${v.index + 1} of ${v.ids.length}</span>
      ${mine ? `<button data-do="not-them">Not ${esc(first(c))}</button>` : ""}</div>
    <div class="stage"><img class="big" src="${v.url || thumb(photo)}" alt="">
      ${v.index > 0 ? `<button class="nav prev" data-do="viewer-step" data-step="-1" aria-label="Newer">‹</button>` : ""}
      ${v.index < v.ids.length - 1 ? `<button class="nav next" data-do="viewer-step" data-step="1" aria-label="Older">›</button>` : ""}</div>
    <div class="bar people">${faces.length ? faces.map((f) => `<span class="person"><img src="${faceImg(f)}" alt="">
        <select data-change="tag-face" data-id="${f.id}" aria-label="Who is this"><option value="">Nobody of mine</option>${S.children.map((k) => `<option value="${k.id}" ${f.childId === k.id ? "selected" : ""}>${esc(k.name)}</option>`).join("")}</select></span>`).join("")
      : `<span style="opacity:.7">Imorta didn't find any faces in this photo.</span>`}</div>`;
}
function closeViewer() {
  if (S.viewer?.url) URL.revokeObjectURL(S.viewer.url);
  S.viewer = null;
  document.querySelector(".viewer")?.remove();
  render();
}

// ---------------------------------------------------------------- adding photos

function addSheet() {
  const a = S.adding;
  if (a?.running) {
    return `<h2>Reading your photos</h2><progress max="${a.total}" value="${a.done}"></progress>
      <p class="muted">${a.status || `Photo ${Math.min(a.done + 1, a.total)} of ${a.total}`}. Keep this tab open.</p>`;
  }
  if (a?.summary) {
    return `<h2>Done</h2><p>${esc(a.summary)}</p>${a.problems ? `<p class="muted">${esc(a.problems)}</p>` : ""}
      <div class="actions"><button class="btn" data-do="close-sheet">OK</button></div>`;
  }
  return `<h2>Add photos</h2>
    <div class="drop" data-drop>
      <p><b>Drop photos here</b></p><p class="muted">or choose them. They're read in your browser and stay on this device.</p>
      <div class="row" style="justify-content:center">
        <label class="btn" style="display:inline-flex">Choose photos<input type="file" accept="image/*" multiple hidden data-change="files"></label>
        <label class="btn secondary" style="display:inline-flex">Choose a folder<input type="file" webkitdirectory multiple hidden data-change="files"></label>
      </div>
    </div>
    <p class="hint">JPEG and PNG work everywhere. iPhone HEIC photos open in Safari; elsewhere, export them as JPEG first.</p>
    <div class="actions"><button class="btn secondary" data-do="close-sheet">Cancel</button></div>`;
}

async function addFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name));
  if (!files.length) return;
  const { readPhoto, loadModels } = await import("./faces.js");
  S.adding = { running: true, total: files.length, done: 0, status: "Getting ready to recognise faces" };
  openSheet(addSheet(), true);
  let added = 0, repeats = 0, unreadable = 0, faceCount = 0;
  try {
    await loadModels();
    const known = new Set(S.photos.map((p) => p.hash));
    for (const file of files) {
      S.adding.status = "";
      openSheet(addSheet(), true);
      try {
        const read = await readPhoto(file);
        if (known.has(read.hash)) { repeats++; }
        else {
          known.add(read.hash);
          const { faces, ...meta } = read;
          const photo = await S.db.put("photos", { ...meta, addedAt: Date.now() });
          try { await S.db.put("originals", { id: photo.id, blob: file }); } catch { /* out of room: the small copy is still kept */ }
          for (const face of faces) await S.db.put("faces", { ...face, photoId: photo.id, childId: null, by: null, rejected: [] });
          added++; faceCount += faces.length;
        }
      } catch { unreadable++; }
      S.adding.done++;
    }
    await reload();
    const filed = await follow();
    const names = S.children.map((k) => { const n = filed.filter((f) => f.childId === k.id).length; return n ? `${n} of ${first(k)}` : null; }).filter(Boolean);
    S.adding = {
      summary: `${added} photo${added === 1 ? "" : "s"} added, with ${faceCount} face${faceCount === 1 ? "" : "s"}.` + (names.length ? ` Imorta placed ${names.join(", ")}.` : ""),
      problems: [repeats ? `${repeats} already here` : "", unreadable ? `${unreadable} couldn't be read by this browser` : ""].filter(Boolean).join(" · "),
    };
  } catch (error) {
    S.adding = { summary: "Imorta couldn't start recognising faces.", problems: String(error.message || error) };
  }
  openSheet(addSheet());
  render();
}

// ---------------------------------------------------------------- pointing out a child

function pickerSheet() {
  const c = child(), p = S.picker;
  const birth = birthOf(c), dates = photoDates();
  if (!p.groups) {
    const unfiled = S.faces.filter((f) => f.childId == null && !(f.rejected || []).includes(c.id) && (!birth || dates.get(f.photoId) >= birth.getTime()));
    p.groups = L.groupFaces(unfiled);
    p.chosen = new Set();
  }
  return `<div><div class="eyebrow">Find ${esc(first(c))}</div><h2 style="margin-top:8px">Which of these is ${esc(first(c))}?</h2>
    <p class="muted" style="margin-top:6px">Each row is one person, as far as Imorta can tell. Tap every row that's ${esc(first(c))}.${birth ? " Photos from before they were born are left out." : ""}</p></div>
    <div class="groups">${p.groups.length ? p.groups.map((g, i) => `<button class="group" data-do="toggle-group" data-index="${i}" aria-pressed="${p.chosen.has(i)}">
      <span class="faces">${g.faces.slice(0, 6).map((f) => `<img class="face small" src="${faceImg(f)}" alt="">`).join("")}</span>
      <span class="muted">${g.faces.length} photo${g.faces.length === 1 ? "" : "s"}</span></button>`).join("") : `<p class="muted">No faces left to place. Add more photos first.</p>`}</div>
    <div class="actions"><button class="btn secondary" data-do="close-sheet">Not now</button>
      <button class="btn" data-do="confirm-pick" ${p.chosen.size ? "" : "disabled"}>That's ${esc(first(c))}${p.chosen.size ? ` (${[...p.chosen].reduce((n, i) => n + p.groups[i].faces.length, 0)})` : ""}</button></div>`;
}

// ---------------------------------------------------------------- settings

function settingsView() {
  const plan = { free: "Keepsake (free)", family: "Family", vault: "Child Vault" }[S.account?.plan] || "Keepsake (free)";
  const interest = S.account?.plan_interest;
  return `<div class="stack" style="max-width:680px">
    <h1 style="font-size:36px">Settings</h1>
    <div class="card stack"><h2>Account</h2>
      <div class="list">
        <div class="item"><div class="grow1"><b>${esc(S.user.email)}</b><span>${S.user.guest ? "You're trying Imorta on this device. Create an account to keep your place." : "Signed in"}</span></div>${DEV ? "" : S.user.guest ? `<button class="link" data-do="leave-guest">Create an account</button>` : `<button class="link" data-do="sign-out">Sign out</button>`}</div>
        <div class="item"><div class="grow1"><b>${esc(plan)}</b><span>${interest ? `On the waitlist for ${interest === "family" ? "Family" : "Child Vault"}` : "Your plan"}</span></div><a class="link" href="../plans.html">See plans</a></div>
      </div></div>
    <div class="card stack"><h2>Children<span class="spacer"></span><a class="link" href="#/children">Add or edit</a></h2>
      <div class="list">${S.children.map((k) => `<div class="item"><div class="grow1"><b>${esc(k.name)}</b><span>${k.birth ? "Born " + esc(fmtDate.format(L.parseDay(k.birth))) : ""} · ${photosOf(k).length} photos</span></div>
        <button class="link" data-do="edit-child" data-id="${k.id}">Edit</button></div>`).join("")}</div></div>
    <div class="card stack"><h2>On this device</h2>
      <div class="list">
        <div class="item"><div class="grow1"><b>${S.photos.length} photos read</b><span>${S.faces.length} face templates. They never leave this browser.</span></div></div>
        <div class="item"><div class="grow1"><b>Forget who's who</b><span>Keeps your photos, forgets every face and which photos are whose.</span></div><button class="link danger" data-do="delete-faces">Delete face data</button></div>
        <div class="item"><div class="grow1"><b>Remove everything from this browser</b><span>Photos, children, milestones and documents kept here. Your account stays.</span></div><button class="link danger" data-do="delete-all">Remove</button></div>
      </div></div>
    <div class="card stack"><h2>Not on the web yet</h2>
      <p class="muted">Encrypted backup, inviting family to send photos, a second parent and Child Vaults are being built. Your archive here is separate from the iPhone app for now: the two don't sync.</p></div>
  </div>`;
}

// ---------------------------------------------------------------- sheets

function openSheet(html, locked = false) {
  sheetEl.innerHTML = `<div class="sheet-back" ${locked ? "" : 'data-do="backdrop"'}><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
}
function closeSheet() { sheetEl.innerHTML = ""; S.picker = null; if (!S.adding?.running) S.adding = null; }

// ---------------------------------------------------------------- what people do

const actions = {
  "auth-mode": (el) => { S.authMode = el.dataset.mode; S.authError = S.authMessage = ""; renderAuth(); },
  async forgot() {
    const email = document.querySelector('input[name="email"]').value.trim();
    if (!email) { S.authError = "Type your email first, then choose Forgot password."; S.authMessage = ""; return renderAuth(); }
    const { error } = await S.supa.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    S.authError = error ? error.message : "";
    S.authMessage = error ? "" : "If that email has an account, a link to choose a new password is on its way.";
    renderAuth();
  },
  guest: enterAsGuest,
  "leave-guest": () => { localStorage.removeItem("imorta.guest"); S.user = null; S.db = null; S.authMode = "signup"; history.replaceState(null, "", location.pathname + "#signup"); renderAuth(); },
  backdrop: (el, event) => { if (event.target === el) closeSheet(); },
  "close-sheet": closeSheet,
  "add-photos": () => { S.adding = null; openSheet(addSheet()); },
  "pick-faces": () => { S.picker = {}; openSheet(pickerSheet()); },
  "toggle-group": (el) => { const i = Number(el.dataset.index); S.picker.chosen.has(i) ? S.picker.chosen.delete(i) : S.picker.chosen.add(i); openSheet(pickerSheet()); },
  async "confirm-pick"() {
    const c = child(), picked = [...S.picker.chosen].flatMap((i) => S.picker.groups[i].faces);
    const seen = new Set(S.faces.filter((f) => f.childId === c.id).map((f) => f.photoId));
    const mine = picked.filter((f) => !seen.has(f.photoId) && seen.add(f.photoId));
    for (const f of mine) { f.childId = c.id; f.by = "parent"; }
    await S.db.putAll("faces", mine);
    await follow();
    closeSheet(); render();
  },
  async "confirm-guesses"() {
    const c = child(), guesses = S.faces.filter((f) => f.childId === c.id && f.by === "auto");
    for (const f of guesses) f.by = "parent";
    await S.db.putAll("faces", guesses);
    if (location.hash.includes("?check")) location.hash = "#/album"; else render();
  },
  "open-photo": (el) => openViewer(Number(el.dataset.id)),
  "close-viewer": closeViewer,
  "viewer-step": (el) => { S.viewer.index += Number(el.dataset.step); renderViewer(); },
  async "not-them"() {
    const c = child(), id = S.viewer.ids[S.viewer.index];
    const theirs = S.faces.filter((f) => f.photoId === id && f.childId === c.id);
    for (const f of theirs) { f.childId = null; f.by = null; f.rejected = [...new Set([...(f.rejected || []), c.id])]; }
    await S.db.putAll("faces", theirs);
    S.viewer.ids.splice(S.viewer.index, 1);
    if (!S.viewer.ids.length) return closeViewer();
    S.viewer.index = Math.min(S.viewer.index, S.viewer.ids.length - 1);
    renderViewer();
  },
  jump: (el) => { if (el.dataset.key) document.getElementById("age-" + el.dataset.key)?.scrollIntoView({ behavior: "smooth", block: "start" }); else window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); },
  "edit-child": (el) => openSheet(childSheet(S.children.find((k) => k.id === Number(el.dataset.id)))),
  async "remove-child"(el) {
    const id = Number(el.dataset.id), k = S.children.find((x) => x.id === id);
    if (!confirm(`Remove ${k.name}? Their milestones, measurements and documents here go too. Your photos stay.`)) return;
    const theirs = S.faces.filter((f) => f.childId === id);
    for (const f of theirs) { f.childId = null; f.by = null; }
    await S.db.putAll("faces", theirs);
    for (const [store, list] of [["milestones", S.milestones], ["growth", S.growth], ["records", S.records]]) {
      for (const row of list.filter((r) => r.childId === id)) await S.db.del(store, row.id);
    }
    await S.db.del("children", id);
    await reload();
    S.childId = S.children[0]?.id ?? null;
    closeSheet(); render();
  },
  "milestone-filter": (el) => { S.milestoneFilter = el.dataset.key; render(); },
  "add-milestone": () => openSheet(milestoneSheet({ category: S.milestoneFilter === "all" ? "personal" : S.milestoneFilter })),
  "edit-milestone": (el) => openSheet(milestoneSheet(S.milestones.find((m) => m.id === Number(el.dataset.id)))),
  async "del-milestone"(el) { await S.db.del("milestones", Number(el.dataset.id)); await reload(); closeSheet(); render(); },
  async "del-growth"(el) { await S.db.del("growth", Number(el.dataset.id)); await reload(); render(); },
  "add-record": () => openSheet(recordSheet()),
  "open-record": (el) => { const r = S.records.find((x) => x.id === Number(el.dataset.id)); if (r?.file) window.open(URL.createObjectURL(r.file), "_blank", "noopener"); },
  async "del-record"(el) { if (!confirm("Remove this document from Imorta?")) return; await S.db.del("records", Number(el.dataset.id)); await reload(); render(); },
  async "sign-out"() { await S.supa.auth.signOut(); },
  async "delete-faces"() {
    if (!confirm("Delete all face data? Imorta forgets every face and which photos are whose. Your photos stay.")) return;
    for (const f of S.faces) await S.db.del("faces", f.id);
    await reload(); render();
  },
  async "delete-all"() {
    if (!confirm("Remove everything Imorta keeps in this browser? This can't be undone. Your own photo files aren't touched.")) return;
    await S.db.wipe();
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear();
    await reload(); S.childId = null; location.hash = "#/"; render();
  },
};

const changes = {
  "pick-child": (el) => { S.childId = Number(el.value); localStorage.setItem("imorta.child." + S.user.id, el.value); render(); },
  files: (el) => addFiles(el.files),
  "jump-select": (el) => { if (el.value) document.getElementById("age-" + el.value)?.scrollIntoView({ behavior: "smooth", block: "start" }); el.value = ""; },
  async "set-trait"(el) {
    const c = child();
    c.traits = { ...(c.traits || {}) };
    if (el.value) c.traits[el.dataset.field] = el.value; else delete c.traits[el.dataset.field];
    if (el.dataset.field === "undertone" && !c.traits.skin) c.traits.skin = "Medium";
    await S.db.put("children", c);
    render();
  },
  async "tag-face"(el) {
    const face = S.faces.find((f) => f.id === Number(el.dataset.id));
    const to = el.value ? Number(el.value) : null;
    if (to != null) {
      const kid = S.children.find((k) => k.id === to), photo = S.photos.find((p) => p.id === face.photoId);
      if (kid.birth && photo.takenAt < L.parseDay(kid.birth).getTime()) { alert(`This photo is from before ${first(kid)} was born.`); return renderViewer(); }
      for (const other of S.faces.filter((f) => f.photoId === face.photoId && f.childId === to && f.id !== face.id)) { other.childId = null; other.by = null; await S.db.put("faces", other); }
    } else if (face.childId != null) {
      face.rejected = [...new Set([...(face.rejected || []), face.childId])];
    }
    face.childId = to;
    face.by = to == null ? null : "tagged";
    await S.db.put("faces", face);
    await follow();
    renderViewer();
  },
};

const submits = {
  async auth(form, data) {
    S.authError = S.authMessage = "";
    const email = data.get("email").trim(), password = data.get("password");
    if (S.authMode === "signup") {
      const { data: out, error } = await S.supa.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) S.authError = /disabled/i.test(error.message) ? "Creating accounts by email isn't switched on yet. You can try Imorta without an account below." : error.message;
      else if (!out.session) S.authMessage = "Check your email for a link to confirm your account, then sign in.";
    } else {
      const { error } = await S.supa.auth.signInWithPassword({ email, password });
      if (error) S.authError = error.message === "Invalid login credentials" ? "That email and password don't match an account."
        : /disabled/i.test(error.message) ? "Signing in by email isn't switched on yet. You can try Imorta without an account below." : error.message;
    }
    if (!S.user) renderAuth();
  },
  async "new-password"(form, data) {
    const { error } = await S.supa.auth.updateUser({ password: data.get("password") });
    if (error) return alert(error.message);
    closeSheet();
  },
  async "add-child"(form, data) {
    const kid = await S.db.put("children", { name: data.get("name").trim(), birth: data.get("birth") || null, sex: data.get("sex") || null, createdAt: Date.now(), traits: {} });
    await reload();
    S.childId = kid.id;
    localStorage.setItem("imorta.child." + S.user.id, String(kid.id));
    render();
  },
  async "save-child"(form, data) {
    const kid = S.children.find((k) => k.id === Number(form.dataset.id));
    Object.assign(kid, { name: data.get("name").trim(), birth: data.get("birth") || null, sex: data.get("sex") || null });
    await S.db.put("children", kid);
    if (kid.birth) {
      const from = L.parseDay(kid.birth).getTime(), dates = photoDates();
      const early = S.faces.filter((f) => f.childId === kid.id && dates.get(f.photoId) < from);
      for (const f of early) { f.childId = null; f.by = null; }
      await S.db.putAll("faces", early);
    }
    closeSheet(); render();
  },
  async "add-growth"(form, data) {
    const num = (k) => (data.get(k) ? Number(data.get(k)) : null);
    const row = { childId: S.childId, date: data.get("date"), weightKg: num("weightKg"), heightCm: num("heightCm"), headCm: num("headCm") };
    if (row.weightKg == null && row.heightCm == null && row.headCm == null) return alert("Add a weight, a height or a head measurement.");
    await S.db.put("growth", row);
    await reload(); render();
  },
  async "save-milestone"(form, data) {
    const existing = form.dataset.id ? S.milestones.find((m) => m.id === Number(form.dataset.id)) : { childId: S.childId, addedAt: Date.now() };
    Object.assign(existing, { title: data.get("title").trim(), category: data.get("category"), date: data.get("date") || null, note: data.get("note").trim() });
    await S.db.put("milestones", existing);
    await reload(); closeSheet(); render();
  },
  async "save-record"(form, data) {
    const file = data.get("file");
    await S.db.put("records", { childId: S.childId, title: data.get("title").trim(), kind: data.get("kind"), date: data.get("date") || null, file, fileName: file.name, addedAt: Date.now() });
    await reload(); closeSheet(); render();
  },
};

document.addEventListener("click", (event) => {
  const el = event.target.closest("[data-do]");
  if (!el) return;
  const run = actions[el.dataset.do];
  if (run) Promise.resolve(run(el, event)).catch((error) => alert(error.message || error));
});
document.addEventListener("change", (event) => {
  const el = event.target.closest("[data-change]");
  const run = el && changes[el.dataset.change];
  if (run) Promise.resolve(run(el)).catch((error) => alert(error.message || error));
});
document.addEventListener("submit", (event) => {
  const form = event.target.closest("form[data-submit]");
  if (!form) return;
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  Promise.resolve(submits[form.dataset.submit](form, new FormData(form)))
    .catch((error) => alert(error.message || error))
    .finally(() => { if (button?.isConnected) button.disabled = false; });
});
document.addEventListener("keydown", (event) => {
  if (S.viewer) {
    if (event.key === "Escape") closeViewer();
    if (event.key === "ArrowLeft" && S.viewer.index > 0) { S.viewer.index--; renderViewer(); }
    if (event.key === "ArrowRight" && S.viewer.index < S.viewer.ids.length - 1) { S.viewer.index++; renderViewer(); }
  } else if (event.key === "Escape" && sheetEl.innerHTML && !S.adding?.running) closeSheet();
});
for (const type of ["dragover", "dragleave", "drop"]) {
  document.addEventListener(type, (event) => {
    const zone = event.target.closest?.("[data-drop]");
    if (!zone) return;
    event.preventDefault();
    zone.classList.toggle("over", type === "dragover");
    if (type === "drop") addFiles(event.dataTransfer.files);
  });
}

// For trying things out on a developer's own machine only.
if (DEV) {
  window.imortaDev = {
    state: S,
    async addUrls(list) {
      const files = await Promise.all(list.map(async (u) => new File([await (await fetch(u)).blob()], u.split("/").pop(), { type: "image/jpeg" })));
      return addFiles(files);
    },
  };
}
