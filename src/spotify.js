const CLIENT_ID = "34699eb977fd4df6af54908a7b010eae";
const REDIRECT_URI = window.location.origin + "/callback";

console.log("🔧 Spotify Config:", { CLIENT_ID, REDIRECT_URI });

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
  console.log("🔐 Starting login flow...");
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

  const authUrl = `https://accounts.spotify.com/authorize?${params}`;
  console.log("🌐 Redirecting to:", authUrl);
  window.location.href = authUrl;
}

export async function exchangeCodeForToken(code) {
  console.log("💱 Exchanging code for token...");
  const verifier = localStorage.getItem("spotify_verifier");

  if (!verifier) {
    console.error("❌ No verifier found!");
    return;
  }

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
  console.log("📦 Token response:", data);

  if (data.access_token) {
    console.log("✅ Token saved successfully!");
    localStorage.setItem("spotify_token", data.access_token);
    localStorage.setItem("spotify_refresh_token", data.refresh_token);
    localStorage.setItem(
      "spotify_token_expiry",
      Date.now() + data.expires_in * 1000,
    );
  } else {
    console.error("❌ No token in response:", data);
  }
  return data;
}

async function refreshToken() {
  console.log("🔄 Refreshing token...");
  const refresh = localStorage.getItem("spotify_refresh_token");
  if (!refresh) {
    console.error("❌ No refresh token!");
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
    console.error("❌ Refresh failed!");
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
    console.log("✅ Token refreshed!");
  }
  return data.access_token;
}

async function getToken() {
  const expiry = parseInt(localStorage.getItem("spotify_token_expiry") || "0");
  if (Date.now() > expiry - 60_000) {
    console.log("⏰ Token expired, refreshing...");
    return await refreshToken();
  }
  const token = localStorage.getItem("spotify_token");
  if (!token) console.warn("⚠️ No token found!");
  return token;
}

export function isLoggedIn() {
  const logged = !!localStorage.getItem("spotify_token");
  console.log("🔍 isLoggedIn:", logged);
  return logged;
}

export function logout() {
  console.log("🚪 Logging out...");
  localStorage.removeItem("spotify_token");
  localStorage.removeItem("spotify_refresh_token");
  localStorage.removeItem("spotify_token_expiry");
  localStorage.removeItem("spotify_verifier");
}

async function api(endpoint, options = {}) {
  const token = await getToken();

  if (!token) {
    console.error("❌ API call without token!");
    throw new Error("No token available");
  }

  const fullUrl = endpoint.startsWith("http")
    ? endpoint
    : `https://api.spotify.com/v1${endpoint}`;

  console.log(`📡 API ${options.method || "GET"} ${fullUrl}`);

  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 204 || res.status === 202) return null;

  const text = await res.text();

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.warn("⚠️ Failed to parse JSON:", text);
    }
  }

  if (!res.ok) {
    console.error(`❌ API error ${res.status}:`, data);
    throw new Error(`Spotify API error: ${res.status}`);
  }

  console.log("✅ API success");
  return data;
}

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

    url = data.next
      ? data.next.replace("https://api.spotify.com/v1", "")
      : null;
  }

  return tracks;
}

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

export async function getPlaylistTracks(playlistId) {
  let tracks = [];
  let url = `/playlists/${playlistId}/items?limit=100`;

  while (url) {
    const data = await api(url);
    const mapped = data.items
      .filter((el) => el.item && el.item.id)
      .map(({ item }) => ({
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

export async function playTrackOnSpotify(trackUri, contextUri = null) {
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

export async function getPlaybackState() {
  return await api("/me/player");
}

function msToMinSec(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export async function transferPlayback(deviceId) {
  await api("/me/player", {
    method: "PUT",
    body: JSON.stringify({
      device_ids: [deviceId],
      play: false,
    }),
  });
}
export async function searchSpotify(query, type = "track", limit = 20) {
  // 1. Ogranicz długość zapytania do 100 znaków (zgodnie z limitem API)
  const safeQuery = query.substring(0, 100);

  const params = new URLSearchParams({
    q: safeQuery,
    type: type,
    limit: limit.toString(),
  });

  return await api(`/search?${params.toString()}`);
}

export async function addTracksToPlaylist(playlistId, trackUris) {
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

export async function removeTracksFromPlaylist(playlistId, trackUris) {
  await api(`/playlists/${playlistId}/tracks`, {
    method: "DELETE",
    body: JSON.stringify({ uris: trackUris }),
  });
}
