import { useState, useEffect, useRef, useCallback } from "react";
import "./styles/global.css";

import Topbar from "./components/Topbar";
import Sidebar from "./components/Sidebar";
import TrackList from "./components/TrackList";
import Player from "./components/Player";
import NowPlaying from "./components/NowPlaying";
import Search from "./components/Search";
import CreatePlaylist from "./components/CreatePlaylist";
import AddToPlaylistModal from "./components/AddToPlaylistModal";
import Toast from "./components/Toast";

import {
  isLoggedIn,
  redirectToLogin,
  exchangeCodeForToken,
  parseAuthCallback,
  getValidAccessToken,
  getCurrentUser,
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

function mapSdkTrack(sdkTrack) {
  if (!sdkTrack?.id) return null;
  const totalSec = Math.floor((sdkTrack.duration_ms || 0) / 1000);
  const m = Math.floor(totalSec / 60);
  const sec = (totalSec % 60).toString().padStart(2, "0");
  return {
    id: sdkTrack.id,
    name: sdkTrack.name,
    uri: sdkTrack.uri,
    artist: sdkTrack.artists?.map((a) => a.name).join(", ") || "—",
    artistId:
      sdkTrack.artists?.[0]?.uri?.replace("spotify:artist:", "") ||
      sdkTrack.artists?.[0]?.id ||
      null,
    duration: `${m}:${sec}`,
    image: sdkTrack.album?.images?.[1]?.url || sdkTrack.album?.images?.[0]?.url,
  };
}

function applyPlaybackPosition(positionMs, durationMs, setters) {
  const durationSec = Math.max(1, Math.floor(durationMs / 1000));
  const sec = Math.floor(positionMs / 1000);
  setters.setCurrentSec(sec);
  setters.setPlaybackMs?.(positionMs);
  setters.setProgress(durationMs > 0 ? positionMs / durationMs : 0);
  setters.totalSecRef.current = durationSec;
}

function getStoredVolume() {
  const stored = Number(localStorage.getItem("spotify_volume"));
  return Number.isFinite(stored) ? Math.max(0, Math.min(100, stored)) : 50;
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
        <p
          style={{
            marginTop: 20,
            fontSize: 10,
            color: "var(--g4)",
            maxWidth: 320,
            lineHeight: 1.6,
          }}
        >
          W trybie deweloperskim Spotify tylko konta z listy User Management mogą się
          zalogować (nazwa użytkownika Spotify, nie e-mail). Odtwarzanie wymaga konta
          Premium oraz przeglądarki z Widevine (Chrome / Edge).
        </p>
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
  const [tracksLoading, setTracksLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [showNowPlaying, setShowNowPlaying] = useState(
    () => localStorage.getItem("now_playing_open") !== "false",
  );

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
  const [playbackMs, setPlaybackMs] = useState(0);
  const [currentPlaylistUri, setCurrentPlaylistUri] = useState(null);

  const [player, setPlayer] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState(null);
  const pendingPlayRef = useRef(null);
  const playerRef = useRef(null);
  const deviceIdRef = useRef(null);
  const currentPlaylistUriRef = useRef(null);
  const currentTracksRef = useRef([]);
  const currentIdxRef = useRef(0);
  const isShuffleRef = useRef(false);
  const isRepeatRef = useRef(false);
  const advancingRef = useRef(false);
  const userPausedRef = useRef(false);
  const currentViewRef = useRef("liked");

  const [addModalTracks, setAddModalTracks] = useState(null);
  const [addModalLoading, setAddModalLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [volume, setVolume] = useState(getStoredVolume);

  const progressIntervalRef = useRef(null);
  const totalSecRef = useRef(0);
  const volumeTimeoutRef = useRef(null);
  const volumeBeforeMuteRef = useRef(getStoredVolume());
  const toastTimeoutRef = useRef(null);

  useEffect(() => {
    deviceIdRef.current = deviceId;
  }, [deviceId]);

  useEffect(() => {
    currentPlaylistUriRef.current = currentPlaylistUri;
  }, [currentPlaylistUri]);

  useEffect(() => {
    currentTracksRef.current = currentTracks;
  }, [currentTracks]);

  useEffect(() => {
    currentIdxRef.current = currentIdx;
  }, [currentIdx]);

  useEffect(() => {
    isShuffleRef.current = isShuffle;
  }, [isShuffle]);

  useEffect(() => {
    isRepeatRef.current = isRepeat;
  }, [isRepeat]);

  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  function toggleNowPlaying() {
    setShowNowPlaying((open) => {
      const next = !open;
      localStorage.setItem("now_playing_open", String(next));
      return next;
    });
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3200);
  }

  useEffect(() => {
    const auth = parseAuthCallback();
    if (!auth) return;

    window.history.replaceState({}, "", "/");

    if (!auth.ok) {
      showToast(auth.error, "error");
      return;
    }

    setLoading(true);
    setLoadingMsg("AUTH.SYNC");
    exchangeCodeForToken(auth.code).then((result) => {
      if (result.ok) {
        setLoggedIn(true);
      } else {
        showToast(result.error, "error");
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    if (!localStorage.getItem("spotify_token")) return;

    setPlayerReady(false);
    setPlayerError(null);
    setDeviceId(null);

    function initSpotifyPlayer() {
      if (!window.Spotify?.Player) return;

      const spotifyPlayer = new window.Spotify.Player({
        name: "HermanOS Client",
        getOAuthToken: async (cb) => {
          try {
            const token = await getValidAccessToken();
            cb(token || "");
          } catch {
            cb("");
          }
        },
        volume: getStoredVolume() / 100,
      });

      spotifyPlayer.addListener("ready", ({ device_id }) => {
        deviceIdRef.current = device_id;
        setDeviceId(device_id);
        setPlayerReady(true);
        setPlayerError(null);
        transferPlayback(device_id)
          .then(() => {
            const pending = pendingPlayRef.current;
            if (pending) {
              pendingPlayRef.current = null;
              pending();
            }
          })
          .catch(console.error);
      });

      spotifyPlayer.addListener("player_state_changed", (state) => {
        if (!state) {
          setIsPlaying(false);
          return;
        }

        setIsPlaying(!state.paused);
        if (state.paused) {
          userPausedRef.current = true;
        } else {
          userPausedRef.current = false;
          advancingRef.current = false;
        }

        setIsShuffle(Boolean(state.shuffle));
        setIsRepeat(state.repeat_mode !== 0);

        const sdkTrack = state.track_window?.current_track;
        if (!sdkTrack) return;

        const mapped = mapSdkTrack(sdkTrack);
        if (!mapped) return;

        const tracks = currentTracksRef.current;
        const idx = tracks.findIndex((t) => t.id === mapped.id);
        setCurrentTrack(mapped);
        if (idx >= 0) setCurrentIdx(idx);

        applyPlaybackPosition(state.position, state.duration, {
          setCurrentSec,
          setPlaybackMs,
          setProgress,
          totalSecRef,
        });
      });

      spotifyPlayer.addListener("not_ready", () => {
        setPlayerReady(false);
      });

      spotifyPlayer.addListener("initialization_error", ({ message }) => {
        setPlayerReady(false);
        setPlayerError(
          message?.includes("keysystem")
            ? "Przeglądarka nie obsługuje DRM (Widevine). Użyj Chrome lub Edge na https, albo uruchom aplikację w przeglądarce zamiast Electrona."
            : message || "Błąd inicjalizacji odtwarzacza",
        );
      });

      spotifyPlayer.addListener("authentication_error", () => {
        setPlayerError("Błąd autoryzacji odtwarzacza — wyloguj się i zaloguj ponownie.");
      });

      spotifyPlayer.addListener("account_error", () => {
        setPlayerError(
          "Web Playback wymaga konta Spotify Premium na tym użytkowniku.",
        );
      });

      spotifyPlayer.addListener("playback_error", ({ message }) => {
        console.warn("Playback error:", message);
      });

      playerRef.current = spotifyPlayer;
      setPlayer(spotifyPlayer);
      spotifyPlayer.connect();
    }

    if (window.Spotify?.Player) {
      initSpotifyPlayer();
      return () => {
        playerRef.current?.disconnect();
        playerRef.current = null;
      };
    }

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);
    window.onSpotifyWebPlaybackSDKReady = initSpotifyPlayer;

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (e.code === "KeyL" && currentTrack) toggleNowPlaying();
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
      const [liked, pls, profile] = await Promise.all([
        getLikedTracks({
          maxTracks: 50,
          onProgress: (loaded, total) => {
            if (total) setLoadingHint(`${loaded} / ${total} utworów`);
          },
        }),
        getPlaylists(),
        getCurrentUser().catch(() => null),
      ]);
      setLikedTracks(liked.tracks);
      setLikedTotal(liked.total);
      setLikedNextUrl(liked.hasMore ? liked.nextUrl : null);
      if (currentViewRef.current === "liked") {
        setCurrentTracks(liked.tracks);
        currentTracksRef.current = liked.tracks;
      }
      setPlaylists(pls);
      if (profile) setUserProfile(profile);
    } catch (err) {
      console.error("Library sync failed:", err);
      showToast(err.message || "Błąd synchronizacji", "error");
      setLikedTracks([]);
      setCurrentTracks([]);
      currentTracksRef.current = [];
      setPlaylists([]);
    } finally {
      setLoading(false);
      setLoadingHint("");
    }
  }

  async function refreshPlaylistTracks(playlistId) {
    const tracks = await getPlaylistTracks(playlistId);
    setTrackCache((prev) => ({ ...prev, [playlistId]: tracks }));
    if (currentViewRef.current === playlistId) {
      setCurrentTracks(tracks);
      currentTracksRef.current = tracks;
    }
    return tracks;
  }

  async function handleSelectView(id) {
    currentViewRef.current = id;
    setCurrentView(id);

    if (id === "liked") {
      setCurrentTracks(likedTracks);
      currentTracksRef.current = likedTracks;
      setCurrentPlaylistUri(null);
      currentPlaylistUriRef.current = null;
      setTracksLoading(false);
      return;
    }

    const pl = playlists.find((p) => p.id === id);
    const playlistUri = pl?.uri || null;
    setCurrentPlaylistUri(playlistUri);
    currentPlaylistUriRef.current = playlistUri;

    const cached = trackCache[id];
    if (cached) {
      setCurrentTracks(cached);
      currentTracksRef.current = cached;
      setTracksLoading(false);
      return;
    }

    setCurrentTracks([]);
    currentTracksRef.current = [];
    setTracksLoading(true);

    try {
      const tracks = await refreshPlaylistTracks(id);
      setCurrentTracks(tracks);
      currentTracksRef.current = tracks;
    } catch (err) {
      console.warn("Playlist access:", err);
      setCurrentTracks([]);
      currentTracksRef.current = [];
      showToast("Brak dostępu do tej playlisty", "error");
    } finally {
      setTracksLoading(false);
    }
  }

  async function startPlayback(track, idx, contextUri, { skipLocalState = false } = {}) {
    advancingRef.current = true;
    userPausedRef.current = false;

    if (!skipLocalState) {
      setCurrentTrack(track);
      setCurrentIdx(idx);
      currentIdxRef.current = idx;
      setIsPlaying(true);
      setCurrentSec(0);
      setPlaybackMs(0);
      setProgress(0);
      totalSecRef.current = parseDuration(track.duration);
    }

    try {
      await playTrackOnSpotify(track.uri, contextUri, deviceIdRef.current);
    } catch (err) {
      setIsPlaying(false);
      showToast(err.message || "Nie udało się odtworzyć", "error");
    } finally {
      setTimeout(() => {
        advancingRef.current = false;
      }, 400);
    }
  }

  function handlePlayTrack(track, idx, contextUriOverride) {
    const contextUri =
      contextUriOverride !== undefined ? contextUriOverride : currentPlaylistUriRef.current;
    if (!playerReady || !deviceIdRef.current) {
      pendingPlayRef.current = () => startPlayback(track, idx, contextUri);
      setCurrentTrack(track);
      setCurrentIdx(idx);
      currentIdxRef.current = idx;
      showToast("Łączenie odtwarzacza Spotify…", "success");
      return;
    }
    startPlayback(track, idx, contextUri);
  }

  function handlePlayFromSearch(track) {
    setCurrentPlaylistUri(null);
    currentPlaylistUriRef.current = null;
    setCurrentTracks([track]);
    currentTracksRef.current = [track];
    handlePlayTrack(track, 0, null);
  }

  async function handlePlayAll() {
    const tracks = currentTracksRef.current;
    if (!tracks.length) return;

    const track = tracks[0];
    const contextUri =
      currentView === "liked" ? null : currentPlaylistUriRef.current;

    if (!playerReady || !deviceIdRef.current) {
      pendingPlayRef.current = () => startPlayback(track, 0, contextUri);
      setCurrentTrack(track);
      setCurrentIdx(0);
      currentIdxRef.current = 0;
      showToast("Łączenie odtwarzacza Spotify…", "success");
      return;
    }

    advancingRef.current = true;
    userPausedRef.current = false;
    setCurrentTrack(track);
    setCurrentIdx(0);
    currentIdxRef.current = 0;
    setIsPlaying(true);
    setCurrentSec(0);
    setPlaybackMs(0);
    setProgress(0);
    totalSecRef.current = parseDuration(track.duration);

    try {
      if (contextUri) {
        await playContext(contextUri, deviceIdRef.current, track.uri);
      } else {
        await playTrackOnSpotify(track.uri, null, deviceIdRef.current);
      }
    } catch (err) {
      setIsPlaying(false);
      showToast(err.message || "Nie udało się odtworzyć", "error");
    } finally {
      setTimeout(() => {
        advancingRef.current = false;
      }, 400);
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

  async function handleCopyPlaylistLink() {
    if (currentView === "liked") return;
    const pl = playlists.find((p) => p.id === currentView);
    if (!pl?.id) return;
    const url = `https://open.spotify.com/playlist/${pl.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link skopiowany do schowka");
    } catch {
      showToast("Nie udało się skopiować linku", "error");
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
      currentTracksRef.current = likedTracks;
      setCurrentPlaylistUri(null);
      currentPlaylistUriRef.current = null;
      showToast("Playlista usunięta");
    } catch (err) {
      showToast(err.message || "Nie udało się usunąć playlisty", "error");
    }
  }

  const advanceLocalQueue = useCallback(async () => {
    if (advancingRef.current || currentPlaylistUriRef.current) return;

    const tracks = currentTracksRef.current;
    if (!tracks.length) return;

    advancingRef.current = true;
    const idx = currentIdxRef.current;

    try {
      if (isRepeatRef.current) {
        await startPlayback(tracks[idx], idx, null);
        return;
      }

      const nextIdx = isShuffleRef.current
        ? Math.floor(Math.random() * tracks.length)
        : (idx + 1) % tracks.length;

      if (!isShuffleRef.current && idx === tracks.length - 1) {
        setIsPlaying(false);
        return;
      }

      await startPlayback(tracks[nextIdx], nextIdx, null);
    } finally {
      setTimeout(() => {
        advancingRef.current = false;
      }, 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    clearInterval(progressIntervalRef.current);
    if (!playerReady || !playerRef.current) return undefined;

    progressIntervalRef.current = setInterval(async () => {
      try {
        const state = await playerRef.current.getCurrentState();
        if (!state) return;

        applyPlaybackPosition(state.position, state.duration, {
          setCurrentSec,
          setPlaybackMs,
          setProgress,
          totalSecRef,
        });

        const nearEnd =
          state.duration > 0 && state.position >= state.duration - 500;
        const trackEnded = nearEnd && state.paused && !userPausedRef.current;

        if (
          trackEnded &&
          !currentPlaylistUriRef.current &&
          !advancingRef.current
        ) {
          await advanceLocalQueue();
        }
      } catch {
        /* player disconnected */
      }
    }, 100);

    return () => clearInterval(progressIntervalRef.current);
  }, [playerReady, advanceLocalQueue]);

  async function handleTogglePlay() {
    if (!currentTrack) {
      if (currentTracksRef.current.length > 0) handlePlayTrack(currentTracksRef.current[0], 0);
      return;
    }
    const newState = !isPlaying;
    userPausedRef.current = !newState;
    setIsPlaying(newState);
    try {
      if (newState) await resumeSpotify(deviceIdRef.current);
      else await pauseSpotify(deviceIdRef.current);
    } catch (err) {
      console.warn("Toggle error:", err);
    }
  }

  const handleNext = useCallback(async () => {
    const tracks = currentTracksRef.current;
    if (!tracks.length || advancingRef.current) return;

    if (currentPlaylistUriRef.current) {
      advancingRef.current = true;
      try {
        await nextSpotify();
      } catch (err) {
        console.warn("Next error:", err);
        const nextIdx = isShuffleRef.current
          ? Math.floor(Math.random() * tracks.length)
          : (currentIdxRef.current + 1) % tracks.length;
        await startPlayback(tracks[nextIdx], nextIdx, currentPlaylistUriRef.current);
      } finally {
        setTimeout(() => {
          advancingRef.current = false;
        }, 400);
      }
      return;
    }

    const nextIdx = isShuffleRef.current
      ? Math.floor(Math.random() * tracks.length)
      : (currentIdxRef.current + 1) % tracks.length;
    await startPlayback(tracks[nextIdx], nextIdx, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePrev() {
    const tracks = currentTracksRef.current;
    if (!tracks.length || advancingRef.current) return;

    if (currentSec > 3) {
      setCurrentSec(0);
      setPlaybackMs(0);
      setProgress(0);
      try {
        await seekSpotify(0);
      } catch {
        /* optional */
      }
      return;
    }

    if (currentPlaylistUriRef.current) {
      advancingRef.current = true;
      try {
        await prevSpotify();
      } catch (err) {
        console.warn("Prev error:", err);
        const prevIdx =
          (currentIdxRef.current - 1 + tracks.length) % tracks.length;
        await startPlayback(
          tracks[prevIdx],
          prevIdx,
          currentPlaylistUriRef.current,
        );
      } finally {
        setTimeout(() => {
          advancingRef.current = false;
        }, 400);
      }
      return;
    }

    const prevIdx = (currentIdxRef.current - 1 + tracks.length) % tracks.length;
    await startPlayback(tracks[prevIdx], prevIdx, null);
  }

  async function handleSeek(ratio) {
    const sec = Math.floor(ratio * totalSecRef.current);
    await handleSeekToTime(sec);
  }

  async function handleSeekToTime(sec) {
    const maxSec = totalSecRef.current || 0;
    const clamped = Math.max(0, Math.min(maxSec, sec));
    const ms = Math.round(clamped * 1000);
    setCurrentSec(Math.floor(clamped));
    setPlaybackMs(ms);
    setProgress(maxSec > 0 ? clamped / maxSec : 0);
    try {
      await seekSpotify(ms);
    } catch {
      /* optional */
    }
  }

  function applyVolume(val) {
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    setVolume(clamped);
    localStorage.setItem("spotify_volume", String(clamped));
    if (clamped > 0) volumeBeforeMuteRef.current = clamped;

    try {
      playerRef.current?.setVolume(clamped / 100);
    } catch (err) {
      console.warn("Player volume error:", err);
    }

    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(async () => {
      try {
        await setVolumeSpotify(clamped);
      } catch (err) {
        console.warn("Volume error:", err);
      }
    }, 120);
  }

  function handleToggleMute() {
    if (volume > 0) {
      applyVolume(0);
      return;
    }
    applyVolume(volumeBeforeMuteRef.current || 50);
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

  function disconnectPlayer() {
    playerRef.current?.disconnect();
    playerRef.current = null;
    deviceIdRef.current = null;
    setPlayer(null);
    setDeviceId(null);
    setPlayerReady(false);
  }

  function handleLogout({ switchAccount = false } = {}) {
    disconnectPlayer();
    if (switchAccount) {
      logout({ spotifyLogout: true });
      return;
    }
    logout();
    setLoggedIn(false);
    setPlaylists([]);
    setLikedTracks([]);
    setCurrentTrack(null);
    setUserProfile(null);
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
      <Topbar
        userProfile={userProfile}
        onLogout={() => handleLogout()}
        onSwitchAccount={() => handleLogout({ switchAccount: true })}
      />
      {playerError && (
        <div
          className="player-status-banner"
          role="alert"
          style={{
            padding: "10px 16px",
            fontSize: 12,
            color: "var(--g2)",
            background: "rgba(180, 40, 40, 0.15)",
            borderBottom: "1px solid rgba(180, 40, 40, 0.35)",
            lineHeight: 1.5,
          }}
        >
          {playerError}
        </div>
      )}
      {!playerError && loggedIn && !playerReady && (
        <div
          style={{
            padding: "8px 16px",
            fontSize: 11,
            color: "var(--g3)",
            letterSpacing: "0.1em",
            borderBottom: "1px solid var(--g5)",
          }}
        >
          Łączenie odtwarzacza Spotify…
        </div>
      )}

      <div className="app-body">
        <div className="app-sidebar-col">
          <Search
            onPlayTrack={handlePlayFromSearch}
            onAddTracks={(tracks) => setAddModalTracks(tracks)}
          />
          <Sidebar playlists={playlists} currentView={currentView} onSelect={handleSelectView} />
          <CreatePlaylist onPlaylistCreated={handlePlaylistCreated} />
        </div>

        <div className="app-content-row">
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
            onCopyPlaylistLink={currentView !== "liked" ? handleCopyPlaylistLink : undefined}
            onLoadMore={currentView === "liked" ? handleLoadMoreLiked : undefined}
            hasMoreLiked={Boolean(likedNextUrl)}
            likedTotal={likedTotal}
            loadingMore={loadingMore}
            loadingTracks={tracksLoading}
          />

          {showNowPlaying && currentTrack && (
            <NowPlaying
              track={currentTrack}
              playbackMs={playbackMs}
              isPlaying={isPlaying}
              onClose={toggleNowPlaying}
              onPlayTrack={(t) => handlePlayTrack(t, 0, null)}
              onSeekToTime={handleSeekToTime}
            />
          )}
        </div>
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
        volume={volume}
        onVolume={applyVolume}
        onToggleMute={handleToggleMute}
        showNowPlaying={showNowPlaying}
        onToggleNowPlaying={toggleNowPlaying}
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
