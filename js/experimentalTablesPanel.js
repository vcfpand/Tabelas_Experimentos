// js/experimentalTablesPanel.js
import { state, saveState } from './state.js';
import { TL, TC, mkStats, showToast, toISOLocal, toBR, showError, hideError } from './utils.js';
import { exportUnifiedExcel, copyUnifiedTSV } from './exportExcel.js';

const DAILY_COLS = [
  'data', 'dia_exp', 'tratamento', 'caixa',
  'ph', 'temp', 'od', 'cond', 'amonia', 'nitrito', 'mort',
  'pote_inicio', 'pote_fim', 'consumo', 'racao_disp', 'pote_vazio'
];
const DAILY_FIXED = ['data', 'dia_exp', 'tratamento', 'caixa', 'pote_vazio'];

const BIO_COLS = ['data', 'dia_experimental', 'tratamento', 'caixa', 'peixe', 'peso_g', 'ct_cm', 'cp_cm'];
const BIO_FIXED = ['data', 'dia_experimental', 'tratamento', 'caixa', 'peixe'];

export function initExperimentalTablesPanel() {
  const panel = document.getElementById('panel2');
  panel.innerHTML = `
    <div class="panel-title">Tabelas Experimentais</div>
    <div class="panel-sub">Gerencie os parâmetros diários e os dados de biometria.</div>
    <div class="tabs-container">
      <div class="tabs">
        <button class="tab-btn active" data-tab="daily">Parâmetros Diários</button>
        <button class="tab-btn" data-tab="bio">Biometria</button>
      </div>
    </div>
    <div class="tab-content active" id="tab-daily">
      <div class="stats-bar" id="statsBar2"></div>
      <div class="table-wrap" style="margin-top:16px;">
        <table><thead id="thead2"></thead><tbody id="tbody2"></tbody></table>
      </div>
    </div>
    <div class="tab-content" id="tab-bio">
      <div class="card" style="margin-bottom:16px;">
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
        <div class="table-wrap">
          <table><thead id="thead3"></thead><tbody id="tbody3"></tbody></table>
        </div>
      </div>
    </div>
    <div class="btn-row" style="margin-top:24px; border-top:1px solid var(--border); padding-top:20px;">
      <button class="btn btn-success btn-sm" id="copyUnifiedBtn">📋 Copiar TSV (todas as tabelas)</button>
      <button class="btn btn-primary btn-sm" id="exportUnifiedExcelBtn">📊 Exportar Excel (completo)</button>
    </div>
  `;

  setupTabs();
  buildDailyTable();
  initBioData();
  renderBioDatesList();

  document.getElementById('btnAddBioDate').addEventListener('click', addBioDate);
  document.getElementById('btnGenerateBioTable').addEventListener('click', buildBioTable);
  document.getElementById('copyUnifiedBtn').addEventListener('click', copyUnifiedTSV);
  document.getElementById('exportUnifiedExcelBtn').addEventListener('click', exportUnifiedExcel);
}

function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(`tab-${tabId}`).classList.add('active');
    });
  });
}

