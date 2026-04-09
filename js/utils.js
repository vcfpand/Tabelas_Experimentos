// js/utils.js
// Converte data para ISO local (yyyy-mm-dd) sem alteração de fuso
export function toISOLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Formata data para pt-BR
export function toBR(date) {
  return date.toLocaleDateString('pt-BR');
}

// Calcula diferença em dias entre duas datas (ignora horas)
export function daysBetween(date1, date2) {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.round((d2 - d1) / 86400000);
}

// Exibe mensagem de erro em um elemento específico
export function showError(element, message) {
  if (typeof element === 'string') element = document.getElementById(element);
  if (element) {
    element.textContent = message;
    element.classList.add('show');
  }
}

// Esconde mensagem de erro
export function hideError(element) {
  if (typeof element === 'string') element = document.getElementById(element);
  if (element) element.classList.remove('show');
}

// Exibe toast temporário
export function showToast(message, duration = 2800) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// Gera HTML para as estatísticas (cards)
export function mkStats(pairs) {
  return pairs.map(([label, value]) => `
    <div class="stat-card">
      <div class="stat-label">${label}</div>
      <div class="stat-val">${value}</div>
    </div>
  `).join('');
}

// Constantes de cores e classes
export const TC = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'];
export const TL = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];