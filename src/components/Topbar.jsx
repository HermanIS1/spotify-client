export default function Topbar({ userProfile, onLogout, onSwitchAccount }) {
  const initials = userProfile?.displayName
    ? userProfile.displayName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <header
      className="panel topbar"
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

      <div className="topbar-actions">
        {userProfile && (
          <div
            className="profile-avatar"
            title={userProfile.displayName}
            aria-label={`Profil: ${userProfile.displayName}`}
          >
            {userProfile.imageUrl ? (
              <img src={userProfile.imageUrl} alt="" />
            ) : (
              <span className="profile-avatar-fallback" aria-hidden="true">
                {initials}
              </span>
            )}
          </div>
        )}

        {onSwitchAccount && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onSwitchAccount}
            style={{ padding: "6px 12px" }}
            title="Wyloguj z Spotify i zaloguj innym kontem (wymagane w trybie deweloperskim)"
          >
            ZMIEŃ KONTO
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onLogout} style={{ padding: "6px 12px" }}>
          WYLOGUJ
        </button>
      </div>
    </header>
  );
}
