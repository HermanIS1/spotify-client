export default function Topbar({ onLogout }) {
  return (
    <header
      className="panel"
      style={{
        height: 42,
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "var(--border2)",
        flexShrink: 0,
        background: "var(--bg-glass)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="title-display glow-text" style={{ fontSize: 13 }}>
          SPOTIFY_CLIENT
        </span>
        <span
          style={{
            fontSize: 9,
            color: "var(--g4)",
            letterSpacing: "0.2em",
            padding: "2px 8px",
            border: "var(--border)",
          }}
        >
          v0.2.0
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 10,
          letterSpacing: "0.12em",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--g-glow)",
            boxShadow: "0 0 8px var(--g-glow)",
            animation: "pulse-glow 2s infinite",
          }}
        />
        <span style={{ color: "var(--g2)" }}>ONLINE</span>
      </div>

      <span className="kbd-hint">SPACE · ← →</span>

      <button type="button" className="btn btn-ghost" onClick={onLogout} style={{ padding: "6px 12px" }}>
        WYLOGUJ
      </button>
    </header>
  );
}
