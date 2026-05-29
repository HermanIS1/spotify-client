import { useState, useEffect, useRef } from "react";
import { searchSpotify } from "../spotify";

function mapSearchItem(item) {
  return {
    id: item.id,
    name: item.name,
    uri: item.uri,
    artist: item.artists?.map((a) => a.name).join(", ") || "—",
    duration: item.duration_ms
      ? `${Math.floor(item.duration_ms / 60000)}:${((item.duration_ms % 60000) / 1000).toFixed(0).padStart(2, "0")}`
      : "0:00",
    image: item.album?.images?.[0]?.url || "",
  };
}

export default function Search({ onPlayTrack, onAddTracks }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query?.trim()) {
      setResults([]);
      setSelected(new Set());
      setOffset(0);
      setHasMore(false);
      return;
    }

    debounceRef.current = setTimeout(() => runSearch(query, 0, false), 500);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  async function runSearch(q, searchOffset, append) {
    setLoading(true);
    try {
      const data = await searchSpotify(q, { limit: 10, offset: searchOffset });
      const items = (data?.tracks?.items || []).map(mapSearchItem);
      const total = data?.tracks?.total ?? 0;

      setResults((prev) => (append ? [...prev, ...items] : items));
      setOffset(searchOffset + items.length);
      setHasMore(searchOffset + items.length < total);
      if (!append) setSelected(new Set());
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(id, e) {
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(results.map((t) => t.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function handleBulkAdd() {
    const tracks = results.filter((t) => selected.has(t.id));
    if (tracks.length) onAddTracks(tracks);
  }

  const selectedCount = selected.size;

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
            className="input search-input"
            placeholder="Szukaj utworów..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>

        {results.length > 0 && (
          <>
            <div className="action-bar">
              <button type="button" className="btn btn-ghost btn-sm" onClick={selectAll}>
                Wszystkie
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={clearSelection}
                disabled={!selectedCount}
              >
                Wyczyść
              </button>
              {selectedCount > 0 && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleBulkAdd}
                >
                  + {selectedCount} do playlisty
                </button>
              )}
            </div>

            <div className="search-results">
              {results.map((track) => {
                const isSelected = selected.has(track.id);
                return (
                  <div
                    key={track.id}
                    className={`search-result-row ${isSelected ? "selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onPlayTrack(track)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onPlayTrack(track);
                      }
                    }}
                  >
                    <button
                      type="button"
                      className={`track-check ${isSelected ? "checked" : ""}`}
                      onClick={(e) => toggleSelect(track.id, e)}
                      aria-label="Zaznacz"
                    >
                      {isSelected && <i className="ti ti-check" />}
                    </button>

                    {track.image ? (
                      <div className="track-art" style={{ width: 36, height: 36 }}>
                        <img src={track.image} alt="" />
                      </div>
                    ) : (
                      <div className="track-art track-art--icon">
                        <i className="ti ti-music" />
                      </div>
                    )}

                    <div className="search-result-info">
                      <div className="search-result-title">{track.name}</div>
                      <div className="search-result-artist">{track.artist}</div>
                    </div>

                    <button
                      type="button"
                      className="btn-icon"
                      title="Dodaj do playlisty"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddTracks([track]);
                      }}
                    >
                      <i className="ti ti-playlist-add" />
                    </button>
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: "100%", marginTop: 8 }}
                disabled={loading}
                onClick={() => runSearch(query, offset, true)}
              >
                {loading ? "..." : "Więcej wyników"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
