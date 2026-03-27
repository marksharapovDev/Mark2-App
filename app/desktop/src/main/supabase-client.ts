import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env');
  }

  cachedClient = createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set('Connection', 'close');
        return fetch(input, {
          ...init,
          headers,
          keepalive: false,
        });
      },
    },
  });
  return cachedClient;
}

/** Force a fresh Supabase client — drops the cached instance */
export function resetSupabase(): void {
  cachedClient = null;
  console.log('[Supabase] Client reset — next call will create a fresh instance');
}
