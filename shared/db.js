// shared/db.js — single Supabase client (fixes 406 + GoTrueClient warning)
const { createClient } = supabase;
export const sb = createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey, {
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  },
  auth: {
    // Firebase manages user auth in this app, so keep Supabase stateless.
    // This avoids browser tracking-prevention storage warnings on some setups.
    persistSession: false,
    autoRefreshToken: false
  }
});