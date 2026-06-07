const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const BASE_URL = "https://api.spotify.com/v1";

export function getRedirectUri() {
  return `${window.location.origin}/callback`;
}

const SCOPES = [
  "user-library-read",
  "user-library-modify",
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
  const verifier = generateRandomString(128);
  const challenge = await generateCodeChallenge(verifier);
  localStorage.setItem("spotify_verifier", verifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: getRedirectUri(),
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
      redirect_uri: getRedirectUri(),
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
    return { ok: true, data };
  }

  const message =
    data.error === "access_denied"
      ? "To konto nie ma dostępu do aplikacji. W Spotify Developer Dashboard → User Management dodaj dokładną nazwę użytkownika Spotify (nie e-mail) i upewnij się, że ma konto Premium."
      : data.error_description ||
        data.error ||
        "Nie udało się zalogować — sprawdź Client ID i Redirect URI w panelu Spotify.";
  return { ok: false, error: message };
}

/** OAuth redirect query: ?code=… or ?error=… */
export function parseAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  if (error) {
    const description = params.get("error_description");
    const message =
      error === "access_denied"
        ? "Logowanie anulowane lub konto nie jest na liście użytkowników aplikacji (Development Mode)."
        : description || error;
    return { ok: false, error: message };
  }
  const code = params.get("code");
  if (code) return { ok: true, code };
  return null;
}

