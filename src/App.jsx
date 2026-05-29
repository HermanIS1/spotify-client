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
  const volumeTimeoutRef = useRef(null);
  const isExchanging = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code && !isExchanging.current) {
      isExchanging.current = true;
      window.history.replaceState({}, "", "/");
      setLoading(true);
      setLoadingMsg("Logowanie...");
      exchangeCodeForToken(code).then((data) => {
        if (data && data.access_token) setLoggedIn(true);
        setLoading(false);
      });
    }
  }, []);

  useEffect(() => {
    if (loggedIn) loadLibrary();
  }, [loggedIn]);

  async function loadLibrary() {
    setLoading(true);
    try {
      setLoadingMsg("Pobieranie biblioteki...");
      const liked = await getLikedTracks();
      setLikedTracks(liked);
      setCurrentTracks(liked);
      const pls = await getPlaylists();
      setPlaylists(pls);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleSelectView(id) {
    setCurrentView(id);
    if (id === "liked") {
      setCurrentTracks(likedTracks);
      setCurrentPlaylistUri(null);
    } else {
      setLoading(true);
      const tracks = await getPlaylistTracks(id);
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
    setCurrentSec(0);
    totalSecRef.current = parseDuration(track.duration);
    await playTrackOnSpotify(track.uri, currentPlaylistUri, deviceId);
  }

  async function handleTogglePlay() {
    setIsPlaying(!isPlaying);
    isPlaying ? await pauseSpotify() : await resumeSpotify();
  }

  async function handleVolume(val) {
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(async () => {
      await setVolumeSpotify(val);
    }, 300);
  }

  if (!loggedIn) return <div className="center"><button onClick={redirectToLogin}>ZALOGUJ</button></div>;
  if (loading) return <div className="center">{loadingMsg}</div>;

  return (
    <div className="app-container">
      <Topbar onLogout={logout} />
      <div className="main-content">
        <Sidebar playlists={playlists} onSelect={handleSelectView} />
        <TrackList playlist={{ tracks: currentTracks }} onPlay={handlePlayTrack} />
      </div>
      <Player 
        track={currentTrack} 
        isPlaying={isPlaying} 
        onTogglePlay={handleTogglePlay}
        onVolume={handleVolume}
      />
    </div>
  );
}
