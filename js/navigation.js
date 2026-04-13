// js/navigation.js
import { state } from './state.js';

let currentPanel = 0;

export function buildSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = `
    <div class="sb-section">Configuração</div>
    <div class="nav-item" data-panel="0"><div class="nav-icon">1</div>Configuração</div>
    <div class="nav-item locked" data-panel="1"><div class="nav-icon">2</div>Tratamentos</div>
    <div class="sb-div"></div>
    <div class="sb-section">Dados</div>
    <div class="nav-item locked" data-panel="2"><div class="nav-icon">📊</div>Tabelas Experimentais</div>
    <div class="nav-item locked" data-panel="3"><div class="nav-icon">🖨</div>Fichas Diárias</div>
    <div class="sb-div"></div>
    <div class="sb-section">Ajuda</div>
    <div class="nav-item" data-panel="4"><div class="nav-icon">ℹ️</div>Sobre</div>
    <div style="margin-top:auto;padding:16px 10px 8px;font-size:9px;color:var(--text3);text-align:center;border-top:0.5px solid var(--border);">
      Me. Victor C. F. Pandolfi<br>UEL/NEPAG – v1.2.0
    </div>
  `;

  sidebar.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const panel = parseInt(item.dataset.panel);
      tryGoTo(panel);
    });
  });

  updateSidebarState();
}

export function updateSidebarState() {
  const items = document.querySelectorAll('.nav-item');
  items.forEach(item => {
    const panel = parseInt(item.dataset.panel);
    item.classList.remove('locked', 'done', 'active');
    if (panel === currentPanel) item.classList.add('active');

    if (panel === 0) {}
    else if (panel === 1) { if (!state.cfg.startDate) item.classList.add('locked'); }
    else if (panel === 2 || panel === 3) { if (!state.confirmed) item.classList.add('locked'); }
    else if (panel === 4) {}

    if (panel === 1 && state.confirmed) {
      item.classList.add('done');
      item.querySelector('.nav-icon').textContent = '✓';
    }
  });
}

export function tryGoTo(panel) {
  if (panel === 0) { setActivePanel(0); return; }
  if (panel === 1 && state.cfg.startDate) { setActivePanel(1); return; }
  if ((panel === 2 || panel === 3) && state.confirmed) { setActivePanel(panel); return; }
  if (panel === 4) { setActivePanel(4); return; }
}

export function setActivePanel(index) {
  for (let i = 0; i <= 4; i++) {
    const panel = document.getElementById(`panel${i}`);
    if (panel) panel.classList.toggle('active', i === index);
  }
  currentPanel = index;
  updateSidebarState();
  window.dispatchEvent(new CustomEvent('panelChanged', { detail: { panel: index } }));
}

export function unlockPanel(panel) {
  const item = document.querySelector(`.nav-item[data-panel="${panel}"]`);
  if (item) item.classList.remove('locked');
}

export function markPanelDone(panel) {
  const item = document.querySelector(`.nav-item[data-panel="${panel}"]`);
  if (item) {
    item.classList.add('done');
    const icon = item.querySelector('.nav-icon');
    if (icon) icon.textContent = '✓';
  }
}