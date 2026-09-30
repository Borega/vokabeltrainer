// Bausteine der Auswertung für Lehrkräfte: Kennzahlen, Verlaufsdiagramme, sortierbare Tabellen.

import { rowsToCsv } from './csv.js';
import { fill, h } from './ui.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of children.flat()) if (c != null) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

// Achsenmaximum auf eine runde Zahl (1, 2, 5 × 10^n), durch 2 teilbar für die Mittellinie
function niceMax(v) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 5, 10].map((m) => m * pow).find((c) => c >= v);
}

export const shortDate = (iso) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
export const pct = (value, total) => (total ? Math.round((value / total) * 100) : 0);

// Kleines Diagramm für eine Messgröße über die Wochen: Linie (Anteil) oder Säulen (Anzahl).
// Hover/Fokus zeigt den Wert der Woche; mit ← → lässt sich per Tastatur durchgehen.
function weekChart({ title, points, value, format, kind, max }) {
  const W = 320, H = 150, L = 34, R = 34, T = 14, B = 26;
  const iw = W - L - R, ih = H - T - B;
  const values = points.map(value);
  const top = max ?? niceMax(Math.max(...values));
  const x = (i) => L + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v) => T + ih - (v / top) * ih;
  const ticks = [0, top / 2, top];

  const grid = ticks.map((t) => svg('g', {},
    svg('line', { x1: L, x2: W - R, y1: y(t), y2: y(t), class: 'chart-grid' }),
    svg('text', { x: L - 6, y: y(t) + 4, class: 'chart-axis', 'text-anchor': 'end' }, kind === 'line' ? `${t}` : `${Math.round(t)}`)));
  const xLabels = [0, points.length - 1].map((i) =>
    svg('text', { x: x(i), y: H - 8, class: 'chart-axis', 'text-anchor': i === 0 ? 'start' : 'end' }, i === points.length - 1 ? 'heute' : shortDate(points[i].at)));

  let marks;
  if (kind === 'line') {
    const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('');
    const last = values.length - 1;
    marks = svg('g', {},
      svg('path', { d: `${d}L${x(last)},${y(0)}L${x(0)},${y(0)}Z`, class: 'chart-area' }),
      svg('path', { d, class: 'chart-line' }),
      svg('circle', { cx: x(last), cy: y(values[last]), r: 4, class: 'chart-dot' }),
      svg('text', { x: x(last) + 8, y: y(values[last]) + 4, class: 'chart-value' }, format(values[last])));
  } else {
    const slot = iw / points.length;
    const bw = Math.min(24, slot * 0.6);
    const col = (i) => L + slot * i + (slot - bw) / 2;
    marks = svg('g', {}, values.map((v, i) => {
      const h0 = y(0) - y(v);
      if (!v) return null;
      const r = Math.min(4, h0, bw / 2);
      const x0 = col(i), y0 = y(v);
      // oben abgerundet, an der Grundlinie eckig
      return svg('path', {
        class: 'chart-bar', 'data-i': i,
        d: `M${x0},${y(0)}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + bw - r}Q${x0 + bw},${y0} ${x0 + bw},${y0 + r}V${y(0)}Z`,
      });
    }));
    xLabels.forEach((t, k) => t.setAttribute('x', k === 0 ? col(0) : col(points.length - 1) + bw));
  }

  const cross = svg('line', { y1: T, y2: T + ih, class: 'chart-cross', visibility: 'hidden' });
  const tip = h('div', { class: 'chart-tip', hidden: true, role: 'status' });
  const hit = svg('rect', { x: L, y: T, width: iw, height: ih, fill: 'transparent' });
  const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `${title}: aktuell ${format(values.at(-1))}`, tabindex: 0 },
    grid, marks, xLabels, cross, hit);
  const wrap = h('figure', { class: 'chart-wrap' }, h('figcaption', {}, title), chart, tip);

  let current = -1;
  function show(i) {
    current = Math.max(0, Math.min(points.length - 1, i));
    const cx = kind === 'line' ? x(current) : L + (iw / points.length) * (current + 0.5);
    cross.setAttribute('x1', cx);
    cross.setAttribute('x2', cx);
    cross.setAttribute('visibility', 'visible');
    chart.querySelectorAll('.chart-bar').forEach((b) => b.classList.toggle('active', Number(b.dataset.i) === current));
    fill(tip, h('strong', {}, format(values[current])), h('span', {}, ` · Woche bis ${shortDate(points[current].at)}`));
    tip.hidden = false;
    const box = chart.getBoundingClientRect();
    tip.style.left = `${Math.min(box.width - 150, Math.max(0, (cx / W) * box.width - 60))}px`;
  }
  function hide() {
    cross.setAttribute('visibility', 'hidden');
    chart.querySelectorAll('.chart-bar.active').forEach((b) => b.classList.remove('active'));
    tip.hidden = true;
  }
  chart.addEventListener('pointermove', (e) => {
    const box = chart.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = kind === 'line'
      ? Math.round(((px - L) / iw) * (points.length - 1))
      : Math.floor(((px - L) / iw) * points.length);
    show(i);
  });
  chart.addEventListener('pointerleave', hide);
  chart.addEventListener('focus', () => show(points.length - 1));
  chart.addEventListener('blur', hide);
  chart.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1); }
  });
  return wrap;
}

