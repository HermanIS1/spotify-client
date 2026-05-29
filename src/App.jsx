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
  getPlaylists,
  getPlaylistTracks,
  playTrackOnSpotify,
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
        <div
          style={{
            fontSize: 11,
            color: "var(--g3)",
            letterSpacing: "0.25em",
            marginBottom: 28,
          }}
        >
          NEURAL AUDIO INTERFACE
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
          <div
            style={{
              marginTop: 16,
              fontSize: 10,
              color: "var(--g4)",
              maxWidth: 280,
              lineHeight: 1.5,
            }}
          >
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

  const [playlists, setPlaylists] = useState([]);
  const [likedTracks, setLikedTracks] = useState([]);
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

  const [addModalTrack, setAddModalTrack] = useState(null);
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
        getOAuthToken: (cb) => {
          cb(localStorage.getItem("spotify_token") || token);
        },
        volume: 0.5,
      });

      setPlayer(spotifyPlayer);

      spotifyPlayer.addListener("ready", ({ device_id }) => {
        setDeviceId(device_id);
        transferPlayback(device_id).catch((err) =>
          console.error("Transfer error:", err),
        );
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
      setLikedTracks(liked);
      setCurrentTracks(liked);

      setLoadingMsg("SYNC.PLAYLISTS");
      setLoadingHint("");
      const pls = await getPlaylists();
      setPlaylists(pls);
    } catch (err) {
      console.error("Library sync failed:", err);
      const msg = err.message || "Błąd synchronizacji";
      showToast(msg, "error");
      setLoadingHint(msg);
      // Still open the app so they are not stuck on this screen
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
      console.warn("Playback error:", err);
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
      console.warn("Playback error:", err);
      showToast("Nie udało się odtworzyć utworu", "error");
    }
  }

  async function handleAddTrackToPlaylist(playlistId) {
    if (!addModalTrack) return;

    setAddModalLoading(true);
    try {
      await addTracksToPlaylist(playlistId, [addModalTrack.uri]);
      const pl = playlists.find((p) => p.id === playlistId);
      await refreshPlaylistTracks(playlistId);
      showToast(`Dodano do „${pl?.name || "playlisty"}"`);
      setAddModalTrack(null);
    } catch (err) {
      console.error("Add to playlist:", err);
      showToast(err.message || "Nie udało się dodać utworu", "error");
    } finally {
      setAddModalLoading(false);
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
        /* sync optional */
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
    let nextIdx;
    if (isShuffle) nextIdx = Math.floor(Math.random() * currentTracks.length);
    else nextIdx = (currentIdx + 1) % currentTracks.length;
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
    const prevIdx =
      (currentIdx - 1 + currentTracks.length) % currentTracks.length;
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
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(async () => {
      try {
        await setVolumeSpotify(val);
      } catch (err) {
        console.warn("Volume error:", err);
      }
    }, 300);
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
        ? {
            ...playlists.find((pl) => pl.id === currentView),
            tracks: currentTracks,
          }
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
            onAddToPlaylist={setAddModalTrack}
          />
          <Sidebar
            playlists={playlists}
            currentView={currentView}
            onSelect={handleSelectView}
          />
          <CreatePlaylist onPlaylistCreated={handlePlaylistCreated} />
        </div>

        <TrackList
          playlist={activePlaylist}
          currentTrackId={currentTrack?.id}
          isPlaying={isPlaying}
          onPlay={handlePlayTrack}
          onAddToPlaylist={setAddModalTrack}
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
        onToggleShuffle={() => setIsShuffle((p) => !p)}
        onToggleRepeat={() => setIsRepeat((p) => !p)}
        onSeek={handleSeek}
        onVolume={handleVolume}
      />

      <AddToPlaylistModal
        track={addModalTrack}
        playlists={playlists}
        loading={addModalLoading}
        onSelect={handleAddTrackToPlaylist}
        onClose={() => !addModalLoading && setAddModalTrack(null)}
      />

      <Toast message={toast?.message} type={toast?.type} />
    </div>
  );
}
