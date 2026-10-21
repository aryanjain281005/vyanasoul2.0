// Shared settings for the build tools. Nothing here is secret: the publishable key only
// reads what row-level security lets anyone read (published reviews).

export const TARGETS = {
  production: { url: "https://www.vyanasoul.com/", indexable: true },
  // the preview's booking form runs in test mode: requests are checked by the function but not saved
  preview: { url: "https://aryanjain281005.github.io/vyanasoul2.0/", indexable: false, testBookings: true },
};

export const SUPABASE_URL = "https://xvdoutqezjsuogankqna.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_H2PXLN9Ms30bXwxnyDz8RA_P-xIVIDO";

export const BUSINESS = {
  name: "Vyana Soul",
  person: "Rekha Bala",
  phone: "+91 99874 87242",
  whatsapp: "919987487242",
  email: "vyanasoul369@gmail.com",
  city: "Mumbai",
  sameAs: [
    "https://www.instagram.com/vyana_soul369/",
    "https://www.facebook.com/people/Vyana-Soul/61586396214113/",
    "https://www.youtube.com/@VYANASOUL369",
  ],
};

// Files and folders copied to dist/ as they are
export const STATIC = [
  "styles.css", "main.js", "fx.js", "app3d.js", ".nojekyll",
  "assets", "fonts", "frames", "vendor", "admin",
];

export const LANGS = ["en", "hi"];
