import { useState } from "react";

function TrackArt({ src, alt }) {
  return (
    <div className="track-art">
      {src ? (
        <img src={src} alt={alt} onError={(e) => { e.target.style.display = "none"; }} />
      ) : (
        <div className="track-art track-art--icon">
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
  onRemoveTrack,
  onPlayAll,
  onSaveTrack,
  onRemoveFromLiked,
  onRenamePlaylist,
  onDeletePlaylist,
  onCopyPlaylistLink,
  onLoadMore,
  hasMoreLiked,
  likedTotal,
  loadingMore,
  loadingTracks,
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  if (!playlist) return null;

  const isLiked = playlist.id === "liked";
  const isPlaylist = !isLiked;

  function startRename() {
    setNameDraft(playlist.name);
    setEditingName(true);
  }

  function submitRename() {
    if (nameDraft.trim() && onRenamePlaylist) {
      onRenamePlaylist(nameDraft.trim());
    }
    setEditingName(false);
  }

  return (
    <div className="app-main panel-glow track-list-main">
      <div className="track-list-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingName ? (
            <input
              className="input"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") setEditingName(false);
              }}
              autoFocus
              style={{ fontSize: 18, marginBottom: 6 }}
            />
          ) : (
            <div className="title-gothic glow-text track-list-title">{playlist.name}</div>
          )}
          <div className="track-list-meta">
            {playlist.tracks.length}
            {likedTotal ? ` / ${likedTotal}` : ""} TRACKS
            <span className="cursor"> █</span>
          </div>
        </div>

        <div className="track-list-actions">
          {playlist.tracks.length > 0 && onPlayAll && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onPlayAll} title="Odtwórz wszystko">
              <i className="ti ti-player-play" />
            </button>
          )}
          {isPlaylist && onCopyPlaylistLink && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onCopyPlaylistLink}
              title="Kopiuj link do playlisty"
            >
              <i className="ti ti-link" />
            </button>
          )}
          {isPlaylist && onRenamePlaylist && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={startRename} title="Zmień nazwę">
              <i className="ti ti-pencil" />
            </button>
          )}
          {isPlaylist && onDeletePlaylist && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-danger"
              onClick={onDeletePlaylist}
              title="Usuń playlistę"
            >
              <i className="ti ti-trash" />
            </button>
          )}
        </div>
      </div>

      <div className="track-list-scroll">
        {loadingTracks ? (
          <div className="track-list-loading">
            <span className="track-list-loading-spinner" aria-hidden="true" />
            <span>ŁADOWANIE UTWORÓW</span>
            <span className="cursor"> █</span>
          </div>
        ) : playlist.tracks.length === 0 ? (
          <div className="track-list-empty">BRAK UTWORÓW</div>
        ) : (
          playlist.tracks.map((track, i) => {
            const isActive = track.id === currentTrackId;
            return (
              <div key={`${track.id}-${i}`} className={`track-row ${isActive ? "active" : ""}`}>
                <div className="track-index" onClick={() => onPlay(track, i)}>
                  {isActive && isPlaying ? (
                    <i className="ti ti-player-play track-index-play" />
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>

                <div onClick={() => onPlay(track, i)} style={{ flexShrink: 0 }}>
                  <TrackArt src={track.image} alt={track.name} />
                </div>

                <div className="track-info" onClick={() => onPlay(track, i)}>
                  <div className={`track-name ${isActive ? "active" : ""}`}>{track.name}</div>
                  <div className="track-artist">{track.artist}</div>
                </div>

                <div className="track-duration">{track.duration}</div>

                <div className="track-row-actions">
                  {isLiked && onRemoveFromLiked && (
                    <button
                      type="button"
                      className="btn-icon active"
                      title="Usuń z polubionych"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFromLiked(track);
                      }}
                    >
                      <i className="ti ti-heart-filled" />
                    </button>
                  )}
                  {onSaveTrack && !isLiked && (
                    <button
                      type="button"
                      className="btn-icon"
                      title="Polub"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSaveTrack(track);
                      }}
                    >
                      <i className="ti ti-heart" />
                    </button>
                  )}
                  {onAddToPlaylist && (
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
                  )}
                  {isPlaylist && onRemoveTrack && (
                    <button
                      type="button"
                      className="btn-icon btn-danger-icon"
                      title="Usuń z playlisty"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveTrack(track);
                      }}
                    >
                      <i className="ti ti-trash" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isLiked && hasMoreLiked && onLoadMore && (
          <div style={{ padding: "16px 20px" }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: "100%" }}
              disabled={loadingMore}
              onClick={onLoadMore}
            >
              {loadingMore ? "Ładowanie..." : "Załaduj więcej polubionych"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