// ===== PARÂMETROS DIÁRIOS =====
function buildDailyTable() {
  const start = new Date(state.cfg.startDate + 'T00:00:00');
  const b2t = {};
  for (let t = 0; t < state.cfg.treats; t++) {
    (state.assigns[t] || []).forEach(c => b2t[c] = t);
  }
  const boxes = Array.from({ length: state.cfg.boxes }, (_, i) => i + 1);

  const thead = document.getElementById('thead2');
  thead.innerHTML = '';
  const headerRow = document.createElement('tr');
  DAILY_COLS.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.replace(/_/g, ' ');
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const tbody = document.getElementById('tbody2');
  tbody.innerHTML = '';
  state.dailyData = [];

  for (let d = 1; d <= state.cfg.days; d++) {
    const date = new Date(start);
    date.setDate(date.getDate() + d - 1);
    const dateStr = date.toLocaleDateString('pt-BR');

    boxes.forEach((c) => {
      const t = b2t[c] ?? 0;
      const row = {
        data: dateStr, dia_exp: d, tratamento: TL[t], caixa: 'C' + String(c).padStart(2, '0'),
        pote_vazio: state.cfg.potWeights[c] || 0,
        pote_inicio: '', pote_fim: '', racao_disp: '', consumo: ''
      };
      DAILY_COLS.forEach(col => {
        if (!DAILY_FIXED.includes(col) && !['racao_disp', 'consumo'].includes(col)) row[col] = '';
      });
      state.dailyData.push(row);
    });
  }

  for (let i = 0; i < state.dailyData.length; i++) {
    const row = state.dailyData[i];
    if (row.dia_exp === 1) continue;
    const prevRow = state.dailyData.find(r => r.dia_exp === row.dia_exp - 1 && r.caixa === row.caixa);
    if (prevRow) row.pote_inicio = prevRow.pote_fim;
  }

  state.dailyData.forEach((row, idx) => {
    const tr = document.createElement('tr');
    if (idx % boxes.length === 0) tr.classList.add('day-start');

    DAILY_COLS.forEach(col => {
      const td = document.createElement('td');
      if (DAILY_FIXED.includes(col)) {
        td.className = 'cell-fixed';
        if (col === 'tratamento') {
          const t = TL.indexOf(row.tratamento);
          td.innerHTML = `<span class="badge ${TC[t]}-pill">${row.tratamento}</span>`;
        } else if (col === 'dia_exp') {
          td.textContent = row.dia_exp;
          td.classList.add('cell-num');
        } else {
          td.textContent = row[col];
        }
      } else if (col === 'racao_disp' || col === 'consumo') {
        td.className = 'cell-fixed cell-num';
        td.id = `${col}_${idx}`;
        updateCalculatedCell(row, col, td);
      } else {
        td.className = 'cell-input';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = '·';
        input.dataset.row = idx;
        input.dataset.col = col;
        input.value = row[col] || '';
        input.addEventListener('input', e => {
          state.dailyData[idx][col] = e.target.value;
          saveState();
          if (col === 'pote_fim') {
            const cur = state.dailyData[idx];
            const next = state.dailyData.find(r => r.dia_exp === cur.dia_exp + 1 && r.caixa === cur.caixa);
            if (next) {
              next.pote_inicio = e.target.value;
              const nextIdx = state.dailyData.indexOf(next);
              const nextInput = document.querySelector(`input[data-row="${nextIdx}"][data-col="pote_inicio"]`);
              if (nextInput) nextInput.value = e.target.value;
              recalcRow(nextIdx);
            }
          }
          recalcRow(idx);
        });
        td.appendChild(input);
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  document.getElementById('statsBar2').innerHTML = mkStats([
    ['Dias', state.cfg.days], ['Caixas', state.cfg.boxes], ['Tratamentos', state.cfg.treats], ['Total linhas', state.cfg.days * state.cfg.boxes]
  ]);
}

function updateCalculatedCell(row, col, td) {
  const poteVazio = row.pote_vazio;
  const poteInicio = parseFloat(row.pote_inicio) || 0;
  const poteFim = parseFloat(row.pote_fim) || 0;
  let value = '';
  if (col === 'racao_disp') {
    if (!isNaN(poteFim) && poteFim > 0) value = (poteFim - poteVazio).toFixed(2);
  } else if (col === 'consumo') {
    if (!isNaN(poteInicio) && !isNaN(poteFim)) value = (poteInicio - poteFim).toFixed(2);
  }
  td.textContent = value;
  row[col] = value;
}

function recalcRow(idx) {
  const row = state.dailyData[idx];
  const racaoTd = document.getElementById(`racao_disp_${idx}`);
  const consumoTd = document.getElementById(`consumo_${idx}`);
  if (racaoTd) updateCalculatedCell(row, 'racao_disp', racaoTd);
  if (consumoTd) updateCalculatedCell(row, 'consumo', consumoTd);
  saveState();
}

// ===== BIOMETRIA =====
function initBioData() {
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
  const newDateInput = document.getElementById('bioNewDate');
  newDateInput.min = state.cfg.startDate;
  newDateInput.max = toISOLocal(new Date(new Date(state.cfg.startDate).setDate(new Date(state.cfg.startDate).getDate() + state.cfg.days - 1)));
}

function renderBioDatesList() {
  const list = document.getElementById('bioDatesList');
  list.innerHTML = '';
  [...state.bioDates].sort((a,b)=> a.dia - b.dia).forEach(bd => {
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
  const err = document.getElementById('errBio'); hideError(err);
  const val = document.getElementById('bioNewDate').value;
  if (!val) { showError(err, 'Selecione uma data.'); return; }
  const dia = Math.round((new Date(val+'T00:00:00') - new Date(state.cfg.startDate+'T00:00:00')) / 86400000) + 1;
  if (dia < 1 || dia > state.cfg.days) { showError(err, 'Data fora do período experimental.'); return; }
  if (state.bioDates.find(b => b.iso === val)) { showError(err, 'Já adicionada.'); return; }
  state.bioDates.push({ iso: val, label: toBR(new Date(val+'T00:00:00')), type: 'inter', dia });
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

  const thead = document.getElementById('thead3'); thead.innerHTML = '';
  const hr = document.createElement('tr');
  BIO_COLS.forEach(c => { const th = document.createElement('th'); th.textContent = c; hr.appendChild(th); });
  thead.appendChild(hr);

  const tbody = document.getElementById('tbody3'); tbody.innerHTML = '';
  state.bioData = [];

  dates.forEach(bd => {
    boxes.forEach((c, bi) => {
      const t = b2t[c] ?? 0;
      for (let f = 1; f <= state.cfg.fishPerBox; f++) {
        const row = {
          data: bd.label, dia_experimental: bd.dia, tratamento: TL[t],
          caixa: 'C' + String(c).padStart(2, '0'), peixe: f, peso_g: '', ct_cm: '', cp_cm: ''
        };
        const idx = state.bioData.length; state.bioData.push(row);
        const tr = document.createElement('tr');
        if (bi === 0 && f === 1) tr.classList.add('bio-group-start');
        BIO_COLS.forEach(col => {
          const td = document.createElement('td');
          if (BIO_FIXED.includes(col)) {
            td.className = 'cell-fixed';
            if (col === 'tratamento') td.innerHTML = `<span class="badge ${TC[t]}-pill">${TL[t]}</span>`;
            else if (col === 'dia_experimental' || col === 'peixe') { td.textContent = row[col]; td.classList.add('cell-num'); }
            else td.textContent = row[col];
          } else {
            td.className = 'cell-input';
            const inp = document.createElement('input');
            inp.type = 'text'; inp.placeholder = '·'; inp.dataset.row = idx; inp.dataset.col = col;
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
    ['Datas', dates.length], ['Caixas', state.cfg.boxes], ['Peixes/cx', state.cfg.fishPerBox], ['Total linhas', total]
  ]);
  document.getElementById('bioTableSection').style.display = 'block';
}