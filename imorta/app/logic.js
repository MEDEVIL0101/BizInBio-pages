// Rules shared with the iPhone app: ages, how an album is laid out, how a
// child is followed through the photos, and how colouring adds up to a season.

// ---- Dates and ages

export function parseDay(text) {            // "2021-02-14" → local midnight
  const [y, m, d] = text.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function dayText(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
export function ageAt(birth, date) {        // whole years and months
  let months = (date.getFullYear() - birth.getFullYear()) * 12 + date.getMonth() - birth.getMonth();
  if (date.getDate() < birth.getDate()) months -= 1;
  return { years: Math.floor(months / 12), months: ((months % 12) + 12) % 12, total: months };
}
export function ageText(birth, date = new Date()) {
  const a = ageAt(birth, date);
  if (a.total < 0) return "Not born yet";
  if (a.years === 0) return a.months === 0 ? "Newborn" : `${a.months} month${a.months === 1 ? "" : "s"} old`;
  return `${a.years} year${a.years === 1 ? "" : "s"}${a.months ? `, ${a.months} month${a.months === 1 ? "" : "s"}` : ""} old`;
}
export function nextBirthday(birth, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
  return { days: Math.round((next - today) / 86400000), turning: next.getFullYear() - birth.getFullYear() };
}

// ---- The album: newest first, grouped by age (or by year without a birthday)

export function sectionFor(birth, date) {
  if (!birth) return { key: "c" + date.getFullYear(), title: String(date.getFullYear()) };
  if (date < birth) return { key: "before", title: "Before" };
  const a = ageAt(birth, date);
  if (a.years === 0) return { key: "m" + a.months, title: a.months === 0 ? "Newborn" : `${a.months} month${a.months === 1 ? "" : "s"}` };
  return { key: "y" + a.years, title: a.years === 1 ? "1 year old" : `${a.years} years old` };
}
const MONTH_YEAR = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });
export function albumSections(birth, photos) {
  const sorted = [...photos].sort((a, b) => b.takenAt - a.takenAt);
  const sections = [];
  for (const photo of sorted) {
    const s = sectionFor(birth, new Date(photo.takenAt));
    const last = sections[sections.length - 1];
    if (last && last.key === s.key) last.photos.push(photo);
    else sections.push({ ...s, photos: [photo] });
  }
  for (const s of sections) {
    const newest = MONTH_YEAR.format(new Date(s.photos[0].takenAt));
    const oldest = MONTH_YEAR.format(new Date(s.photos[s.photos.length - 1].takenAt));
    s.range = newest === oldest ? newest : `${oldest} – ${newest}`;
    s.birthday = null;
    if (birth) {
      const years = s.key === "m0" ? 0 : s.key.startsWith("y") ? Number(s.key.slice(1)) : null;
      if (years !== null) {
        const day = new Date(birth.getFullYear() + years, birth.getMonth(), birth.getDate());
        s.birthdayIds = new Set(s.photos.filter((p) => sameDay(new Date(p.takenAt), day)).map((p) => p.id));
      }
    }
    s.birthdayIds = s.birthdayIds || new Set();
  }
  return sections;
}
export function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

/** Photos from this week of the year, in years gone by: newest year first. */
export function onThisDay(photos, now = new Date()) {
  const byYear = new Map();
  for (const p of photos) {
    const d = new Date(p.takenAt);
    if (d.getFullYear() >= now.getFullYear()) continue;
    const there = new Date(d.getFullYear(), now.getMonth(), now.getDate());
    if (Math.abs(d - there) > 3.5 * 86400000) continue;
    if (!byYear.has(d.getFullYear())) byYear.set(d.getFullYear(), []);
    byYear.get(d.getFullYear()).push(p);
  }
  return [...byYear.entries()].sort((a, b) => b[0] - a[0]).map(([year, list]) => ({ year, photos: list.sort((a, b) => a.takenAt - b.takenAt).slice(0, 6) }));
}

// ---- Faces: who is who

export function distance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; sum += d * d; }
  return Math.sqrt(sum);
}

