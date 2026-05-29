import { useState, useEffect, useRef } from "react";
import { searchSpotify } from "../spotify";

export default function Search({ onSelectTrack }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const debounceRef = useRef(null);

  useEffect(() => {
    // 1. Zatrzymujemy poprzednie zapytanie
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // 2. Jeśli pole jest puste lub ma tylko spacje - czyścimy wyniki i nie pytamy API
    if (!query || query.trim().length === 0) {
      setResults([]);
      return;
    }

    // 3. Hamulec (500ms opóźnienia) chroniący przed błędami 400 i 429
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchSpotify(query);
        
        // Zabezpieczenie przed wywaleniem apki, jeśli Spotify zwróci nietypowy obiekt
        if (data && data.tracks && data.tracks.items) {
          const mapped = data.tracks.items.map(item => ({
            id: item.id,
            name: item.name,
            uri: item.uri,
            artist: item.artists ? item.artists.map(a => a.name).join(", ") : "Nieznany artysta",
            duration: item.duration_ms 
              ? `${Math.floor(item.duration_ms / 60000)}:${((item.duration_ms % 60000) / 1000).toFixed(0).padStart(2, '0')}` 
              : "0:00",
            image: item.album?.images?.[0]?.url || ""
          }));
          setResults(mapped);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error("🚨 Błąd w komponencie Search:", err);
      }
    }, 500);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <div style={{ padding: "16px", background: "var(--bg2)", borderBottom: "var(--border2)" }}>
      <input
        type="text"
        placeholder="Szukaj utworów..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: "100%",
          padding: "8px 12px",
          background: "var(--bg3)",
          border: "1px solid var(--g3)",
          color: "var(--g)",
          fontFamily: "var(--font-mono)",
          borderRadius: "4px"
        }}
      />
      
      {results.length > 0 && (
        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {results.map(track => (
            <div 
              key={track.id} 
              onClick={() => onSelectTrack(track)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "8px",
                cursor: "pointer",
                transition: "background 0.2s",
                borderRadius: "4px"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg3)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              {track.image && (
                <img src={track.image} alt="Okładka" style={{ width: "40px", height: "40px", borderRadius: "4px" }} />
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "14px", color: "var(--g)" }}>{track.name}</span>
                <span style={{ fontSize: "12px", color: "var(--g3)" }}>{track.artist}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
