/** DefectLoop 等同进程挂载时的 URL 前缀（由 templates/index.html 注入）。 */
export function getMountPrefix() {
  return typeof window !== 'undefined' ? (window.__COCO_VIZ_MOUNT__ || '') : '';
}

/** 为 API / static 路径加挂载前缀；DefectLoop 桥接 /api/viz/* 保持根路径。 */
export function mountUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const mount = getMountPrefix();
  if (!mount) return url;
  if (url.startsWith('/api/viz/')) return url;
  if (url.startsWith('/api/') || url.startsWith('/static/')) {
    return `${mount}${url}`;
  }
  return url;
}
