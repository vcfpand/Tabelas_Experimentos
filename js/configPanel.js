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
      <div class="card-title">Período experimental</div>
      <div class="fg2">
        <div class="field"><label>Data de início do experimento (Dia 1)</label><input type="date" id="startDate"></div>
        <div class="field"><label>Duração do experimento (dias)</label><input type="number" id="numDays" min="1" max="365" value="30"></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Aclimatação</div>
      <div class="fg2">
        <div class="field"><label>Data de início da aclimatação</label><input type="date" id="acclimStart"></div>
        <div class="field"><p style="font-size:12px;color:var(--text2);line-height:1.7;padding-top:4px">O período vai da data escolhida até o Dia 0 (biometria inicial). Os dias serão numerados negativamente (-7, -6, ... -1, 0).</p></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Estrutura</div>
      <div class="fg3">
        <div class="field"><label>Número de caixas</label><input type="number" id="numBoxes" min="2" max="64" value="16"></div>
        <div class="field"><label>Número de tratamentos</label><input type="number" id="numTreats" min="2" max="8" value="4"></div>
        <div class="field"><label>Peixes por caixa</label><input type="number" id="fishPerBox" min="1" max="999" value="10"></div>
      </div>
    </div>
    <div id="err0" class="error-msg"></div>
    <div class="btn-row">
      <button class="btn btn-primary" id="btnNextToTreat">Próximo: Tratamentos →</button>
      <button class="btn btn-ghost" id="btnResetAll" style="margin-left:auto">⚠️ Zerar todos os dados</button>
    </div>
  `;

  // Preenche campos com valores do estado
  const startDate = document.getElementById('startDate');
  const acclimStart = document.getElementById('acclimStart');
  const numDays = document.getElementById('numDays');
  const numBoxes = document.getElementById('numBoxes');
  const numTreats = document.getElementById('numTreats');
  const fishPerBox = document.getElementById('fishPerBox');

  startDate.value = state.cfg.startDate || new Date().toISOString().split('T')[0];
  acclimStart.value = state.cfg.acclimStart || (() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return toISOLocal(d);
  })();
  numDays.value = state.cfg.days;
  numBoxes.value = state.cfg.boxes;
  numTreats.value = state.cfg.treats;
  fishPerBox.value = state.cfg.fishPerBox;

  document.getElementById('btnNextToTreat').addEventListener('click', goStep1);
  document.getElementById('btnResetAll').addEventListener('click', resetAllData);

  function goStep1() {
    const sd = startDate.value;
    const as = acclimStart.value;
    const nd = +numDays.value;
    const nb = +numBoxes.value;
    const nt = +numTreats.value;
    const fp = +fishPerBox.value;
    const err = document.getElementById('err0');
    hideError(err);

    if (!sd) { showError(err, 'Informe a data de início do experimento.'); return; }
    if (!as) { showError(err, 'Informe a data de início da aclimatação.'); return; }
    if (new Date(as + 'T00:00:00') >= new Date(sd + 'T00:00:00')) {
      showError(err, 'A aclimatação deve iniciar antes do experimento.'); return;
    }
    if (nd < 1 || nd > 365) { showError(err, 'Duração inválida (1–365).'); return; }
    if (nb < 2) { showError(err, 'Mínimo 2 caixas.'); return; }
    if (fp < 1) { showError(err, 'Mínimo 1 peixe por caixa.'); return; }

    state.cfg = { startDate: sd, acclimStart: as, days: nd, boxes: nb, treats: nt, fishPerBox: fp };
    state.assigns = {};
    for (let i = 0; i < nt; i++) state.assigns[i] = [];
    state.confirmed = false;
    state.dailyData = [];
    state.bioData = [];
    state.bioDates = [];
    saveState();

    // Prepara painel de tratamentos
    initTreatmentPanel(); // reconstrói com novos valores
    unlockPanel(1);
    setActivePanel(1);
  }

  function resetAllData() {
    if (confirm('Tem certeza? Todos os dados serão perdidos e a página será recarregada.')) {
      localStorage.removeItem('experimentState');
      window.location.reload();
    }
  }
}