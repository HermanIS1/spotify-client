const CLIENT_ID = "34699eb977fd4df6af54908a7b010eae";
const REDIRECT_URI = window.location.origin + "/callback";
const BASE_URL = "https://api.spotify.com/v1";

const SCOPES = [
  "user-library-read",
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-public",
  "playlist-modify-private",
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

// --- Pomocnicze funkcje autoryzacji ---
function generateRandomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((b) => chars[b % chars.length])
    .join("");
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// --- Autoryzacja ---
export async function redirectToLogin() {
  const verifier = generateRandomString(128);
  const challenge = await generateCodeChallenge(verifier);

  localStorage.setItem("spotify_verifier", verifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    show_dialog: "true",
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code) {
  const verifier = localStorage.getItem("spotify_verifier");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
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

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("spotify_refresh_token");
  if (!refreshToken) return false;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) return false;

  localStorage.setItem("spotify_token", data.access_token);
  localStorage.setItem(
    "spotify_token_expiry",
    String(Date.now() + data.expires_in * 1000),
  );
  if (data.refresh_token) {
    localStorage.setItem("spotify_refresh_token", data.refresh_token);
  }
  return true;
}

async function ensureValidToken() {
  const expiry = Number(localStorage.getItem("spotify_token_expiry") || 0);
  if (Date.now() < expiry - 60_000) return;
  const refreshed = await refreshAccessToken();
  if (!refreshed) throw new Error("Session expired — log in again");
}

// --- Główna funkcja API ---
async function api(endpoint, options = {}) {
  await ensureValidToken();

  const token = localStorage.getItem("spotify_token");
  if (!token) throw new Error("No token available");

  const fullUrl = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;
  const headers = { Authorization: `Bearer ${token}`, ...options.headers };
  if (options.body) headers["Content-Type"] = "application/json";

  const res = await fetch(fullUrl, { ...options, headers });

  if (res.status === 204 || res.status === 202) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.error?.message || data.error_description || "";
    throw new Error(
      `Spotify API error: ${res.status}${detail ? ` — ${detail}` : ""}`,
    );
  }
  return data;
}

function playlistEntryTrack(entry) {
  return entry?.track ?? entry?.item ?? null;
}

// --- Funkcje użytkowe ---
export async function searchSpotify(query, type = "track", limit = 10) {
  if (!query || typeof query !== "string" || query.trim() === "") {
    return { tracks: { items: [] } };
  }

  const params = new URLSearchParams({
    q: query.trim(),
    type,
    limit: String(Math.min(Math.max(limit, 1), 10)),
    market: "PL",
  });

  return await api(`/search?${params.toString()}`);
}

export async function getLikedTracks() {
  let tracks = [];
  let url = "/me/tracks?limit=50";
  
  while (url) {
    const data = await api(url);
    if (!data || !data.items) break;
    
    const mapped = data.items.map(({ track }) => ({
      id: track.id,
      name: track.name,
      uri: track.uri,
      artist: track.artists.map((a) => a.name).join(", "),
      duration: msToMinSec(track.duration_ms),
      image: track.album.images[1]?.url || track.album.images[0]?.url,
    }));
    tracks = [...tracks, ...mapped];
    
    // api() samo radzi sobie z pełnymi URLami, więc możemy przypisać bezpośrednio data.next
    url = data.next ? data.next : null;
  }
  return tracks;
}

export async function getPlaylists() {
  const data = await api("/me/playlists?limit=50");
  if (!data || !data.items) return [];

  return data.items.filter(Boolean).map((pl) => ({
    id: pl.id,
    name: pl.name,
    uri: pl.uri,
    image: pl.images?.[0]?.url,
    // Zabezpieczenie przed wywaleniem (TypeError: Cannot read properties of undefined)
    total: pl.tracks?.total ?? pl.items?.total ?? 0,
  }));
}

export async function getPlaylistTracks(playlistId) {
  let tracks = [];
  let url = `/playlists/${playlistId}/items?limit=50`;

  while (url) {
    const data = await api(url);
    if (!data?.items) break;

    const mapped = data.items
      .map((entry) => {
        const track = playlistEntryTrack(entry);
        if (!track?.id) return null;
        return {
          id: track.id,
          name: track.name,
          uri: track.uri,
          artist: track.artists.map((a) => a.name).join(", "),
          duration: msToMinSec(track.duration_ms),
          image: track.album.images[1]?.url || track.album.images[0]?.url,
        };
      })
      .filter(Boolean);

    tracks = [...tracks, ...mapped];
    url = data.next || null;
  }
  return tracks;
}

// --- Obsługa Playlist (Tworzenie i Modyfikacja) ---

export async function createPlaylist(name, description = "", isPublic = false) {
  return await api("/me/playlists", {
    method: "POST",
    body: JSON.stringify({ name, description, public: isPublic }),
  });
}

export async function addTracksToPlaylist(playlistId, trackUris) {
  for (let i = 0; i < trackUris.length; i += 100) {
    await api(`/playlists/${playlistId}/items`, {
      method: "POST",
      body: JSON.stringify({ uris: trackUris.slice(i, i + 100) }),
    });
  }
}

export async function removeTracksFromPlaylist(playlistId, trackUris) {
  await api(`/playlists/${playlistId}/items`, {
    method: "DELETE",
    body: JSON.stringify({ items: trackUris.map((uri) => ({ uri })) }),
  });
}

// --- Obsługa Odtwarzacza ---

export async function playTrackOnSpotify(trackUri, contextUri = null, deviceId = null) {
  const body = contextUri 
    ? { context_uri: contextUri, offset: { uri: trackUri } } 
    : { uris: [trackUri] };
    
  // Doklejamy device_id bezpośrednio do URL, jeśli jest dostępne
  const url = deviceId ? `/me/player/play?device_id=${deviceId}` : "/me/player/play";
    
  await api(url, { 
    method: "PUT", 
    body: JSON.stringify(body) 
  });
}

export async function pauseSpotify() { 
  await api("/me/player/pause", { method: "PUT" }); 
}

export async function resumeSpotify() { 
  await api("/me/player/play", { method: "PUT" }); 
}

export async function nextSpotify() { 
  await api("/me/player/next", { method: "POST" }); 
}

export async function prevSpotify() { 
  await api("/me/player/previous", { method: "POST" }); 
}

export async function setVolumeSpotify(percent) { 
  await api(`/me/player/volume?volume_percent=${percent}`, { method: "PUT" }); 
}

export async function seekSpotify(positionMs) { 
  await api(`/me/player/seek?position_ms=${positionMs}`, { method: "PUT" }); 
}

export async function getPlaybackState() { 
  return await api("/me/player"); 
}

export async function transferPlayback(deviceId) {
  await api("/me/player", { 
    method: "PUT", 
    body: JSON.stringify({ device_ids: [deviceId], play: false }) 
  });
}

// --- Sesja i Helpery ---

export async function logout() { 
  localStorage.clear(); 
  window.location.reload(); 
}

export function isLoggedIn() { 
  return !!localStorage.getItem("spotify_token"); 
}

function msToMinSec(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
