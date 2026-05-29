import { useState, useEffect, useRef, useCallback } from "react";
import "./styles/global.css";

import Topbar from "./components/Topbar";
import Sidebar from "./components/Sidebar";
import TrackList from "./components/TrackList";
import Player from "./components/Player";
import Search from "./components/Search";
import CreatePlaylist from "./components/CreatePlaylist";
import AddToPlaylistModal from "./components/AddToPlaylistModal";
import Toast from "./components/Toast";

import {
  isLoggedIn,
  redirectToLogin,
  exchangeCodeForToken,
  getLikedTracks,
  fetchLikedPage,
  getPlaylists,
  getPlaylistTracks,
  playTrackOnSpotify,
  playContext,
  pauseSpotify,
  resumeSpotify,
  nextSpotify,
  prevSpotify,
  setVolumeSpotify,
  seekSpotify,
  getPlaybackState,
  logout,
  transferPlayback,
  addTracksToPlaylist,
  removeTracksFromPlaylist,
  updatePlaylistDetails,
  unfollowPlaylist,
  saveTracksToLibrary,
  removeTracksFromLibrary,
  setPlayerShuffle,
  setPlayerRepeat,
} from "./spotify";

function parseDuration(dur) {
  if (!dur) return 0;
  const [m, s] = dur.split(":");
  return parseInt(m) * 60 + parseInt(s);
}

function LoginScreen() {
  return (
    <div className="screen-center">
      <div className="screen-frame">
        <div className="title-gothic glow-text" style={{ fontSize: 52, marginBottom: 8 }}>
          Spotify
        </div>
        <div style={{ fontSize: 11, color: "var(--g3)", letterSpacing: "0.25em", marginBottom: 28 }}>
          LIGHTWEIGHT AUDIO CLIENT
        </div>
        <button type="button" className="btn btn-primary" onClick={redirectToLogin}>
          POŁĄCZ Z SPOTIFY
        </button>
      </div>
    </div>
  );
}

