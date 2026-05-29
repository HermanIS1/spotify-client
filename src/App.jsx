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
  createPlaylist,
  addTracksToPlaylist,
} from "./spotify";

function parseDuration(dur) {
  if (!dur) return 0;
  const [m, s] = dur.split(":");
  return parseInt(m) * 60 + parseInt(s);
}

function LoginScreen() {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg)", gap: "24px" }}>
      <div style={{ fontFamily: "var(--font-gothic)", fontSize: "48px", color: "var(--g)" }}>Spotify</div>
      <button onClick={redirectToLogin} style={{ padding: "10px 32px", background: "none", border: "var(--border2)", color: "var(--g)", cursor: "pointer" }}>
        &gt;_ ZALOGUJ PRZEZ SPOTIFY
      </button>
    </div>
  );
}

function LoadingScreen({ message }) {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg)", gap: "12px" }}>
      <div style={{ fontSize: "12px", color: "var(--g3)" }}>{message} <span className="cursor">█</span></div>
    </div>
  );
}

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
  const [deviceId, setDeviceId] = useState(null);
  const [selectedTracks, setSelectedTracks] = useState([]);
  
  const intervalRef = useRef(null);
  const totalSecRef = useRef(0);
  const syncInterval = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.history.replaceState({}, "", "/");
      setLoading(true);
      setLoadingMsg("wymiana tokenu...");
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
        getOAuthToken: (cb) => cb(token),
        volume: 0.5,
      });

      spotifyPlayer.addListener("ready", ({ device_id }) => {
        setDeviceId(device_id);
        transferPlayback(device_id).catch(console.error);
      });

      spotifyPlayer.connect();
    };
    return () => { if (script.parentNode) script.parentNode.removeChild(script); };
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn) return;
    loadLibrary();
  }, [loggedIn]);

  async function loadLibrary() {
    setLoading(true);
    setLoadingMsg("pobieranie danych...");
    const liked = await getLikedTracks();
    setLikedTracks(liked);
    setCurrentTracks(liked);
    const pls = await getPlaylists();
    setPlaylists(pls);
    setLoading(false);
  }

  async function handleSelectView(id) {
    setCurrentView(id);
    if (id === "liked") {
      setCurrentTracks(likedTracks);
      setCurrentPlaylistUri(null);
    } else {
      setLoading(true);
      const tracks = await getPlaylistTracks(id);
      setTrackCache((prev) => ({ ...prev, [id]: tracks }));
      setCurrentTracks(tracks);
      const pl = playlists.find((p) => p.id === id);
      setCurrentPlaylistUri(pl?.uri || null);
      setLoading(false);
    }
  }

  async function handlePlayTrack(track, idx) {
    setCurrentTrack(track);
    setCurrentIdx(idx);
    setIsPlaying(true);
    totalSecRef.current = parseDuration(track.duration);
    await playTrackOnSpotify(track.uri, currentPlaylistUri);
  }

  const handleNext = useCallback(async () => {
    if (!currentTracks.length) return;
    const nextIdx = isShuffle ? Math.floor(Math.random() * currentTracks.length) : (currentIdx + 1) % currentTracks.length;
    handlePlayTrack(currentTracks[nextIdx], nextIdx);
    await nextSpotify();
  }, [currentIdx, currentTracks, isShuffle]);

  function handleLogout() {
    logout();
    setLoggedIn(false);
  }

  const activePlaylist = currentView === "liked" 
    ? { id: "liked", name: "Polubione utwory", tracks: likedTracks }
    : { ...playlists.find(p => p.id === currentView), tracks: currentTracks };

  if (!loggedIn) return <LoginScreen />;
  if (loading) return <LoadingScreen message={loadingMsg} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>
      <Topbar onLogout={handleLogout} />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
          <Search />
          <Sidebar playlists={playlists} currentView={currentView} onSelect={handleSelectView} />
          <CreatePlaylist />
        </div>
        <TrackList playlist={activePlaylist} currentTrackId={currentTrack?.id} isPlaying={isPlaying} onPlay={handlePlayTrack} />
      </div>
      <Player track={currentTrack} isPlaying={isPlaying} onNext={handleNext} />
    </div>
  );
}
