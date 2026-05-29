function fmtSec(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${sec}`;
}

function CtrlBtn({ icon, active, onClick, title }) {
  return (
    <button
      type="button"
      title={title}
      className={`btn-icon ${active ? "active" : ""}`}
      onClick={onClick}
      style={{ fontSize: 16, width: 36, height: 36 }}
    >
      <i className={`ti ${icon}`} />
    </button>
  );
}

export default function Player({
  track,
  isPlaying,
  isShuffle,
  isRepeat,
  progress,
  currentSec,
  onTogglePlay,
  onPrev,
  onNext,
  onToggleShuffle,
  onToggleRepeat,
  onSeek,
  onVolume,
}) {
  function handleSeek(e) {
    const bar = e.currentTarget;
    const ratio = e.nativeEvent.offsetX / bar.offsetWidth;
    onSeek(Math.max(0, Math.min(1, ratio)));
  }

  return (
    <footer
      className="panel panel-glow"
      style={{
        padding: "12px 24px 14px",
        flexShrink: 0,
        borderTop: "var(--border-glow)",
        background: "var(--bg-glass)",
        backdropFilter: "blur(16px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 10, color: "var(--g3)", width: 36, fontVariantNumeric: "tabular-nums" }}>
          {fmtSec(currentSec)}
        </span>
        <div className="progress-bar" onClick={handleSeek}>
          <div className="progress-fill" style={{ width: `${(progress || 0) * 100}%` }} />
        </div>
        <span
          style={{
            fontSize: 10,
            color: "var(--g3)",
            width: 36,
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {track ? track.duration : "0:00"}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, width: 220, minWidth: 0 }}>
          <div className="track-art" style={{ width: 44, height: 44 }}>
            {track?.image ? (
              <img src={track.image} alt="" />
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
          <div style={{ minWidth: 0 }}>
            <div
              className="title-display"
              style={{
                fontSize: 12,
                color: track ? "var(--g)" : "var(--g3)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {track ? track.name : "— STANDBY —"}
            </div>
            {track && (
              <div style={{ fontSize: 10, color: "var(--g3)", marginTop: 2 }}>
                {track.artist}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <CtrlBtn
            icon="ti-arrows-shuffle"
            active={isShuffle}
            onClick={onToggleShuffle}
            title="Losowo"
          />
          <CtrlBtn icon="ti-player-skip-back" onClick={onPrev} title="Poprzedni" />
          <button
            type="button"
            className="btn-icon active"
            onClick={onTogglePlay}
            style={{
              width: 44,
              height: 44,
              fontSize: 18,
              animation: isPlaying ? "pulse-glow 2s infinite" : undefined,
            }}
          >
            <i className={`ti ${isPlaying ? "ti-player-pause" : "ti-player-play"}`} />
          </button>
          <CtrlBtn icon="ti-player-skip-forward" onClick={onNext} title="Następny" />
          <CtrlBtn icon="ti-repeat" active={isRepeat} onClick={onToggleRepeat} title="Powtarzaj" />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: 160,
            justifyContent: "flex-end",
          }}
        >
          <i className="ti ti-volume" style={{ fontSize: 16, color: "var(--g3)" }} />
          <input
            type="range"
            min="0"
            max="100"
            defaultValue={localStorage.getItem("spotify_volume") || "80"}
            onChange={(e) => onVolume(parseInt(e.target.value, 10))}
            style={{ width: 90, accentColor: "var(--g-glow)" }}
          />
        </div>
      </div>
    </footer>
  );
}
