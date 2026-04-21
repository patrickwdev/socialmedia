const MENTION_RE = /@([a-zA-Z0-9_]+)/g;

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
