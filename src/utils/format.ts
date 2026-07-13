export function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

/** "51m" / "1h51m" / "2h" — same breakdown as formatDuration, no spaces, for tight spaces like calendar cells. */
export function formatDurationCompact(seconds: number): string {
  if (!seconds) return '';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h${remainingMinutes}m` : `${hours}h`;
}

/** "12/34 min" — position/duration in whole minutes, for rows with a partially-listened episode. */
export function formatProgress(positionSeconds: number, durationSeconds: number): string {
  const positionMinutes = Math.round(positionSeconds / 60);
  const durationMinutes = Math.round(durationSeconds / 60);
  return `${positionMinutes}/${durationMinutes} min`;
}

export function formatDate(unixSeconds: number): string {
  if (!unixSeconds) return '';
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Decodes entities and strips tags, but doesn't trim — used by both stripHtml (which trims the
 * whole result) and parseDescriptionSegments (which must NOT trim interior slices, since that
 * would eat the space between "...text " and " <a>link</a>" and run words together). */
function decodeAndStripTags(html: string): string {
  const withBreaks = html
    .replace(/<\s*(br|\/p|\/div|\/li)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  const decoded = withBreaks.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const isHex = entity[1]?.toLowerCase() === 'x';
      const code = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match;
  });
  return decoded.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n');
}

/** Feed descriptions are often HTML — strip tags and decode entities down to plain text
 * for display in places that just render a text block (no rich-text support here). */
export function stripHtml(html: string): string {
  if (!html) return '';
  return decodeAndStripTags(html).trim();
}

export interface DescriptionSegment {
  text: string;
  /** Present only for segments that came from an <a href> — render as a tappable link. */
  href?: string;
}

const LINK_TAG_RE = /<a\s+[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const SUPPORTED_LINK_SCHEMES = /^(https?:|mailto:)/i;

/** Like stripHtml, but keeps <a href> targets instead of discarding them — for rendering
 * descriptions with tappable links rather than a plain text block. */
export function parseDescriptionSegments(html: string): DescriptionSegment[] {
  if (!html) return [];
  const segments: DescriptionSegment[] = [];
  let lastIndex = 0;
  LINK_TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LINK_TAG_RE.exec(html))) {
    const [full, href, label] = match;
    if (match.index > lastIndex) {
      const plain = decodeAndStripTags(html.slice(lastIndex, match.index));
      if (plain) segments.push({ text: plain });
    }
    const linkText = decodeAndStripTags(label).trim();
    if (linkText) {
      segments.push(SUPPORTED_LINK_SCHEMES.test(href) ? { text: linkText, href } : { text: linkText });
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < html.length) {
    const plain = decodeAndStripTags(html.slice(lastIndex));
    if (plain) segments.push({ text: plain });
  }
  if (segments.length > 0) {
    segments[0].text = segments[0].text.trimStart();
    segments[segments.length - 1].text = segments[segments.length - 1].text.trimEnd();
  }
  return segments;
}

/** "Today" / "Yesterday" / "Mon, Jan 5" — for the "YYYY-MM-DD" strings DayStats.date uses. */
export function formatHistoryDay(dateString: string): string {
  const target = new Date(`${dateString}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (target.getTime() === today.getTime()) return 'Today';
  if (target.getTime() === yesterday.getTime()) return 'Yesterday';
  return target.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
