export function parseLrc(lrcText) {
  if (!lrcText?.trim()) return [];

  const lines = [];
  for (const raw of lrcText.split("\n")) {
    const matches = [...raw.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?]/g)];
    if (!matches.length) continue;

    const text = raw.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?]/g, "").trim();
    if (!text) continue;

    const last = matches[matches.length - 1];
    const min = Number(last[1]);
    const sec = Number(last[2]);
    const frac = last[3] ? Number(last[3].padEnd(3, "0")) : 0;
    lines.push({ time: min * 60 + sec + frac / 1000, text });
  }

  return lines.sort((a, b) => a.time - b.time);
}

export function getActiveLyricIndex(lines, currentSec) {
  if (!lines.length) return -1;
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= currentSec + 0.25) idx = i;
    else break;
  }
  return idx;
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
