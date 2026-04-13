// js/configPanel.js
import { state, saveState } from './state.js';
import { toISOLocal, showError, hideError, showToast } from './utils.js';
import { unlockPanel, setActivePanel } from './navigation.js';
import { initTreatmentPanel } from './treatmentPanel.js';

export function initConfigPanel() {
  const panel = document.getElementById('panel0');
  panel.innerHTML = `
    <div class="panel-title">Configuração</div>
    <div class="panel-sub">Defina os parâmetros gerais do experimento.</div>
    <div class="card">
      <div class="card-title">Identificação</div>
      <div class="fg2">
        <div class="field"><label>Título / nome do experimento</label><input type="text" id="expTitle" placeholder="Ex: Experimento Tilápia 2025"></div>
        <div class="field"><label>Pesquisador responsável</label><input type="text" id="expResearcher" placeholder="Nome do pesquisador"></div>
      </div>
    </div>
    <div class="card"><div class="card-title">Período experimental</div><div class="fg2">
      <div class="field"><label>Data de início do experimento (Dia 1)</label><input type="date" id="startDate"></div>
      <div class="field"><label>Duração do experimento (dias)</label><input type="number" id="numDays" min="1" max="365" value="30"></div>
    </div></div>
    <div class="card"><div class="card-title">Aclimatação</div><div class="fg2">
      <div class="field"><label>Data de início da aclimatação</label><input type="date" id="acclimStart"></div>
      <div class="field"><p style="font-size:12px;color:var(--text2);line-height:1.7;padding-top:4px">O período vai da data escolhida até o Dia 0 (biometria inicial).</p></div>
    </div></div>
    <div class="card"><div class="card-title">Estrutura</div><div class="fg3">
      <div class="field"><label>Número de caixas</label><input type="number" id="numBoxes" min="2" max="64" value="16"></div>
      <div class="field"><label>Número de tratamentos</label><input type="number" id="numTreats" min="2" max="8" value="4"></div>
      <div class="field"><label>Peixes por caixa</label><input type="number" id="fishPerBox" min="1" max="999" value="10"></div>
    </div>
    <div id="treatmentDetails" style="margin-top:16px;"></div>
    </div>
    <div id="err0" class="error-msg"></div>
    <div class="btn-row">
      <button class="btn btn-primary" id="btnNextToTreat">Próximo: Tratamentos →</button>
      <button class="btn btn-ghost" id="btnResetAll" style="margin-left:auto">⚠️ Zerar todos os dados</button>
      <button class="btn btn-add" id="btnExportState">📤 Exportar backup</button>
      <button class="btn btn-add" id="btnImportState">📥 Importar backup</button>
      <input type="file" id="fileImport" accept=".json,application/json" style="display:none">
    </div>
  `;

  const expTitle = document.getElementById('expTitle');
  const expResearcher = document.getElementById('expResearcher');
  const startDate = document.getElementById('startDate');
  const acclimStart = document.getElementById('acclimStart');
  const numDays = document.getElementById('numDays');
  const numBoxes = document.getElementById('numBoxes');
  const numTreats = document.getElementById('numTreats');
  const fishPerBox = document.getElementById('fishPerBox');

  expTitle.value = state.cfg.expTitle || '';
  expResearcher.value = state.cfg.expResearcher || '';
  startDate.value = state.cfg.startDate || new Date().toISOString().split('T')[0];
  acclimStart.value = state.cfg.acclimStart || (() => { const d = new Date(); d.setDate(d.getDate() - 7); return toISOLocal(d); })();
  numDays.value = state.cfg.days;
  numBoxes.value = state.cfg.boxes;
  numTreats.value = state.cfg.treats;
  fishPerBox.value = state.cfg.fishPerBox;

  if (!state.cfg.treatmentNames) state.cfg.treatmentNames = [];
  if (!state.cfg.initialFeedKg) state.cfg.initialFeedKg = [];

  function renderTreatmentDetails() {
    const nt = +numTreats.value;
    const container = document.getElementById('treatmentDetails');
    let html = `<div class="card"><div class="card-title">Detalhes dos Tratamentos</div>`;
    for (let i = 0; i < nt; i++) {
      const name = (state.cfg.treatmentNames && state.cfg.treatmentNames[i]) ? state.cfg.treatmentNames[i] : '';
      const feed = (state.cfg.initialFeedKg && state.cfg.initialFeedKg[i] !== undefined) ? state.cfg.initialFeedKg[i] : '';
      html += `
        <div class="fg2" style="margin-bottom:12px;">
          <div class="field">
            <label>Nome do tratamento ${i+1}</label>
            <input type="text" id="treatName_${i}" value="${name}" placeholder="Ex: Controle">
          </div>
          <div class="field">
            <label>Ração inicial (kg) ${i+1}</label>
            <input type="number" id="treatFeed_${i}" min="0" step="0.1" value="${feed}" placeholder="0.0">
          </div>
        </div>
      `;
    }
    html += `</div>`;
    container.innerHTML = html;
  }
  numTreats.addEventListener('input', renderTreatmentDetails);
  renderTreatmentDetails();

  expTitle.addEventListener('change', () => { state.cfg.expTitle = expTitle.value; saveState(); });
  expResearcher.addEventListener('change', () => { state.cfg.expResearcher = expResearcher.value; saveState(); });

  document.getElementById('btnNextToTreat').addEventListener('click', goStep1);
  document.getElementById('btnResetAll').addEventListener('click', resetAllData);
  document.getElementById('btnExportState').addEventListener('click', exportBackup);
  document.getElementById('btnImportState').addEventListener('click', () => document.getElementById('fileImport').click());
  document.getElementById('fileImport').addEventListener('change', importBackup);

  function goStep1() {
    const sd = startDate.value, as = acclimStart.value, nd = +numDays.value, nb = +numBoxes.value, nt = +numTreats.value, fp = +fishPerBox.value;
    const err = document.getElementById('err0'); hideError(err);
    if (!sd) { showError(err, 'Informe a data de início do experimento.'); return; }
    if (!as) { showError(err, 'Informe a data de início da aclimatação.'); return; }
    if (new Date(as+'T00:00:00') >= new Date(sd+'T00:00:00')) { showError(err, 'A aclimatação deve iniciar antes do experimento.'); return; }
    if (nd<1 || nd>365) { showError(err, 'Duração inválida (1–365).'); return; }
    if (nb<2) { showError(err, 'Mínimo 2 caixas.'); return; }
    if (fp<1) { showError(err, 'Mínimo 1 peixe por caixa.'); return; }

    const treatmentNames = [];
    const initialFeedKg = [];
    for (let i=0; i<nt; i++) {
      const nameInput = document.getElementById(`treatName_${i}`);
      const feedInput = document.getElementById(`treatFeed_${i}`);
      if (!nameInput.value.trim()) { showError(err, `Informe o nome do tratamento ${i+1}.`); return; }
      treatmentNames.push(nameInput.value.trim());
      const feedVal = parseFloat(feedInput.value);
      if (isNaN(feedVal) || feedVal < 0) { showError(err, `Informe a ração inicial válida para o tratamento ${i+1}.`); return; }
      initialFeedKg.push(feedVal);
    }

    state.cfg = {
      ...state.cfg,
      startDate: sd, acclimStart: as, days: nd, boxes: nb, treats: nt, fishPerBox: fp,
      treatmentNames, initialFeedKg,
      potWeights: state.cfg.potWeights || {}
    };
    if (!state.assigns || Object.keys(state.assigns).length !== nt) {
      state.assigns = {};
      for (let i=0; i<nt; i++) state.assigns[i] = [];
    }
    state.confirmed = false;
    state.dailyData = [];
    state.bioData = [];
    state.bioDates = [];
    saveState();
    initTreatmentPanel();
    unlockPanel(1);
    setActivePanel(1);
  }

  function resetAllData() {
    if (confirm('Tem certeza? Todos os dados serão perdidos e a página será recarregada.')) {
      localStorage.removeItem('experimentState');
      window.location.reload();
    }
  }

  function exportBackup() {
    const backup = { version: '1.2.0', date: new Date().toISOString(), state };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_experimento_${state.cfg.startDate || 'config'}_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✓ Backup exportado!');
  }

  function importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const backup = JSON.parse(ev.target.result);
        if (!backup.state || !backup.state.cfg) throw new Error('Arquivo inválido');
        Object.assign(state, backup.state);
        saveState();
        showToast('✓ Backup restaurado! Reiniciando...');
        setTimeout(() => window.location.reload(), 1000);
      } catch (err) {
        showToast('⚠ Arquivo de backup inválido');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }
}