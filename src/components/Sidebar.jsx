// Sidebar.jsx
// Lewy panel: "Polubione utwory" + lista playlist

// Props:
//   playlists    - tablica obiektów { id, name, icon, tracks }
//   currentView  - id aktualnie wybranej playlisty/sekcji
//   onSelect     - funkcja(id) wywoływana po kliknięciu

export default function Sidebar({ playlists, currentView, onSelect }) {
  const sidebarStyle = {
    width: '220px',
    background: 'var(--bg2)',
    borderRight: 'var(--border2)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflow: 'hidden',
  };

  const labelStyle = {
    fontSize: '10px',
    color: 'var(--g3)',
    padding: '4px 16px 8px',
    letterSpacing: '2px',
  };

  const dividerStyle = {
    border: 'none',
    borderTop: 'var(--border)',
    margin: '4px 16px',
  };

  const itemStyle = (isActive) => ({
    padding: '7px 16px',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: isActive ? 'var(--g)' : 'var(--g2)',
    background: isActive ? 'var(--bg3)' : 'transparent',
    borderLeft: isActive ? '2px solid var(--g)' : '2px solid transparent',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transition: 'background 0.1s',
  });

  return (
    <div style={sidebarStyle}>
      {/* Sekcja: polubione */}
      <div style={{ padding: '12px 0' }}>
        <div style={labelStyle}>LIBRARY.SYS</div>
        <div
          style={itemStyle(currentView === 'liked')}
          onClick={() => onSelect('liked')}
          onMouseEnter={e => { if (currentView !== 'liked') e.currentTarget.style.background = 'var(--bg3)'; }}
          onMouseLeave={e => { if (currentView !== 'liked') e.currentTarget.style.background = 'transparent'; }}
        >
          <i className="ti ti-heart" aria-hidden="true" style={{ fontSize: '14px', flexShrink: 0 }} />
          <span>Polubione utwory</span>
        </div>
      </div>

      <hr style={dividerStyle} />

      {/* Sekcja: playlisty */}
      <div style={{ padding: '12px 0', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={labelStyle}>PLAYLISTS.DB</div>
        {playlists.map(pl => (
          <div
            key={pl.id}
            style={itemStyle(currentView === pl.id)}
            onClick={() => onSelect(pl.id)}
            onMouseEnter={e => { if (currentView !== pl.id) e.currentTarget.style.background = 'var(--bg3)'; }}
            onMouseLeave={e => { if (currentView !== pl.id) e.currentTarget.style.background = 'transparent'; }}
          >
            <i className={`ti ${pl.icon}`} aria-hidden="true" style={{ fontSize: '14px', flexShrink: 0 }} />
            <span>{pl.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
