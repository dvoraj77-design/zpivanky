// Paleta: jemné pastelové barvy, světlý čistý vzhled. Stejné hodnoty jsou v css/app.css (:root).
export const C = {
  bg: '#f7f6f3', surface: '#ffffff', surface2: '#f2f1ed', line: '#e8e5df',
  text: '#2f3140', muted: '#6e7080', dim: '#a3a4ae',
  primary: '#a8dcc9', primaryInk: '#17473a', accentInk: '#2a8a72',
  good: '#3fae84', goodInk: '#1f7a55', goodSoft: '#d9f1e7', goodFill: '#b7e4d2',
  warn: '#e39c3a', warnInk: '#9a5f0c', warnSoft: '#fcefd8', warnFill: '#f6d9ad',
  bad: '#e06a7c', badInk: '#b23b4e', badSoft: '#fbe1e5', badFill: '#f5c2ca',
  sky: '#cfe3f8', skyInk: '#2a5d8f', lav: '#e4e0fa', lavInk: '#4c428f', peach: '#ffe2cf', peachInk: '#97481c', butter: '#fbf0c4', butterInk: '#7a5a00',
  note: '#c3cdf5', noteNow: '#93a6ec', noteListen: '#d3d8e6',
  grid: '#efede8', gridStrong: '#e2ded5', gridKey: '#f3e3c2', label: '#9a9cab', labelKey: '#c07a22',
  curve: '#f0a35e', canvas: '#fcfbf9', track: '#eeece7', gold: '#f0b84d',
};

export const statusColor = (s) => (s === 'ok' ? C.good : s === 'near' ? C.warn : s === 'off' ? C.bad : C.curve);
export const scoreHex = (s) => (s >= 85 ? C.good : s >= 65 ? '#6fa8dc' : s >= 45 ? C.warn : C.bad);
export const scoreFill = (s) => (s >= 85 ? C.goodFill : s >= 65 ? '#cfe1f5' : s >= 45 ? C.warnFill : C.badFill);
