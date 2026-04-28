const MENTION_RE = /@([a-zA-Z0-9_]+)/g;

export type MentionTextSegment =
  | { type: 'text'; text: string }
  | { type: 'mention'; username: string };

/** Split body text into plain segments and @handle mentions (same token rules as captions). */
export function splitTextWithMentions(text: string): MentionTextSegment[] {
  if (!text) return [];
  const segments: MentionTextSegment[] = [];
  const re = new RegExp(MENTION_RE.source, 'g');
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      segments.push({ type: 'text', text: text.slice(last, m.index) });
    }
    const username = m[1];
    if (username) {
      segments.push({ type: 'mention', username });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    segments.push({ type: 'text', text: text.slice(last) });
  }
  if (segments.length === 0) {
    segments.push({ type: 'text', text });
  }
  return segments;
}

/** Unique @handles in order of first appearance (case-insensitive dedupe). */
export function extractMentionUsernames(caption: string): string[] {
  if (!caption || !caption.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE.source, 'g');
  while ((m = re.exec(caption)) !== null) {
    const raw = m[1];
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}

/** Caption text with @username tokens removed and whitespace normalized. */
export function captionWithoutMentionTokens(caption: string): string {
  if (!caption) return '';
  return caption.replace(MENTION_RE, ' ').replace(/\s+/g, ' ').trim();
}
