import { useState } from "react";
import { createPlaylist, addTracksToPlaylist } from "../spotify";

export default function CreatePlaylist({ onPlaylistCreated }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const playlist = await createPlaylist(name, description, isPublic);
      onPlaylistCreated(playlist);
      setName("");
      setDescription("");
      setIsPublic(false);
      setShowForm(false);
    } catch (err) {
      console.error("Create playlist error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "12px", borderTop: "var(--border2)" }}>
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          style={{
            width: "100%",
            padding: "8px",
            background: "none",
            border: "var(--border2)",
            color: "var(--g)",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            cursor: "pointer",
            transition: "background 0.1s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--bg3)")
          }
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
        >
          + Create Playlist
        </button>
      ) : (
        <form
          onSubmit={handleCreate}
          style={{ display: "flex", flexDirection: "column", gap: "8px" }}
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Playlist name..."
            style={{
              padding: "6px",
              background: "var(--bg2)",
              border: "var(--border2)",
              borderRadius: "2px",
              color: "var(--g)",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
            }}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            style={{
              padding: "6px",
              background: "var(--bg2)",
              border: "var(--border2)",
              borderRadius: "2px",
              color: "var(--g)",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              resize: "vertical",
              minHeight: "40px",
            }}
          />
          <label
            style={{
              fontSize: "11px",
              color: "var(--g2)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Public playlist
          </label>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: "6px",
                background: "var(--g4)",
                border: "none",
                color: "var(--bg)",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                cursor: "pointer",
                opacity: loading ? 0.5 : 1,
              }}
            >
              {loading ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{
                flex: 1,
                padding: "6px",
                background: "none",
                border: "var(--border2)",
                color: "var(--g)",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
