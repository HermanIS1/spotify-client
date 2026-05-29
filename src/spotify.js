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

async function api(endpoint, options = {}) {
  const token = localStorage.getItem("spotify_token");
  if (!token) throw new Error("No token");

  const fullUrl = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;
  const headers = { Authorization: `Bearer ${token}` };

  if (options.method && ["POST", "PUT", "DELETE"].includes(options.method)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(fullUrl, { ...options, headers: { ...headers, ...options.headers } });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Spotify API error ${res.status}: ${data.error?.message || 'Unknown'}`);
  return data;
}

export async function searchSpotify(query, type = "track", limit = 20) {
  if (!query || query.trim() === "") return { tracks: { items: [] } };
  const safeQuery = encodeURIComponent(query.trim().substring(0, 100));
  const safeLimit = parseInt(limit, 10) || 20;
  
  // Usunięto &market=PL - to jest najczęstsza przyczyna 400 u użytkowników zagranicznych
  return await api(`/search?q=${safeQuery}&type=${type}&limit=${safeLimit}`);
}

export async function getLikedTracks() {
  let tracks = [];
  let url = "/me/tracks?limit=50";
  while (url) {
    const data = await api(url);
    if (!data?.items) break;
    tracks.push(...data.items.map(({ track }) => ({
      id: track.id, name: track.name, uri: track.uri,
      artist: track.artists.map(a => a.name).join(", "),
      duration: `${Math.floor(track.duration_ms / 60000)}:${((track.duration_ms % 60000) / 1000).toFixed(0).padStart(2, '0')}`,
      image: track.album?.images?.[0]?.url
    })));
    url = data.next;
  }
  return tracks;
}

export async function getPlaylistTracks(id) {
  let tracks = [];
  let url = `/playlists/${id}/tracks?limit=100`;
  while (url) {
    try {
      const data = await api(url);
      if (!data?.items) break;
      tracks.push(...data.items.filter(i => i.track).map(({ track }) => ({
        id: track.id, name: track.name, uri: track.uri,
        artist: track.artists.map(a => a.name).join(", "),
        duration: `${Math.floor(track.duration_ms / 60000)}:${((track.duration_ms % 60000) / 1000).toFixed(0).padStart(2, '0')}`,
        image: track.album?.images?.[0]?.url
      })));
      url = data.next;
    } catch { break; }
  }
  return tracks;
}

export async function getPlaylists() {
  const data = await api("/me/playlists?limit=50");
  return data?.items?.map(pl => ({ id: pl.id, name: pl.name, uri: pl.uri, image: pl.images?.[0]?.url })) || [];
}

export async function playTrackOnSpotify(trackUri, contextUri, deviceId) {
  const url = deviceId ? `/me/player/play?device_id=${deviceId}` : "/me/player/play";
  await api(url, { method: "PUT", body: JSON.stringify(contextUri ? { context_uri: contextUri, offset: { uri: trackUri } } : { uris: [trackUri] }) });
}

export async function logout() { localStorage.clear(); window.location.reload(); }
export function isLoggedIn() { return !!localStorage.getItem("spotify_token"); }
// Dodaj pozostałe funkcje typu pauseSpotify, nextSpotify itp. tutaj w razie potrzeby.

function msToMinSec(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}


export { createPlaylist, addTracksToPlaylist, removeTracksFromPlaylist };
