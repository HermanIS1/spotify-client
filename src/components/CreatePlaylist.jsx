import { useState } from "react";
import { createPlaylist } from "../spotify";

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
    <div
      className="panel"
      style={{ padding: 14, borderTop: "var(--border2)", flexShrink: 0 }}
    >
      {!showForm ? (
        <button
          type="button"
          className="btn btn-ghost"
          style={{ width: "100%" }}
          onClick={() => setShowForm(true)}
        >
          <i className="ti ti-plus" style={{ marginRight: 6 }} />
          NOWA PLAYLISTA
        </button>
      ) : (
        <form
          onSubmit={handleCreate}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <input
            type="text"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nazwa playlisty..."
            autoFocus
          />
          <textarea
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opis (opcjonalnie)"
            rows={2}
            style={{ resize: "vertical", minHeight: 48 }}
          />
          <label
            style={{
              fontSize: 11,
              color: "var(--g2)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Publiczna playlista
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ flex: 1, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "..." : "UTWÓRZ"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ flex: 1 }}
              onClick={() => setShowForm(false)}
            >
              ANULUJ
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