/** Groups unfiled faces that look like one person, biggest group first, never two faces from one photo. */
export function groupFaces(faces, threshold = 0.5) {
  const groups = [];
  const sorted = [...faces].sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h);
  for (const face of sorted) {
    let best = null, bestD = threshold;
    for (const g of groups) {
      if (g.photoIds.has(face.photoId)) continue;
      const d = distance(face.desc, g.centre);
      if (d < bestD) { bestD = d; best = g; }
    }
    if (!best) { groups.push({ faces: [face], centre: Float32Array.from(face.desc), photoIds: new Set([face.photoId]) }); continue; }
    best.faces.push(face);
    best.photoIds.add(face.photoId);
    const n = best.faces.length;
    for (let i = 0; i < best.centre.length; i++) best.centre[i] += (face.desc[i] - best.centre[i]) / n;
  }
  return groups.sort((a, b) => b.faces.length - a.faces.length);
}

/**
 * Follows each child from the faces a parent pointed out: an unfiled face is
 * theirs when it's close to their known faces and clearly closer than to any
 * other child, the photo isn't from before they were born, and they aren't
 * already in that photo. Returns the faces it filed.
 */
export function followChildren(children, faces, photoDates, { near = 0.47, margin = 0.05 } = {}) {
  const filed = [];
  for (let pass = 0; pass < 4; pass++) {
    const known = new Map(children.map((c) => [c.id, faces.filter((f) => f.childId === c.id)]));
    const taken = new Set(faces.filter((f) => f.childId != null).map((f) => f.photoId + ":" + f.childId));
    const candidates = [];
    for (const face of faces) {
      if (face.childId != null) continue;
      const scores = [];
      for (const child of children) {
        const theirs = known.get(child.id);
        if (!theirs.length || (face.rejected || []).includes(child.id)) continue;
        if (child.birth && photoDates.get(face.photoId) < parseDay(child.birth).getTime()) continue;
        const nearest = theirs.map((k) => distance(face.desc, k.desc)).sort((a, b) => a - b).slice(0, 3);
        scores.push({ child, d: nearest.reduce((s, v) => s + v, 0) / nearest.length });
      }
      scores.sort((a, b) => a.d - b.d);
      if (!scores.length || scores[0].d > near) continue;
      if (scores[1] && scores[1].d - scores[0].d < margin) continue;
      candidates.push({ face, child: scores[0].child, d: scores[0].d });
    }
    candidates.sort((a, b) => a.d - b.d);
    let added = 0;
    for (const c of candidates) {
      const key = c.face.photoId + ":" + c.child.id;
      if (taken.has(key)) continue;
      taken.add(key);
      c.face.childId = c.child.id;
      c.face.by = "auto";
      filed.push(c.face);
      added++;
    }
    if (!added) break;
  }
  return filed;
}

// ---- When a photo was taken (EXIF DateTimeOriginal), read from the file itself

export function exifDate(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset), size = view.getUint16(offset + 2);
    if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) return readTiff(view, offset + 10);
    if ((marker & 0xff00) !== 0xff00) break;
    offset += 2 + size;
  }
  return null;
}
function readTiff(view, start) {
  if (start + 8 > view.byteLength) return null;
  const little = view.getUint16(start) === 0x4949;
  const u16 = (o) => view.getUint16(o, little), u32 = (o) => view.getUint32(o, little);
  const text = (o, n) => { let s = ""; for (let i = 0; i < n && o + i < view.byteLength; i++) { const c = view.getUint8(o + i); if (!c) break; s += String.fromCharCode(c); } return s; };
  const find = (dir, tag) => {
    if (dir + 2 > view.byteLength) return null;
    const count = u16(dir);
    for (let i = 0; i < count; i++) {
      const entry = dir + 2 + i * 12;
      if (entry + 12 > view.byteLength) return null;
      if (u16(entry) === tag) return entry;
    }
    return null;
  };
  const ifd0 = start + u32(start + 4);
  let stamp = null;
  const exifPointer = find(ifd0, 0x8769);
  if (exifPointer) {
    const exif = start + u32(exifPointer + 8);
    const original = find(exif, 0x9003) ?? find(exif, 0x9004);
    if (original) stamp = text(start + u32(original + 8), 19);
  }
  if (!stamp) { const plain = find(ifd0, 0x0132); if (plain) stamp = text(start + u32(plain + 8), 19); }
  const m = stamp && stamp.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const date = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return isNaN(date) || date.getFullYear() < 1990 ? null : date;
}

// ---- About them: eyes, hair, skin and the colour season they add up to

