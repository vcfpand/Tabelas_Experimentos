// js/treatmentPanel.js
import { state, saveState } from './state.js';
import { TC, TL, showError, hideError } from './utils.js';
import { unlockPanel, markPanelDone, setActivePanel } from './navigation.js';
import { initDailyPanel } from './dailyPanel.js';

let selTreat = 0;

export function initTreatmentPanel() {
  const panel = document.getElementById('panel1');
  panel.innerHTML = `
    <div class="panel-title">Atribuição de Tratamentos</div>
    <div class="panel-sub">Selecione um tratamento e clique nas caixas para atribuí-las.</div>
    <div class="card"><div class="card-title">Tratamento ativo</div><div class="treat-selector" id="treatSelector"></div></div>
    <div class="card"><div class="card-title">Caixas disponíveis</div><div class="box-pool" id="boxPool"></div></div>
    <div class="treat-columns" id="treatColumns"></div>
    <div id="err1" class="error-msg"></div>
    <div class="btn-row">
      <button class="btn btn-ghost" id="btnBackToConfig">← Voltar</button>
      <button class="btn btn-primary" id="btnConfirmTreats">Confirmar e continuar →</button>
    </div>
  `;

  document.getElementById('btnBackToConfig').addEventListener('click', () => setActivePanel(0));
  document.getElementById('btnConfirmTreats').addEventListener('click', confirmTreatments);

  buildTreatUI();
}

function buildTreatUI() {
  buildTreatSelector();
  renderBoxPool();
  renderTreatColumns();
}

function buildTreatSelector() {
  const el = document.getElementById('treatSelector');
  el.innerHTML = '';
  for (let i = 0; i < state.cfg.treats; i++) {
    const btn = document.createElement('button');
    btn.className = 'treat-btn' + (i === selTreat ? ' sel' : '');
    btn.dataset.t = i;
    btn.textContent = TL[i];
    btn.addEventListener('click', () => { selTreat = i; buildTreatUI(); });
    el.appendChild(btn);
  }
}

function allAssignedBoxes() {
  return Object.values(state.assigns).flat();
}

function renderBoxPool() {
  const pool = document.getElementById('boxPool');
  pool.innerHTML = '';
  const taken = allAssignedBoxes();
  for (let c = 1; c <= state.cfg.boxes; c++) {
    const chip = document.createElement('span');
    chip.className = 'box-chip' + (taken.includes(c) ? ' taken' : '');
    chip.textContent = 'C' + String(c).padStart(2, '0');
    if (!taken.includes(c)) {
      chip.addEventListener('click', () => {
        state.assigns[selTreat].push(c);
        saveState();
        buildTreatUI();
      });
    }
    pool.appendChild(chip);
  }
}

function renderTreatColumns() {
  const container = document.getElementById('treatColumns');
  container.style.gridTemplateColumns = `repeat(${Math.min(state.cfg.treats, 4)}, 1fr)`;
  container.innerHTML = '';
  for (let t = 0; t < state.cfg.treats; t++) {
    const boxes = (state.assigns[t] || []).slice().sort((a, b) => a - b);
    const col = document.createElement('div');
    col.className = 'treat-col-card';
    col.innerHTML = `
      <div class="treat-col-header">
        <span class="badge ${TC[t]}-pill">${TL[t]}</span>
        <span class="treat-count">${boxes.length} cx</span>
      </div>
      <div class="chips-container" id="chips${t}"></div>
    `;
    container.appendChild(col);
    const chipsDiv = document.getElementById(`chips${t}`);
    boxes.forEach(c => {
      const chip = document.createElement('span');
      chip.className = `assigned-chip ${TC[t]}-pill`;
      chip.innerHTML = `C${String(c).padStart(2, '0')}<span class="x">✕</span>`;
      chip.addEventListener('click', () => {
        state.assigns[t] = state.assigns[t].filter(x => x !== c);
        saveState();
        buildTreatUI();
      });
      chipsDiv.appendChild(chip);
    });
  }
}

function confirmTreatments() {
  const err = document.getElementById('err1');
  hideError(err);
  const assigned = allAssignedBoxes();
  if (assigned.length !== state.cfg.boxes) {
    showError(err, `Atribua todas as ${state.cfg.boxes} caixas (${assigned.length} atribuídas).`);
    return;
  }
  state.confirmed = true;
  saveState();
  markPanelDone(1);
  unlockPanel(2);
  unlockPanel(3);
  unlockPanel(4);
  // Inicializa tabelas diárias e de biometria (vazias)
  initDailyPanel();
  setActivePanel(2);
}