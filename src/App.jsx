import { useEffect, useState } from "react";
import {
  login,
  getTokenFromURL,
  getAccessToken,
  spotifyFetch,
} from "./spotify";

export default function App() {
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState([]);

  useEffect(() => {
    if (!getAccessToken()) {
      getTokenFromURL();
    }
  }, []);

  async function search() {
    if (!query) return;

    const data = await spotifyFetch(
      `/search?q=${encodeURIComponent(query)}&type=track&limit=50&market=PL`
    );

    setTracks(data?.tracks?.items || []);
  }

  if (!getAccessToken()) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Lżejszy Spotify</h1>
        <button onClick={login}>Zaloguj się przez Spotify</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Wyszukiwarka</h2>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Szukaj utworów..."
        style={{ width: 300, padding: 6 }}
      />
      <button onClick={search} style={{ marginLeft: 10 }}>
        Szukaj
      </button>

      <ul>
        {tracks.map((t) => (
          <li key={t.id}>
            {t.name} — {t.artists.map((a) => a.name).join(", ")}
          </li>
        ))}
      </ul>
    </div>
  );
}
