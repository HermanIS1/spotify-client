import { useState, useEffect, useRef, useCallback } from "react";
import "./styles/global.css";

import Topbar from "./components/Topbar";
import Sidebar from "./components/Sidebar";
import TrackList from "./components/TrackList";
import Player from "./components/Player";
import Search from "./components/Search";
import CreatePlaylist from "./components/CreatePlaylist";

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
  searchSpotify,
  createPlaylist,
  addTracksToPlaylist,
} from "./spotify";

function parseDuration(dur) {
  if (!dur) return 0;
  const [m, s] = dur.split(":");
  return parseInt(m) * 60 + parseInt(s);
}

// ─── Ekran logowania ───────────────────────────────────────────────────────
function LoginScreen() {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        gap: "24px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-gothic)",
          fontSize: "48px",
          color: "var(--g)",
        }}
      >
        Spotify
      </div>
      <div
        style={{ fontSize: "12px", color: "var(--g3)", letterSpacing: "2px" }}
      >
        SPOTIFY_CLIENT.EXE v0.1.0
      </div>
      <button
        onClick={redirectToLogin}
        style={{
          marginTop: "16px",
          padding: "10px 32px",
          background: "none",
          border: "var(--border2)",
          borderRadius: "2px",
          color: "var(--g)",
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
          cursor: "pointer",
          letterSpacing: "1px",
          transition: "background 0.1s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg3)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        &gt;_ ZALOGUJ PRZEZ SPOTIFY
      </button>
    </div>
  );
}

// ─── Ekran ładowania ───────────────────────────────────────────────────────
function LoadingScreen({ message }) {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        gap: "12px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-gothic)",
          fontSize: "32px",
          color: "var(--g)",
        }}
      >
        Spotify
      </div>
      <div style={{ fontSize: "12px", color: "var(--g3)" }}>
        {message} <span className="cursor">█</span>
      </div>
    </div>
  );
}

