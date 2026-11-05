/* ═══════════════ HILFSFUNKTIONEN ═══════════════ */
export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const Cap = window.Capacitor;
export const IS_NATIVE = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
export const P = (Cap && Cap.Plugins) || {};
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const eur = c => (c < 0 ? '−' : '') + (Math.abs(c) / 100).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' €';
export const eurPlain = c => (c / 100).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
export function parseMoney(v) {
  if (v == null) return NaN;
  let s = String(v).replace(/[€\s]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? NaN : Math.round(n * 100);
}
export const moneyIn = c => (c == null || isNaN(c)) ? '' : eurPlain(c).replace(/\./g, '');
export const pad = n => String(n).padStart(2, '0');
export const dayKey = ts => { const d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
export const fmtDate = ts => new Date(ts).toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'});
export const fmtTime = ts => new Date(ts).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'});
export const fmtDT = ts => fmtDate(ts) + ' ' + fmtTime(ts);
export const COLORS = ['#009EB2', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#0ea5e9', '#84cc16', '#a16207', '#64748b'];
export const soft = (hex, a = .16) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
export const csv = rows => '﻿' + rows.map(r => r.map(v => { v = String(v ?? ''); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';')).join('\r\n');
export const isDesktop = () => matchMedia('(min-width:1024px)').matches;
