const CLIENT_ID = "34699eb977fd4df6af54908a7b010eae";
const REDIRECT_URI = window.location.origin + "/callback";
const BASE_URL = "https://api.spotify.com/v1";

const SCOPES = [
  "user-library-read", "playlist-read-private", "playlist-read-collaborative",
  "playlist-modify-public", "playlist-modify-private", "streaming",
  "user-read-email", "user-read-private", "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

// --- Autoryzacja ---
export async function redirectToLogin() {
  const verifier = Math.random().toString(36).substring(2);
  localStorage.setItem("spotify_verifier", verifier);
  const params = new URLSearchParams({
    response_type: "code", client_id: CLIENT_ID, scope: SCOPES,
    redirect_uri: REDIRECT_URI, code_challenge_method: "S256",
    code_challenge: verifier, show_dialog: "true",
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code) {
  const verifier = localStorage.getItem("spotify_verifier");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code,
      redirect_uri: REDIRECT_URI, client_id: CLIENT_ID, code_verifier: verifier,
    }),
  });
  const data = await res.json();
  if (data.access_token) {
    localStorage.setItem("spotify_token", data.access_token);
    localStorage.setItem("spotify_refresh_token", data.refresh_token);
    localStorage.setItem("spotify_token_expiry", Date.now() + data.expires_in * 1000);
  }
  return data;
}

// --- Główna funkcja API ---
async function api(endpoint, options = {}) {
  const token = localStorage.getItem("spotify_token");
  if (!token) throw new Error("No token available");

  const fullUrl = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;
  
  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Spotify API error: ${res.status}`);
  return data;
}

// --- Funkcje użytkowe ---
export async function searchSpotify(query, type = "track", limit = 20) {
  if (!query || query.trim().length === 0) return { tracks: { items: [] } };
  
  const params = new URLSearchParams({
    q: query.substring(0, 100),
    type: type,
    limit: Math.min(Math.max(limit, 1), 50).toString(),
  });

  return await api(`/search?${params.toString()}`);
}

export async function getLikedTracks() {
  let tracks = [];
  let url = "/me/tracks?limit=50";
  while (url) {
    const data = await api(url);
    const mapped = data.items.map(({ track }) => ({
      id: track.id, name: track.name, uri: track.uri,
      artist: track.artists.map((a) => a.name).join(", "),
      duration: msToMinSec(track.duration_ms),
      image: track.album.images[1]?.url || track.album.images[0]?.url,
    }));
    tracks = [...tracks, ...mapped];
    url = data.next ? data.next.replace(BASE_URL, "") : null;
  }
  return tracks;
}

export async function getPlaylists() {
  const data = await api("/me/playlists?limit=50");
  return data.items.filter(Boolean).map((pl) => ({
    id: pl.id, name: pl.name, uri: pl.uri, image: pl.images?.[0]?.url,
  }));
}

export async function getPlaylistTracks(playlistId) {
  let tracks = [];
  let url = `/playlists/${playlistId}/tracks?limit=100`;
  while (url) {
    const data = await api(url);
    const mapped = data.items.filter(el => el.track).map(({ track }) => ({
      id: track.id, name: track.name, uri: track.uri,
      artist: track.artists.map((a) => a.name).join(", "),
      duration: msToMinSec(track.duration_ms),
      image: track.album.images[1]?.url || track.album.images[0]?.url,
    }));
    tracks = [...tracks, ...mapped];
    url = data.next ? data.next.replace(BASE_URL, "") : null;
  }
  return tracks;
}

export async function playTrackOnSpotify(trackUri, contextUri = null) {
  const body = contextUri ? { context_uri: contextUri, offset: { uri: trackUri } } : { uris: [trackUri] };
  await api("/me/player/play", { method: "PUT", body: JSON.stringify(body) });
}

export async function pauseSpotify() { await api("/me/player/pause", { method: "PUT" }); }
export async function resumeSpotify() { await api("/me/player/play", { method: "PUT" }); }
export async function nextSpotify() { await api("/me/player/next", { method: "POST" }); }
export async function prevSpotify() { await api("/me/player/previous", { method: "POST" }); }
export async function getPlaybackState() { return await api("/me/player"); }
export async function logout() { localStorage.clear(); }
export function isLoggedIn() { return !!localStorage.getItem("spotify_token"); }

function msToMinSec(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export async function transferPlayback(deviceId) {
  await api("/me/player", { method: "PUT", body: JSON.stringify({ device_ids: [deviceId], play: false }) });
}
