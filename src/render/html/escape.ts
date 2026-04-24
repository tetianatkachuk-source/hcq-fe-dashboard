export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Trusted HTML concatenation helper: each arg is a pre-rendered HTML string.
export function h(...parts: Array<string | number | false | null | undefined>): string {
  return parts.filter((p) => p !== false && p != null && p !== '').join('');
}
