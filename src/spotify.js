const CLIENT_ID = "34699eb977fd4df6af54908a7b010eae";
const REDIRECT_URI = window.location.origin;
const BASE_URL = "https://api.spotify.com/v1";

const SCOPES = [
  "user-library-read", "playlist-read-private", "playlist-modify-public", 
  "streaming", "user-read-playback-state", "user-modify-playback-state"
].join(" ");

async function api(endpoint, options = {}) {
  const token = localStorage.getItem("spotify_token");
  if (!token) throw new Error("No token");
  
  const headers = { Authorization: `Bearer ${token}` };
  if (options.method && ["POST", "PUT", "DELETE"].includes(options.method)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers: { ...headers, ...options.headers } });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`API error ${res.status}: ${data.error?.message || 'Unknown'}`);
  return data;
}

export async function searchSpotify(query, type = "track", limit = 20) {
  if (!query || query.trim() === "") return { tracks: { items: [] } };
  const safeQuery = encodeURIComponent(query.trim().substring(0, 100));
  return await api(`/search?q=${safeQuery}&type=${type}&limit=${limit}`);
}

export async function exchangeCodeForToken(code) {
  const verifier = localStorage.getItem("spotify_verifier");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID, code_verifier: verifier
    }).toString()
  });
  const data = await res.json();
  if (data.access_token) {
    localStorage.setItem("spotify_token", data.access_token);
    localStorage.setItem("spotify_refresh_token", data.refresh_token);
    localStorage.setItem("spotify_token_expiry", Date.now() + data.expires_in * 1000);
  }
  return data;
}

export async function playTrackOnSpotify(trackUri, contextUri, deviceId) {
  const url = deviceId ? `/me/player/play?device_id=${deviceId}` : "/me/player/play";
  await api(url, { method: "PUT", body: JSON.stringify(contextUri ? { context_uri: contextUri, offset: { uri: trackUri } } : { uris: [trackUri] }) });
}

export async function getLikedTracks() {
  let tracks = [], url = "/me/tracks?limit=50";
  while (url) {
    const data = await api(url);
    if (!data?.items) break;
    tracks.push(...data.items.map(({ track }) => ({ id: track.id, name: track.name, uri: track.uri, artist: track.artists.map(a => a.name).join(", ") })));
    url = data.next;
  }
  return tracks;
}

export function isLoggedIn() { return !!localStorage.getItem("spotify_token"); }
export function logout() { localStorage.clear(); window.location.reload(); }
