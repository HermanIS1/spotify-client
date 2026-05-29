// --- CONFIG ---
const CLIENT_ID = "34699eb977fd4df6af54908a7b010eae";
const REDIRECT_URI = window.location.origin;
const BASE_URL = "https://api.spotify.com/v1";

const SCOPES = [
  "user-library-read",
  "playlist-read-private",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

// --- PKCE ---
function generateRandomString(len) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map((n) => chars[n % chars.length])
    .join("");
}

async function sha256(str) {
  const data = new TextEncoder().encode(str);
  return crypto.subtle.digest("SHA-256", data);
}

function base64encode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export async function login() {
  const verifier = generateRandomString(128);
  const challenge = base64encode(await sha256(verifier));

  localStorage.setItem("verifier", verifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });

  window.location = "https://accounts.spotify.com/authorize?" + params.toString();
}

export async function getTokenFromURL() {
  const code = new URLSearchParams(window.location.search).get("code");
  if (!code) return null;

  const verifier = localStorage.getItem("verifier");

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json();

  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);

  window.history.pushState({}, null, "/");

  return data.access_token;
}

export function getAccessToken() {
  return localStorage.getItem("access_token");
}

export async function spotifyFetch(endpoint) {
  const token = getAccessToken();
  if (!token) return null;

  const res = await fetch(BASE_URL + endpoint, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    console.warn("Token expired");
    return null;
  }

  return res.json();
}
