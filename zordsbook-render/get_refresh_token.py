"""
One-time helper to obtain a Spotify refresh token for your account.

Usage:
  - Set the following env vars or input when prompted:
      SPOTIPY_CLIENT_ID
      SPOTIPY_CLIENT_SECRET
      SPOTIPY_REDIRECT_URI
  - Run: python get_refresh_token.py
  - Open the printed URL, authorize, then paste the full redirected URL back into the script.

The script will exchange the code for tokens and print the refresh token.
Do NOT commit the refresh token to source control.
"""

import os
import sys
import urllib.parse
import requests


CLIENT_ID = os.getenv("SPOTIPY_CLIENT_ID") or input("SPOTIPY_CLIENT_ID: ")
CLIENT_SECRET = os.getenv("SPOTIPY_CLIENT_SECRET") or input("SPOTIPY_CLIENT_SECRET: ")
REDIRECT_URI = os.getenv("SPOTIPY_REDIRECT_URI") or input("SPOTIPY_REDIRECT_URI: ")

SCOPE = "user-read-currently-playing user-read-playback-state"


def build_auth_url(client_id, redirect_uri, scope):
    params = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": scope,
        "show_dialog": "true",
    }
    return "https://accounts.spotify.com/authorize?" + urllib.parse.urlencode(params)


def exchange_code_for_token(code, client_id, client_secret, redirect_uri):
    url = "https://accounts.spotify.com/api/token"
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
    }
    resp = requests.post(url, data=data, auth=(client_id, client_secret), timeout=10)
    resp.raise_for_status()
    return resp.json()


def main():
    print("Open the following URL in your browser and authorize the app:\n")
    print(build_auth_url(CLIENT_ID, REDIRECT_URI, SCOPE))
    print("\nAfter authorizing, you'll be redirected to your redirect URI. Paste the full redirect URL here:\n")
    redirected = input("Redirect URL: ").strip()
    if not redirected:
        print("No URL provided, exiting.")
        sys.exit(1)

    parsed = urllib.parse.urlparse(redirected)
    qs = urllib.parse.parse_qs(parsed.query)
    code = qs.get("code", [None])[0]
    if not code:
        print("No code found in the redirect URL. Make sure you pasted the full URL.")
        sys.exit(1)

    token_data = exchange_code_for_token(code, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
    refresh_token = token_data.get("refresh_token")
    print("\n=== Token response ===")
    print(token_data)
    print("\nCopy the refresh token value below and set it as SPOTIPY_REFRESH_TOKEN in your deployment environment:\n")
    print(refresh_token)


if __name__ == "__main__":
    main()
