export default function AddToPlaylistModal({
  tracks,
  playlists,
  loading,
  onSelect,
  onClose,
}) {
  if (!tracks?.length) return null;

  const single = tracks.length === 1 ? tracks[0] : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="panel-header" style={{ padding: 0 }}>
            {tracks.length === 1 ? "ADD TO PLAYLIST" : `ADD ${tracks.length} TRACKS`}
          </div>
          {single ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 12,
              }}
            >
              {single.image && (
                <div className="track-art">
                  <img src={single.image} alt="" />
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div className="title-display" style={{ fontSize: 13, marginBottom: 4 }}>
                  {single.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--g3)" }}>{single.artist}</div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 10, fontSize: 11, color: "var(--g3)" }}>
              {tracks.slice(0, 3).map((t) => t.name).join(" · ")}
              {tracks.length > 3 && ` +${tracks.length - 3}`}
            </div>
          )}
        </div>

        <div className="modal-body">
          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--g3)", fontSize: 12 }}>
              Dodawanie<span className="cursor">█</span>
            </div>
          ) : playlists.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--g3)", fontSize: 12 }}>
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