export const EYES = { "Dark brown": "#3B2416", "Brown": "#6B4423", "Amber": "#A86B2D", "Hazel": "#8E7240", "Green": "#5F7D4A", "Blue-green": "#4F7F7A", "Blue-grey": "#6E7F8C", "Grey": "#8A9298", "Blue": "#4F7BA8" };
export const HAIR = { "Black": "#1C1A19", "Dark brown": "#3B2A20", "Brown": "#5E4330", "Light brown": "#8A6A4C", "Dirty blonde": "#A88A5C", "Ash blonde": "#B5A68C", "Blonde": "#D2B07A", "Platinum blonde": "#E5DCC5", "Strawberry blonde": "#C98C5E", "Red": "#A8482A", "Auburn": "#7A3B22", "Grey": "#A9A9A9" };
export const SKIN_DEPTHS = ["Very fair", "Fair", "Medium", "Tan", "Brown", "Deep"];
export const UNDERTONES = ["warm", "neutral", "cool"];
export const SEASONS = ["Light Spring", "True Spring", "Bright Spring", "Light Summer", "True Summer", "Soft Summer", "Soft Autumn", "True Autumn", "Dark Autumn", "Dark Winter", "True Winter", "Bright Winter"];

export function skinHex(depth, undertone) {
  const [angle, chroma] = { "Very fair": [62, 16], "Fair": [48, 19], "Medium": [34, 22], "Tan": [19, 24], "Brown": [-8, 22] }[depth] || [-45, 16];
  const hue = { warm: 69, neutral: 59, cool: 49 }[undertone] ?? 59;
  const a = chroma * Math.cos(hue * Math.PI / 180), b = chroma * Math.sin(hue * Math.PI / 180);
  const l = 50 + b * Math.tan(angle * Math.PI / 180);
  const fy = (l + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (t) => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);
  const x = inv(fx) * 0.95047, y = inv(fy), z = inv(fz) * 1.08883;
  const lin = [3.2406 * x - 1.5372 * y - 0.4986 * z, -0.9689 * x + 1.8758 * y + 0.0415 * z, 0.0557 * x - 0.204 * y + 1.057 * z];
  return "#" + lin.map((v) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
    return Math.round(Math.min(Math.max(c, 0), 1) * 255).toString(16).padStart(2, "0");
  }).join("").toUpperCase();
}

const HAIR_VALUE = { "Black": [1, 0], "Dark brown": [2, 0], "Brown": [3, 0], "Auburn": [3, 1], "Light brown": [4, -0.5], "Red": [4, 1], "Dirty blonde": [5, 0.75], "Ash blonde": [6, -1], "Strawberry blonde": [6, 1], "Blonde": [7, 1], "Platinum blonde": [8, -1], "Grey": [6, -1] };
const EYE_VALUE = { "Dark brown": [1, 0, false], "Brown": [2, 0.5, false], "Amber": [3, 1, true], "Hazel": [3, 0.5, false], "Green": [4, 0, true], "Blue-green": [4.5, -0.25, true], "Blue-grey": [5, -0.75, false], "Grey": [5, -1, false], "Blue": [5.5, -1, true] };

/** The twelve-season reading, from the names a parent chose. */
export function season(eye, hair, depth, undertone) {
  const e = EYE_VALUE[eye], h = HAIR_VALUE[hair];
  if (!e && !h) return null;
  const lights = [e && e[0], h && h[0]].filter((v) => v != null);
  const deep = lights.reduce((s, v) => s + v, 0) / lights.length;
  const skinLight = depth ? ({ "Very fair": 8, "Fair": 7, "Medium": 5, "Tan": 4, "Brown": 2.5 }[depth] ?? 1) : 6;
  const tone = depth ? ({ warm: 1, cool: -1 }[undertone] ?? 0) : 0;
  const hairWarm = h ? h[1] : 0;
  const warmth = hairWarm + (e ? e[1] : 0) + tone;
  const warm = warmth > 0.25 || (Math.abs(warmth) <= 0.25 && hairWarm > 0);
  const contrast = skinLight - (h ? h[0] : deep);
  const clear = e ? e[2] : false;
  if (deep <= 2.5) return warm ? "Dark Autumn" : contrast >= 5.5 && warmth < -0.5 ? "True Winter" : "Dark Winter";
  if (deep >= 5.5) return warm ? "Light Spring" : "Light Summer";
  if (contrast >= 5 && clear) return warm ? "Bright Spring" : "Bright Winter";
  if (!clear || hair === "Ash blonde" || hair === "Light brown") return warm ? "Soft Autumn" : "Soft Summer";
  if (warm) return deep <= 3.5 ? "True Autumn" : "True Spring";
  return "True Summer";
}

