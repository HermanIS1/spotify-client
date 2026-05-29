// TrackList.jsx
// Główna przestrzeń: nagłówek playlisty + lista tracków

// Props:
//   playlist       - obiekt { id, name, tracks: [...] }
//   currentTrackId - id aktualnie odtwarzanego tracka
//   isPlaying      - boolean
//   onPlay         - funkcja(track, index) — kliknięcie w utwór

function TrackImage({ src, alt }) {
  const style = {
    width: '36px',
    height: '36px',
    background: 'var(--bg3)',
    border: 'var(--border)',
    borderRadius: '2px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    color: 'var(--g3)',
    overflow: 'hidden',
  };

  return (
    <div style={style}>
      <img
        src={src}
        alt={alt}
        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }}
        onError={e => {
          e.target.style.display = 'none';
          e.target.parentNode.innerHTML = '<i class="ti ti-music"></i>';
        }}
      />
    </div>
  );
}

export default function TrackList({ playlist, currentTrackId, isPlaying, onPlay }) {
  if (!playlist) return null;

  const headerStyle = {
    padding: '16px 20px 12px',
    borderBottom: 'var(--border)',
    background: 'var(--bg)',
    flexShrink: 0,
  };

  const trackStyle = (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 20px',
    cursor: 'pointer',
    borderLeft: isActive ? '2px solid var(--g)' : '2px solid transparent',
    background: isActive ? 'var(--bg3)' : 'transparent',
    transition: 'background 0.1s',
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Nagłówek */}
      <div style={headerStyle}>
        <div style={{ fontFamily: 'var(--font-gothic)', fontSize: '22px', color: 'var(--g)', marginBottom: '4px' }}>
          {playlist.name}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--g3)' }}>
          {playlist.tracks.length} utworów &nbsp;<span className="cursor">█</span>
        </div>
      </div>

      {/* Lista tracków */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {playlist.tracks.map((track, i) => {
          const isActive = track.id === currentTrackId;
          return (
            <div
              key={track.id}
              style={trackStyle(isActive)}
              onClick={() => onPlay(track, i)}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg3)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Numer / ikona play */}
              <div style={{ fontSize: '11px', color: 'var(--g3)', width: '18px', textAlign: 'right', flexShrink: 0 }}>
                {isActive && isPlaying
                  ? <i className="ti ti-player-play" style={{ color: 'var(--g)', fontSize: '12px' }} />
                  : <span>{i + 1}</span>
                }
              </div>

              <TrackImage src={track.image} alt={track.name} />

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '13px',
                  color: isActive ? 'var(--g)' : 'var(--g2)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {track.name}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--g3)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {track.artist}
                </div>
              </div>

              {/* Czas trwania */}
              <div style={{ fontSize: '11px', color: 'var(--g3)', flexShrink: 0 }}>
                {track.duration}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
