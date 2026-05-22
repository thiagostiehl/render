let supabaseClient = null;

function getConfig() {
  return window.ZORDSBOOK_CONFIG || null;
}

function isConfigured() {
  const c = getConfig();
  return Boolean(c?.SUPABASE_URL && c?.SUPABASE_ANON_KEY);
}

function getSupabase() {
  if (!isConfigured()) return null;
  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(
      getConfig().SUPABASE_URL,
      getConfig().SUPABASE_ANON_KEY
    );
  }
  return supabaseClient;
}
