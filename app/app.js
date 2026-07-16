// Shared Supabase client + category/template config for the BizInBio app
// (onboarding + dashboard). Loaded before page-specific scripts.

const SUPABASE_URL = "https://eqsxcbmcsjrtnkevaygy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxc3hjYm1jc2pydG5rZXZheWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNjUwNTEsImV4cCI6MjA5OTc0MTA1MX0.KBEolyVp1mls1JM4siS0xZT1Kxffe7E_FJqh59tSz5w";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Broad, general business categories (not trades-only) — each maps to a
// template ordering of default elements at onboarding.
const CATEGORIES = [
  { id: "restaurant", label: "Restaurant / Food", template: "storefront" },
  { id: "retail", label: "Retail", template: "storefront" },
  { id: "salon_beauty", label: "Salon & Beauty", template: "service" },
  { id: "professional_services", label: "Professional Services", template: "service" },
  { id: "fitness_wellness", label: "Fitness & Wellness", template: "service" },
  { id: "contractor_trades", label: "Contractor / Trades", template: "trade" },
  { id: "creative_events", label: "Creative / Events", template: "service" },
  { id: "other", label: "Other", template: "service" },
];

const TEMPLATE_ORDER = {
  trade: ["header", "portfolio_gallery", "services_list", "service_area", "contact", "quote_request_form"],
  storefront: ["header", "about", "portfolio_gallery", "services_list", "contact", "social_link"],
  service: ["header", "about", "services_list", "portfolio_gallery", "contact", "quote_request_form"],
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
