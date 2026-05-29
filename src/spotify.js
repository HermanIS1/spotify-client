const CLIENT_ID = "34699eb977fd4df6af54908a7b010eae"; // ← Twój Client ID
const REDIRECT_URI = window.location.origin + "/callback";
const SCOPES = [
  "user-library-read",
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-public", // ← Keep these
  "playlist-modify-private", // ← Keep these
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

// ─── PKCE Auth Flow ───────────────────────────────────────────────────────────
// Bezpieczniejszy niż Implicit Flow, nie wymaga backendu

function generateRandomString(length) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
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
    show_dialog: "true", // Wymusza pokazanie ekranu zgód
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
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
    localStorage.setItem(
      "spotify_token_expiry",
      Date.now() + data.expires_in * 1000,
    );
  }
  return data;
}

async function refreshToken() {
  const refresh = localStorage.getItem("spotify_refresh_token");
  if (!refresh) {
    logout();
    return null;
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh,
      client_id: CLIENT_ID,
    }),
  });

  if (!res.ok) {
    // token nieważny — wyloguj i zacznij od nowa
    logout();
    window.location.href = "/";
    return null;
  }

  const data = await res.json();
  if (data.access_token) {
    localStorage.setItem("spotify_token", data.access_token);
    localStorage.setItem(
      "spotify_token_expiry",
      Date.now() + data.expires_in * 1000,
    );
    if (data.refresh_token) {
      localStorage.setItem("spotify_refresh_token", data.refresh_token);
    }
  }
  return data.access_token;
}

async function getToken() {
  const expiry = parseInt(localStorage.getItem("spotify_token_expiry") || "0");
  if (Date.now() > expiry - 60_000) {
    return await refreshToken();
  }
  return localStorage.getItem("spotify_token");
}

export function isLoggedIn() {
  return !!localStorage.getItem("spotify_token");
}

export function logout() {
  localStorage.removeItem("spotify_token");
  localStorage.removeItem("spotify_refresh_token");
  localStorage.removeItem("spotify_token_expiry");
  localStorage.removeItem("spotify_verifier");
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function api(endpoint, options = {}) {
  const token = await getToken();

  const res = await fetch(
    endpoint.startsWith("http")
      ? endpoint
      : `https://api.spotify.com/v1${endpoint}`, // zostawiam Twój bazowy URL
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    },
  );

  // Jeśli API zwraca 204 (No Content) lub 202 (Accepted), nie ma czego parsować
  if (res.status === 204 || res.status === 202) return null;

  // Pobieramy odpowiedź jako czysty tekst zamiast wymuszać JSON
  const text = await res.text();

  // Jeśli tekst jest pusty, zwracamy null, w przeciwnym razie parsujemy JSON
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.warn("API nie zwróciło poprawnego JSONa:", text);
    }
  }

  if (!res.ok) {
    if (res.status === 429) {
      console.error("RATE LIMIT SPOTIFY! Musisz odczekać parę minut.");
    } else {
      console.error("Spotify API error:", res.status, data);
    }
    throw new Error(`Spotify API error: ${res.status}`);
  }

  return data;
}

// ─── Dane ─────────────────────────────────────────────────────────────────────

// Polubione utwory (stronicowane, pobieramy wszystkie)
export async function getLikedTracks() {
  let tracks = [];
  let url = "/me/tracks?limit=50";

  while (url) {
    const data = await api(url);
    const mapped = data.items.map(({ track }) => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      duration: msToMinSec(track.duration_ms),
      image: track.album.images[1]?.url || track.album.images[0]?.url,
      uri: track.uri,
    }));
    tracks = [...tracks, ...mapped];

    // Spotify zwraca pełny URL następnej strony lub null
    url = data.next
      ? data.next.replace("https://api.spotify.com/v1", "")
      : null;
  }

  return tracks;
}

// Lista playlist użytkownika
export async function getPlaylists() {
  const data = await api("/me/playlists?limit=50");
  return data.items
    .filter((pl) => pl !== null)
    .map((pl) => ({
      id: pl.id,
      name: pl.name,
      icon: "ti-playlist",
      image: pl.images?.[0]?.url,
      total: pl.tracks?.total ?? 0,
      uri: pl.uri,
    }));
}

// Tracki konkretnej playlisty (NOWY ENDPOINT /items)
export async function getPlaylistTracks(playlistId) {
  let tracks = [];
  let url = `/playlists/${playlistId}/items?limit=100`;

  while (url) {
    const data = await api(url);
    const mapped = data.items
      .filter((el) => el.item && el.item.id) // ZMIANA: szukamy 'item' zamiast 'track'
      .map(({ item }) => ({
        // ZMIANA: wyciągamy 'item' zamiast 'track'
        id: item.id,
        name: item.name,
        artist: item.artists.map((a) => a.name).join(", "),
        duration: msToMinSec(item.duration_ms),
        image: item.album.images[1]?.url || item.album.images[0]?.url,
        uri: item.uri,
      }));
    tracks = [...tracks, ...mapped];
    url = data.next
      ? data.next.replace("https://api.spotify.com/v1", "")
      : null;
  }

  return tracks;
}

// ─── Odtwarzanie (Spotify Connect) ───────────────────────────────────────────
// Wymaga Spotify Premium + aktywne urządzenie

export async function playTrackOnSpotify(trackUri, contextUri = null) {
  // contextUri = uri playlisty (żeby Spotify wiedział skąd lecimy)
  const body = contextUri
    ? { context_uri: contextUri, offset: { uri: trackUri } }
    : { uris: [trackUri] };

  await api("/me/player/play", {
    method: "PUT",
    body: JSON.stringify(body),
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

// Stan odtwarzacza (do synchronizacji UI z prawdziwym stanem)
export async function getPlaybackState() {
  return await api("/me/player");
}

//Utils

function msToMinSec(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Przekazanie odtwarzania do Web Playback SDK
export async function transferPlayback(deviceId) {
  await api("/me/player", {
    method: "PUT",
    body: JSON.stringify({
      device_ids: [deviceId],
      play: false, // false zapobiega automatycznemu puszczeniu muzyki przy starcie
    }),
  });
}

// Search for tracks, playlists, or artists
export async function searchSpotify(query, type = "track", limit = 20) {
  const params = new URLSearchParams({
    q: query,
    type: type, // "track", "playlist", "artist", or combination: "track,playlist"
    limit: limit,
  });

  return await api(`/search?${params}`);
}

// Create a new playlist
export async function createPlaylist(name, description = "", isPublic = false) {
  const data = await api("/me", { method: "GET" });
  const userId = data.id;

  return await api(`/users/${userId}/playlists`, {
    method: "POST",
    body: JSON.stringify({
      name: name,
      description: description,
      public: isPublic,
    }),
  });
}

// Add tracks to a playlist
export async function addTracksToPlaylist(playlistId, trackUris) {
  // Spotify API accepts max 100 tracks per request
  const chunks = [];
  for (let i = 0; i < trackUris.length; i += 100) {
    chunks.push(trackUris.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    await api(`/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: JSON.stringify({ uris: chunk }),
    });
  }
}

// Remove tracks from playlist
export async function removeTracksFromPlaylist(playlistId, trackUris) {
  await api(`/playlists/${playlistId}/tracks`, {
    method: "DELETE",
    body: JSON.stringify({ uris: trackUris }),
  });
}
