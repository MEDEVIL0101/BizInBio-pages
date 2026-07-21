// Shared Supabase client + category/template config for the BizInBio app
// (onboarding + dashboard). Loaded before page-specific scripts.

const SUPABASE_URL = "https://eqsxcbmcsjrtnkevaygy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxc3hjYm1jc2pydG5rZXZheWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNjUwNTEsImV4cCI6MjA5OTc0MTA1MX0.KBEolyVp1mls1JM4siS0xZT1Kxffe7E_FJqh59tSz5w";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Broad, general business categories (not trades-only) — each has its own
// visual template and default element set (2026-07-16 redesign), not just a
// shared grouping with reordered sections. See design_handoff_bizinbio_redesign
// for the source mockups driving this per-category composition.
const CATEGORIES = [
  { id: "restaurant", label: "Restaurant / Food", blurb: "Menus, hours, gallery" },
  { id: "retail", label: "Retail", blurb: "Products, gallery" },
  { id: "salon_beauty", label: "Salon & Beauty", blurb: "Services, booking" },
  { id: "professional_services", label: "Professional Services", blurb: "Bio, quote form" },
  { id: "fitness_wellness", label: "Fitness & Wellness", blurb: "Classes, booking" },
  { id: "contractor_trades", label: "Contractor / Trades", blurb: "Service area, quotes" },
  { id: "creative_events", label: "Creative / Events", blurb: "Portfolio, packages" },
  { id: "other", label: "Other", blurb: "General layout" },
];

// Default element set per category, matching each one's mockup composition.
const CATEGORY_ELEMENTS = {
  restaurant: ["header", "contact", "about", "services_list", "portfolio_gallery", "social_link"],
  retail: ["header", "about", "portfolio_gallery", "services_list", "contact", "social_link"],
  salon_beauty: ["portfolio_gallery", "header", "about", "services_list", "contact", "social_link"],
  professional_services: ["header", "about", "contact", "services_list", "quote_request_form"],
  fitness_wellness: ["portfolio_gallery", "header", "about", "services_list", "contact", "social_link"],
  contractor_trades: ["header", "portfolio_gallery", "services_list", "service_area", "contact", "quote_request_form"],
  creative_events: ["header", "about", "portfolio_gallery", "services_list", "contact", "social_link"],
  other: ["header", "about", "portfolio_gallery", "services_list", "contact", "social_link"],
};

// Theme v2 — a flat color palette (or Custom, user-picked accent+bg) plus an
// independent font pairing. Mirrors PALETTES/FONT_PAIRS/CUSTOM_TEXT/SHAPE in
// supabase/functions/render-page/index.ts exactly (same manual-sync
// convention as SOCIAL_PLATFORMS). One consistent shape language (radius/
// border/avatar) across every palette — only color and font vary.
const PALETTES = [
  { id: "coral", label: "Coral", primary: "#e8603c", bg: "#fbf3ec", text: "#3d2c22" },
  { id: "citrus", label: "Citrus", primary: "#dba53a", bg: "#fbf4e7", text: "#3a3020" },
  { id: "ocean", label: "Ocean", primary: "#3f7cb0", bg: "#eff5f9", text: "#212c34" },
  { id: "berry", label: "Berry", primary: "#a13d6b", bg: "#faeef3", text: "#33202a" },
  { id: "forest", label: "Forest", primary: "#4b8060", bg: "#eef6f0", text: "#1f2e24" },
];
const CUSTOM_TEXT = "#2b2320";
const SHAPE = { radius: "14px", cardBlur: "0px", borderWidth: "1px", avatarRadius: "50%" };

const FONT_PAIRS = [
  { id: "playful", label: "Playful", display: '"Fredoka",system-ui,sans-serif', body: '"Plus Jakarta Sans",system-ui,sans-serif' },
  { id: "editorial", label: "Editorial", display: '"Playfair Display","Georgia",serif', body: '"Source Sans 3",system-ui,sans-serif' },
  { id: "modern", label: "Modern", display: '"Space Grotesk",system-ui,sans-serif', body: '"IBM Plex Sans",system-ui,sans-serif' },
  { id: "elegant", label: "Elegant", display: '"DM Serif Display","Georgia",serif', body: '"DM Sans",system-ui,sans-serif' },
];

