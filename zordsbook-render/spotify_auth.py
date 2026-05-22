import os
import sys
from spotipy import Spotify
from spotipy.oauth2 import SpotifyOAuth

DEFAULT_SCOPE = "user-read-private user-read-email playlist-read-private playlist-modify-private user-read-currently-playing user-read-playback-state"
CACHE_PATH = ".spotify_cache"


def get_spotify_client(scope: str = DEFAULT_SCOPE, cache_path: str = CACHE_PATH) -> Spotify:
    """Create and return a Spotipy client authenticated with Spotify OAuth."""
    client_id = os.getenv("SPOTIPY_CLIENT_ID")
    client_secret = os.getenv("SPOTIPY_CLIENT_SECRET")
    redirect_uri = os.getenv("SPOTIPY_REDIRECT_URI")

    if not client_id or not client_secret or not redirect_uri:
        print("Missing Spotify credentials.")
        print("Set environment variables: SPOTIPY_CLIENT_ID, SPOTIPY_CLIENT_SECRET, SPOTIPY_REDIRECT_URI")
        sys.exit(1)

    auth_manager = SpotifyOAuth(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scope=scope,
        cache_path=cache_path,
        show_dialog=True,
    )

    return Spotify(auth_manager=auth_manager)


def show_user_profile(spotify: Spotify) -> None:
    """Print the authenticated Spotify user's profile information."""
    user = spotify.current_user()
    print("Authenticated Spotify user:")
    print(f"  Display name: {user.get('display_name')}")
    print(f"  User ID: {user.get('id')}")
    print(f"  Email: {user.get('email')}")
    print(f"  Country: {user.get('country')}")
    print(f"  Product: {user.get('product')}")


def main() -> None:
    """Authenticate and verify Spotify access."""
    scope = os.getenv("SPOTIPY_SCOPE", DEFAULT_SCOPE)
    cache_path = os.getenv("SPOTIPY_CACHE_PATH", CACHE_PATH)

    spotify = get_spotify_client(scope=scope, cache_path=cache_path)
    show_user_profile(spotify)


if __name__ == "__main__":
    main()
