#!/usr/bin/env node
/* Regenerates the data files under environments/ from the app's runtime data (src/js/data/*.js),
   so the documents and the bench never drift apart.
   Usage: node tools/export-data.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { window: {} }; ctx.window.PX = { DATA: {} }; vm.createContext(ctx);
['palettes', 'keyboard', 'topology', 'parts', 'assembly', 'instrument', 'quantum', 'sourcing'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(root, 'src/js/data', f + '.js'), 'utf8'), ctx, { filename: f + '.js' }));
const D = ctx.window.PX.DATA;
const out = (rel, text) => { const p = path.join(root, 'environments', rel); fs.writeFileSync(p, text.endsWith('\n') ? text : text + '\n'); console.log('wrote environments/' + rel); };
const csv = rows => rows.map(r => r.map(c => /[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).join(',')).join('\n');

/* topology */
out('topology/system-graph.json', JSON.stringify({
  nodes: Object.entries(D.NODES).map(([id, n]) => ({ id, label: n.t, title: n.title, summary: n.sub, spec: Object.fromEntries(n.kv), probe: n.probe, faultSymptom: n.fault })),
  edges: [
    ['xtal', 'cpu', 'CLK'], ['cpu', 'bus', 'A0-A15/D0-D7'], ['rom', 'bus', ''], ['ram', 'bus', ''], ['vdp', 'bus', ''], ['fdc', 'bus', ''], ['psg', 'bus', ''], ['pio', 'bus', ''],
    ['vdp', 'crt', 'VIDEO/SYNC'], ['fdc', 'fdd', '34P'], ['psg', 'spk', 'AUDIO'], ['kbd', 'pio', 'DIN-5'], ['mouse', 'pio', 'DE-9']
  ].map(([from, to, net]) => ({ from, to, net })),
  memoryMap: D.MEMMAP.map(m => ({ from: '0x' + m.from.toString(16).toUpperCase().padStart(4, '0'), to: '0x' + m.to.toString(16).toUpperCase().padStart(4, '0'), region: m.n })),
  ioPorts: D.IOPORTS.map(([port, fn]) => ({ port, function: fn })),
  clockTree: D.CLOCKS.map(([depth, label]) => ({ depth, label }))
}, null, 2));

/* circuit */
out('circuit/keyboard-matrix.csv', csv([['key', 'row', 'col', 'diode', 'psg_click_hz']].concat(D.KEYS.map(k => [k, D.MATRIX[k].r, D.MATRIX[k].c, '1N4148', D.keyFreq(k).toFixed(2)]))));

/* chassis */
out('chassis/colorways.json', JSON.stringify({ roles: Object.fromEntries(D.roles), palettes: D.palettes }, null, 2));
out('chassis/parts.json', JSON.stringify(D.PICKS, null, 2));

/* assembly */
let md = '# 조립 공정 (자동 생성)\n\n`src/js/data/assembly.js`에서 생성됩니다. 수정은 그 파일에서 하고 `node tools/export-data.js`를 실행하세요.\n\n';
let total = 0;
D.steps.forEach((s, i) => {
  total += s.min;
  md += `## ${String(i + 1).padStart(2, '0')}. ${s.t}\n\n- 모듈: ${s.m}\n- 예상 시간: ${s.min}분 (누적 ${total}분)\n- 공구: ${s.tools.join(', ')}\n- 체결 부품: ${s.fast.join(', ')}\n- 토크: ${s.torque}\n\n**작업 요령**\n\n${s.notes.map(n => '- ' + n).join('\n')}\n\n**검수**\n\n${s.checks.map(c => '- [ ] ' + c).join('\n')}\n\n`;
});
out('assembly/steps.md', md);
out('assembly/fasteners.csv', csv([['step', 'title', 'module', 'fasteners', 'torque', 'minutes']].concat(D.steps.map((s, i) => [i + 1, s.t, s.m, s.fast.join(' / '), s.torque, s.min]))));
out('assembly/qc-checklist.md', '# 출하 검수 체크리스트 (자동 생성)\n\n' + D.steps.map((s, i) => `### ${String(i + 1).padStart(2, '0')} ${s.t}\n${s.checks.map(c => '- [ ] ' + c).join('\n')}`).join('\n\n'));

/* instrument */
out('instrument/scope-presets.json', JSON.stringify({ timebase_s: D.TB, volts_per_div: D.VD, presets: D.PRESETS, logicAnalyzerModes: D.LA_MODES, busCycle: D.CYC.map(([type, tstates, label]) => ({ type, tstates, label })) }, null, 2));

/* quantum */
out('topology/quantum-stack.json', JSON.stringify({
  nodes: Object.entries(D.QNODES).map(([id, n]) => ({ id, label: n.t, title: n.title, summary: n.sub, spec: Object.fromEntries(n.kv), faultSymptom: n.fault })),
  cryostatStages: D.QSTAGES.map(([name, baseK]) => ({ name, baseK })),
  couplingMap: D.QCOUPLING, qubitOffsets: D.QOFFS
}, null, 2));
out('instrument/presets.qasm', Object.entries(D.QPRESETS).map(([k, p]) => `// ===== ${k}: ${p.n}\n// ${p.note}\n${D.toQASM(p.ops, p.q)}\n`).join('\n'));
out('instrument/gates.json', JSON.stringify(D.GATES, null, 2));
/* sourcing */
out('circuit/bom-sourcing.csv', csv([['group', 'block', 'part', 'part_number', 'status', 'status_label', 'easy_alternative_or_note', 'where']].concat(D.SOURCING.map(r => [r[0], r[1], r[2], r[3], r[4], D.SRC_STATUS[r[4]][0], r[5], r[6]]))));
