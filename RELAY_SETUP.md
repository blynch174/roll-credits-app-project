# TMDB relay setup (once, about 10 minutes)

The app searches TMDB through a tiny relay on Cloudflare (free, no credit card). Your TMDB key stays in your
GitHub secrets; the deploy workflow copies it to Cloudflare as an encrypted secret. It's never in the app.

## 1. Cloudflare account

1. Sign up at https://dash.cloudflare.com/sign-up (free plan).
2. In the left menu open **Workers & Pages**. If it asks you to pick a `workers.dev` subdomain, pick one
   (for example `blynch174`). Your relay will live at `https://roll-credits-tmdb.<that-subdomain>.workers.dev`.

## 2. Two values for GitHub

- **Account ID:** on the **Workers & Pages** overview page, it's in the right-hand column (**Account ID → Copy**).
- **API token:** top right profile icon → **My Profile → API Tokens → Create Token** → use the
  **Edit Cloudflare Workers** template → **Continue to summary → Create Token**. Copy it (it's only shown once).

## 3. Add them as GitHub secrets

GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**, twice:

| Name | Value |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | the Account ID |
| `CLOUDFLARE_API_TOKEN` | the API token |

`TMDB_TOKEN` should already be there from the catalog workflow.

## 4. Deploy

**Actions → Deploy TMDB relay → Run workflow.** (It also runs by itself whenever `worker/` changes.)
When it finishes, the log shows the relay's address, e.g. `https://roll-credits-tmdb.blynch174.workers.dev`.

## 5. Tell the app where it is

In `js/firebase-config.js`, set:

```js
export const TMDB_RELAY = 'https://roll-credits-tmdb.blynch174.workers.dev';
```

Commit and push. "Search TMDB" now shows up when adding a movie that isn't in the catalog.

## Notes

- The relay only answers your site (`ALLOWED_ORIGINS` in `worker/wrangler.toml`). If you move the app to a
  new address, add it there and push.
- It only searches movies and reads one movie's details, caches answers for a day, and limits each visitor
  to 60 requests a minute. Cloudflare's free plan allows 100,000 requests a day.
