import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function isSupabaseBrowserConfigured() {
    return Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
}

export function createSupabaseBrowserClient(): SupabaseClient {
    if (_client) return _client;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
        // During build/SSR prerender, env vars may not exist.
        // Real Supabase calls only happen inside useEffect (client-side).
        return null as unknown as SupabaseClient;
    }
    _client = createClient(url, key);
    return _client;
}
