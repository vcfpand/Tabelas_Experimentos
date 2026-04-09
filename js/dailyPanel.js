// js/dailyPanel.js
import { state, saveState } from './state.js';
import { TL, TC, mkStats, showToast } from './utils.js';
import { setActivePanel } from './navigation.js';

const DAILY_COLS = ['data', 'dia_exp', 'tratamento', 'caixa', 'ph', 'temp', 'od', 'cond', 'amonia', 'nitrito', 'mort', 'pote_vazio', 'pote_inicio', 'pote_fim', 'racao_disp', 'consumo'];
const DAILY_FIXED = ['data', 'dia_exp', 'tratamento', 'caixa'];

export function initDailyPanel() {
  const panel = document.getElementById('panel2');
  panel.innerHTML = `
    <div class="panel-title">Parâmetros Diários</div>
    <div class="stats-bar" id="statsBar2"></div>
    <div class="table-controls">
      <button class="btn btn-success btn-sm" id="copyBtn2">📋 Copiar para área de transferência</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead id="thead2"></thead>
        <tbody id="tbody2"></tbody>
      </table>
    </div>
  `;

  buildDailyTable();

  document.getElementById('copyBtn2').addEventListener('click', () => copyDailyTable());
}

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
    th.textContent = col;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const tbody = document.getElementById('tbody2');
  tbody.innerHTML = '';
  state.dailyData = []; // recria do zero

  for (let d = 1; d <= state.cfg.days; d++) {
    const date = new Date(start);
    date.setDate(date.getDate() + d - 1);
    const dateStr = date.toLocaleDateString('pt-BR');

    boxes.forEach((c, bi) => {
      const t = b2t[c] ?? 0;
      const row = {
        data: dateStr,
        dia_exp: d,
        tratamento: TL[t],
        caixa: 'C' + String(c).padStart(2, '0')
      };
      DAILY_COLS.forEach(col => {
        if (!DAILY_FIXED.includes(col)) row[col] = '';
      });

      const idx = state.dailyData.length;
      state.dailyData.push(row);

      const tr = document.createElement('tr');
      if (bi === 0) tr.classList.add('day-start');

      DAILY_COLS.forEach(col => {
        const td = document.createElement('td');
        if (DAILY_FIXED.includes(col)) {
          td.className = 'cell-fixed';
          if (col === 'tratamento') {
            td.innerHTML = `<span class="badge ${TC[t]}-pill">${TL[t]}</span>`;
          } else if (col === 'dia_exp') {
            td.textContent = d;
            td.classList.add('cell-num');
          } else {
            td.textContent = row[col];
          }
        } else {
          td.className = 'cell-input';
          const input = document.createElement('input');
          input.type = 'text';
          input.placeholder = '·';
          input.dataset.row = idx;
          input.dataset.col = col;
          input.addEventListener('input', e => {
            state.dailyData[+e.target.dataset.row][e.target.dataset.col] = e.target.value;
            saveState(); // autosave
          });
          td.appendChild(input);
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  document.getElementById('statsBar2').innerHTML = mkStats([
    ['Dias', state.cfg.days],
    ['Caixas', state.cfg.boxes],
    ['Tratamentos', state.cfg.treats],
    ['Total linhas', state.cfg.days * state.cfg.boxes]
  ]);
}

function copyDailyTable() {
  const cols = DAILY_COLS;
  const tsv = [cols.join('\t'), ...state.dailyData.map(r => cols.map(c => r[c] ?? '').join('\t'))].join('\n');
  navigator.clipboard.writeText(tsv).then(() => {
    showToast('✓ Copiado!');
  }).catch(() => showToast('⚠ Erro ao copiar.'));
}