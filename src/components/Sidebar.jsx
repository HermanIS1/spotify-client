export default function Sidebar({ playlists, currentView, onSelect }) {
  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div className="panel-header">LIBRARY</div>
      <div
        className={`list-item ${currentView === "liked" ? "active" : ""}`}
        onClick={() => onSelect("liked")}
      >
        <i className="ti ti-heart" style={{ fontSize: 15 }} />
        <span>Polubione utwory</span>
      </div>

      <hr style={{ border: "none", borderTop: "var(--border)", margin: "8px 14px" }} />

      <div className="panel-header">PLAYLISTS</div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {playlists.map((pl) => (
          <div
            key={pl.id}
            className={`list-item ${currentView === pl.id ? "active" : ""}`}
            onClick={() => onSelect(pl.id)}
            title={pl.name}
          >
            <i className="ti ti-playlist" style={{ fontSize: 15, flexShrink: 0 }} />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {pl.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
