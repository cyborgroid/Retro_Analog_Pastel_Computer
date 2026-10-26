#!/usr/bin/env python3
"""Download and analyse the reference images collected in references/inbox/ (see tools/refs/collect.js).
Usage: python3 tools/refs/ingest.py [--analyse-only]

Images come from their original sites (or the page's own thumbnail as a fallback), never from a search query.
Outputs (references/ is git-ignored; the summary is committed):
  references/cache/*.jpg          downscaled copies (max 640 px)
  references/sheets/sheet_NN.jpg  10 x 10 contact sheets for visual review
  references/analysis.json        per-image colours, pastel ratio, aspect, duplicates
  environments/chassis/references-web.md   summary: counts, sources, learned pastel palette
"""
import base64, collections, concurrent.futures as cf, hashlib, io, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REFS = os.path.join(ROOT, 'references')
INBOX, CACHE, SHEETS = (os.path.join(REFS, d) for d in ('inbox', 'cache', 'sheets'))
STATUS = os.path.join(REFS, 'ingest-status.json')
UA = 'PASTELLA84-reference-ingest/1.0 (design study; images fetched once from the pages they were found on)'
MAX_BYTES = 12 * 1024 * 1024
state = {'phase': 'start', 'total': 0, 'downloaded': 0, 'failed': 0, 'unique': 0, 'analysed': 0, 'sheets': 0}


def save_status(**kw):
    state.update(kw, updated=time.time())
    tmp = STATUS + '.tmp'; json.dump(state, open(tmp, 'w')); os.replace(tmp, STATUS)


def load_items():
    items = collections.OrderedDict()
    for f in sorted(os.listdir(INBOX)) if os.path.isdir(INBOX) else []:
        if not f.endswith('.json'): continue
        try: d = json.load(open(os.path.join(INBOX, f)))
        except Exception: continue
        for it in d.get('items', []):
            key = it.get('original') or it.get('thumb')
            if key and key not in items: items[key] = dict(it, query=d.get('query'))
    return list(items.values())


def fetch(url):
    if url.startswith('data:image/'):
        return base64.b64decode(url.split(',', 1)[1])
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'image/*'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                if not r.headers.get('Content-Type', 'image/').startswith('image/'): raise ValueError('not an image')
                data = r.read(MAX_BYTES + 1)
                if len(data) > MAX_BYTES: raise ValueError('too large')
                return data
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 3: raise
            time.sleep(15 * (attempt + 1))   # rate limited: back off


def download(it):
    key = it.get('original') or it.get('thumb')
    name = hashlib.sha1(key.encode()).hexdigest()[:20] + '.jpg'
    path = os.path.join(CACHE, name)
    if os.path.exists(path): return dict(it, file=name, source='cache')
    for src in ('original', 'thumb'):
        u = it.get(src)
        if not u: continue
        try:
            im = Image.open(io.BytesIO(fetch(u))).convert('RGB')
            if min(im.size) < 64: continue
            im.thumbnail((640, 640)); im.save(path, quality=86)
            return dict(it, file=name, source=src)
        except Exception:
            continue
    return None


def dhash(im):
    g = np.asarray(im.convert('L').resize((9, 8), Image.BILINEAR), dtype=np.int16)
    bits = (g[:, 1:] > g[:, :-1]).flatten()
    return int(''.join('1' if b else '0' for b in bits), 2)


def kmeans(x, k, iters=12, seed=0):
    rng = np.random.default_rng(seed)
    c = x[rng.choice(len(x), size=min(k, len(x)), replace=False)].astype(float)
    for _ in range(iters):
        lab = ((x[:, None, :] - c[None]) ** 2).sum(-1).argmin(1)
        for j in range(len(c)):
            if (lab == j).any(): c[j] = x[lab == j].mean(0)
    lab = ((x[:, None, :] - c[None]) ** 2).sum(-1).argmin(1)
    return c, np.bincount(lab, minlength=len(c)) / len(x)


def pastel_mask(rgb):
    mx, mn = rgb.max(1), rgb.min(1)
    v, s = mx / 255.0, np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    return (v > 0.72) & (s > 0.10) & (s < 0.48)


def analyse(rec):
    im = Image.open(os.path.join(CACHE, rec['file'])).convert('RGB')
    small = np.asarray(im.resize((96, 96)), dtype=np.float64).reshape(-1, 3)
    cols, w = kmeans(small, 5)
    pm = pastel_mask(small)
    return dict(rec, w=im.size[0], h=im.size[1], aspect=round(im.size[0] / im.size[1], 3), dhash=dhash(im),
                colors=[['#%02x%02x%02x' % tuple(int(v) for v in c), round(float(f), 3)] for c, f in sorted(zip(cols, w), key=lambda t: -t[1])],
                pastel_ratio=round(float(pm.mean()), 3), pastel_px=small[pm][::7].tolist())


