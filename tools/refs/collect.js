/* PASTELLA 84 reference collector — paste into the DevTools console of an image-results page you opened yourself.
   It only reads what that page has loaded (scrolling to load more), then sends the list to the local workbench
   server; if that is blocked it downloads a JSON file you can drop on refs.html. the endpoint placeholder is filled in by refs.html. */
(async () => {
  const ENDPOINT = '__ENDPOINT__', TARGET = 10000, IDLE_ROUNDS = 12, BATCH = 400;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const seen = new Map();
  const query = new URLSearchParams(location.search).get('q') || document.title;
  const isSearchHost = u => /(^|\.)(google|gstatic|googleusercontent|bing|duckduckgo)\./.test(new URL(u).hostname);
  const harvest = () => {
    // original image URLs embedded in the result data:  ["https://site/image.jpg", height, width]
    const html = document.documentElement.innerHTML;
    for (const m of html.matchAll(/\["(https?:\/\/[^"\s]{8,2048}?)",(\d{2,5}),(\d{2,5})\]/g)) {
      let u; try { u = JSON.parse('"' + m[1] + '"'); new URL(u); } catch { continue; }
      if (isSearchHost(u) || seen.has(u)) continue;
      seen.set(u, { original: u, h: +m[2], w: +m[3] });
    }
    // thumbnails the page has already rendered (kept as a fallback when an original cannot be fetched)
    document.querySelectorAll('img').forEach(img => {
      const s = img.currentSrc || img.src;
      if (!s || img.naturalWidth < 80 || img.naturalHeight < 60) return;
      if (!(s.startsWith('data:image/') || /encrypted-tbn\d\.gstatic\.com/.test(s))) return;
      const key = 'thumb:' + (s.length > 300 ? s.slice(0, 120) + s.length + s.slice(-120) : s);
      if (seen.has(key)) return;
      const a = img.closest('a'), card = img.closest('[data-lpage],[data-ved]');
      seen.set(key, { thumb: s, alt: img.alt || '', page: (card && card.getAttribute('data-lpage')) || (a && a.href) || '' });
    });
  };
  const more = () => {
    const b = [...document.querySelectorAll('input[type=button],button,a,span')].find(e => /결과 더보기|더보기|Show more results|See more/i.test(e.value || e.textContent || ''));
    if (b && b.offsetParent) b.click();
  };
  const badge = Object.assign(document.createElement('div'), { style: 'position:fixed;z-index:2147483647;right:12px;bottom:12px;padding:8px 12px;border-radius:10px;background:#2a2633;color:#fff;font:13px monospace' });
  document.body.appendChild(badge);
  let last = 0, idle = 0;
  for (let i = 0; i < 1500 && seen.size < TARGET && idle < IDLE_ROUNDS; i++) {
    harvest();
    badge.textContent = `PASTELLA 수집: ${seen.size}개 (스크롤 ${i})`;
    idle = seen.size === last ? idle + 1 : 0; last = seen.size;
    window.scrollBy(0, innerHeight * 0.9); more();
    await sleep(600 + Math.random() * 400);
  }
  harvest();
  const items = [...seen.values()];
  let sent = 0, failed = false;
  for (let i = 0; i < items.length && !failed; i += BATCH) {
    try {
      const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ query, page: location.href, items: items.slice(i, i + BATCH) }) });
      if (!r.ok) throw new Error(r.status); sent += Math.min(BATCH, items.length - i);
    } catch (e) { failed = true; }
  }
  if (failed) {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify({ query, page: location.href, items })], { type: 'application/json' })), download: `pastella-refs-${Date.now()}.json` });
    document.body.appendChild(a); a.click();
    badge.textContent = `PASTELLA: ${items.length}개 — 서버 전송이 막혀 JSON 파일로 저장했습니다. refs.html에 끌어다 놓으세요.`;
  } else badge.textContent = `PASTELLA: ${items.length}개 수집 · ${sent}개 전송 완료`;
  console.log('[PASTELLA] collected', items.length, 'sent', sent);
})();
