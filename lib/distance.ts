export function formatDistance(meters: number): string {
  if (meters < 50) return "right here";
  if (meters < 1000) return `${Math.round(meters / 10) * 10}m away`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)}km away`;
}
