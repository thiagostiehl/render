import argparse
import http.server
import json
import os
import socketserver
from typing import Any, Dict, Optional

from spotify_auth import get_spotify_client

DEFAULT_PORT = 8000


def get_now_playing(spotify) -> Optional[Dict[str, Any]]:
    """Return the current Spotify playback state, or None if nothing is playing."""
    response = spotify.current_user_playing_track()
    if not response or not response.get("item"):
        return None

    track = response["item"]
    artists = [artist.get("name") for artist in track.get("artists", []) if artist.get("name")]
    album = track.get("album", {})

    return {
        "is_playing": response.get("is_playing", False),
        "progress_ms": response.get("progress_ms"),
        "timestamp": response.get("timestamp"),
        "track_name": track.get("name"),
        "track_id": track.get("id"),
        "artists": artists,
        "album_name": album.get("name"),
        "album_image": album.get("images", [{}])[0].get("url"),
        "track_url": track.get("external_urls", {}).get("spotify"),
    }


def print_now_playing(spotify) -> None:
    """Print the current listening status in a friendly text format."""
    now_playing = get_now_playing(spotify)
    if not now_playing:
        print("Nothing is playing right now.")
        return

    artists = ", ".join(now_playing["artists"])
    print("Now listening:")
    print(f"  {now_playing['track_name']} by {artists}")
    print(f"  Album: {now_playing['album_name']}")
    print(f"  URL: {now_playing['track_url']}")
    print(f"  Playing: {now_playing['is_playing']}")
    print(f"  Progress: {now_playing['progress_ms']} ms")


class NowPlayingHandler(http.server.BaseHTTPRequestHandler):
    spotify = None

    def do_GET(self) -> None:
        if self.path != "/now-playing":
            self.send_error(404, "Not Found")
            return

        now_playing = get_now_playing(self.spotify)
        body = json.dumps(now_playing or {"is_playing": False})

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body.encode("utf-8"))

    def log_message(self, format: str, *args: Any) -> None:
        return


def serve_now_playing(spotify, port: int) -> None:
    """Run a simple local HTTP endpoint that returns now-playing JSON."""
    handler_class = NowPlayingHandler
    handler_class.spotify = spotify

    with socketserver.TCPServer(("", port), handler_class) as httpd:
        print(f"Now-playing endpoint running at http://localhost:{port}/now-playing")
        print("Press Ctrl+C to stop.")
        httpd.serve_forever()


def main() -> None:
    """Authenticate and either print now-playing or run the JSON endpoint."""
    parser = argparse.ArgumentParser(description="Spotify now playing helper")
    parser.add_argument("--serve", action="store_true", help="Serve /now-playing as JSON")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="HTTP port when using --serve")
    args = parser.parse_args()

    spotify = get_spotify_client()

    if args.serve:
        serve_now_playing(spotify, args.port)
    else:
        print_now_playing(spotify)


if __name__ == "__main__":
    main()
