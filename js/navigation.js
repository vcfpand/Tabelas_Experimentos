// js/navigation.js
import { state } from './state.js';

let currentPanel = 0;

// Constrói a sidebar (chamada uma vez em main.js)
export function buildSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = `
    <div class="sb-section">Configuração</div>
    <div class="nav-item" data-panel="0"><div class="nav-icon">1</div>Configuração</div>
    <div class="nav-item locked" data-panel="1"><div class="nav-icon">2</div>Tratamentos</div>
    <div class="sb-div"></div>
    <div class="sb-section">Dados</div>
    <div class="nav-item locked" data-panel="2"><div class="nav-icon">📋</div>Parâm. Diários</div>
    <div class="nav-item locked" data-panel="3"><div class="nav-icon">🐟</div>Biometria</div>
    <div class="nav-item locked" data-panel="4"><div class="nav-icon">🖨</div>Fichas Diárias</div>
  `;

  sidebar.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const panel = parseInt(item.dataset.panel);
      tryGoTo(panel);
    });
  });

  updateSidebarState();
}

// Atualiza classes locked/done/active com base no estado
export function updateSidebarState() {
  const items = document.querySelectorAll('.nav-item');
  items.forEach(item => {
    const panel = parseInt(item.dataset.panel);
    item.classList.remove('locked', 'done', 'active');
    if (panel === currentPanel) item.classList.add('active');

    // Lógica de bloqueio/liberação
    if (panel === 0) {
      // Sempre liberado
    } else if (panel === 1) {
      if (!state.cfg.startDate) item.classList.add('locked');
    } else if (panel >= 2 && panel <= 4) {
      if (!state.confirmed) item.classList.add('locked');
    }

    // Marca como concluído (done)
    if (panel === 1 && state.confirmed) {
      item.classList.add('done');
      item.querySelector('.nav-icon').textContent = '✓';
    }
  });
}

// Tenta navegar para um painel
export function tryGoTo(panel) {
  if (panel === 0) {
    setActivePanel(0);
    return;
  }
  if (panel === 1 && state.cfg.startDate) {
    setActivePanel(1);
    return;
  }
  if (panel >= 2 && panel <= 4 && state.confirmed) {
    setActivePanel(panel);
    return;
  }
  // Não permitido
}

// Muda o painel ativo
export function setActivePanel(index) {
  // Esconde todos, mostra o selecionado
  for (let i = 0; i <= 4; i++) {
    const panel = document.getElementById(`panel${i}`);
    if (panel) panel.classList.toggle('active', i === index);
  }
  currentPanel = index;
  updateSidebarState();

  // Dispara evento para que módulos possam reagir (ex.: atualizar conteúdo)
  window.dispatchEvent(new CustomEvent('panelChanged', { detail: { panel: index } }));
}

// Funções auxiliares para desbloquear/marcar como concluído (chamadas pelos módulos)
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