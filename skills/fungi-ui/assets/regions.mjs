export function validRegion(r) {
  return !!r && typeof r === 'object' &&
    ['x','y','width','height','viewportWidth','viewportHeight'].every(k => Number.isFinite(r[k])) &&
    r.x >= 0 && r.y >= 0 && r.width >= 4 && r.height >= 4 &&
    r.viewportWidth >= 4 && r.viewportHeight >= 4 &&
    r.x + r.width <= r.viewportWidth && r.y + r.height <= r.viewportHeight &&
    Array.isArray(r.scroll) && r.scroll.every(s =>
      s && Array.isArray(s.path) && s.path.every(i => Number.isSafeInteger(i) && i >= 0) &&
      Number.isFinite(s.x) && Number.isFinite(s.y));
}
