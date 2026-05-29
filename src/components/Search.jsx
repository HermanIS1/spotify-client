import { useState, useEffect, useRef } from "react";
import { searchSpotify } from "../spotify";

export default function Search({ onPlayTrack, onAddToPlaylist }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query || query.trim().length === 0) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchSpotify(query);
        if (data?.tracks?.items) {
          const mapped = data.tracks.items.map((item) => ({
            id: item.id,
            name: item.name,
            uri: item.uri,
            artist: item.artists
              ? item.artists.map((a) => a.name).join(", ")
              : "Nieznany artysta",
            duration: item.duration_ms
              ? `${Math.floor(item.duration_ms / 60000)}:${((item.duration_ms % 60000) / 1000).toFixed(0).padStart(2, "0")}`
              : "0:00",
            image: item.album?.images?.[0]?.url || "",
          }));
          setResults(mapped);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error("Search error:", err);
      }
    }, 500);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <div className="panel" style={{ borderBottom: "var(--border2)", flexShrink: 0 }}>
      <div className="panel-header">SEARCH</div>
      <div style={{ padding: "0 14px 14px" }}>
        <div style={{ position: "relative" }}>
          <i
            className="ti ti-search"
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--g3)",
              fontSize: 14,
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            className="input"
            placeholder="Szukaj utworów..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>

        {results.length > 0 && (
          <div
            style={{
              marginTop: 10,
              maxHeight: 220,
              overflowY: "auto",
              border: "var(--border)",
              borderRadius: "var(--radius-lg)",
              background: "rgba(6, 14, 8, 0.6)",
            }}
          >
            {results.map((track) => (
              <div
                key={track.id}
                className="search-result-row list-item"
                role="button"
                tabIndex={0}
                title="Kliknij, aby odtworzyć"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderBottom: "var(--border)",
                  cursor: "pointer",
                  borderLeft: "2px solid transparent",
                }}
                onClick={() => onPlayTrack(track)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onPlayTrack(track);
                  }
                }}
              >
                {track.image ? (
                  <div className="track-art" style={{ width: 36, height: 36 }}>
                    <img src={track.image} alt="" />
                  </div>
                ) : (
                  <div
                    className="track-art"
                    style={{
                      width: 36,
                      height: 36,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--g3)",
                    }}
                  >
                    <i className="ti ti-music" />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--g)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {track.name}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--g3)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {track.artist}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-icon"
                  title="Dodaj do playlisty"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToPlaylist(track);
                  }}
                >
                  <i className="ti ti-playlist-add" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
