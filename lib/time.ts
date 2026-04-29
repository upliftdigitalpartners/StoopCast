export function minutesLeft(expiresAtIso: string): number {
  const ms = new Date(expiresAtIso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 60000));
}

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
