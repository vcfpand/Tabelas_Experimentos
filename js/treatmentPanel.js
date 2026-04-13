// js/treatmentPanel.js
import { state, saveState } from './state.js';
import { TC, showError, hideError, showToast } from './utils.js';
import { unlockPanel, markPanelDone, setActivePanel } from './navigation.js';
import { initExperimentalTablesPanel } from './experimentalTablesPanel.js';

let selTreat = 0;

export function initTreatmentPanel() {
  const panel = document.getElementById('panel1');
  const treatNames = state.cfg.treatmentNames || [];
  panel.innerHTML = `
    <div class="panel-title">Atribuição de Tratamentos</div>
    <div class="panel-sub">Selecione um tratamento e clique nas caixas para atribuí-las.</div>
    <div class="card"><div class="card-title">Tratamento ativo</div><div class="treat-selector" id="treatSelector"></div></div>
    <div class="card"><div class="card-title">Caixas disponíveis</div><div class="box-pool" id="boxPool"></div></div>
    <div class="treat-columns" id="treatColumns"></div>
    <div id="err1" class="error-msg"></div>
    <div id="potWeightsSection" style="display:none;">
      <div class="card">
        <div class="card-title">Peso dos Potes (g) <span class="tooltip-icon" title="Peso do pote vazio (sem ração). Usado para calcular a ração disponibilizada.">ⓘ</span></div>
        <div id="potWeightsList" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(100px, 1fr)); gap:12px;"></div>
        <div id="errPot" class="error-msg"></div>
      </div>
    </div>
    <div class="btn-row" id="actionRow"></div>
  `;

  const actionRow = document.getElementById('actionRow');
  actionRow.innerHTML = `
    <div role="button" tabindex="0" class="btn btn-ghost" id="btnBackToConfig">← Voltar</div>
    <div role="button" tabindex="0" class="btn btn-primary" id="btnConfirmTreats" disabled>Confirmar e continuar →</div>
    <div role="button" tabindex="0" class="btn btn-add" id="btnExportTreats" style="margin-left:auto">💾 Salvar distribuição</div>
    <div role="button" tabindex="0" class="btn btn-add" id="btnImportTreats">📂 Importar distribuição</div>
    <input type="file" id="treatFileImport" accept=".csv,text/csv" style="display:none">
  `;

  const backBtn = document.getElementById('btnBackToConfig');
  const confirmBtn = document.getElementById('btnConfirmTreats');
  const exportBtn = document.getElementById('btnExportTreats');
  const importBtn = document.getElementById('btnImportTreats');
  const fileInput = document.getElementById('treatFileImport');

  const preventNavigation = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  };

  backBtn.addEventListener('click', (e) => {
    preventNavigation(e);
    setActivePanel(0);
  }, true);

  confirmBtn.addEventListener('click', (e) => {
    preventNavigation(e);
    if (confirmBtn.style.pointerEvents !== 'none') confirmTreatments();
  }, true);

  exportBtn.addEventListener('click', (e) => {
    preventNavigation(e);
    exportTreatmentAssignment();
  }, true);

  importBtn.addEventListener('click', (e) => {
    preventNavigation(e);
    fileInput.click();
  }, true);

  fileInput.addEventListener('change', (e) => {
    importTreatmentAssignment(e);
    e.target.value = '';
  });

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
  const names = state.cfg.treatmentNames;
  for (let i = 0; i < state.cfg.treats; i++) {
    const btn = document.createElement('div');
    btn.className = 'treat-btn' + (i === selTreat ? ' sel' : '');
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.dataset.t = i;
    btn.textContent = names[i] || `T${i}`;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selTreat = i;
      buildTreatUI();
    });
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
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
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
  const names = state.cfg.treatmentNames;
  for (let t = 0; t < state.cfg.treats; t++) {
    const boxes = (state.assigns[t] || []).slice().sort((a, b) => a - b);
    const col = document.createElement('div');
    col.className = 'treat-col-card';
    col.innerHTML = `
      <div class="treat-col-header">
        <span class="badge ${TC[t]}-pill">${names[t] || `T${t}`}</span>
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
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
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
    confirmBtn.style.pointerEvents = allValid ? 'auto' : 'none';
    confirmBtn.classList.toggle('disabled', !allValid);
  } else {
    section.style.display = 'none';
    confirmBtn.style.pointerEvents = 'none';
    confirmBtn.classList.add('disabled');
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
        const allValid = checkAllPotWeightsValid();
        confirmBtn.style.pointerEvents = allValid ? 'auto' : 'none';
        confirmBtn.classList.toggle('disabled', !allValid);
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
  unlockPanel(2);
  unlockPanel(3);
  initExperimentalTablesPanel();
  setActivePanel(2);
}

function exportTreatmentAssignment() {
  const lines = ['Caixa,Tratamento,Peso Pote (g)'];
  for (let t = 0; t < state.cfg.treats; t++) {
    const boxes = state.assigns[t] || [];
    boxes.forEach(c => {
      lines.push(`C${String(c).padStart(2, '0')},${state.cfg.treatmentNames[t]},${state.cfg.potWeights[c] || ''}`);
    });
  }
  const csv = lines.join('\n');
  const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  const a = document.createElement('a');
  a.href = dataUri;
  a.download = `distribuicao_tratamentos_${new Date().toISOString().slice(0, 10)}.csv`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('✓ Distribuição exportada como CSV');
}

function importTreatmentAssignment(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const text = ev.target.result;
    const lines = text.split('\n').filter(l => l.trim() !== '');
    if (lines.length < 2) { showToast('⚠ Arquivo CSV inválido'); return; }
    const newAssigns = {};
    for (let i=0; i<state.cfg.treats; i++) newAssigns[i] = [];
    const newPotWeights = {};
    const treatMap = {};
    state.cfg.treatmentNames.forEach((name, idx) => { treatMap[name] = idx; });
    for (let i=1; i<lines.length; i++) {
      const cols = lines[i].split(',').map(s => s.trim());
      if (cols.length < 3) continue;
      const caixaStr = cols[0].replace(/^C/i, '');
      const caixa = parseInt(caixaStr);
      if (isNaN(caixa)) continue;
      const tratName = cols[1];
      const peso = parseFloat(cols[2]);
      const tIdx = treatMap[tratName];
      if (tIdx !== undefined) {
        newAssigns[tIdx].push(caixa);
        if (!isNaN(peso)) newPotWeights[caixa] = peso;
      }
    }
    const allBoxes = Array.from({length: state.cfg.boxes}, (_,i)=>i+1);
    const assignedBoxes = Object.values(newAssigns).flat();
    const missing = allBoxes.filter(c => !assignedBoxes.includes(c));
    if (missing.length > 0) {
      showToast(`⚠ Caixas não atribuídas: ${missing.join(', ')}`);
    }
    state.assigns = newAssigns;
    state.cfg.potWeights = { ...state.cfg.potWeights, ...newPotWeights };
    saveState();
    buildTreatUI();
    showToast('✓ Distribuição importada!');
  };
  reader.readAsText(file);
  e.target.value = '';
}