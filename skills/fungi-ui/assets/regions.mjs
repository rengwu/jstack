export function validRegion(r) {
  return !!r && typeof r === 'object' && JSON.stringify(r).length <= 12000 &&
    ['x','y','width','height','viewportWidth','viewportHeight'].every(k => Number.isFinite(r[k])) &&
    r.x >= 0 && r.y >= 0 && r.width >= 4 && r.height >= 4 &&
    r.viewportWidth >= 4 && r.viewportWidth <= 16000 && r.viewportHeight >= 4 && r.viewportHeight <= 1200 &&
    r.x + r.width <= r.viewportWidth && r.y + r.height <= r.viewportHeight &&
    Array.isArray(r.scroll) && r.scroll.length <= 64 && r.scroll.every(s =>
      s && Array.isArray(s.path) && s.path.length <= 32 && s.path.every(i => Number.isSafeInteger(i) && i >= 0 && i <= 100000) &&
      Number.isFinite(s.x) && Math.abs(s.x) <= 10000000 && Number.isFinite(s.y) && Math.abs(s.y) <= 10000000);
}
