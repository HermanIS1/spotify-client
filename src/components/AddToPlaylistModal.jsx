export default function AddToPlaylistModal({
  track,
  playlists,
  loading,
  onSelect,
  onClose,
}) {
  if (!track) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="panel-header" style={{ padding: 0 }}>
            ADD TO PLAYLIST
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 12,
            }}
          >
            {track.image && (
              <div className="track-art">
                <img src={track.image} alt="" />
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div
                className="title-display"
                style={{ fontSize: 13, marginBottom: 4 }}
              >
                {track.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--g3)" }}>
                {track.artist}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-body">
          {loading ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "var(--g3)",
                fontSize: 12,
              }}
            >
              Dodawanie<span className="cursor">█</span>
            </div>
          ) : playlists.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "var(--g3)",
                fontSize: 12,
              }}
            >
              Brak playlist — utwórz nową poniżej
            </div>
          ) : (
            playlists.map((pl) => (
              <button
                key={pl.id}
                type="button"
                className="playlist-pick"
                onClick={() => onSelect(pl.id)}
              >
                {pl.image ? (
                  <img src={pl.image} alt="" />
                ) : (
                  <div
                    className="track-art"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <i className="ti ti-playlist" style={{ color: "var(--g3)" }} />
                  </div>
                )}
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {pl.name}
                </span>
                <i className="ti ti-plus" style={{ color: "var(--g3)", fontSize: 14 }} />
              </button>
            ))
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Anuluj
          </button>
        </div>
      </div>
    </div>
  );
}