def sheet(recs, idx):
    cell, cols = 160, 10
    S = Image.new('RGB', (cols * cell, ((len(recs) + cols - 1) // cols) * cell), 'white'); d = ImageDraw.Draw(S)
    for i, r in enumerate(recs):
        im = Image.open(os.path.join(CACHE, r['file'])); im.thumbnail((cell - 4, cell - 16))
        x, y = (i % cols) * cell, (i // cols) * cell
        S.paste(im, (x + 2, y + 2)); d.text((x + 3, y + cell - 13), '%04d' % r['n'], fill='red')
    S.save(os.path.join(SHEETS, 'sheet_%02d.jpg' % idx), quality=82)


def main():
    for d in (CACHE, SHEETS): os.makedirs(d, exist_ok=True)
    items = load_items()
    recs = []
    if '--analyse-only' in sys.argv:   # use what is already downloaded (downloads may still be running)
        for it in items:
            name = hashlib.sha1((it.get('original') or it.get('thumb')).encode()).hexdigest()[:20] + '.jpg'
            if os.path.exists(os.path.join(CACHE, name)): recs.append(dict(it, file=name, source='cache'))
    else:
        save_status(phase='download', total=len(items))
        with cf.ThreadPoolExecutor(4) as ex:
            for i, r in enumerate(ex.map(download, items)):
                if r: recs.append(r)
                if i % 20 == 0: save_status(downloaded=len(recs), failed=i + 1 - len(recs))
        save_status(phase='analyse', downloaded=len(recs), failed=len(items) - len(recs))
    out, seen = [], []
    for r in recs:
        try: a = analyse(r)
        except Exception: continue
        if any(bin(a['dhash'] ^ h).count('1') <= 5 for h in seen): continue   # near-duplicate
        seen.append(a['dhash']); a['n'] = len(out); out.append(a)
        if len(out) % 25 == 0: save_status(unique=len(out), analysed=len(out))
    save_status(phase='sheets', unique=len(out), analysed=len(out))
    for f in os.listdir(SHEETS): os.remove(os.path.join(SHEETS, f))
    for k in range(0, len(out), 100): sheet(out[k:k + 100], k // 100)
    # learned palette: cluster the pastel pixels of all images
    px = np.array([p for a in out for p in a['pastel_px']], dtype=np.float64)
    palette = []
    if len(px) >= 12:
        c, w = kmeans(px, 12, iters=20)
        palette = [['#%02x%02x%02x' % tuple(int(v) for v in cc), round(float(ww), 3)] for cc, ww in sorted(zip(c, w), key=lambda t: -t[1])]
    domains = collections.Counter(urllib.parse.urlparse(a.get('original') or a.get('page') or '').hostname or '(thumbnail)' for a in out)
    pastel = [a for a in out if a['pastel_ratio'] >= 0.15]
    summary = dict(collected=len(items), downloaded=len(recs), unique=len(out), pastel_images=len(pastel),
                   queries=collections.Counter(a.get('query') for a in out).most_common(), palette=palette,
                   aspect_median=float(np.median([a['aspect'] for a in out])) if out else None, domains=domains.most_common(25))
    for a in out: a.pop('pastel_px', None)
    json.dump(dict(summary=summary, images=out), open(os.path.join(REFS, 'analysis.json'), 'w'), ensure_ascii=False)
    md = ['# 웹 레퍼런스 이미지 분석 (자동 생성)', '',
          '`tools/refs/collect.js`로 브라우저에서 모은 이미지를 `tools/refs/ingest.py`가 원본 사이트에서 받아 분석한 결과입니다. 이미지는 저장소에 넣지 않습니다(`references/`, git 제외).', '',
          f'- 수집 {len(items)}개 → 다운로드 {len(recs)}개 → 중복 제거 후 {len(out)}개, 파스텔 비중 15 % 이상 {len(pastel)}개',
          f'- 검색어: ' + ', '.join(f'{q} ({n})' for q, n in summary['queries']), '',
          '## 학습한 파스텔 팔레트 (전체 이미지의 파스텔 픽셀 군집)', '', '| 색 | 비중 |', '|---|---|']
    md += [f'| `{c}` | {w * 100:.1f} % |' for c, w in palette]
    md += ['', '## 출처 사이트 상위 25', '', '| 사이트 | 이미지 |', '|---|---|'] + [f'| {d} | {n} |' for d, n in summary['domains']]
    open(os.path.join(ROOT, 'environments', 'chassis', 'references-web.md'), 'w').write('\n'.join(md) + '\n')
    save_status(phase='done', unique=len(out), analysed=len(out), sheets=(len(out) + 99) // 100, palette=palette)


if __name__ == '__main__':
    try: main()
    except Exception as e:
        save_status(phase='error', error=str(e)); raise
