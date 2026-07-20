import { stripHtml } from '@/utils/format';

function stripVttInlineTags(line: string): string {
  return line.replace(/<[^>]+>/g, '');
}

/** Handles both SRT and WEBVTT — structurally identical for this purpose (cue index/timestamp
 * lines followed by text lines, blank line between cues), just different header/timestamp
 * punctuation, which the line-type checks below don't care about. Doesn't preserve cue timing —
 * this app shows a plain readable transcript, not scroll-synced captions. */
function parseSrtOrVtt(raw: string): string {
  const textLines: string[] = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line === 'WEBVTT') continue;
    if (/^NOTE\b/.test(line)) continue;
    if (/^\d+$/.test(line)) continue; // SRT cue index
    if (line.includes('-->')) continue; // timestamp line
    textLines.push(stripVttInlineTags(line));
  }
  return textLines.join(' ').replace(/\s+/g, ' ').trim();
}

interface JsonTranscriptSegment {
  body?: string;
  text?: string;
}

/** Podcasting 2.0's JSON transcript format is `{ segments: [{ body, startTime, endTime, speaker }] }`
 * — falls back to the raw text if the shape doesn't match (format isn't tightly standardized). */
function parseJsonTranscript(raw: string): string {
  try {
    const data: unknown = JSON.parse(raw);
    const segments: JsonTranscriptSegment[] = Array.isArray(data)
      ? data
      : Array.isArray((data as { segments?: unknown })?.segments)
        ? (data as { segments: JsonTranscriptSegment[] }).segments
        : [];
    if (segments.length === 0) return raw.trim();
    return segments
      .map((segment) => segment.body ?? segment.text ?? '')
      .filter(Boolean)
      .join('\n')
      .trim();
  } catch {
    return raw.trim();
  }
}

/** Normalizes whatever format a feed's `<podcast:transcript>` points to (vtt/srt/html/json/plain)
 * down to plain readable text for display — see PlayerSheet.tsx's transcript sheet. */
export async function fetchTranscriptText(url: string, type: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch transcript (${response.status}): ${url}`);
  }
  const raw = await response.text();
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes('html')) return stripHtml(raw);
  if (normalizedType.includes('json')) return parseJsonTranscript(raw);
  if (normalizedType.includes('vtt') || normalizedType.includes('srt') || normalizedType.includes('subrip')) {
    return parseSrtOrVtt(raw);
  }
  return raw.trim();
}
