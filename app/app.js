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

// Theme presets — each is a distinct persona (font pairing, corner shape,
// solid-vs-glass surface, optional gradient background), mirrored field-for-
// field from THEME_PRESETS in supabase/functions/render-page/index.ts. Keep
// the two in sync when editing either — there's no shared build step
// between the Deno edge function and this static JS file, so it's a manual
// mirror. Full fidelity here (not just accent/bg) is what lets the
// onboarding/dashboard forms re-skin live as an actual preview, not just a
// small swatch — see applyTheme() below.
const THEMES = [
  { id: "classic", label: "Classic", bg: "#ffffff", cardBg: "#ffffff", surface: "#f2f2f2", text: "#0f0f0f", accent: "#ff0000",
    fontHeading: '"Barlow Condensed",system-ui,sans-serif', fontHeadingWeight: "600", fontBody: '"Barlow",system-ui,sans-serif',
    radius: 4, cardBlur: 0, borderWidth: 1, avatarRadius: "50%", headingTransform: "none", headingLetterSpacing: "-.015em" },
  { id: "editorial", label: "Editorial", bg: "#faf6f1", cardBg: "#ffffff", surface: "#f1ebe2", text: "#2a2420", accent: "#b8632f",
    fontHeading: '"Fraunces","Georgia",serif', fontHeadingWeight: "600", fontBody: '"Inter",system-ui,sans-serif',
    radius: 10, cardBlur: 0, borderWidth: 1, avatarRadius: "50%", headingTransform: "none", headingLetterSpacing: "-.01em" },
  { id: "rugged", label: "Rugged", bg: "#1c1c1a", cardBg: "#262420", surface: "#302d27", text: "#f2ede4", accent: "#c85a2a", dark: true,
    fontHeading: '"Oswald",system-ui,sans-serif', fontHeadingWeight: "600", fontBody: '"Barlow",system-ui,sans-serif',
    radius: 0, cardBlur: 0, borderWidth: 2, avatarRadius: "8px", headingTransform: "uppercase", headingLetterSpacing: "0.01em" },
  { id: "collegiate", label: "Collegiate", bg: "#f7f3ea", cardBg: "#ffffff", surface: "#efe8d8", text: "#1a2340", accent: "#a30f28",
    fontHeading: '"Bebas Neue",system-ui,sans-serif', fontHeadingWeight: "400", fontBody: '"Barlow",system-ui,sans-serif',
    radius: 16, cardBlur: 0, borderWidth: 1, avatarRadius: "50%", headingTransform: "uppercase", headingLetterSpacing: "0.02em" },
  { id: "aurora", label: "Aurora", bg: "#f3e8e2", bodyBg: "linear-gradient(160deg,#f3e2da 0%,#ece0e6 100%)", cardBg: "rgba(255,255,255,0.55)", surface: "rgba(255,255,255,0.7)", text: "#33232a", accent: "#8a2f47",
    fontHeading: '"Manrope",system-ui,sans-serif', fontHeadingWeight: "700", fontBody: '"Inter",system-ui,sans-serif',
    radius: 18, cardBlur: 18, borderWidth: 1, avatarRadius: "50%", headingTransform: "none", headingLetterSpacing: "-.01em" },
  { id: "midnight", label: "Midnight", bg: "#15130f", bodyBg: "linear-gradient(160deg,#17140f 0%,#0c0a08 100%)", cardBg: "rgba(255,255,255,0.06)", surface: "rgba(255,255,255,0.09)", text: "#f1ede4", accent: "#c9a227", dark: true,
    fontHeading: '"Manrope",system-ui,sans-serif', fontHeadingWeight: "700", fontBody: '"Inter",system-ui,sans-serif',
    radius: 16, cardBlur: 20, borderWidth: 1, avatarRadius: "50%", headingTransform: "none", headingLetterSpacing: "-.01em" },
  { id: "sage", label: "Sage", bg: "#f6f5ef", cardBg: "#ffffff", surface: "#eeece0", text: "#232a1e", accent: "#5c7a52",
    fontHeading: '"Fraunces","Georgia",serif', fontHeadingWeight: "500", fontBody: '"Barlow",system-ui,sans-serif',
    radius: 10, cardBlur: 0, borderWidth: 1, avatarRadius: "50%", headingTransform: "none", headingLetterSpacing: "-.005em" },
  { id: "custom", label: "Custom", bg: "#ffffff", cardBg: "#ffffff", surface: "#f2f2f2", text: "#0f0f0f", accent: "#ff0000",
    fontHeading: '"Barlow Condensed",system-ui,sans-serif', fontHeadingWeight: "600", fontBody: '"Barlow",system-ui,sans-serif',
    radius: 4, cardBlur: 0, borderWidth: 1, avatarRadius: "50%", headingTransform: "none", headingLetterSpacing: "-.015em" },
];

