import os
import requests
from flask import Flask, jsonify, make_response, send_from_directory, redirect, request

app = Flask(__name__, static_folder=".", static_url_path="")

CLIENT_ID     = os.getenv("SPOTIPY_CLIENT_ID")
CLIENT_SECRET = os.getenv("SPOTIPY_CLIENT_SECRET")
SUPABASE_URL  = os.getenv("SUPABASE_URL")
SUPABASE_KEY  = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SITE_URL      = os.getenv("SITE_URL", "").rstrip("/")


# ── Utilitários ──────────────────────────────────────────────────────────────

def _cors_json(obj, status=200):
    resp = make_response(jsonify(obj), status)
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Cache-Control"] = "no-store"
    return resp


def _get_access_token(refresh_token):
    resp = requests.post(
        "https://accounts.spotify.com/api/token",
        data={"grant_type": "refresh_token", "refresh_token": refresh_token},
        auth=(CLIENT_ID, CLIENT_SECRET),
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


# ── Rotas estáticas ──────────────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/<path:path>")
def static_files(path):
    # Serve qualquer arquivo estático (html, css, js, imagens…)
    return send_from_directory(".", path)


# ── API: Spotify OAuth callback ───────────────────────────────────────────────

@app.route("/spotify/callback")
def spotify_callback():
    code    = request.args.get("code")
    user_id = request.args.get("state")
    error   = request.args.get("error")

    if error:
        return redirect(f"{SITE_URL}/home.html?spotify=error&reason={error}")

    if not code or not user_id:
        return redirect(f"{SITE_URL}/home.html?spotify=error&reason=missing_params")

    if not CLIENT_ID or not CLIENT_SECRET:
        return redirect(f"{SITE_URL}/home.html?spotify=error&reason=server_config")

    redirect_uri = f"{SITE_URL}/spotify/callback"

    try:
        # Troca o code pelo refresh_token
        token_resp = requests.post(
            "https://accounts.spotify.com/api/token",
            data={
                "grant_type":   "authorization_code",
                "code":         code,
                "redirect_uri": redirect_uri,
            },
            auth=(CLIENT_ID, CLIENT_SECRET),
            timeout=10,
        )
        token_data = token_resp.json()

        if not token_data.get("refresh_token"):
            reason = token_data.get("error", "no_refresh_token")
            return redirect(f"{SITE_URL}/home.html?spotify=error&reason={reason}")

        # Salva o refresh_token no Supabase
        patch = requests.patch(
            f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}",
            json={"spotify_refresh_token": token_data["refresh_token"]},
            headers={
                "apikey":        SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type":  "application/json",
                "Prefer":        "return=minimal",
            },
            timeout=10,
        )

        if not patch.ok:
            return redirect(f"{SITE_URL}/home.html?spotify=error&reason=db_save_failed")

        return redirect(f"{SITE_URL}/home.html?spotify=connected")

    except Exception as e:
        print(f"[spotify_callback] erro: {e}")
        return redirect(f"{SITE_URL}/home.html?spotify=error&reason=exception")


# ── API: Now Playing ──────────────────────────────────────────────────────────

@app.route("/api/now-playing")
def now_playing():
    if not CLIENT_ID or not CLIENT_SECRET:
        return _cors_json({"error": "server_config"}, 500)

    user_id = request.args.get("user_id")
    refresh_token = None

    if user_id and SUPABASE_URL and SUPABASE_KEY:
        try:
            r = requests.get(
                f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}&select=spotify_refresh_token",
                headers={
                    "apikey":        SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                },
                timeout=10,
            )
            profiles = r.json()
            refresh_token = (profiles or [{}])[0].get("spotify_refresh_token")
        except Exception as e:
            print(f"[now_playing] erro supabase: {e}")

    if not refresh_token:
        return _cors_json({"is_playing": False, "error": "no_token"})

    try:
        token_data   = _get_access_token(refresh_token)
        access_token = token_data.get("access_token")

        if not access_token:
            return _cors_json({"is_playing": False, "error": "token_refresh_failed"})

        # Atualiza o refresh_token se o Spotify rotacionou
        new_refresh = token_data.get("refresh_token")
        if new_refresh and new_refresh != refresh_token and user_id and SUPABASE_URL and SUPABASE_KEY:
            try:
                requests.patch(
                    f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}",
                    json={"spotify_refresh_token": new_refresh},
                    headers={
                        "apikey":        SUPABASE_KEY,
                        "Authorization": f"Bearer {SUPABASE_KEY}",
                        "Content-Type":  "application/json",
                        "Prefer":        "return=minimal",
                    },
                    timeout=10,
                )
            except Exception:
                pass

        playing = requests.get(
            "https://api.spotify.com/v1/me/player/currently-playing",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )

        if playing.status_code == 204:
            return _cors_json({"is_playing": False})

        if playing.status_code in (401, 403):
            return _cors_json({"is_playing": False, "error": "unauthorized"})

        data  = playing.json()
        track = data.get("item")

        if not track:
            return _cors_json({"is_playing": False})

        artists = [a["name"] for a in track.get("artists", []) if a.get("name")]
        album   = track.get("album", {})
        images  = album.get("images") or [{}]

        return _cors_json({
            "is_playing":   data.get("is_playing", False),
            "track_name":   track.get("name"),
            "artists":      artists,
            "album_name":   album.get("name"),
            "album_image":  images[0].get("url"),
            "track_url":    track.get("external_urls", {}).get("spotify"),
            "progress_ms":  data.get("progress_ms", 0),
            "duration_ms":  track.get("duration_ms", 0),
        })

    except Exception as e:
        print(f"[now_playing] erro: {e}")
        return _cors_json({"is_playing": False})


# ── Health check ──────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port)
