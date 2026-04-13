// js/utils.js
export function toISOLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function toBR(date) { return date.toLocaleDateString('pt-BR'); }
export function daysBetween(date1, date2) {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.round((d2 - d1) / 86400000);
}
export function showError(element, message) {
  if (typeof element === 'string') element = document.getElementById(element);
  if (element) { element.textContent = message; element.classList.add('show'); }
}
export function hideError(element) {
  if (typeof element === 'string') element = document.getElementById(element);
  if (element) element.classList.remove('show');
}
export function showToast(message, duration = 2800) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div'); toast.id = 'toast'; toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message; toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}
export function mkStats(pairs) {
  return pairs.map(([l, v]) => `<div class="stat-card"><div class="stat-label">${l}</div><div class="stat-val">${v}</div></div>`).join('');
}

export const TC = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'];
export const TL = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// Tema
export function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.body.classList.toggle('light', savedTheme === 'light');
  updateThemeIcon(savedTheme);
}
export function toggleTheme() {
  const isLight = document.body.classList.contains('light');
  const newTheme = isLight ? 'dark' : 'light';
  document.body.classList.toggle('light', newTheme === 'light');
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}
function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = theme === 'light' ? '🌙' : '☀️';
}
export function createTooltip(text) {
  const span = document.createElement('span');
  span.style.cursor = 'help';
  span.style.opacity = '0.7';
  span.style.marginLeft = '4px';
  span.textContent = 'ⓘ';
  span.title = text;
  return span;
}