// Curated font choices for the "Custom" theme — mirrors FONT_OPTIONS in
// supabase/functions/render-page/index.ts (same manual-sync convention as
// THEMES/THEME_PRESETS). Deliberately a fixed list, not free-text: every
// option here is already loaded via the Google Fonts import at the top of
// site.css, so a custom font choice can never reference an unloaded family.
const FONT_OPTIONS = [
  { id: "barlow_condensed", label: "Barlow Condensed", css: '"Barlow Condensed",system-ui,sans-serif' },
  { id: "barlow", label: "Barlow", css: '"Barlow",system-ui,sans-serif' },
  { id: "inter", label: "Inter", css: '"Inter",system-ui,sans-serif' },
  { id: "fraunces", label: "Fraunces (serif)", css: '"Fraunces","Georgia",serif' },
  { id: "oswald", label: "Oswald", css: '"Oswald",system-ui,sans-serif' },
  { id: "bebas_neue", label: "Bebas Neue", css: '"Bebas Neue",system-ui,sans-serif' },
  { id: "manrope", label: "Manrope", css: '"Manrope",system-ui,sans-serif' },
];

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

// Default (empty) content shape per element type — used both by onboarding
// (creating a page's starter elements) and the builder (adding a new
// element). Kept here rather than duplicated in both pages.
const ELEMENT_DEFAULTS = {
  header: { business_name: "", location: "", logo_url: "", cover_image_url: "" },
  about: { bio: "" },
  services_list: { services: [] },
  portfolio_gallery: { photos: [] },
  social_link: { links: [] },
  contact: { phone: "", whatsapp: "", email: "" },
  service_area: { area: "" },
  quote_request_form: {},
  booking_deposit: { deposit_amount: 0 },
  product_shop: {},
};

// Applies a theme's full token set to the document root, so the
// onboarding/dashboard form itself becomes a live preview of the chosen
// look (not just a small static swatch) — same CSS vars themeStyleBlock()
// injects for the actual published page in render-page/index.ts.
function applyTheme(themeId, customAccentColor, customBgColor, customTextColor, customFont) {
  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
  const isCustom = themeId === "custom";
  const accent = isCustom && customAccentColor ? customAccentColor : theme.accent;
  const bg = isCustom && customBgColor ? customBgColor : theme.bg;
  const bodyBg = isCustom && customBgColor ? customBgColor : (theme.bodyBg || theme.bg);
  const text = isCustom && customTextColor ? customTextColor : theme.text;
  const font = isCustom ? FONT_OPTIONS.find((f) => f.id === customFont) : undefined;
  const root = document.documentElement.style;
  root.setProperty("--color-bg", bg);
  root.setProperty("--body-bg", bodyBg);
  root.setProperty("--color-card-bg", theme.cardBg);
  root.setProperty("--color-surface", theme.surface);
  root.setProperty("--color-text", text);
  root.setProperty("--color-accent", accent);
  root.setProperty("--font-heading", font ? font.css : theme.fontHeading);
  root.setProperty("--font-heading-weight", theme.fontHeadingWeight);
  root.setProperty("--font-body", font ? font.css : theme.fontBody);
  root.setProperty("--radius-md", theme.radius + "px");
  root.setProperty("--card-blur", theme.cardBlur + "px");
  root.setProperty("--card-border-width", theme.borderWidth + "px");
  root.setProperty("--avatar-radius", theme.avatarRadius);
  root.setProperty("--heading-transform", theme.headingTransform);
  root.setProperty("--heading-letter-spacing", theme.headingLetterSpacing);
}

// Shared theme-swatch preview for the onboarding + dashboard theme pickers —
// a small realistic mockup of the actual page (avatar, business name set in
// the theme's own heading font, a body line, a button) rather than an
// abstract color dot, so picking a theme shows what you'll actually get.
function themeSwatchPreview(theme) {
  const isDark = !!theme.dark;
  const isGlass = theme.cardBlur > 0;
  const nameColor = isDark ? "rgba(255,255,255,.92)" : "rgba(20,20,20,.85)";
  const lineColor = isDark ? "rgba(255,255,255,.35)" : "rgba(20,20,20,.22)";
  const glassBg = isDark ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.5)";
  const glassBorder = isDark ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.7)";
  const innerRadius = Math.max(theme.radius - 5, 3);
  return `
    <div class="swatch-preview" style="background:${theme.bodyBg || theme.bg};border-radius:${theme.radius}px">
      ${theme.id === "custom" ? `<div style="position:absolute;inset:0;background:conic-gradient(from 0deg, red, orange, yellow, green, blue, violet, red);opacity:.5"></div>` : ""}
      ${isGlass ? `<div class="swatch-glass" style="border-radius:${innerRadius}px;background:${glassBg};border:1px solid ${glassBorder}"></div>` : ""}
      <div class="swatch-mini-avatar" style="border-radius:${theme.avatarRadius};background:${theme.accent}"></div>
      <div class="swatch-mini-name" style="font-family:${theme.fontHeading};color:${nameColor}">Studio</div>
      <div class="swatch-mini-line" style="background:${lineColor}"></div>
      <div class="swatch-mini-btn" style="background:${theme.accent};border-radius:${Math.max(innerRadius - 2, 2)}px"></div>
      <div class="swatch-check"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
    </div>`;
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

function slugify(name) {
  const base = (name || "biz")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "biz";
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
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
