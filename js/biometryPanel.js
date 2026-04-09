// js/biometryPanel.js
import { state, saveState } from './state.js';
import { toISOLocal, toBR, showError, hideError, mkStats, showToast, TC, TL } from './utils.js';
import { setActivePanel } from './navigation.js';

const BIO_COLS = ['data', 'dia_experimental', 'tratamento', 'caixa', 'peixe', 'peso_g', 'ct_cm', 'cp_cm'];
const BIO_FIXED = ['data', 'dia_experimental', 'tratamento', 'caixa', 'peixe'];

export function initBiometryPanel() {
  const panel = document.getElementById('panel3');
  panel.innerHTML = `
    <div class="panel-title">Biometria</div>
    <div class="panel-sub">A biometria inicial (Dia 0) e a final (Dia <span id="bioFinalDay">—</span>) são fixas.</div>
    <div class="card">
      <div class="card-title">Datas de biometria</div>
      <div class="bio-dates-list" id="bioDatesList"></div>
      <div class="bio-add-row">
        <div class="field"><label>Adicionar biometria intermediária</label><input type="date" id="bioNewDate"></div>
        <button class="btn btn-add btn-sm" id="btnAddBioDate">+ Adicionar</button>
      </div>
      <div id="errBio" class="error-msg"></div>
    </div>
    <div class="btn-row" style="margin-bottom:20px">
      <button class="btn btn-primary" id="btnGenerateBioTable">Gerar Tabela de Biometria</button>
    </div>
    <div id="bioTableSection" style="display:none">
      <div class="stats-bar" id="statsBar3"></div>
      <div class="table-controls">
        <button class="btn btn-success btn-sm" id="copyBtn3">📋 Copiar para área de transferência</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead id="thead3"></thead>
          <tbody id="tbody3"></tbody>
        </table>
      </div>
    </div>
  `;

  // Inicializa bioDates se vazio
  if (state.bioDates.length === 0) {
    const start = new Date(state.cfg.startDate + 'T00:00:00');
    const ini = new Date(start); ini.setDate(ini.getDate() - 1);
    const fin = new Date(start); fin.setDate(fin.getDate() + state.cfg.days);
    state.bioDates = [
      { iso: toISOLocal(ini), label: toBR(ini), type: 'initial', dia: 0 },
      { iso: toISOLocal(fin), label: toBR(fin), type: 'final', dia: state.cfg.days + 1 }
    ];
    saveState();
  }

  document.getElementById('bioFinalDay').textContent = state.cfg.days + 1;
  const newDateInput = document.getElementById('bioNewDate');
  newDateInput.min = state.cfg.startDate;
  newDateInput.max = toISOLocal(new Date(new Date(state.cfg.startDate).setDate(new Date(state.cfg.startDate).getDate() + state.cfg.days - 1)));

  renderBioDatesList();

  document.getElementById('btnAddBioDate').addEventListener('click', addBioDate);
  document.getElementById('btnGenerateBioTable').addEventListener('click', buildBioTable);
  document.getElementById('copyBtn3').addEventListener('click', copyBioTable);
}

function renderBioDatesList() {
  const list = document.getElementById('bioDatesList');
  list.innerHTML = '';
  [...state.bioDates].sort((a, b) => a.dia - b.dia).forEach(bd => {
    const tagClass = bd.type === 'initial' ? 'tag-initial' : bd.type === 'final' ? 'tag-final' : 'tag-inter';
    const tagText = bd.type === 'initial' ? 'INICIAL' : bd.type === 'final' ? 'FINAL' : 'INTERMEDIÁRIA';
    const row = document.createElement('div');
    row.className = 'bio-date-row';
    row.innerHTML = `
      <div class="bio-date-info">
        <span class="bio-tag ${tagClass}">${tagText}</span>
        <span class="bio-date-label">${bd.label}</span>
        <span class="bio-date-sub">Dia ${bd.dia}</span>
      </div>
      ${bd.type === 'inter' ? '<button class="bio-remove">✕</button>' : '<span style="width:28px"></span>'}
    `;
    if (bd.type === 'inter') {
      row.querySelector('.bio-remove').addEventListener('click', () => removeBioDate(bd.iso));
    }
    list.appendChild(row);
  });
}

