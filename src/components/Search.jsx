import { useState } from "react";
import { searchSpotify } from "../spotify";

export default function Search({ onSelectTrack }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const data = await searchSpotify(query, "track", 20);
      const tracks = data.tracks.items.map((track) => ({
        id: track.id,
        name: track.name,
        artist: track.artists.map((a) => a.name).join(", "),
        duration: msToMinSec(track.duration_ms),
        image: track.album.images[1]?.url || track.album.images[0]?.url,
        uri: track.uri,
      }));
      setResults(tracks);
    } catch (err) {
      console.error("Search error:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function msToMinSec(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = (totalSec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  return (
    <div style={{ padding: "16px", borderBottom: "var(--border2)" }}>
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs, artists..."
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "var(--bg2)",
            border: "var(--border2)",
            borderRadius: "4px",
            color: "var(--g)",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
          }}
        />
      </form>

      {loading && (
        <div style={{ color: "var(--g3)", fontSize: "12px", marginTop: "8px" }}>
          Searching...
        </div>
      )}

      {results.length > 0 && (
        <div
          style={{ marginTop: "12px", maxHeight: "300px", overflowY: "auto" }}
        >
          {results.map((track) => (
            <div
              key={track.id}
              onClick={() => onSelectTrack(track)}
              style={{
                padding: "8px",
                background: "var(--bg3)",
                marginBottom: "4px",
                borderRadius: "2px",
                cursor: "pointer",
                fontSize: "11px",
                color: "var(--g2)",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--g5)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--bg3)")
              }
            >
              <div style={{ fontWeight: "bold", color: "var(--g)" }}>
                {track.name}
              </div>
              <div>{track.artist}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
