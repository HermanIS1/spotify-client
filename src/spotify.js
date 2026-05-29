const CLIENT_ID = "34699eb977fd4df6af54908a7b010eae";
const REDIRECT_URI = window.location.origin + "/callback";

const SCOPES = [
  "user-library-read", "playlist-read-private", "playlist-read-collaborative",
  "playlist-modify-public", "playlist-modify-private", "streaming",
  "user-read-email", "user-read-private", "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

// --- Pomocnicze funkcje autoryzacji ---
function generateRandomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(length))).map((b) => chars[b % chars.length]).join("");
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export async function redirectToLogin() {
  const verifier = generateRandomString(128);
  const challenge = await generateCodeChallenge(verifier);
  localStorage.setItem("spotify_verifier", verifier);
  const params = new URLSearchParams({
    response_type: "code", client_id: CLIENT_ID, scope: SCOPES,
    redirect_uri: REDIRECT_URI, code_challenge_method: "S256",
    code_challenge: challenge, show_dialog: "true",
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

  // POPRAWKA URL: używamy właściwego adresu API Spotify
  const baseUrl = "https://api.spotify.com/v1";
  const fullUrl = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;

  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 204 || res.status === 202) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`❌ API error ${res.status}:`, data);
    throw new Error(`Spotify API error: ${res.status}`);
  }
  return data;
}

// --- Funkcje wyszukiwania i inne ---
export async function searchSpotify(query, type = "track", limit = 20) {
  if (!query || query.trim().length === 0) return { tracks: { items: [] } };
  
  const params = new URLSearchParams({
    q: query.substring(0, 100),
    type: type,
    limit: Math.min(Math.max(limit, 1), 50).toString(),
  });

  return await api(`/search?${params.toString()}`);
}

// Reszta Twoich funkcji (getLikedTracks, getPlaylists itp.) zostaje bez zmian, 
// ale pamiętaj, aby w getLikedTracks i getPlaylistTracks poprawić zamianę URL:
// url = data.next ? data.next.replace("https://api.spotify.com/v1", "") : null;