function addBioDate() {
  const err = document.getElementById('errBio');
  hideError(err);
  const val = document.getElementById('bioNewDate').value;
  if (!val) { showError(err, 'Selecione uma data.'); return; }
  const dia = Math.round((new Date(val + 'T00:00:00') - new Date(state.cfg.startDate + 'T00:00:00')) / 86400000) + 1;
  if (dia < 1 || dia > state.cfg.days) { showError(err, 'Data fora do período experimental.'); return; }
  if (state.bioDates.find(b => b.iso === val)) { showError(err, 'Já adicionada.'); return; }
  state.bioDates.push({ iso: val, label: toBR(new Date(val + 'T00:00:00')), type: 'inter', dia });
  saveState();
  renderBioDatesList();
}

function removeBioDate(iso) {
  state.bioDates = state.bioDates.filter(b => b.iso !== iso);
  saveState();
  renderBioDatesList();
}

function buildBioTable() {
  const b2t = {};
  for (let t = 0; t < state.cfg.treats; t++) (state.assigns[t] || []).forEach(c => b2t[c] = t);
  const boxes = Array.from({ length: state.cfg.boxes }, (_, i) => i + 1);
  const dates = [...state.bioDates].sort((a, b) => a.dia - b.dia);

  const thead = document.getElementById('thead3');
  thead.innerHTML = '';
  const hr = document.createElement('tr');
  BIO_COLS.forEach(c => { const th = document.createElement('th'); th.textContent = c; hr.appendChild(th); });
  thead.appendChild(hr);

  const tbody = document.getElementById('tbody3');
  tbody.innerHTML = '';
  state.bioData = [];

  dates.forEach(bd => {
    boxes.forEach((c, bi) => {
      const t = b2t[c] ?? 0;
      for (let f = 1; f <= state.cfg.fishPerBox; f++) {
        const row = {
          data: bd.label,
          dia_experimental: bd.dia,
          tratamento: TL[t],
          caixa: 'C' + String(c).padStart(2, '0'),
          peixe: f,
          peso_g: '',
          ct_cm: '',
          cp_cm: ''
        };
        const idx = state.bioData.length;
        state.bioData.push(row);

        const tr = document.createElement('tr');
        if (bi === 0 && f === 1) tr.classList.add('bio-group-start');

        BIO_COLS.forEach(col => {
          const td = document.createElement('td');
          if (BIO_FIXED.includes(col)) {
            td.className = 'cell-fixed';
            if (col === 'tratamento') {
              td.innerHTML = `<span class="badge ${TC[t]}-pill">${TL[t]}</span>`;
            } else if (col === 'dia_experimental' || col === 'peixe') {
              td.textContent = row[col];
              td.classList.add('cell-num');
            } else {
              td.textContent = row[col];
            }
          } else {
            td.className = 'cell-input';
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.placeholder = '·';
            inp.dataset.row = idx;
            inp.dataset.col = col;
            inp.addEventListener('input', e => {
              state.bioData[+e.target.dataset.row][e.target.dataset.col] = e.target.value;
              saveState();
            });
            td.appendChild(inp);
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      }
    });
  });

  const total = dates.length * state.cfg.boxes * state.cfg.fishPerBox;
  document.getElementById('statsBar3').innerHTML = mkStats([
    ['Datas', dates.length],
    ['Caixas', state.cfg.boxes],
    ['Peixes/cx', state.cfg.fishPerBox],
    ['Total linhas', total]
  ]);
  document.getElementById('bioTableSection').style.display = 'block';
}

function copyBioTable() {
  const cols = BIO_COLS;
  const tsv = [cols.join('\t'), ...state.bioData.map(r => cols.map(c => r[c] ?? '').join('\t'))].join('\n');
  navigator.clipboard.writeText(tsv).then(() => showToast('✓ Copiado!')).catch(() => showToast('⚠ Erro ao copiar.'));
}