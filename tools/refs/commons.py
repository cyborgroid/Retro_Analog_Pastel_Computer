#!/usr/bin/env python3
"""Bulk reference harvest from Wikimedia Commons (public API, openly licensed photos) into references/inbox/.

Walks retro-computer categories (and one level of sub-categories), paced to the API etiquette
(identifying User-Agent, maxlag, back-off on 429). Usage: python3 tools/refs/commons.py [target=10000]
"""
import json, os, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
INBOX = os.path.join(ROOT, 'references', 'inbox')
API = 'https://commons.wikimedia.org/w/api.php'
UA = 'PASTELLA84-reference-harvest/1.0 (design study of retro computers; low request rate)'
TARGET = int(sys.argv[1]) if len(sys.argv) > 1 else 10000
CATEGORIES = [
    'Macintosh Color Classic', 'Macintosh Classic', 'Macintosh 128K', 'Macintosh Plus', 'Macintosh SE', 'IMac G3', 'Apple eMac',
    'Apple IIc', 'Apple IIe', 'Apple II Plus', 'Apple Lisa', 'Commodore 64', 'Commodore 64C', 'Commodore 128', 'Commodore VIC-20',
    'Amiga 500', 'Amiga 1000', 'Commodore PET', 'MSX computers', 'Sony HB-F1XD', 'Panasonic FS-A1', 'Sharp X68000', 'Sharp X1',
    'Sharp MZ-80K', 'Sharp MZ-700', 'NEC PC-8801', 'NEC PC-9801', 'NEC PC-6001', 'FM Towns', 'Fujitsu FM-7', 'Atari ST', 'Atari 800XL',
    'Atari 130XE', 'Amstrad CPC 464', 'Amstrad CPC 6128', 'ZX Spectrum', 'Sinclair QL', 'BBC Micro', 'Acorn Electron', 'Canon Cat',
    'Bandai Pippin', 'TRS-80', 'IBM Personal Computer', 'IBM PCjr', 'IBM PS/2', 'Texas Instruments TI-99/4A', 'Toshiba Pasopia',
    'Sega SC-3000', 'Mattel Aquarius', 'Spectravideo', 'Oric computers', 'Dragon 32', 'Tandy Color Computer', 'Kaypro', 'Osborne 1',
    'Computer keyboards', 'Ball mice', 'Computer mice', 'Cathode ray tube monitors', 'Home computers', 'Computers in museums',
]
req_n = 0


def api(params):
    global req_n
    params = dict(params, format='json', maxlag=5)
    url = API + '?' + urllib.parse.urlencode(params)
    for attempt in range(6):
        try:
            req_n += 1
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=40) as r:
                d = json.load(r)
            if d.get('error', {}).get('code') == 'maxlag':
                time.sleep(10); continue
            time.sleep(1.2)
            return d
        except urllib.error.HTTPError as e:
            time.sleep(30 * (attempt + 1) if e.code == 429 else 5)
        except Exception:
            time.sleep(5)
    return {}


def files_in(cat, items, limit):
    cont = {}
    while len(items) < limit:
        d = api(dict(action='query', generator='categorymembers', gcmtitle='Category:' + cat, gcmtype='file', gcmlimit=50,
                     prop='imageinfo', iiprop='url|extmetadata', iiurlwidth=500, iiextmetadatafilter='LicenseShortName', **cont))
        for p in (d.get('query', {}).get('pages', {}) or {}).values():
            ii = (p.get('imageinfo') or [{}])[0]
            if not ii.get('thumburl') or not p['title'].lower().endswith(('.jpg', '.jpeg', '.png', '.webp')): continue
            lic = ii.get('extmetadata', {}).get('LicenseShortName', {}).get('value')
            items[ii['thumburl']] = dict(original=ii['thumburl'], page=ii.get('descriptionurl'), alt=p['title'], license=lic, category=cat)
        if 'continue' not in d: return
        cont = {k: v for k, v in d['continue'].items()}


def subcats(cat):
    d = api(dict(action='query', list='categorymembers', cmtitle='Category:' + cat, cmtype='subcat', cmlimit=50))
    return [m['title'].split(':', 1)[1] for m in d.get('query', {}).get('categorymembers', [])]


def flush(cat, items, done):
    new = [v for k, v in items.items() if k not in done]
    if not new: return
    os.makedirs(INBOX, exist_ok=True)
    name = 'commons-%s-%d.json' % (time.strftime('%Y%m%d-%H%M%S'), len(done))
    json.dump({'query': 'commons: retro computers', 'page': 'https://commons.wikimedia.org/wiki/Category:' + cat, 'items': new},
              open(os.path.join(INBOX, name), 'w'), ensure_ascii=False)
    done.update(it['original'] for it in new)


def main():
    items, done = {}, set()
    queue = [(c, 0) for c in CATEGORIES]
    visited = set()
    while queue and len(items) < TARGET:
        cat, depth = queue.pop(0)
        if cat in visited: continue
        visited.add(cat)
        before = len(items)
        files_in(cat, items, min(TARGET, len(items) + 600))
        print(f'{cat}: +{len(items) - before} (total {len(items)}, requests {req_n})', flush=True)
        flush(cat, items, done)
        if depth < 1:
            queue.extend((s, depth + 1) for s in subcats(cat))
    print(f'done: {len(items)} images from {len(visited)} categories, {req_n} requests', flush=True)


if __name__ == '__main__':
    main()
