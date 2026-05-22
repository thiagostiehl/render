Spotify Now-Playing Server
=========================

This small Flask app exposes a single endpoint `/now-playing` that returns the authenticated user's current playback state as JSON.

Deployment overview
- Set the following environment variables on your host/service:
  - `SPOTIPY_CLIENT_ID` — your Spotify app client id
  - `SPOTIPY_CLIENT_SECRET` — your Spotify app client secret
  - `SPOTIPY_REFRESH_TOKEN` — a refresh token for the user (see below)

- Deploy to any Python PaaS (Render, Railway, Heroku). The repo contains a `Procfile` and `requirements.txt` for easy deploy.

Getting a refresh token (one-time)
---------------------------------
You need a refresh token for the Spotify account whose "now playing" you want to expose.

Quick method (local):

1. Install `spotipy` locally:

```powershell
python -m pip install spotipy
```

2. Run a one-off script to perform OAuth and print the refresh token:

```python
from spotipy.oauth2 import SpotifyOAuth
import os

os.environ['SPOTIPY_CLIENT_ID'] = '<your client id>'
os.environ['SPOTIPY_CLIENT_SECRET'] = '<your client secret>'
os.environ['SPOTIPY_REDIRECT_URI'] = 'http://localhost:8888/callback'

scope = 'user-read-currently-playing user-read-playback-state'
auth = SpotifyOAuth(scope=scope)
token = auth.get_access_token(as_dict=True)
print('refresh_token:', token.get('refresh_token'))
```

Follow the printed URL in a browser, authorize the app, and paste the redirected URL back to the script when prompted. The script will print a `refresh_token` you can copy into your PaaS environment variables.

Security
--------
- Do NOT commit your client secret or refresh token to source control.
- Restrict access to the deployed endpoint (via secret path, API gateway, or allowlist) if you intend to expose only to your site.

Example deploy commands (Render)
--------------------------------
1. Create a new Web Service on Render connected to this repo
2. Set build command: `pip install -r requirements.txt`
3. Set start command: `gunicorn spotify_server:app`
4. Add the three required env vars in the service settings

Netlify (recommended for your free site)
---------------------------------------
If your site is already hosted on Netlify, using a Netlify Function keeps everything together and works with the free tier.

1. Add the function file `netlify/functions/now-playing.js` (included in this repo).
2. In your Netlify site dashboard, set the following Environment Variables:
  - `SPOTIPY_CLIENT_ID`
  - `SPOTIPY_CLIENT_SECRET`
  - `SUPABASE_SERVICE_ROLE_KEY` — your Supabase service role key (used to store per-user refresh tokens)
  - `SUPABASE_URL` — your Supabase REST endpoint (e.g. https://xyz.supabase.co)

If you prefer a single global refresh token (less recommended), also set `SPOTIPY_REFRESH_TOKEN`.
3. Deploy the site (Netlify will build your functions automatically).
4. Set `NOW_PLAYING_URL` in `js/config.js` to:

```
window.ZORDSBOOK_CONFIG = {
  // ... other keys ...
  NOW_PLAYING_URL: "https://<your-site>.netlify.app/.netlify/functions/now-playing"
}
```

Note: Netlify Functions have short execution limits and may cold-start; they are suitable for polling every 20–60s.

Database migration
------------------
Run the SQL in `supabase/migration-add-spotify.sql` in the Supabase SQL Editor to add a `spotify_refresh_token` column to `public.profiles`.

How it works (per-user)
- User clicks "Conectar Spotify" on your site. They are redirected to Spotify's auth page.
- Spotify redirects to the Netlify function `/auth-spotify-callback`, which exchanges the code for a refresh token and stores it in `profiles.spotify_refresh_token` using the Supabase service role key.
- The `/now-playing?user_id=<id>` function reads that refresh token, obtains an access token, and returns the user's now-playing info.

Privacy
-------
Only store refresh tokens for users who explicitly connect. Be transparent in your UI and allow users to disconnect (clear the token from their profile). You can remove a stored token by PATCHing `spotify_refresh_token` to `null` for that profile via Supabase.

After deployment, set the frontend to use the deployed endpoint by adding `NOW_PLAYING_URL` to `js/config.js` (or to your Netlify environment and inject during build).

Example `js/config.js` addition:

```js
window.ZORDSBOOK_CONFIG = {
  SUPABASE_URL: "https://...",
  SUPABASE_ANON_KEY: "...",
  SITE_URL: "https://your-site.netlify.app",
  GROUP_INVITE_CODE: "ZORDS2026",
  NOW_PLAYING_URL: "https://your-deployed-service.onrender.com/now-playing"
}
```
