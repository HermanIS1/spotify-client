function parseTimestamp(min, sec, frac) {
  const ms = frac ? Number(String(frac).padEnd(3, "0")) : 0;
  return Number(min) * 60 + Number(sec) + ms / 1000;
}

function tokenizeWords(text) {
  return (text.match(/\S+/g) || []).filter(Boolean);
}

function interpolateWords(text, startTime, endTime) {
  const parts = tokenizeWords(text);
  if (!parts.length) return [];

  const duration = Math.max(0.05, endTime - startTime);
  const totalWeight = parts.reduce((sum, word) => sum + Math.max(1, word.length), 0);
  let cursor = startTime;

  return parts.map((word, i) => {
    const isLast = i === parts.length - 1;
    const slice = isLast
      ? endTime - cursor
      : duration * (Math.max(1, word.length) / totalWeight);
    const entry = {
      text: word,
      time: cursor,
      endTime: cursor + slice,
    };
    cursor += slice;
    return entry;
  });
}

function parseTimedSegments(raw) {
  const segments = [];

  const esRegex = /<(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?>([^<]*)/g;
  let match;
  while ((match = esRegex.exec(raw)) !== null) {
    const text = match[4].trim();
    if (text) {
      segments.push({
        time: parseTimestamp(match[1], match[2], match[3]),
        text,
      });
    }
  }
  if (segments.length) return segments;

  const bracketRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?]\s*([^[]*)/g;
  while ((match = bracketRegex.exec(raw)) !== null) {
    const text = match[4].trim();
    if (text) {
      segments.push({
        time: parseTimestamp(match[1], match[2], match[3]),
        text,
      });
    }
  }

  return segments;
}

export function parseLrc(lrcText, trackDurationSec = 0) {
  if (!lrcText?.trim()) return [];

  const lines = [];

  for (const raw of lrcText.split("\n")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const segments = parseTimedSegments(trimmed);
    if (!segments.length) continue;

    if (segments.length === 1 && segments[0].text.includes(" ")) {
      lines.push({
        time: segments[0].time,
        text: segments[0].text,
        words: null,
      });
      continue;
    }

    if (segments.length > 1 && segments.every((s) => !s.text.includes(" "))) {
      lines.push({
        time: segments[0].time,
        text: segments.map((s) => s.text).join(" "),
        words: segments.map((s, i) => ({
          text: s.text,
          time: s.time,
          endTime: segments[i + 1]?.time,
        })),
      });
      continue;
    }

    lines.push({
      time: segments[0].time,
      text: segments.map((s) => s.text).join(" "),
      words: null,
    });
  }

  lines.sort((a, b) => a.time - b.time);

  for (let i = 0; i < lines.length; i++) {
    const nextTime = lines[i + 1]?.time;
    const fallbackEnd = trackDurationSec > lines[i].time
      ? trackDurationSec
      : lines[i].time + 3.5;
    lines[i].endTime = nextTime ?? fallbackEnd;

    if (!lines[i].words?.length) {
      lines[i].words = interpolateWords(lines[i].text, lines[i].time, lines[i].endTime);
    } else {
      lines[i].words = lines[i].words.map((word, wi) => ({
        ...word,
        endTime: word.endTime ?? lines[i].words[wi + 1]?.time ?? lines[i].endTime,
      }));
    }
  }

  return lines;
}

export function getLyricSyncState(lines, currentSec) {
  if (!lines.length || currentSec < 0) {
    return { lineIdx: -1, wordIdx: -1 };
  }

  let lineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (currentSec >= lines[i].time && currentSec < lines[i].endTime) {
      lineIdx = i;
      break;
    }
  }

  if (lineIdx === -1) {
    const last = lines.length - 1;
    if (currentSec >= lines[last].time) lineIdx = last;
  }

  if (lineIdx === -1) return { lineIdx: -1, wordIdx: -1 };

  const line = lines[lineIdx];
  let wordIdx = -1;

  for (let i = 0; i < line.words.length; i++) {
    const word = line.words[i];
    const end = word.endTime ?? line.endTime;
    if (currentSec >= word.time && currentSec < end) {
      wordIdx = i;
      break;
    }
  }

  if (wordIdx === -1 && line.words.length) {
    for (let i = line.words.length - 1; i >= 0; i--) {
      if (currentSec >= line.words[i].time) {
        wordIdx = i;
        break;
      }
    }
  }

  return { lineIdx, wordIdx };
}

/** @deprecated use getLyricSyncState */
export function getActiveLyricIndex(lines, currentSec) {
  return getLyricSyncState(lines, currentSec).lineIdx;
}

async function searchLyrics(trackName, artistName) {
  const q = `${trackName} ${artistName}`.trim();
  const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return null;
  const items = await res.json();
  if (!Array.isArray(items) || !items.length) return null;

  const normalizedTrack = trackName.toLowerCase();
  const normalizedArtist = artistName.toLowerCase();

  const best =
    items.find(
      (item) =>
        item.trackName?.toLowerCase() === normalizedTrack &&
        item.artistName?.toLowerCase().includes(normalizedArtist.split(",")[0].trim()),
    ) || items[0];

  return {
    plain: best.plainLyrics || null,
    synced: best.syncedLyrics || null,
  };
}

export async function fetchLyrics(trackName, artistName, durationSec) {
  if (!trackName?.trim()) return null;

  const primaryArtist = artistName?.split(",")[0]?.trim() || artistName;
  const duration = Math.max(1, Math.round(durationSec || 0));

  try {
    const params = new URLSearchParams({
      track_name: trackName,
      artist_name: primaryArtist,
      duration: String(duration),
    });
    const res = await fetch(`https://lrclib.net/api/get?${params}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.plainLyrics || data?.syncedLyrics) {
        return {
          plain: data.plainLyrics || null,
          synced: data.syncedLyrics || null,
        };
      }
    }
  } catch {
    /* fall through to search */
  }

  try {
    return await searchLyrics(trackName, primaryArtist);
  } catch {
    return null;
  }
}
