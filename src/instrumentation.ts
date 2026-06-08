// Configures the global undici dispatcher to use the corporate proxy
// so that Next.js API routes (server-side Supabase calls) can reach the internet.
export async function register() {
    const proxyUrl = process.env.HTTPS_PROXY;
    if (!proxyUrl) return;
    try {
        const { setGlobalDispatcher, ProxyAgent } = await import("undici");
        setGlobalDispatcher(new ProxyAgent(proxyUrl));
        console.log("[proxy] Configured via", proxyUrl);
    } catch {
        // undici not available — ignore
    }
}
