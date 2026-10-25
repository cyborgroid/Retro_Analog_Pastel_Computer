/* 49-key layout and 8x8 scan matrix — mirrored in environments/circuit/keyboard-matrix.csv */
(function (PX) {
  const D = PX.DATA;
  D.KEY_ROWS = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'BKSP'],
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'ENTER'],
    ['SHIFT', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'],
    ['SPACE']
  ];
  D.WIDE = { BKSP: 1.5, ENTER: 1.6, SHIFT: 1.8, SPACE: 6 };
  D.SHORT = { BKSP: 'BS', ENTER: 'RET', SHIFT: 'SHF', SPACE: 'SPC' };
  D.SHIFTED = { '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0', '_': '-', '+': '=', '{': '[', '}': ']', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/' };
  D.KEYS = D.KEY_ROWS.flat();
  D.MATRIX = {};
  D.GRID = [...Array(8)].map(() => Array(8).fill(null));
  D.KEYS.forEach((k, i) => { const r = Math.floor(i / 8), c = i % 8; D.MATRIX[k] = { r, c }; D.GRID[r][c] = k; });
  /* PSG key-click pitch: major pentatonic walk up the layout */
  const PENTA = [0, 2, 4, 7, 9];
  D.keyFreq = k => { const i = D.KEYS.indexOf(k); const n = PENTA[i % 5] + 12 * Math.floor(i / 5) % 36; return 261.63 * Math.pow(2, n / 12); };
})(window.PX);