// Verlauf: „Ø sicher“ als Linie, Abfragen pro Woche als Säulen, dazu eine Tabellenansicht.
export function historyPanel(history, { safeLabel }) {
  return h('div', { class: 'history' },
    h('div', { class: 'charts' },
      weekChart({ title: safeLabel, points: history, value: (p) => p.safe_pct, format: (v) => `${Math.round(v)} %`, kind: 'line', max: 100 }),
      weekChart({ title: 'Abfragen pro Woche', points: history, value: (p) => p.reviews, format: (v) => `${v} Abfragen`, kind: 'bar' }),
    ),
    h('details', { class: 'table-view' },
      h('summary', {}, 'Verlauf als Tabelle'),
      h('table', { class: 'stats' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Woche bis'), h('th', {}, safeLabel), h('th', {}, 'Abfragen'))),
        h('tbody', {}, history.map((p) => h('tr', {}, h('td', {}, shortDate(p.at)), h('td', {}, `${Math.round(p.safe_pct)} %`), h('td', {}, p.reviews)))))),
  );
}

export function statTiles(tiles) {
  return h('div', { class: 'tiles' }, tiles.map(([label, value, sub]) =>
    h('div', { class: 'tile' }, h('span', { class: 'tile-label' }, label), h('span', { class: 'tile-value' }, value), sub ? h('span', { class: 'tile-sub' }, sub) : null)));
}

// Tabelle mit sortierbaren Spalten: columns = [{ label, value(row), render(row), numeric }]
export function sortableTable(rows, columns, { initial = 0, rowClass } = {}) {
  let sortBy = initial;
  let asc = initial == null ? true : !columns[initial].numeric;
  const tbody = h('tbody', {});
  const heads = columns.map((c, i) => h('th', { 'aria-sort': 'none' },
    h('button', { type: 'button', class: 'sort', onclick: () => { asc = sortBy === i ? !asc : !c.numeric; sortBy = i; render(); } }, c.label)));
  function render() {
    const col = columns[sortBy];
    const sorted = col == null ? rows : [...rows].sort((a, b) => {
      const va = col.value(a), vb = col.value(b);
      const cmp = typeof va === 'string' ? va.localeCompare(vb, 'de') : (va ?? -Infinity) - (vb ?? -Infinity);
      return asc ? cmp : -cmp;
    });
    heads.forEach((th, i) => th.setAttribute('aria-sort', i === sortBy ? (asc ? 'ascending' : 'descending') : 'none'));
    fill(tbody, sorted.map((r) => h('tr', { class: rowClass?.(r) ?? '' }, columns.map((c) => h('td', { class: c.class ?? '' }, c.render(r))))));
  }
  render();
  return h('div', { class: 'table-wrap' }, h('table', { class: 'stats' }, h('thead', {}, h('tr', {}, heads)), tbody));
}

export function downloadCsv(filename, rows) {
  const a = h('a', { href: URL.createObjectURL(new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' })), download: filename });
  a.click();
  URL.revokeObjectURL(a.href);
}

export const LEVEL_NAMES = ['neu', 'Anfang', 'lernt', 'sicher', 'sehr sicher', 'gefestigt'];

export function levelChip(p) {
  if (!p) return h('span', { class: 'level level-0' }, 'neu');
  const due = p.due && new Date(p.due) <= new Date();
  return h('span', { class: 'level-cell' },
    h('span', { class: `level level-${p.box}` }, LEVEL_NAMES[p.box] ?? '–'),
    due ? h('span', { class: 'chip due' }, 'fällig') : null);
}
