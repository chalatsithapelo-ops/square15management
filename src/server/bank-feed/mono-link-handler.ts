/**
 * Mono Connect link page.
 *
 * GET /api/bank-feed/mono-link?state=...&redirectUri=...
 *
 * Mono doesn't have an OAuth redirect like Stitch. Instead the user has to
 * load the Mono Connect JS widget in the browser, complete the bank login
 * inside that widget, and the widget returns a `code` via callback.
 *
 * We serve a tiny self-contained HTML page that:
 *   1. Loads https://connect.mono.co/connect.js
 *   2. Opens it with our MONO_PUBLIC_KEY + the `state` we issued
 *   3. On success, POSTs { code, state } to /api/bank-feed/mono-callback
 *   4. Redirects the user to /admin/bank-feed/link?status=... based on result
 *
 * Security:
 *   - MONO_PUBLIC_KEY is intentionally exposed in HTML (it's a public key,
 *     designed to be used in the browser).
 *   - MONO_SECRET_KEY is NEVER sent to the browser; only the server-side
 *     callback handler uses it.
 *   - The `state` is HMAC-signed by linkState.ts so the callback can verify
 *     the user/bankAccount even after a full browser round-trip.
 */

import { eventHandler } from "h3";

function parseQuery(event: any): Record<string, string> {
  const rawUrl: string = event?.node?.req?.url || "";
  const qIdx = rawUrl.indexOf("?");
  if (qIdx < 0) return {};
  const params = new URLSearchParams(rawUrl.slice(qIdx + 1));
  const out: Record<string, string> = {};
  for (const [k, v] of params) out[k] = v;
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const handler = eventHandler(async (event) => {
  const query = parseQuery(event);
  const state = typeof query.state === "string" ? query.state : "";
  const redirectUri = typeof query.redirectUri === "string" ? query.redirectUri : "";
  const publicKey = process.env.MONO_PUBLIC_KEY || "";

  if (!state || !redirectUri || !publicKey) {
    return new Response(
      `<!doctype html><html><body><h2>Mono link unavailable</h2>` +
        `<p>Missing configuration (state/redirectUri/MONO_PUBLIC_KEY).</p></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Connecting your bank…</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #f9fafb;
           display: flex; align-items: center; justify-content: center; min-height: 100vh;
           margin: 0; color: #111827; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
            padding: 32px; max-width: 480px; text-align: center;
            box-shadow: 0 10px 25px -10px rgba(0,0,0,0.1); }
    h1 { font-size: 20px; margin: 0 0 12px; }
    p  { color: #6b7280; margin: 8px 0; font-size: 14px; }
    .spinner { width: 32px; height: 32px; border: 3px solid #e5e7eb;
               border-top-color: #2563eb; border-radius: 50%;
               animation: spin 0.8s linear infinite; margin: 16px auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .err  { color: #b91c1c; }
    .btn  { display: inline-block; margin-top: 16px; padding: 8px 16px;
            background: #2563eb; color: white; border: none; border-radius: 8px;
            cursor: pointer; font-size: 14px; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Connecting your bank…</h1>
    <div class="spinner" id="spinner"></div>
    <p id="status">Loading Mono Connect…</p>
    <div id="actions" style="display:none">
      <a class="btn" href="/admin/bank-feed/link">Return to Bank Feed</a>
    </div>
  </div>
  <script src="https://connect.withmono.com/connect.js"></script>
  <script>
    (function() {
      var STATE       = ${JSON.stringify(state)};
      var REDIRECT    = ${JSON.stringify(redirectUri)};
      var PUBLIC_KEY  = ${JSON.stringify(publicKey)};
      var statusEl    = document.getElementById('status');
      var spinnerEl   = document.getElementById('spinner');
      var actionsEl   = document.getElementById('actions');

      function showError(msg) {
        spinnerEl.style.display = 'none';
        statusEl.className = 'err';
        statusEl.textContent = msg;
        actionsEl.style.display = 'block';
      }

      function returnTo(qs) {
        // Bounce to the admin UI with the same query-string contract as Stitch
        window.location.href = '/admin/bank-feed/link' + qs;
      }

      // Mono's browser SDK exposes window.Connect. Newer NPM builds also
      // expose MonoConnect — accept either so we don't break on upgrades.
      var MonoCtor = (typeof Connect !== 'undefined') ? Connect
                   : (typeof MonoConnect !== 'undefined') ? MonoConnect
                   : null;
      if (!MonoCtor) {
        showError('Could not load Mono Connect widget. Please try again.');
        return;
      }

      try {
        var connect = new MonoCtor({
          key: PUBLIC_KEY,
          onLoad: function() { statusEl.textContent = 'Choose your bank to continue.'; },
          onClose: function() {
            statusEl.textContent = 'Linking cancelled.';
            spinnerEl.style.display = 'none';
            actionsEl.style.display = 'block';
          },
          onSuccess: function(data) {
            statusEl.textContent = 'Securing your connection…';
            fetch(REDIRECT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: data.code, state: STATE })
            })
            .then(function(r) { return r.json().then(function(j){ return { ok: r.ok, body: j }; }); })
            .then(function(res) {
              if (res.ok && res.body && res.body.ok) {
                returnTo('?status=linked&account=' + encodeURIComponent(res.body.bankAccountId || ''));
              } else {
                var reason = (res.body && (res.body.reason || res.body.error)) || 'unknown';
                returnTo('?status=error&reason=' + encodeURIComponent(reason));
              }
            })
            .catch(function(err) {
              returnTo('?status=error&reason=' + encodeURIComponent(String(err).slice(0,200)));
            });
          },
          onEvent: function(eventName, _data) {
            if (eventName === 'OPENED') statusEl.textContent = 'Select your bank in the Mono window…';
          }
        });
        connect.setup();
        connect.open();
      } catch (err) {
        showError('Mono error: ' + (err && err.message ? err.message : err));
      }
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Frame-Options": "DENY",
    },
  });
});

// silence unused-import warning if escapeHtml ends up unused after edits
void escapeHtml;

export default handler;
