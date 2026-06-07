import { useRef } from "react";

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

function volumeIcon(volume) {
  if (volume === 0) return "ti-volume-off";
  if (volume < 35) return "ti-volume-2";
  return "ti-volume";
}

function VolumeControl({ volume, onChange, onToggleMute }) {
  const barRef = useRef(null);
  const draggingRef = useRef(false);

  function setFromClientX(clientX) {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChange(Math.round(ratio * 100));
  }

  function handlePointerDown(e) {
    draggingRef.current = true;
    barRef.current?.setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  }

  function handlePointerMove(e) {
    if (!draggingRef.current) return;
    setFromClientX(e.clientX);
  }

  function handlePointerUp(e) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    barRef.current?.releasePointerCapture(e.pointerId);
  }

  return (
    <div className="volume-control">
      <button
        type="button"
        className="btn-icon volume-btn"
        onClick={onToggleMute}
        title={volume === 0 ? "Włącz dźwięk" : "Wycisz"}
      >
        <i className={`ti ${volumeIcon(volume)}`} />
      </button>

      <div
        ref={barRef}
        className="volume-slider"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="slider"
        aria-label="Głośność"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={volume}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            onChange(Math.min(100, volume + 5));
          }
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            onChange(Math.max(0, volume - 5));
          }
        }}
      >
        <div className="volume-track">
          <div className="volume-fill" style={{ width: `${volume}%` }} />
          <div className="volume-thumb" style={{ left: `${volume}%` }} />
        </div>
      </div>

      <span className="volume-value">{volume}</span>
    </div>
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
  volume,
  onVolume,
  onToggleMute,
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

        <VolumeControl volume={volume} onChange={onVolume} onToggleMute={onToggleMute} />
      </div>
    </footer>
  );
}
