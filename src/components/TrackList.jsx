function TrackArt({ src, alt }) {
  return (
    <div className="track-art">
      {src ? (
        <img
          src={src}
          alt={alt}
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--g3)",
          }}
        >
          <i className="ti ti-music" />
        </div>
      )}
    </div>
  );
}

export default function TrackList({
  playlist,
  currentTrackId,
  isPlaying,
  onPlay,
  onAddToPlaylist,
}) {
  if (!playlist) return null;

  return (
    <div
      className="app-main panel-glow"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--bg-glass)",
      }}
    >
      <div
        style={{
          padding: "20px 24px 16px",
          borderBottom: "var(--border)",
          flexShrink: 0,
          background:
            "linear-gradient(180deg, rgba(77, 187, 110, 0.06) 0%, transparent 100%)",
        }}
      >
        <div className="title-gothic glow-text" style={{ fontSize: 28, marginBottom: 6 }}>
          {playlist.name}
        </div>
        <div style={{ fontSize: 11, color: "var(--g3)", letterSpacing: "0.15em" }}>
          {playlist.tracks.length} TRACKS
          <span className="cursor" style={{ marginLeft: 4 }}>
            █
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {playlist.tracks.length === 0 ? (
          <div
            style={{
              padding: 48,
              textAlign: "center",
              color: "var(--g3)",
              fontSize: 12,
              letterSpacing: "0.1em",
            }}
          >
            BRAK UTWORÓW
          </div>
        ) : (
          playlist.tracks.map((track, i) => {
            const isActive = track.id === currentTrackId;
            return (
              <div
                key={`${track.id}-${i}`}
                className={`track-row ${isActive ? "active" : ""}`}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--g3)",
                    width: 22,
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                  onClick={() => onPlay(track, i)}
                >
                  {isActive && isPlaying ? (
                    <i className="ti ti-player-play" style={{ color: "var(--g-glow)" }} />
                  ) : (
                    <span style={{ opacity: isActive ? 1 : 0.6 }}>{i + 1}</span>
                  )}
                </div>

                <div onClick={() => onPlay(track, i)} style={{ flexShrink: 0 }}>
                  <TrackArt src={track.image} alt={track.name} />
                </div>

                <div
                  style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                  onClick={() => onPlay(track, i)}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color: isActive ? "var(--g-glow)" : "var(--g2)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {track.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--g3)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {track.artist}
                  </div>
                </div>

                <div style={{ fontSize: 11, color: "var(--g3)", flexShrink: 0 }}>
                  {track.duration}
                </div>

                {onAddToPlaylist && playlist.id !== "liked" && (
                  <button
                    type="button"
                    className="btn-icon"
                    title="Dodaj do innej playlisty"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToPlaylist(track);
                    }}
                  >
                    <i className="ti ti-playlist-add" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