export async function getValidAccessToken() {
  await ensureValidToken();
  return localStorage.getItem("spotify_token");
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

async function api(endpoint, options = {}) {
  await ensureValidToken();

  const token = localStorage.getItem("spotify_token");
  if (!token) throw new Error("No token available");

  const fullUrl = endpoint.startsWith("http")
    ? endpoint
    : `${BASE_URL}${endpoint}`;
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

function msToMinSec(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function mapApiTrack(track) {
  if (!track?.id) return null;
  return {
    id: track.id,
    name: track.name,
    uri: track.uri,
    artist: track.artists?.map((a) => a.name).join(", ") || "—",
    duration: msToMinSec(track.duration_ms),
    image: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url,
  };
}

export async function searchSpotify(
  query,
  { type = "track", limit = 10, offset = 0 } = {},
) {
  if (!query || typeof query !== "string" || query.trim() === "") {
    return { tracks: { items: [], total: 0 } };
  }

  const params = new URLSearchParams({
    q: query.trim(),
    type,
    limit: String(Math.min(Math.max(limit, 1), 10)),
    offset: String(Math.max(offset, 0)),
    market: "PL",
  });

  return await api(`/search?${params.toString()}`);
}

export async function fetchLikedPage(url = "/me/tracks?limit=50") {
  const data = await api(url);
  const tracks = (data?.items || [])
    .map(({ track }) => mapApiTrack(track))
    .filter(Boolean);
  return { tracks, total: data?.total ?? 0, next: data?.next || null };
}

export async function getLikedTracks({
  maxTracks = 50,
  onProgress,
  startUrl,
} = {}) {
  let url = startUrl || "/me/tracks?limit=50";
  let collected = [];
  let total = 0;
  let lastNext = null;

  while (url && collected.length < maxTracks) {
    const page = await fetchLikedPage(url);
    total = page.total;
    lastNext = page.next;
    collected = [...collected, ...page.tracks];
    onProgress?.(collected.length, total);
    url = page.next && collected.length < maxTracks ? page.next : null;
  }

  const tracks = collected.slice(0, maxTracks);
  return {
    tracks,
    total,
    hasMore: Boolean(lastNext) || total > tracks.length,
    nextUrl: lastNext,
  };
}

export async function getTrack(trackId) {
  const data = await api(`/tracks/${trackId}`);
  if (!data?.id) return null;
  return {
    id: data.id,
    name: data.name,
    uri: data.uri,
    popularity: data.popularity ?? 0,
    durationMs: data.duration_ms,
    artist: data.artists?.map((a) => a.name).join(", ") || "—",
    artistId: data.artists?.[0]?.id || null,
    artistIds: (data.artists || []).map((a) => a.id).filter(Boolean),
    album: {
      id: data.album?.id,
      name: data.album?.name || "—",
      image: data.album?.images?.[0]?.url || data.album?.images?.[1]?.url,
      releaseDate: data.album?.release_date || "",
    },
    image: data.album?.images?.[1]?.url || data.album?.images?.[0]?.url,
    duration: msToMinSec(data.duration_ms),
  };
}

export async function getArtist(artistId) {
  const data = await api(`/artists/${artistId}`);
  if (!data?.id) return null;
  return {
    id: data.id,
    name: data.name,
    uri: data.uri,
    genres: data.genres || [],
    followers: data.followers?.total ?? 0,
    popularity: data.popularity ?? 0,
    image: data.images?.[0]?.url || data.images?.[1]?.url,
    spotifyUrl: data.external_urls?.spotify,
  };
}

export async function getArtistTopTracks(artistId, market = "PL") {
  const data = await api(`/artists/${artistId}/top-tracks?market=${market}`);
  return (data?.tracks || []).map((t) => mapApiTrack(t)).filter(Boolean);
}

export async function searchArtist(query) {
  const primary = query?.split(",")[0]?.trim();
  if (!primary) return null;

  const data = await searchSpotify(primary, { type: "artist", limit: 5 });
  const items = data?.artists?.items || [];
  if (!items.length) return null;

  const normalized = primary.toLowerCase();
  const match =
    items.find((a) => a.name?.toLowerCase() === normalized) ||
    items.find((a) => a.name?.toLowerCase().includes(normalized)) ||
    items[0];

  return getArtist(match.id);
}

export async function getArtistTopTracksSafe(artistId) {
  const markets = ["PL", "US", "GB", "DE", "SE"];
  for (const market of markets) {
    try {
      const tracks = await getArtistTopTracks(artistId, market);
      if (tracks.length) return tracks;
    } catch {
      /* try next market */
    }
  }
  try {
    return await getArtistTopTracks(artistId, "US");
  } catch {
    return [];
  }
}

export async function loadArtistProfile({ artistId, artistName }) {
  let artist = null;

  if (artistId) {
    try {
      artist = await getArtist(artistId);
    } catch (err) {
      console.warn("getArtist failed:", err);
    }
  }

  if (!artist && artistName) {
    try {
      artist = await searchArtist(artistName);
    } catch (err) {
      console.warn("searchArtist failed:", err);
    }
  }

  const resolvedId = artist?.id || artistId || null;
  const topTracks = resolvedId ? await getArtistTopTracksSafe(resolvedId) : [];

  if (!artist && artistName) {
    artist = {
      id: resolvedId,
      name: artistName.split(",")[0].trim(),
      uri: resolvedId ? `spotify:artist:${resolvedId}` : null,
      genres: [],
      followers: 0,
      popularity: 0,
      image: null,
      spotifyUrl: resolvedId
        ? `https://open.spotify.com/artist/${resolvedId}`
        : null,
      isFallback: true,
    };
  }

  return { artist, topTracks };
}

export async function getCurrentUser() {
  const data = await api("/me");
  if (!data?.id) return null;
  return {
    id: data.id,
    displayName: data.display_name || "Spotify User",
    imageUrl: data.images?.[0]?.url || data.images?.at(-1)?.url || null,
  };
}

export async function getPlaylists() {
  const data = await api("/me/playlists?limit=50");
  if (!data?.items) return [];

  return data.items.filter(Boolean).map((pl) => ({
    id: pl.id,
    name: pl.name,
    uri: pl.uri,
    image: pl.images?.[0]?.url,
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
      .map((entry) => mapApiTrack(playlistEntryTrack(entry)))
      .filter(Boolean);

    tracks = [...tracks, ...mapped];
    url = data.next || null;
  }
  return tracks;
}

export async function createPlaylist(name, description = "", isPublic = false) {
  return await api("/me/playlists", {
    method: "POST",
    body: JSON.stringify({ name, description, public: isPublic }),
  });
}

export async function updatePlaylistDetails(
  playlistId,
  { name, description, public: isPublic },
) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (description !== undefined) body.description = description;
  if (isPublic !== undefined) body.public = isPublic;
  return await api(`/playlists/${playlistId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function unfollowPlaylist(playlistId) {
  await api(`/playlists/${playlistId}/followers`, { method: "DELETE" });
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

export async function saveTracksToLibrary(uris) {
  if (!uris.length) return;
  await api("/me/library", {
    method: "PUT",
    body: JSON.stringify({ uris }),
  });
}

export async function removeTracksFromLibrary(uris) {
  if (!uris.length) return;
  await api("/me/library", {
    method: "DELETE",
    body: JSON.stringify({ uris }),
  });
}

function playEndpoint(deviceId) {
  if (!deviceId) {
    throw new Error(
      "Odtwarzacz nie jest gotowy — poczekaj, aż pojawi się „Gotowy do odtwarzania”.",
    );
  }
  return `/me/player/play?device_id=${deviceId}`;
}

export async function playTrackOnSpotify(
  trackUri,
  contextUri = null,
  deviceId = null,
) {
  const body = contextUri
    ? { context_uri: contextUri, offset: { uri: trackUri } }
    : { uris: [trackUri] };

  await api(playEndpoint(deviceId), {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function playContext(
  contextUri,
  deviceId = null,
  offsetUri = null,
) {
  const body = offsetUri
    ? { context_uri: contextUri, offset: { uri: offsetUri } }
    : { context_uri: contextUri };
  await api(playEndpoint(deviceId), {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function pauseSpotify(deviceId = null) {
  const q = deviceId ? `?device_id=${deviceId}` : "";
  await api(`/me/player/pause${q}`, { method: "PUT" });
}

export async function resumeSpotify(deviceId = null) {
  const q = deviceId ? `?device_id=${deviceId}` : "";
  await api(`/me/player/play${q}`, { method: "PUT" });
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

export async function setPlayerShuffle(state) {
  await api(`/me/player/shuffle?state=${state}`, { method: "PUT" });
}

export async function setPlayerRepeat(state) {
  await api(`/me/player/repeat?state=${state}`, { method: "PUT" });
}

export async function getPlaybackState() {
  return await api("/me/player");
}

export async function transferPlayback(deviceId) {
  await api("/me/player", {
    method: "PUT",
    body: JSON.stringify({ device_ids: [deviceId], play: false }),
  });
}

export async function logout({ spotifyLogout = false } = {}) {
  localStorage.clear();
  if (spotifyLogout) {
    const returnTo = encodeURIComponent(window.location.origin);
    window.location.href = `https://accounts.spotify.com/logout?continue=${returnTo}`;
    return;
  }
  window.location.reload();
}

export function isLoggedIn() {
  return !!localStorage.getItem("spotify_token");
}