export const PALETTES = {
  "Light Spring": [["#F8C8A0", "#F4A6A0", "#F08C7A", "#F6D86B", "#A8DDB5", "#7FD1C7", "#9FB4E8", "#D9B48A"], ["#111111", "#6D0F2A", "#333840", "#13224A"], "Light and warm — soft peach, warm pastels, light camel."],
  "True Spring": [["#FF6F59", "#FFC93C", "#7DBE4A", "#2EC4B6", "#F2542D", "#C69C6D", "#4FC1C9", "#FFB385"], ["#111111", "#8A8D91", "#B08EA2", "#CFE8F5"], "Warm and clear — coral, golden yellow, warm green."],
  "Bright Spring": [["#FF3E6C", "#FFD23F", "#00B894", "#00A8E8", "#FF7F11", "#7B61FF", "#F7F1E1", "#00C2C7"], ["#C9A9A6", "#8A8B5A", "#A39887", "#D8C8B0"], "Warm and vivid — clear turquoise, poppy red, bright coral."],
  "Light Summer": [["#B8D4EC", "#C7B8E6", "#F2B8C6", "#BFE3D0", "#A3B4E0", "#C9CCD1", "#E58FAE", "#8CC7C3"], ["#F07F2A", "#111111", "#D6A23A", "#B5532A"], "Light and cool — powder blue, lavender, soft rose."],
  "True Summer": [["#6E8FB7", "#C2457A", "#3B4E78", "#7FA39B", "#D97A9A", "#7E4C79", "#8E96A3", "#A894C8"], ["#F07F2A", "#D4A017", "#B5532A", "#C19A6B"], "Cool and gentle — dusty blue, raspberry, soft navy."],
  "Soft Summer": [["#9CAF88", "#B48A9E", "#7C93A8", "#C99AA0", "#6F9C9A", "#A39A92", "#6C7A89", "#8C6C86"], ["#111111", "#FF7F11", "#FFFFFF", "#F6F930"], "Cool and muted — sage, mauve, grey-blue."],
  "Soft Autumn": [["#8A8B4A", "#5E9C93", "#C19A6B", "#E39A82", "#7E8B55", "#A08C76", "#D8876F", "#B7A77A"], ["#111111", "#E0218A", "#CFE8F5", "#FFFFFF"], "Warm and muted — olive, soft teal, camel."],
  "True Autumn": [["#B5532A", "#D6A23A", "#2F5D3A", "#E07B2A", "#6B6B2A", "#1F6F6B", "#5C3A21", "#C6402B"], ["#F6D1E0", "#E0218A", "#A7AEB8", "#111111"], "Warm and rich — rust, mustard, forest green."],
  "Dark Autumn": [["#4E2A1E", "#7A1E2C", "#0F5257", "#556B2F", "#4B2840", "#9C3D1F", "#24442E", "#B8860B"], ["#F8C8DC", "#CFE8F5", "#C7B8E6", "#C0C4CA"], "Deep and warm — chocolate, burgundy, deep teal."],
  "Dark Winter": [["#5B0F24", "#0B6E4F", "#13224A", "#6D0F2A", "#4A1942", "#1C4532", "#333840", "#B3122E"], ["#F8C8A0", "#C19A6B", "#F28C28", "#D6A23A"], "Deep and cool — black-cherry, emerald, deep navy."],
  "True Winter": [["#D0021B", "#1F3FBF", "#00875A", "#FFFFFF", "#111111", "#D1127B", "#CFE8F5", "#5B2A86"], ["#D8C8B0", "#C19A6B", "#F28C28", "#6B6B2A"], "Cool and striking — true red, royal blue, pure white."],
  "Bright Winter": [["#E0218A", "#BDE6F7", "#00A86B", "#0047AB", "#E3132C", "#7F00FF", "#111111", "#FFFFFF"], ["#C9A9A6", "#6B6B2A", "#B5532A", "#D8C8B0"], "Cool and vivid — fuchsia, icy blue, emerald."],
};

export const MILESTONE_CATEGORIES = { personal: "Personal", academic: "Academic", career: "Career", financial: "Financial" };
export const RECORD_KINDS = { birth: "Birth certificate", identity: "ID document", health: "Health record", school: "School record", award: "Award", qualification: "Qualification", other: "Record" };
