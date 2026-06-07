import { useState, useEffect, useRef } from "react";
import { getTrack, getArtist, getArtistTopTracks } from "../spotify";
import { fetchLyrics, parseLrc, getLyricSyncState } from "../lyrics";

function LyricLine({ line, lineIdx, sync, isPast, lineRef, onSeekToTime }) {
  const isCurrent = lineIdx === sync.lineIdx;

  return (
    <p
      ref={isCurrent ? lineRef : null}
      className={`lyric-line ${isCurrent ? "current" : ""} ${isPast ? "past" : ""}`}
    >
      {line.words.map((word, wi) => (
        <span key={`${lineIdx}-${wi}-${word.text}`}>
          <button
            type="button"
            className={`lyric-word ${isCurrent && wi === sync.wordIdx ? "active" : ""} ${
              isCurrent && wi < sync.wordIdx ? "sung" : ""
            }`}
            onClick={() => onSeekToTime(word.time)}
            title={`Przejdź do ${formatTime(word.time)}`}
          >
            {word.text}
          </button>
          {wi < line.words.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatFollowers(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function PopularityBar({ value, label }) {
  return (
    <div className="np-stat">
      <div className="np-stat-head">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="np-stat-bar">
        <div className="np-stat-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function NowPlaying({
  track,
  playbackMs = 0,
  isPlaying,
  onClose,
  onPlayTrack,
  onSeekToTime,
}) {
  const [tab, setTab] = useState("lyrics");
  const [details, setDetails] = useState(null);
  const [artist, setArtist] = useState(null);
  const [topTracks, setTopTracks] = useState([]);
  const [lyrics, setLyrics] = useState(null);
  const [syncedLines, setSyncedLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const lyricsRef = useRef(null);
  const activeLineRef = useRef(null);

  const currentTimeSec = playbackMs / 1000;
  const sync = getLyricSyncState(syncedLines, currentTimeSec);

  useEffect(() => {
    if (!track?.id) return undefined;

    let cancelled = false;
    setLoading(true);
    setDetails(null);
    setArtist(null);
    setTopTracks([]);
    setLyrics(null);
    setSyncedLines([]);

    async function load() {
      try {
        const [trackData, lyricsData] = await Promise.all([
          getTrack(track.id),
          fetchLyrics(track.name, track.artist, parseDuration(track.duration)),
        ]);

        if (cancelled) return;
        setDetails(trackData);
        setLyrics(lyricsData);

        if (lyricsData?.synced) {
          const durationSec =
            trackData?.durationMs != null
              ? trackData.durationMs / 1000
              : parseDuration(track.duration);
          setSyncedLines(parseLrc(lyricsData.synced, durationSec));
        }

        if (trackData?.artistId) {
          const [artistData, tops] = await Promise.all([
            getArtist(trackData.artistId),
            getArtistTopTracks(trackData.artistId),
          ]);
          if (!cancelled) {
            setArtist(artistData);
            setTopTracks(tops.slice(0, 5));
          }
        }
      } catch (err) {
        console.warn("Now playing load:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [track?.id]);

  useEffect(() => {
    if (tab !== "lyrics" || !activeLineRef.current || !lyricsRef.current) return;
    activeLineRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [sync.lineIdx, tab]);

  if (!track) return null;

  const cover = details?.album?.image || details?.image || track.image;
  const albumName = details?.album?.name;
  const releaseYear = details?.album?.releaseDate?.slice(0, 4);

  return (
    <aside className="now-playing panel-glow" aria-label="Teraz odtwarzane">
      <div className="now-playing-bg" style={cover ? { backgroundImage: `url(${cover})` } : undefined} />

      <header className="now-playing-header">
        <div className="panel-header" style={{ padding: 0 }}>
          NOW.PLAYING
        </div>
        <button type="button" className="btn-icon" onClick={onClose} title="Zamknij">
          <i className="ti ti-x" />
        </button>
      </header>

      <div className="now-playing-hero">
        <div className="now-playing-cover-wrap">
          {cover ? (
            <img src={cover} alt="" className="now-playing-cover" />
          ) : (
            <div className="now-playing-cover now-playing-cover--empty">
              <i className="ti ti-music" />
            </div>
          )}
          {isPlaying && <div className="now-playing-eq" aria-hidden="true">
            <span /><span /><span /><span />
          </div>}
        </div>
        <h2 className="now-playing-title title-display">{track.name}</h2>
        <p className="now-playing-artist">{track.artist}</p>
        {(albumName || releaseYear) && (
          <p className="now-playing-album">
            {albumName}
            {releaseYear ? ` · ${releaseYear}` : ""}
          </p>
        )}
      </div>

      <nav className="now-playing-tabs" role="tablist">
        {[
          { id: "lyrics", icon: "ti-microphone-2", label: "Tekst" },
          { id: "artist", icon: "ti-user", label: "Artysta" },
          { id: "track", icon: "ti-disc", label: "Album" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`now-playing-tab ${tab === item.id ? "active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            <i className={`ti ${item.icon}`} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="now-playing-body">
        {loading && (
          <div className="now-playing-loading">
            <span className="track-list-loading-spinner" />
            <span>SYNC...</span>
          </div>
        )}

        {!loading && tab === "lyrics" && (
          <div className="now-playing-lyrics" ref={lyricsRef}>
            {syncedLines.length > 0 ? (
              syncedLines.map((line, i) => (
                <LyricLine
                  key={`${line.time}-${i}`}
                  line={line}
                  lineIdx={i}
                  sync={sync}
                  isPast={i < sync.lineIdx}
                  lineRef={activeLineRef}
                  onSeekToTime={onSeekToTime}
                />
              ))
            ) : lyrics?.plain ? (
              lyrics.plain.split("\n").map((line, i) => (
                <p key={i} className="lyric-line plain">
                  {line || "\u00A0"}
                </p>
              ))
            ) : (
              <div className="now-playing-empty">
                <i className="ti ti-microphone-off" />
                <p>Brak tekstu dla tego utworu</p>
                <span>Spróbuj innej wersji lub utworu z LRCLIB</span>
              </div>
            )}
          </div>
        )}

        {!loading && tab === "artist" && (
          <div className="now-playing-artist-panel">
            {artist ? (
              <>
                <div className="artist-card">
                  {artist.image ? (
                    <img src={artist.image} alt="" className="artist-card-img" />
                  ) : (
                    <div className="artist-card-img artist-card-img--empty">
                      <i className="ti ti-user" />
                    </div>
                  )}
                  <div className="artist-card-info">
                    <h3 className="title-display glow-text">{artist.name}</h3>
                    <p className="artist-followers">
                      {formatFollowers(artist.followers)} obserwujących
                    </p>
                    {artist.genres.length > 0 && (
                      <div className="artist-genres">
                        {artist.genres.slice(0, 4).map((g) => (
                          <span key={g} className="genre-tag">
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <PopularityBar value={artist.popularity} label="Popularność artysty" />

                {artist.spotifyUrl && (
                  <a
                    href={artist.spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost np-spotify-link"
                  >
                    <i className="ti ti-brand-spotify" />
                    Otwórz w Spotify
                  </a>
                )}

                {topTracks.length > 0 && (
                  <div className="np-top-tracks">
                    <div className="panel-header">TOP.TRACKS</div>
                    {topTracks.map((t, i) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`np-top-track ${t.id === track.id ? "current" : ""}`}
                        onClick={() => onPlayTrack(t, i)}
                      >
                        <span className="np-top-rank">{i + 1}</span>
                        {t.image ? (
                          <img src={t.image} alt="" className="np-top-art" />
                        ) : (
                          <div className="np-top-art np-top-art--empty">
                            <i className="ti ti-music" />
                          </div>
                        )}
                        <span className="np-top-name">{t.name}</span>
                        <span className="np-top-dur">{t.duration}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="now-playing-empty">
                <i className="ti ti-user-off" />
                <p>Nie udało się załadować profilu artysty</p>
              </div>
            )}
          </div>
        )}

        {!loading && tab === "track" && (
          <div className="now-playing-track-panel">
            {details ? (
              <>
                {cover && (
                  <img src={cover} alt="" className="np-album-cover" />
                )}
                <h3 className="title-display">{details.album?.name}</h3>
                <p className="np-meta-row">
                  <span>Wydanie</span>
                  <span>{details.album?.releaseDate || "—"}</span>
                </p>
                <p className="np-meta-row">
                  <span>Czas trwania</span>
                  <span>{details.duration}</span>
                </p>
                <PopularityBar value={details.popularity} label="Popularność utworu" />
                <p className="np-meta-row">
                  <span>Wykonawcy</span>
                  <span>{details.artist}</span>
                </p>
              </>
            ) : (
              <div className="now-playing-empty">
                <i className="ti ti-disc-off" />
                <p>Brak szczegółów albumu</p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function parseDuration(dur) {
  if (!dur) return 0;
  const [m, s] = dur.split(":");
  return parseInt(m, 10) * 60 + parseInt(s, 10);
}
