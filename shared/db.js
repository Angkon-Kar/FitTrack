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
    persistSession: true,
    autoRefreshToken: true
  }
});