// ─── Główna aplikacja ──────────────────────────────────────────────────────
export default function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");

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

  // Zmienne stanu dla wbudowanego odtwarzacza
  const [player, setPlayer] = useState(null);
  const [deviceId, setDeviceId] = useState(null);

  // Zmienne stanu dla search i playlist
  const [selectedTracks, setSelectedTracks] = useState([]);

  const intervalRef = useRef(null);
  const totalSecRef = useRef(0);
  const syncInterval = useRef(null);
  const volumeTimeoutRef = useRef(null);

  // ── OAuth callback ────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      window.history.replaceState({}, "", "/");
      setLoading(true);
      setLoadingMsg("wymiana tokenu...");

      exchangeCodeForToken(code).then((data) => {
        // Twarde zabezpieczenie: ustawiamy "loggedIn" tylko jeśli mamy token!
        if (data && data.access_token) {
          setLoggedIn(true);
        } else {
          console.error("🚨 Błąd logowania: Spotify nie zwróciło tokenu!");
        }
        setLoading(false);
      }).catch(err => {
        console.error("🚨 Krytyczny błąd autoryzacji:", err);
        setLoading(false);
      });
    }
  }, []);
  // ── Inicjalizacja Web Playback SDK (Własny odtwarzacz) ──────────────────────
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
        name: "HermanOS Client", // Taką nazwę zobaczysz w Spotify
        getOAuthToken: (cb) => {
          cb(token);
        },
        volume: 0.5,
      });

      setPlayer(spotifyPlayer);

      spotifyPlayer.addListener("ready", ({ device_id }) => {
        console.log(
          "Odtwarzacz gotowy! Przejmowanie kontroli... Device ID:",
          device_id,
        );
        setDeviceId(device_id);

        // Zmuszamy Spotify do wysyłania muzyki do naszej aplikacji
        transferPlayback(device_id).catch((err) =>
          console.error("Błąd transferu:", err),
        );
      });

      spotifyPlayer.addListener("not_ready", ({ device_id }) => {
        console.log("Odtwarzacz rozłączony z Device ID:", device_id);
      });

      spotifyPlayer.connect();
    };

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [loggedIn]);

  // ── Ładowanie danych po zalogowaniu ────────────────────────────────────────
  useEffect(() => {
    if (!loggedIn) return;
    loadLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  async function loadLibrary() {
async function loadLibrary() {
    setLoading(true);

    setLoadingMsg("pobieranie polubionych...");
    const liked = await getLikedTracks();
    setLikedTracks(liked);
    setCurrentTracks(liked);

    setLoadingMsg("pobieranie playlist...");
    const pls = await getPlaylists();
    setPlaylists(pls);

    setLoading(false);
    try {
      setLoadingMsg("pobieranie polubionych...");
      const liked = await getLikedTracks();
      setLikedTracks(liked);
      setCurrentTracks(liked);

      setLoadingMsg("pobieranie playlist...");
      const pls = await getPlaylists();
      setPlaylists(pls);
    } catch (err) {
      console.error("🚨 Błąd podczas pobierania biblioteki (np. brak Premium):", err);
    } finally {
      // To gwarantuje, że ekran ładowania ZAWSZE zniknie, niezależnie od błędów
      setLoading(false); 
    }
  }

  // ── Zmiana widoku (sidebar) ─────────────────────────────────────────────────
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
      setLoadingMsg("ładowanie tracków...");
      try {
        const tracks = await getPlaylistTracks(id);
        setTrackCache((prev) => ({ ...prev, [id]: tracks }));
        setCurrentTracks(tracks);
      } catch (err) {
        console.warn("Brak dostępu do playlisty:", err);
        setCurrentTracks([]);
      } finally {
        setLoading(false);
      }
    }

    const pl = playlists.find((p) => p.id === id);
    setCurrentPlaylistUri(pl?.uri || null);
  }

  // ── Odtwarzanie tracka ──────────────────────────────────────────────────────
  async function handlePlayTrack(track, idx) {
    setCurrentTrack(track);
    setCurrentIdx(idx);
    setIsPlaying(true);
    setCurrentSec(0);
    setProgress(0);
    totalSecRef.current = parseDuration(track.duration);

    try {
      // PRZEKAZUJEMY DEVICE_ID ABY MUZYKA LECIAŁA OD RAZU!
      await playTrackOnSpotify(track.uri, currentPlaylistUri, deviceId);
    } catch (err) {
      console.warn("Spotify playback error:", err);
    }
  }

  // ── Lokalny progres ────────────────────────────────────────────────────────
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

  // ── Synchronizacja z prawdziwym stanem Spotify (co 5s) ─────────────────────
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
        // cicho ignorujemy błędy synca
      }
    }, 5000);

    return () => clearInterval(syncInterval.current);
  }, [loggedIn]);

  // ── Kontrolki ──────────────────────────────────────────────────────────────
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
      console.warn("Spotify toggle error:", err);
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
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, currentTracks, isShuffle]);

  async function handlePrev() {
    if (!currentTracks.length) return;
    if (currentSec > 3) {
      setCurrentSec(0);
      setProgress(0);
      try {
        await seekSpotify(0);
      } catch {}
      return;
    }
    const prevIdx =
      (currentIdx - 1 + currentTracks.length) % currentTracks.length;
    handlePlayTrack(currentTracks[prevIdx], prevIdx);
    try {
      await prevSpotify();
    } catch {}
  }

  async function handleSeek(ratio) {
    const sec = Math.floor(ratio * totalSecRef.current);
    setCurrentSec(sec);
    setProgress(ratio);
    try {
      await seekSpotify(sec * 1000);
    } catch {}
  }

  async function handleVolume(val) {
    // USUWA SPAM - ZABEZPIECZENIE PRZED BŁĘDEM 429
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);

    volumeTimeoutRef.current = setTimeout(async () => {
      try {
        await setVolumeSpotify(val);
      } catch (err) {
        console.warn("Błąd głośności:", err);
      }
    }, 300);
  }

  function handleLogout() {
    if (player) player.disconnect(); // Odłączamy odtwarzacz przy wylogowaniu
    logout();
    setLoggedIn(false);
    setPlaylists([]);
    setLikedTracks([]);
    setCurrentTrack(null);
  }

  // ── Obsługa search i playlist ──────────────────────────────────────────────
  async function handleSelectTrack(track) {
    setSelectedTracks([...selectedTracks, track]);
  }

  async function handlePlaylistCreated(playlist) {
    if (selectedTracks.length > 0) {
      try {
        const uris = selectedTracks.map((t) => t.uri);
        await addTracksToPlaylist(playlist.id, uris);
        setSelectedTracks([]);
      } catch (err) {
        console.error("Error adding tracks:", err);
      }
    }
    const pls = await getPlaylists();
    setPlaylists(pls);
  }

  // ── Aktualnie wyświetlana playlista ─────────────────────────────────────────
  const activePlaylist =
    currentView === "liked"
      ? { id: "liked", name: "Polubione utwory", tracks: likedTracks }
      : playlists.find((pl) => pl.id === currentView)
        ? {
            ...playlists.find((pl) => pl.id === currentView),
            tracks: currentTracks,
          }
        : null;

  // ── Renderowanie ────────────────────────────────────────────────────────────
  if (!loggedIn) return <LoginScreen />;
  if (loading) return <LoadingScreen message={loadingMsg} />;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      <Topbar onLogout={handleLogout} />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
          }}
        >
          <Search onSelectTrack={handleSelectTrack} />
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
    </div>
  );
}
