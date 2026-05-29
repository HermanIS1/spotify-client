// Player.jsx
// Dolny pasek: okładka + info + kontrolki + pasek postępu + głośność

// Props:
//   track      - aktualny obiekt { id, name, artist, image, duration }
//   isPlaying  - boolean
//   isShuffle  - boolean
//   isRepeat   - boolean
//   progress   - liczba 0–1 (postęp odtwarzania)
//   currentSec - liczba sekund aktualnej pozycji
//   onTogglePlay
//   onPrev
//   onNext
//   onToggleShuffle
//   onToggleRepeat
//   onSeek     - funkcja(ratio 0–1)
//   onVolume   - funkcja(0–100)

function fmtSec(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function CtrlBtn({ icon, active, onClick, title }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: active ? 'var(--g)' : 'var(--g3)',
        cursor: 'pointer',
        fontSize: '18px',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        transition: 'color 0.1s',
      }}
      onMouseEnter={e => e.currentTarget.style.color = 'var(--g)'}
      onMouseLeave={e => e.currentTarget.style.color = active ? 'var(--g)' : 'var(--g3)'}
    >
      <i className={`ti ${icon}`} aria-hidden="true" />
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
  const totalSec = track ? parseDuration(track.duration) : 0;

  function parseDuration(dur) {
    if (!dur) return 0;
    const [m, s] = dur.split(':');
    return parseInt(m) * 60 + parseInt(s);
  }

  function handleSeek(e) {
    const bar = e.currentTarget;
    const ratio = e.nativeEvent.offsetX / bar.offsetWidth;
    onSeek(Math.max(0, Math.min(1, ratio)));
  }

  return (
    <div style={{
      background: 'var(--bg2)',
      borderTop: 'var(--border2)',
      padding: '10px 20px',
      flexShrink: 0,
    }}>
      {/* Pasek postępu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <span style={{ fontSize: '10px', color: 'var(--g3)', width: '32px' }}>
          {fmtSec(currentSec)}
        </span>

        <div
          onClick={handleSeek}
          style={{
            flex: 1,
            height: '3px',
            background: 'var(--g4)',
            borderRadius: '2px',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <div style={{
            height: '100%',
            background: 'var(--g)',
            borderRadius: '2px',
            width: `${(progress || 0) * 100}%`,
            transition: 'width 0.5s linear',
          }} />
        </div>

        <span style={{ fontSize: '10px', color: 'var(--g3)', width: '32px', textAlign: 'right' }}>
          {track ? track.duration : '0:00'}
        </span>
      </div>

      {/* Rząd: info + kontrolki + głośność */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Info o tracku */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '200px' }}>
          <div style={{
            width: '40px', height: '40px',
            background: 'var(--bg3)',
            border: 'var(--border)',
            borderRadius: '2px',
            flexShrink: 0,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            color: 'var(--g3)',
          }}>
            {track?.image
              ? <img
                  src={track.image}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              : <i className="ti ti-music" aria-hidden="true" />
            }
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: '12px',
              color: track ? 'var(--g)' : 'var(--g3)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {track ? track.name : '— nie odtwarzane —'}
            </div>
            {track && (
              <div style={{ fontSize: '10px', color: 'var(--g3)' }}>{track.artist}</div>
            )}
          </div>
        </div>

        {/* Kontrolki */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <CtrlBtn icon="ti-arrows-shuffle" active={isShuffle} onClick={onToggleShuffle} title="Losowo" />
          <CtrlBtn icon="ti-player-skip-back" onClick={onPrev} />

          {/* Przycisk play/pause */}
          <button
            onClick={onTogglePlay}
            style={{
              width: '36px', height: '36px',
              border: 'var(--border2)',
              borderRadius: '2px',
              background: 'none',
              color: 'var(--g)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <i className={`ti ${isPlaying ? 'ti-player-pause' : 'ti-player-play'}`} aria-hidden="true" />
          </button>

          <CtrlBtn icon="ti-player-skip-forward" onClick={onNext} />
          <CtrlBtn icon="ti-repeat" active={isRepeat} onClick={onToggleRepeat} title="Powtarzaj" />
        </div>

        {/* Głośność */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '160px', justifyContent: 'flex-end' }}>
          <i className="ti ti-volume" style={{ fontSize: '16px', color: 'var(--g3)' }} aria-hidden="true" />
          <input
            type="range"
            min="0"
            max="100"
            defaultValue="80"
            onChange={e => onVolume(parseInt(e.target.value))}
            style={{ width: '80px', accentColor: 'var(--g)' }}
          />
        </div>
      </div>
    </div>
  );
}
