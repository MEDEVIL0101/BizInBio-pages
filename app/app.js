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

const THEMES = ["default", "warm", "cool", "bold"];

async function requireSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
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