// Element types visible on a free-tier page — mirrors FREE_ELEMENTS in
// supabase/functions/render-page/index.ts (same manual-sync convention as
// PALETTES/SOCIAL_PLATFORMS). Every paid tier ("website_shop"/All Access and
// "custom_domain") unlocks every element type, so the builder only needs
// this one free/paid boundary, not the full per-tier breakdown render-page
// enforces server-side.
const FREE_ELEMENT_TYPES = new Set(["header", "social_link", "contact", "about"]);

// Social platform icons for the builder's link picker — mirrors
// SOCIAL_PLATFORMS in supabase/functions/render-page/index.ts exactly (same
// hand-drawn inline-SVG style as every other icon in this app: viewBox 0 0
// 24 24, stroke=currentColor, stroke-width 1.5, round caps/joins).
const SOCIAL_PLATFORMS = [
  { id: "instagram", label: "Instagram", defaultLabel: "Follow on Instagram",
    icon: `<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/>` },
  { id: "tiktok", label: "TikTok", defaultLabel: "Watch on TikTok",
    icon: `<path d="M14 4v10.8a3.3 3.3 0 1 1-2.6-3.23"/><path d="M14 4a5 5 0 0 0 5 5"/>` },
  { id: "facebook", label: "Facebook", defaultLabel: "Follow on Facebook",
    icon: `<circle cx="12" cy="12" r="9"/><path d="M14 8.5h-1.5A1.5 1.5 0 0 0 11 10v2H9v3h2v5h3v-5h2l.5-3H14v-1.5c0-.4.2-.5.5-.5H15z"/>` },
  { id: "youtube", label: "YouTube", defaultLabel: "Watch on YouTube",
    icon: `<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M10.5 9.5l4.5 2.5-4.5 2.5z" fill="currentColor" stroke="none"/>` },
  { id: "twitter", label: "X (Twitter)", defaultLabel: "Follow on X",
    icon: `<path d="M5 5l14 14M19 5L5 19"/>` },
  { id: "linkedin", label: "LinkedIn", defaultLabel: "Connect on LinkedIn",
    icon: `<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8.5" r="1.1" fill="currentColor" stroke="none"/><path d="M8 11v6"/><path d="M13 17v-3.5a2 2 0 0 1 4 0V17"/><path d="M13 11v6"/>` },
  { id: "pinterest", label: "Pinterest", defaultLabel: "Follow on Pinterest",
    icon: `<circle cx="12" cy="12" r="9"/><path d="M9.5 17c.8-3 1.3-5.3 1.3-6.8a1.8 1.8 0 1 1 3.6 0c0 1.6-.9 3.3-2 3.3-.9 0-1.4-.6-1.4-1.4"/>` },
  { id: "amazon", label: "Amazon", defaultLabel: "Shop on Amazon",
    icon: `<path d="M4.5 8h15l-1.3 8.5a2 2 0 0 1-2 1.7H7.8a2 2 0 0 1-2-1.7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M6 20c4 2 8 2 12 0"/>` },
  { id: "other", label: "Other link", defaultLabel: "Visit link",
    icon: `<path d="M9 15l6-6"/><path d="M13 5l1-1a4 4 0 1 1 6 6l-1 1"/><path d="M11 19l-1 1a4 4 0 1 1-6-6l1-1"/>` },
];

