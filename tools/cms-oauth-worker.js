// Cloudflare Worker — provider OAuth GitHub per il pannello Decap CMS (/admin).
// Serve perché il sito resta su GitHub Pages (statico) e non su Netlify.
//
// Deploy (via dashboard.cloudflare.com, nessun CLI/Node richiesto):
//   1. Workers & Pages → Create → Create Worker → incolla questo file → Deploy.
//   2. Settings → Variables and Secrets → aggiungi come secret:
//        GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
//      (presi dalla GitHub OAuth App creata in Settings → Developer settings →
//       OAuth Apps; come "Authorization callback URL" usa
//       https://<nome-worker>.workers.dev/callback)
//   3. Copia l'URL del Worker in admin/config.yml come backend.base_url.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/auth") {
      const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
      authorizeUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
      authorizeUrl.searchParams.set("scope", "repo,user");
      authorizeUrl.searchParams.set("redirect_uri", `${url.origin}/callback`);
      return Response.redirect(authorizeUrl.toString(), 302);
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Missing code", { status: 400 });

      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        return new Response(`OAuth error: ${tokenData.error_description || tokenData.error}`, { status: 400 });
      }

      const payload = JSON.stringify({ token: tokenData.access_token, provider: "github" });

      const html = `<!DOCTYPE html><html><body>
<script>
(function() {
  function receiveMessage(e) {
    window.opener.postMessage(
      'authorization:github:success:${payload.replace(/'/g, "\\'")}',
      e.origin
    );
    window.removeEventListener("message", receiveMessage, false);
  }
  window.addEventListener("message", receiveMessage, false);
  window.opener.postMessage("authorizing:github", "*");
})();
</script>
</body></html>`;

      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    return new Response("Orobie Heritage - Decap CMS OAuth provider.\nEndpoints: /auth, /callback", { status: 200 });
  },
};
