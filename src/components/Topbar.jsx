// Topbar.jsx
export default function Topbar({ onLogout }) {
  return (
    <div style={{
      background: 'var(--bg2)',
      borderBottom: 'var(--border2)',
      padding: '0 16px',
      height: '36px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: '11px',
      color: 'var(--g3)',
      flexShrink: 0,
    }}>
      <span style={{ color: 'var(--g)', fontSize: '12px' }}>SPOTIFY_CLIENT.EXE</span>
      <span>
        v0.1.0 &nbsp;|&nbsp;
        <span style={{ color: 'var(--g)' }}>● CONNECTED</span>
      </span>
      <button
        onClick={onLogout}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--g3)',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          cursor: 'pointer',
          padding: '2px 8px',
          transition: 'color 0.1s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--g)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--g3)'}
      >
        &gt;_ logout
      </button>
    </div>
  );
}
