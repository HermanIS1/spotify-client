const CLIENT_ID = "34699eb977fd4df6af54908a7b010eae";
const REDIRECT_URI = window.location.origin;
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

// --- Automatyczne odświeżanie tokenu ---
export async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("spotify_refresh_token");
  if (!refreshToken) {
    logout();
    return null;
  }

  try {
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
    if (data.access_token) {
      localStorage.setItem("spotify_token", data.access_token);
      if (data.refresh_token) {
        localStorage.setItem("spotify_refresh_token", data.refresh_token);
      }
      localStorage.setItem("spotify_token_expiry", Date.now() + data.expires_in * 1000);
      return data.access_token;
    } else {
      logout();
      return null;
    }
  } catch (err) {
    console.error("Błąd podczas odświeżania tokenu:", err);
    logout();
    return null;
  }
}

// --- Główna funkcja API ---
async function api(endpoint, options = {}) {
  let token = localStorage.getItem("spotify_token");
  const expiry = localStorage.getItem("spotify_token_expiry");

  if (!token) throw new Error("No token available");

  // Sprawdzamy, czy token wygasł (z marginesem 1 minuty zapasu)
  if (expiry && Date.now() > parseInt(expiry) - 60000) {
    console.log("🔄 Token wygasł, odświeżam w tle...");
    token = await refreshAccessToken();
    if (!token) throw new Error("Nie udało się odświeżyć tokenu.");
  }

  const fullUrl = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;
  
  const headers = {
    Authorization: `Bearer ${token}`
  };

  // Zabezpieczenie przed błędem 400 - Content-Type tylko tam, gdzie to konieczne
  if (options.method && ["POST", "PUT", "DELETE"].includes(options.method)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(fullUrl, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (res.status === 204 || res.status === 202) return null;
  
  // Jeśli z jakiegoś powodu wciąż dostajemy 401, wylogowujemy
  if (res.status === 401) {
    console.warn("Krytyczne wygaśnięcie sesji (401). Wymuszone wylogowanie.");
    logout();
    return null;
  }

  const data = await res.json().catch(() => ({}));
  
  if (!res.ok) {
    const errorMsg = data?.error?.message || "Brak detali z API";
    console.error(`🚨 Błąd API [${res.status}]:`, errorMsg);
    throw new Error(`Spotify API error ${res.status}: ${errorMsg}`);
  }
  
  return data;
}

// --- Wyszukiwarka ---
export async function searchSpotify(query, type = "track", limit = 20) {
  if (!query || typeof query !== 'string' || query.trim() === "") {
    return { tracks: { items: [] } };
  }
  
  const safeQuery = encodeURIComponent(query.trim());
  return await api(`/search?q=${safeQuery}&type=${type}&limit=${limit}&market=PL`);
}

// --- Biblioteka i Playlisty ---
export async function getLikedTracks() {
  let tracks = [];
  let url = "/me/tracks?limit=50";
  
  while (url) {
    try {
      const data = await api(url);
      if (!data || !data.items) break;
      
      const mapped = data.items.map(({ track }) => ({
        id: track.id,
        name: track.name,
        uri: track.uri,
        artist: track.artists.map((a) => a.name).join(", "),
        duration: msToMinSec(track.duration_ms),
        image: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url,
      }));
      tracks = [...tracks, ...mapped];
      url = data.next ? data.next : null;
    } catch (err) {
      console.warn("Błąd podczas pobierania polubionych:", err);
      break;
    }
  }
  return tracks;
}

export async function getPlaylists() {
  try {
    const data = await api("/me/playlists?limit=50");
    if (!data || !data.items) return [];

    return data.items.filter(Boolean).map((pl) => ({
      id: pl.id,
      name: pl.name,
      uri: pl.uri,
      image: pl.images?.[0]?.url,
      total: pl.tracks?.total ?? 0 
    }));
  } catch (err) {
    console.warn("Błąd podczas pobierania listy playlist:", err);
    return [];
  }
}

export async function getPlaylistTracks(playlistId) {
  let tracks = [];
  let url = `/playlists/${playlistId}/tracks?limit=100`;
  
  while (url) {
    try {
      const data = await api(url);
      if (!data || !data.items) break;

      const mapped = data.items.filter(el => el.track).map(({ track }) => ({
        id: track.id,
        name: track.name,
        uri: track.uri,
        artist: track.artists.map((a) => a.name).join(", "),
        duration: msToMinSec(track.duration_ms),
        image: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url,
      }));
      tracks = [...tracks, ...mapped];
      url = data.next ? data.next : null;
    } catch (err) {
      console.warn(`Zablokowany dostęp (403) do utworów playlisty ${playlistId}.`);
      break; 
    }
  }
  return tracks;
}

// --- Tworzenie i Modyfikacja Playlist ---
export async function createPlaylist(name, description = "") {
  const userRes = await api("/me");
  if (!userRes || !userRes.id) throw new Error("Brak ID użytkownika");
  
  return await api(`/users/${userRes.id}/playlists`, {
    method: "POST",
    body: JSON.stringify({ name, description, public: false }),
  });
}

export async function addTracksToPlaylist(playlistId, trackUris) {
  for (let i = 0; i < trackUris.length; i += 100) {
    await api(`/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: JSON.stringify({ uris: trackUris.slice(i, i + 100) }),
    });
  }
}

export async function removeTracksFromPlaylist(playlistId, trackUris) {
  await api(`/playlists/${playlistId}/tracks`, {
    method: "DELETE",
    body: JSON.stringify({ tracks: trackUris.map(uri => ({ uri })) }),
  });
}

// --- Odtwarzacz ---
export async function playTrackOnSpotify(trackUri, contextUri = null, deviceId = null) {
  const body = contextUri 
    ? { context_uri: contextUri, offset: { uri: trackUri } } 
    : { uris: [trackUri] };
    
  const url = deviceId ? `/me/player/play?device_id=${deviceId}` : "/me/player/play";
  await api(url, { method: "PUT", body: JSON.stringify(body) });
}

export async function pauseSpotify() { await api("/me/player/pause", { method: "PUT" }); }
export async function resumeSpotify() { await api("/me/player/play", { method: "PUT" }); }
export async function nextSpotify() { await api("/me/player/next", { method: "POST" }); }
export async function prevSpotify() { await api("/me/player/previous", { method: "POST" }); }
export async function setVolumeSpotify(percent) { await api(`/me/player/volume?volume_percent=${percent}`, { method: "PUT" }); }
export async function seekSpotify(positionMs) { await api(`/me/player/seek?position_ms=${positionMs}`, { method: "PUT" }); }
export async function getPlaybackState() { return await api("/me/player"); }
export async function transferPlayback(deviceId) {
  await api("/me/player", { method: "PUT", body: JSON.stringify({ device_ids: [deviceId], play: false }) });
}

// --- Sesja ---
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
