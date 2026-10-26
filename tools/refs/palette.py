#!/usr/bin/env python3
"""Turn the learned reference palette (references/analysis.json) into two workbench colourways.

  Archive Beige  — the colours of the photographed machines, assigned to the colourway roles
  Archive Pastel — the same hue structure lifted into the pastel band (high value, low-mid saturation)

Prints JavaScript objects for src/js/data/palettes.js. Usage: python3 tools/refs/palette.py
"""
import colorsys, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
a = json.load(open(os.path.join(ROOT, 'references', 'analysis.json')))['summary']
pal = [(c, w) for c, w in a['palette']]


def hsv(h):
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    return colorsys.rgb_to_hsv(r, g, b)


def hexc(h, s, v):
    r, g, b = colorsys.hsv_to_rgb(h % 1.0, max(0, min(1, s)), max(0, min(1, v)))
    return '#%02x%02x%02x' % (round(r * 255), round(g * 255), round(b * 255))


# body colours: low-saturation warm clusters by share; accents: the most saturated peach and blue
neutral = sorted([p for p in pal if 0.04 < hsv(p[0])[0] < 0.17 and hsv(p[0])[1] < 0.30], key=lambda p: -p[1])
cool = sorted([p for p in pal if 0.50 < hsv(p[0])[0] < 0.70], key=lambda p: -hsv(p[0])[1])
peach = sorted([p for p in pal if hsv(p[0])[0] < 0.07 and hsv(p[0])[1] >= 0.25], key=lambda p: -p[1])
lightest = max(neutral, key=lambda p: hsv(p[0])[2])[0]
body, kbd = neutral[0][0], neutral[1][0]
mon = max([p for p in neutral[:4] if p[0] not in (body, kbd)], key=lambda p: hsv(p[0])[2])[0]
beige = {
    'n': 'Archive Beige', 'base': body, 'monitor': mon, 'keyboard': kbd, 'keyA': lightest,
    'keyB': peach[0][0] if peach else neutral[-1][0], 'mouse': mon, 'trim': cool[0][0] if cool else neutral[-1][0], 'desk': '#f2efe9',
}


def lift(h, v=0.93, s=(0.10, 0.30)):
    hh, ss, vv = hsv(h)
    return hexc(hh, s[0] + (s[1] - s[0]) * min(1, ss / 0.45), max(vv, v))


pastel = {'n': 'Archive Pastel', 'desk': '#f4f1ec'}
for role, col in beige.items():
    if role in ('n', 'desk'): continue
    pastel[role] = lift(col, 0.96 if role in ('keyA', 'monitor', 'mouse') else 0.92, (0.08, 0.26) if role not in ('keyB', 'trim') else (0.22, 0.40))
print(f"/* learned from {a['unique']} reference photos (tools/refs/palette.py) */")
for p in (beige, pastel):
    print('    ' + json.dumps(p, ensure_ascii=False).replace('"n":', 'n:').replace('"base":', 'base:').replace('"monitor":', 'monitor:')
          .replace('"keyboard":', 'keyboard:').replace('"keyA":', 'keyA:').replace('"keyB":', 'keyB:').replace('"mouse":', 'mouse:')
          .replace('"trim":', 'trim:').replace('"desk":', 'desk:').replace('"', "'") + ',')
