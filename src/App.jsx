import { useState, useEffect, useRef } from "react";
import { isLoggedIn, exchangeCodeForToken, getLikedTracks, playTrackOnSpotify, logout } from "./spotify";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks] = useState([]);
  const isExchanging = useRef(false);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code && !isExchanging.current) {
      isExchanging.current = true;
      setLoading(true);
      exchangeCodeForToken(code).then(data => {
        if (data?.access_token) setLoggedIn(true);
        setLoading(false);
      });
    }
  }, []);

  useEffect(() => {
    if (loggedIn) {
      getLikedTracks().then(setTracks);
    }
  }, [loggedIn]);

  if (!loggedIn) return <button onClick={() => window.location.href = "..."}>ZALOGUJ</button>;
  if (loading) return <div>Ładowanie...</div>;

  return (
    <div>
      <button onClick={logout}>Wyloguj</button>
      {tracks.map(t => <div key={t.id} onClick={() => playTrackOnSpotify(t.uri)}>{t.name} - {t.artist}</div>)}
    </div>
  );
}