function LoadingScreen({ message, hint }) {
  return (
    <div className="screen-center">
      <div className="screen-frame">
        <div className="title-gothic" style={{ fontSize: 36, marginBottom: 16 }}>
          Spotify
        </div>
        <div style={{ fontSize: 12, color: "var(--g3)", letterSpacing: "0.15em" }}>
          {message} <span className="cursor">█</span>
        </div>
        {hint && (
          <div style={{ marginTop: 16, fontSize: 10, color: "var(--g4)", maxWidth: 280, lineHeight: 1.5 }}>
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [loadingHint, setLoadingHint] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  const [playlists, setPlaylists] = useState([]);
  const [likedTracks, setLikedTracks] = useState([]);
  const [likedTotal, setLikedTotal] = useState(0);
  const [likedNextUrl, setLikedNextUrl] = useState(null);
  const [trackCache, setTrackCache] = useState({});

  const [currentView, setCurrentView] = useState("liked");
  const [currentTracks, setCurrentTracks] = useState([]);

  const [currentTrack, setCurrentTrack] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const [currentPlaylistUri, setCurrentPlaylistUri] = useState(null);

  const [player, setPlayer] = useState(null);
  const [deviceId, setDeviceId] = useState(null);

  const [addModalTracks, setAddModalTracks] = useState(null);
  const [addModalLoading, setAddModalLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const intervalRef = useRef(null);
  const totalSecRef = useRef(0);
  const syncInterval = useRef(null);
  const volumeTimeoutRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  function showToast(message, type = "success") {
    setToast({ message, type });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3200);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.history.replaceState({}, "", "/");
      setLoading(true);
      setLoadingMsg("AUTH.SYNC");
      exchangeCodeForToken(code).then(() => {
        setLoggedIn(true);
        setLoading(false);
      });
    }
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    const token = localStorage.getItem("spotify_token");
    if (!token) return;

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const spotifyPlayer = new window.Spotify.Player({
        name: "HermanOS Client",
        getOAuthToken: (cb) => cb(localStorage.getItem("spotify_token") || token),
        volume: Number(localStorage.getItem("spotify_volume") || 50) / 100,
      });
      setPlayer(spotifyPlayer);
      spotifyPlayer.addListener("ready", ({ device_id }) => {
        setDeviceId(device_id);
        transferPlayback(device_id).catch(console.error);
      });
      spotifyPlayer.connect();
    };

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn) return;
    loadLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn || loading) return;

    function onKeyDown(e) {
      if (e.target.matches("input, textarea")) return;
      if (e.code === "Space") {
        e.preventDefault();
        handleTogglePlay();
      }
      if (e.code === "ArrowRight") handleNext();
      if (e.code === "ArrowLeft") handlePrev();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, loading, currentTrack, isPlaying]);

  async function loadLibrary() {
    setLoading(true);
    setLoadingHint("");
    try {
      setLoadingMsg("SYNC.LIKED");
      const liked = await getLikedTracks({
        maxTracks: 50,
        onProgress: (loaded, total) => {
          if (total) setLoadingHint(`${loaded} / ${total} utworów`);
        },
      });
      setLikedTracks(liked.tracks);
      setLikedTotal(liked.total);
      setLikedNextUrl(liked.hasMore ? liked.nextUrl : null);
      setCurrentTracks(liked.tracks);

      setLoadingMsg("SYNC.PLAYLISTS");
      setLoadingHint("");
      setPlaylists(await getPlaylists());
    } catch (err) {
      console.error("Library sync failed:", err);
      showToast(err.message || "Błąd synchronizacji", "error");
      setLikedTracks([]);
      setCurrentTracks([]);
      setPlaylists([]);
    } finally {
      setLoading(false);
      setLoadingHint("");
    }
  }

  async function refreshPlaylistTracks(playlistId) {
    const tracks = await getPlaylistTracks(playlistId);
    setTrackCache((prev) => ({ ...prev, [playlistId]: tracks }));
    if (currentView === playlistId) setCurrentTracks(tracks);
    return tracks;
  }

  async function handleSelectView(id) {
    setCurrentView(id);
    if (id === "liked") {
      setCurrentTracks(likedTracks);
      setCurrentPlaylistUri(null);
      return;
    }
    if (trackCache[id]) {
      setCurrentTracks(trackCache[id]);
    } else {
      setLoading(true);
      setLoadingMsg("LOAD.TRACKS");
      try {
        await refreshPlaylistTracks(id);
      } catch (err) {
        console.warn("Playlist access:", err);
        setCurrentTracks([]);
        showToast("Brak dostępu do tej playlisty", "error");
      } finally {
        setLoading(false);
      }
    }
    const pl = playlists.find((p) => p.id === id);
    setCurrentPlaylistUri(pl?.uri || null);
  }

  async function handlePlayTrack(track, idx) {
    setCurrentTrack(track);
    setCurrentIdx(idx);
    setIsPlaying(true);
    setCurrentSec(0);
    setProgress(0);
    totalSecRef.current = parseDuration(track.duration);
    try {
      await playTrackOnSpotify(track.uri, currentPlaylistUri, deviceId);
    } catch (err) {
      showToast("Nie udało się odtworzyć", "error");
    }
  }

  async function handlePlayFromSearch(track) {
    setCurrentPlaylistUri(null);
    setCurrentTracks([track]);
    setCurrentTrack(track);
    setCurrentIdx(0);
    setIsPlaying(true);
    setCurrentSec(0);
    setProgress(0);
    totalSecRef.current = parseDuration(track.duration);
    try {
      await playTrackOnSpotify(track.uri, null, deviceId);
    } catch (err) {
      showToast("Nie udało się odtworzyć utworu", "error");
    }
  }

  async function handlePlayAll() {
    if (!currentTracks.length) return;
    const uri =
      currentView === "liked"
        ? null
        : playlists.find((p) => p.id === currentView)?.uri;
    if (uri) {
      try {
        await playContext(uri, deviceId, currentTracks[0].uri);
        handlePlayTrack(currentTracks[0], 0);
      } catch {
        handlePlayTrack(currentTracks[0], 0);
      }
    } else {
      handlePlayTrack(currentTracks[0], 0);
    }
  }

  async function handleAddToPlaylist(playlistId) {
    if (!addModalTracks?.length) return;
    setAddModalLoading(true);
    try {
      const uris = addModalTracks.map((t) => t.uri);
      await addTracksToPlaylist(playlistId, uris);
      const pl = playlists.find((p) => p.id === playlistId);
      await refreshPlaylistTracks(playlistId);
      showToast(
        uris.length === 1
          ? `Dodano do „${pl?.name || "playlisty"}"`
          : `Dodano ${uris.length} utworów do „${pl?.name}"`,
      );
      setAddModalTracks(null);
    } catch (err) {
      showToast(err.message || "Nie udało się dodać", "error");
    } finally {
      setAddModalLoading(false);
    }
  }

  async function handleRemoveFromPlaylist(track) {
    if (currentView === "liked") return;
    try {
      await removeTracksFromPlaylist(currentView, [track.uri]);
      const next = currentTracks.filter((t) => t.id !== track.id);
      setCurrentTracks(next);
      setTrackCache((prev) => ({ ...prev, [currentView]: next }));
      if (currentTrack?.id === track.id) setCurrentTrack(null);
      showToast("Usunięto z playlisty");
    } catch (err) {
      showToast(err.message || "Nie udało się usunąć", "error");
    }
  }

  async function handleSaveTrack(track) {
    try {
      await saveTracksToLibrary([track.uri]);
      showToast("Dodano do polubionych");
    } catch (err) {
      showToast(err.message || "Polubienie niedostępne (dev mode?)", "error");
    }
  }

  async function handleRemoveFromLiked(track) {
    try {
      await removeTracksFromLibrary([track.uri]);
      const next = likedTracks.filter((t) => t.id !== track.id);
      setLikedTracks(next);
      if (currentView === "liked") setCurrentTracks(next);
      setLikedTotal((n) => Math.max(0, n - 1));
      if (currentTrack?.id === track.id) setCurrentTrack(null);
      showToast("Usunięto z polubionych");
    } catch (err) {
      showToast(err.message || "Nie udało się usunąć", "error");
    }
  }

  async function handleLoadMoreLiked() {
    if (!likedNextUrl || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchLikedPage(likedNextUrl);
      setLikedTracks((prev) => [...prev, ...page.tracks]);
      if (currentView === "liked") {
        setCurrentTracks((prev) => [...prev, ...page.tracks]);
      }
      setLikedNextUrl(page.next);
      setLikedTotal(page.total);
      showToast(`Załadowano +${page.tracks.length} utworów`);
    } catch (err) {
      showToast(err.message || "Błąd ładowania", "error");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleRenamePlaylist(name) {
    if (currentView === "liked") return;
    try {
      await updatePlaylistDetails(currentView, { name });
      setPlaylists((prev) =>
        prev.map((p) => (p.id === currentView ? { ...p, name } : p)),
      );
      showToast("Zmieniono nazwę playlisty");
    } catch (err) {
      showToast(err.message || "Nie udało się zmienić nazwy", "error");
    }
  }

  async function handleDeletePlaylist() {
    if (currentView === "liked") return;
    const pl = playlists.find((p) => p.id === currentView);
    if (!window.confirm(`Usunąć playlistę „${pl?.name}"?`)) return;
    try {
      await unfollowPlaylist(currentView);
      setPlaylists((prev) => prev.filter((p) => p.id !== currentView));
      setTrackCache((prev) => {
        const next = { ...prev };
        delete next[currentView];
        return next;
      });
      setCurrentView("liked");
      setCurrentTracks(likedTracks);
      setCurrentPlaylistUri(null);
      showToast("Playlista usunięta");
    } catch (err) {
      showToast(err.message || "Nie udało się usunąć playlisty", "error");
    }
  }

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (isPlaying && currentTrack) {
      intervalRef.current = setInterval(() => {
        setCurrentSec((prev) => {
          const next = prev + 1;
          if (next >= totalSecRef.current) {
            if (isRepeat) return 0;
            handleNext();
            return 0;
          }
          setProgress(next / totalSecRef.current);
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentTrack, isRepeat]);

  useEffect(() => {
    if (!loggedIn) return;
    syncInterval.current = setInterval(async () => {
      try {
        const state = await getPlaybackState();
        if (!state) return;
        setIsPlaying(state.is_playing);
        if (state.progress_ms !== undefined && totalSecRef.current > 0) {
          const sec = Math.floor(state.progress_ms / 1000);
          setCurrentSec(sec);
          setProgress(sec / totalSecRef.current);
        }
      } catch {
        /* optional */
      }
    }, 5000);
    return () => clearInterval(syncInterval.current);
  }, [loggedIn]);

  async function handleTogglePlay() {
    if (!currentTrack) {
      if (currentTracks.length > 0) handlePlayTrack(currentTracks[0], 0);
      return;
    }
    const newState = !isPlaying;
    setIsPlaying(newState);
    try {
      if (newState) await resumeSpotify();
      else await pauseSpotify();
    } catch (err) {
      console.warn("Toggle error:", err);
    }
  }

  const handleNext = useCallback(async () => {
    if (!currentTracks.length) return;
    const nextIdx = isShuffle
      ? Math.floor(Math.random() * currentTracks.length)
      : (currentIdx + 1) % currentTracks.length;
    handlePlayTrack(currentTracks[nextIdx], nextIdx);
    try {
      await nextSpotify();
    } catch {
      /* optional */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, currentTracks, isShuffle]);

  async function handlePrev() {
    if (!currentTracks.length) return;
    if (currentSec > 3) {
      setCurrentSec(0);
      setProgress(0);
      try {
        await seekSpotify(0);
      } catch {
        /* optional */
      }
      return;
    }
    const prevIdx = (currentIdx - 1 + currentTracks.length) % currentTracks.length;
    handlePlayTrack(currentTracks[prevIdx], prevIdx);
    try {
      await prevSpotify();
    } catch {
      /* optional */
    }
  }

  async function handleSeek(ratio) {
    const sec = Math.floor(ratio * totalSecRef.current);
    setCurrentSec(sec);
    setProgress(ratio);
    try {
      await seekSpotify(sec * 1000);
    } catch {
      /* optional */
    }
  }

  async function handleVolume(val) {
    localStorage.setItem("spotify_volume", String(val));
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(async () => {
      try {
        await setVolumeSpotify(val);
      } catch (err) {
        console.warn("Volume error:", err);
      }
    }, 300);
  }

  async function handleToggleShuffle() {
    const next = !isShuffle;
    setIsShuffle(next);
    try {
      await setPlayerShuffle(next);
    } catch {
      /* local shuffle still works */
    }
  }

  async function handleToggleRepeat() {
    const next = !isRepeat;
    setIsRepeat(next);
    try {
      await setPlayerRepeat(next ? "context" : "off");
    } catch {
      /* local repeat still works */
    }
  }

  function handleLogout() {
    if (player) player.disconnect();
    logout();
    setLoggedIn(false);
    setPlaylists([]);
    setLikedTracks([]);
    setCurrentTrack(null);
  }

  async function handlePlaylistCreated(playlist) {
    const pls = await getPlaylists();
    setPlaylists(pls);
    showToast(`Utworzono „${playlist.name}"`);
    if (playlist?.id) {
      setTrackCache((prev) => ({ ...prev, [playlist.id]: [] }));
      handleSelectView(playlist.id);
    }
  }

  const activePlaylist =
    currentView === "liked"
      ? { id: "liked", name: "Polubione utwory", tracks: likedTracks }
      : playlists.find((pl) => pl.id === currentView)
        ? { ...playlists.find((pl) => pl.id === currentView), tracks: currentTracks }
        : null;

  if (!loggedIn) return <LoginScreen />;
  if (loading) return <LoadingScreen message={loadingMsg} hint={loadingHint} />;

  return (
    <div className="app-shell">
      <Topbar onLogout={handleLogout} />

      <div className="app-body">
        <div className="app-sidebar-col">
          <Search
            onPlayTrack={handlePlayFromSearch}
            onAddTracks={(tracks) => setAddModalTracks(tracks)}
          />
          <Sidebar playlists={playlists} currentView={currentView} onSelect={handleSelectView} />
          <CreatePlaylist onPlaylistCreated={handlePlaylistCreated} />
        </div>

        <TrackList
          playlist={activePlaylist}
          currentTrackId={currentTrack?.id}
          isPlaying={isPlaying}
          onPlay={handlePlayTrack}
          onAddToPlaylist={(track) => setAddModalTracks([track])}
          onRemoveTrack={currentView !== "liked" ? handleRemoveFromPlaylist : undefined}
          onPlayAll={handlePlayAll}
          onSaveTrack={handleSaveTrack}
          onRemoveFromLiked={currentView === "liked" ? handleRemoveFromLiked : undefined}
          onRenamePlaylist={currentView !== "liked" ? handleRenamePlaylist : undefined}
          onDeletePlaylist={currentView !== "liked" ? handleDeletePlaylist : undefined}
          onLoadMore={currentView === "liked" ? handleLoadMoreLiked : undefined}
          hasMoreLiked={Boolean(likedNextUrl)}
          likedTotal={likedTotal}
          loadingMore={loadingMore}
        />
      </div>

      <Player
        track={currentTrack}
        isPlaying={isPlaying}
        isShuffle={isShuffle}
        isRepeat={isRepeat}
        progress={progress}
        currentSec={currentSec}
        onTogglePlay={handleTogglePlay}
        onNext={handleNext}
        onPrev={handlePrev}
        onToggleShuffle={handleToggleShuffle}
        onToggleRepeat={handleToggleRepeat}
        onSeek={handleSeek}
        onVolume={handleVolume}
      />

      <AddToPlaylistModal
        tracks={addModalTracks}
        playlists={playlists}
        loading={addModalLoading}
        onSelect={handleAddToPlaylist}
        onClose={() => !addModalLoading && setAddModalTracks(null)}
      />

      <Toast message={toast?.message} type={toast?.type} />
    </div>
  );
}
