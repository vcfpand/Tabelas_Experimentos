// js/treatmentPanel.js
import { state, saveState } from './state.js';
import { TC, TL, showError, hideError, showToast } from './utils.js';
import { unlockPanel, markPanelDone, setActivePanel } from './navigation.js';
import { initExperimentalTablesPanel } from './experimentalTablesPanel.js';   // ← alterado

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
    <div id="potWeightsSection" style="display:none;">
      <div class="card">
        <div class="card-title">Peso dos Potes (g)</div>
        <div id="potWeightsList" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(100px, 1fr)); gap:12px;"></div>
        <div id="errPot" class="error-msg"></div>
      </div>
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost" id="btnBackToConfig">← Voltar</button>
      <button class="btn btn-primary" id="btnConfirmTreats" disabled>Confirmar e continuar →</button>
      <button class="btn btn-add" id="btnExportTreats" style="margin-left:auto">💾 Salvar distribuição</button>
    </div>
  `;

  document.getElementById('btnBackToConfig').addEventListener('click', () => setActivePanel(0));
  document.getElementById('btnConfirmTreats').addEventListener('click', confirmTreatments);
  document.getElementById('btnExportTreats').addEventListener('click', exportTreatmentAssignment);

  buildTreatUI();
}

function buildTreatUI() {
  buildTreatSelector();
  renderBoxPool();
  renderTreatColumns();
  updatePotWeightsSection();
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

function updatePotWeightsSection() {
  const assigned = allAssignedBoxes();
  const allAssigned = assigned.length === state.cfg.boxes;
  const section = document.getElementById('potWeightsSection');
  const confirmBtn = document.getElementById('btnConfirmTreats');
  
  if (allAssigned) {
    section.style.display = 'block';
    renderPotWeightsList();
    const allValid = checkAllPotWeightsValid();
    confirmBtn.disabled = !allValid;
  } else {
    section.style.display = 'none';
    confirmBtn.disabled = true;
  }
}

function renderPotWeightsList() {
  const list = document.getElementById('potWeightsList');
  if (!list) return;
  
  list.innerHTML = '';
  const boxes = allAssignedBoxes().sort((a, b) => a - b);
  
  boxes.forEach(c => {
    const div = document.createElement('div');
    div.className = 'field';
    div.style.margin = '0';
    div.innerHTML = `
      <label style="font-weight:600;">C${String(c).padStart(2, '0')}</label>
      <input type="number" id="potWeight_${c}" min="0" step="0.1" value="${state.cfg.potWeights[c] ?? ''}" placeholder="0.0" style="width:100%;">
    `;
    list.appendChild(div);
    
    const input = document.getElementById(`potWeight_${c}`);
    if (input) {
      input.addEventListener('input', () => {
        const val = parseFloat(input.value);
        if (!isNaN(val) && val >= 0) {
          state.cfg.potWeights[c] = val;
        } else {
          delete state.cfg.potWeights[c];
        }
        saveState();
        const confirmBtn = document.getElementById('btnConfirmTreats');
        if (confirmBtn) confirmBtn.disabled = !checkAllPotWeightsValid();
        hideError(document.getElementById('errPot'));
      });
    }
  });
}

function checkAllPotWeightsValid() {
  const boxes = allAssignedBoxes();
  for (const c of boxes) {
    const w = state.cfg.potWeights[c];
    if (w === undefined || w === null || isNaN(w) || w < 0) return false;
  }
  return true;
}

function confirmTreatments() {
  const err = document.getElementById('err1');
  hideError(err);
  const assigned = allAssignedBoxes();
  if (assigned.length !== state.cfg.boxes) {
    showError(err, `Atribua todas as ${state.cfg.boxes} caixas (${assigned.length} atribuídas).`);
    return;
  }
  if (!checkAllPotWeightsValid()) {
    showError(document.getElementById('errPot'), 'Informe o peso de todos os potes (≥ 0).');
    return;
  }
  state.confirmed = true;
  saveState();
  markPanelDone(1);
  unlockPanel(2);   // Tabelas Experimentais
  unlockPanel(3);   // Fichas Diárias
  initExperimentalTablesPanel();   // ← inicializa o painel com abas
  setActivePanel(2);
}

function exportTreatmentAssignment() {
  const lines = ['Caixa,Tratamento,Peso Pote (g)'];
  for (let t = 0; t < state.cfg.treats; t++) {
    const boxes = state.assigns[t] || [];
    boxes.forEach(c => {
      lines.push(`C${String(c).padStart(2, '0')},T${t},${state.cfg.potWeights[c] || ''}`);
    });
  }
  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `distribuicao_tratamentos_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✓ Distribuição exportada como CSV');
}