function socialIcon(platformId) {
  const platform = SOCIAL_PLATFORMS.find((p) => p.id === platformId) || SOCIAL_PLATFORMS[SOCIAL_PLATFORMS.length - 1];
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${platform.icon}</svg>`;
}

// Accepts watch/embed/short/youtu.be URLs, with or without extra query
// params (?t=30s etc) — mirrors youtubeId in
// supabase/functions/render-page/index.ts (same manual-sync convention as
// SOCIAL_PLATFORMS/PALETTES). Used for the builder's thumbnail preview.
function youtubeId(url) {
  const match = String(url || "").match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : "";
}

// Default (empty) content shape per element type — used both by onboarding
// (creating a page's starter elements) and the builder (adding a new
// element). Kept here rather than duplicated in both pages.
const ELEMENT_DEFAULTS = {
  header: { business_name: "", location: "", logo_url: "", cover_image_url: "" },
  about: { bio: "" },
  services_list: { services: [] },
  portfolio_gallery: { photos: [] },
  youtube_video: { videos: [] },
  social_link: { links: [] },
  contact: {
    methods: [
      { id: "phone", type: "phone", label: "Phone", value: "", enabled: false, showValue: true },
      { id: "email", type: "email", label: "Email", value: "", enabled: false, showValue: true },
      { id: "whatsapp", type: "whatsapp", label: "WhatsApp", value: "", enabled: false, showValue: true },
    ],
  },
  service_area: { area: "" },
  quote_request_form: {
    fields: [
      { id: "name", label: "Name", enabled: true },
      { id: "email", label: "Email", enabled: true },
      { id: "phone", label: "Phone", enabled: false },
      { id: "details", label: "Project details", enabled: true },
    ],
  },
  booking_deposit: { deposit_amount: 0 },
  product_shop: {},
};

// Applies a theme's full token set to a root element (defaults to the
// document root) — same CSS vars themeStyleBlock() injects for the actual
// published page in render-page/index.ts, so any element that gets this
// becomes a live preview of the chosen look. Builder chrome is fixed-color
// per the design handoff, so builder.html targets only its preview
// subtree, not the whole document, unlike other app pages.
function applyTheme(themeId, customAccentColor, customBgColor, fontPairId, target) {
  const isCustom = themeId === "custom";
  const palette = isCustom
    ? { primary: customAccentColor || PALETTES[0].primary, bg: customBgColor || PALETTES[0].bg, text: CUSTOM_TEXT }
    : PALETTES.find((p) => p.id === themeId) || PALETTES[0];
  const fonts = FONT_PAIRS.find((f) => f.id === fontPairId) || FONT_PAIRS[0];
  const root = (target || document.documentElement).style;
  root.setProperty("--color-bg", palette.bg);
  root.setProperty("--body-bg", palette.bg);
  root.setProperty("--color-card-bg", "#ffffff");
  root.setProperty("--color-surface", `color-mix(in srgb, ${palette.bg} 70%, white)`);
  root.setProperty("--color-text", palette.text);
  root.setProperty("--color-accent", palette.primary);
  root.setProperty("--font-heading", fonts.display);
  root.setProperty("--font-heading-weight", "700");
  root.setProperty("--font-body", fonts.body);
  root.setProperty("--radius-md", SHAPE.radius);
  root.setProperty("--card-blur", SHAPE.cardBlur);
  root.setProperty("--card-border-width", SHAPE.borderWidth);
  root.setProperty("--avatar-radius", SHAPE.avatarRadius);
  root.setProperty("--heading-transform", "none");
  root.setProperty("--heading-letter-spacing", "normal");
}

async function requireSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = "/app/index.html";
    return null;
  }
  // getSession() only reads the locally cached token — a JWT stays valid
  // (unexpired) for up to an hour even after the underlying account is
  // deleted, since deleting a user doesn't revoke already-issued access
  // tokens. getUser() actually round-trips to the server, so a
  // meanwhile-deleted account gets caught here instead of silently
  // treating a stale local token as a real logged-in user.
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) {
    await sb.auth.signOut();
    window.location.href = "/app/index.html";
    return null;
  }
  return session;
}

// Clean, human-readable default — "Harvey Medcalf" -> "harvey-medcalf", not
// a random-suffixed string. Uniqueness is handled by letting the owner see
// and edit their URL (slugAvailable below), not by silently appending
// noise they never see or agreed to.
function slugify(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "biz";
}

// pageId: pass the current page's id when checking availability for an
// existing page's own (unchanged) slug, so it doesn't flag itself as taken.
async function slugAvailable(slug, pageId) {
  if (!slug) return false;
  let query = sb.from("pages").select("id").eq("slug", slug);
  if (pageId) query = query.neq("id", pageId);
  const { data } = await query.maybeSingle();
  return !data;
}

async function callFunction(name, payload, session) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session ? session.access_token : SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
