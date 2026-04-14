// js/printPanel.js
import { state } from './state.js';
import { toBR, showToast } from './utils.js';

const T_PRINT_FG = ['#6b3fa0', '#1a6b3a', '#7a4800', '#0a3c88', '#8a001a', '#006678', '#7a6200', '#7a2020'];
const T_PRINT_BG = ['#f0eafc', '#d4f5e3', '#fff0cc', '#dce9ff', '#ffd5dd', '#d5f5ff', '#fff8cc', '#ffe5e5'];

export function initPrintPanel() {
  const panel = document.getElementById('panel3');
  panel.innerHTML = `
    <div class="panel-title">Fichas Diárias</div>
    <div class="panel-sub">Uma ficha A4 paisagem por dia — aclimatação, biometrias e experimento. A primeira página é uma capa com resumo.</div>
    <div class="card">
      <div class="card-title">📄 Preview da Capa</div>
      <div class="info-box" id="coverPreview" style="max-height:300px;overflow-y:auto;font-family:'SF Mono', monospace;font-size:11px;line-height:1.4;">
        Configure e confirme os tratamentos para visualizar o preview.
      </div>
    </div>
    <div class="card">
      <div class="card-title">Resumo do período</div>
      <div class="info-box" id="fichaInfo">Carregando...</div>
      <div class="legend-row">
        <div style="display:flex;align-items:center;gap:7px"><div class="leg-swatch" style="background:#fff;border-color:#999"></div><span>Caixas lidas (amônia/nitrito)</span></div>
        <div style="display:flex;align-items:center;gap:7px"><div class="leg-swatch" style="background:#111"></div><span>Não lidas neste dia</span></div>
        <div style="display:flex;align-items:center;gap:7px"><div class="leg-swatch" style="background:#fff;border-color:#999"></div><span>Todas ativas nos dias de biometria</span></div>
      </div>
    </div>
    <div class="btn-row">
      <button class="btn btn-print" id="btnOpenPrint">🖨️ Abrir para Impressão / Salvar PDF</button>
    </div>
  `;

  updateFichaInfo();
  updateCoverPreview();
  document.getElementById('btnOpenPrint').addEventListener('click', openPrintWindow);

  window.addEventListener('panelChanged', e => {
    if (e.detail.panel === 3) {
      updateFichaInfo();
      updateCoverPreview();
    }
  });
}

function buildDaySequence() {
  const expStart = new Date(state.cfg.startDate + 'T00:00:00');
  const acStart = new Date(state.cfg.acclimStart + 'T00:00:00');
  const bioDias = new Set(state.bioDates.map(b => b.dia));
  const bioSorted = [...state.bioDates].sort((a, b) => a.dia - b.dia);
  const bioLabelMap = {};
  bioSorted.forEach((b, i) => {
    let label;
    if (i === 0) label = 'Biometria Inicial';
    else if (i === bioSorted.length - 1) label = 'Biometria Final';
    else label = 'Biometria Intermediária';
    bioLabelMap[b.dia] = label;
  });

  const days = [];
  let d = new Date(acStart);
  let periodIdx = 0;
  while (d < expStart) {
    const diff = Math.round((expStart - d) / 86400000);
    days.push({ date: new Date(d), diaExp: -diff, period: 'acclim', periodIdx: periodIdx++ });
    d.setDate(d.getDate() + 1);
  }
  const d0 = new Date(expStart); d0.setDate(d0.getDate() - 1);
  days.push({ date: d0, diaExp: 0, period: 'bio', periodIdx: 0, bioLabel: bioLabelMap[0] || 'Biometria 1' });
  for (let i = 1; i <= state.cfg.days; i++) {
    const date = new Date(expStart); date.setDate(date.getDate() + i - 1);
    const isBio = bioDias.has(i);
    days.push({
      date,
      diaExp: i,
      period: isBio ? 'bio' : 'exp',
      periodIdx: i - 1,
      bioLabel: isBio ? bioLabelMap[i] : ''
    });
  }
  const dfin = new Date(expStart); dfin.setDate(dfin.getDate() + state.cfg.days);
  const finalDia = state.cfg.days + 1;
  days.push({ date: dfin, diaExp: finalDia, period: 'bio', periodIdx: 0, bioLabel: bioLabelMap[finalDia] || 'Biometria Final' });

  // 14 folhas adicionais para caso o experimento se prolongue além do previsto
  for (let extra = 1; extra <= 14; extra++) {
    const dExtra = new Date(dfin);
    dExtra.setDate(dExtra.getDate() + extra);
    days.push({
      date: dExtra,
      diaExp: finalDia + extra,
      period: 'adicional',
      periodIdx: extra - 1
    });
  }

  return days;
}

function getActiveBoxes(day, totalBoxes) {
  if (day.period === 'bio') return null;
  const group = (day.periodIdx || 0) % 4;
  const start = group * 4 + 1;
  return [start, start + 1, start + 2, start + 3].filter(c => c <= totalBoxes);
}

function updateFichaInfo() {
  const infoEl = document.getElementById('fichaInfo');
  if (!state.confirmed) {
    infoEl.innerHTML = '<strong>Configure e confirme os tratamentos primeiro.</strong>';
    return;
  }
  const days = buildDaySequence();
  const ac = days.filter(d => d.period === 'acclim').length;
  const ex = days.filter(d => d.period === 'exp').length;
  const bi = days.filter(d => d.period === 'bio').length;
  const ad = days.filter(d => d.period === 'adicional').length;
  infoEl.innerHTML = `
    <strong>Total de fichas geradas:</strong> ${days.length} páginas A4 paisagem<br>
    <strong>Aclimatação:</strong> ${ac} dias &nbsp;|&nbsp; <strong>Biometrias:</strong> ${bi} &nbsp;|&nbsp; <strong>Experimento:</strong> ${ex} dias &nbsp;|&nbsp; <strong>Adicionais:</strong> ${ad}<br>
    <strong>Rotação amônia/nitrito:</strong> grupos de 4 caixas por dia, reiniciando em cada período.
  `;
}

function updateCoverPreview() {
  const previewEl = document.getElementById('coverPreview');
  if (!state.confirmed) {
    previewEl.innerHTML = 'Configure e confirme os tratamentos para visualizar o preview.';
    return;
  }
  const title = state.cfg.expTitle || 'Experimento';
  const researcher = state.cfg.expResearcher || '—';
  const startDateStr = toBR(new Date(state.cfg.startDate + 'T00:00:00'));
  const endDate = new Date(state.cfg.startDate);
  endDate.setDate(endDate.getDate() + state.cfg.days);
  const endDateStr = toBR(endDate);
  const acclimStr = toBR(new Date(state.cfg.acclimStart + 'T00:00:00'));

  let html = `
    <div style="border-bottom:2px solid var(--accent);margin-bottom:8px;padding-bottom:4px;">
      <strong style="font-size:14px;">${title}</strong><br>
      <span style="color:var(--text2);">Pesquisador: ${researcher}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
      <div>
        <strong>Período</strong><br>
        Aclimatação: ${acclimStr}<br>
        Início: ${startDateStr}<br>
        Duração: ${state.cfg.days} dias<br>
        Término: ${endDateStr}
      </div>
      <div>
        <strong>Estrutura</strong><br>
        Caixas: ${state.cfg.boxes}<br>
        Tratamentos: ${state.cfg.treats}<br>
        Peixes/caixa: ${state.cfg.fishPerBox}<br>
        Total peixes: ${state.cfg.boxes * state.cfg.fishPerBox}
      </div>
    </div>
    <div style="margin-bottom:8px;">
      <strong>Distribuição dos Tratamentos</strong><br>`;
  for (let t = 0; t < state.cfg.treats; t++) {
    const boxesT = (state.assigns[t] || []).slice().sort((a,b)=>a-b);
    html += `<span style="background:${T_PRINT_BG[t]};color:${T_PRINT_FG[t]};padding:2px 6px;border-radius:4px;margin-right:4px;font-size:10px;">${state.cfg.treatmentNames[t]}: ${boxesT.map(c=>'C'+String(c).padStart(2,'0')).join(', ') || '—'}</span><br>`;
  }
  html += `</div>
    <div>
      <strong>Biometrias programadas</strong><br>`;
  const sortedBio = [...state.bioDates].sort((a,b)=>a.dia-b.dia);
  sortedBio.forEach(b => { html += `${b.label} (Dia ${b.dia}) `; });
  html += `</div>`;
  previewEl.innerHTML = html;
}

function openPrintWindow() {
  if (!state.confirmed) {
    showToast('⚠ Confirme os tratamentos primeiro.');
    return;
  }
  const title = state.cfg.expTitle || 'Experimento';
  const researcher = state.cfg.expResearcher || '';
  const days = buildDaySequence();
  const b2t = {};
  for (let t = 0; t < state.cfg.treats; t++) (state.assigns[t] || []).forEach(c => b2t[c] = t);
  const boxes = Array.from({ length: state.cfg.boxes }, (_, i) => i + 1);

  const html = buildPrintHTML(days, boxes, b2t, title, researcher);
  const w = window.open('', '_blank');
  if (!w) {
    showToast('⚠ Pop-up bloqueado. Permita pop-ups para este site.');
    return;
  }
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 700);
}

function buildPrintHTML(days, boxes, b2t, title, researcher) {
  const HCOLS = ['CAIXAS', 'TEMP (°C)', 'OD (mg/L)', 'COND (µS)', 'pH', 'MORTALIDADE', 'CONSUMO', 'AMÔNIA', 'NITRITO'];
  const CWPCT = [11, 9, 9, 9, 8, 12, 12, 15, 15];
  
  let capa = `
  <div style="width:277mm;height:180mm;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;page-break-after:always;padding:10mm;box-sizing:border-box;background:#fff;">
    <div style="border-bottom:3px solid #333;padding-bottom:8px;margin-bottom:12px;">
      <h1 style="font-size:24pt;font-weight:800;color:#1a1a1a;margin:0 0 4px;">${title}</h1>
      <p style="font-size:12pt;color:#555;margin:0;">Pesquisador: ${researcher || '—'}</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
      <div>
        <h2 style="font-size:12pt;font-weight:700;color:#333;border-left:4px solid #0a84ff;padding-left:8px;margin:0 0 8px;">Período</h2>
        <table style="width:100%;border-collapse:collapse;font-size:10pt;">
          <tr><td style="padding:4px 0;color:#666;">Início da aclimatação:</td><td style="font-weight:600;">${toBR(new Date(state.cfg.acclimStart + 'T00:00:00'))}</td></tr>
          <tr><td style="padding:4px 0;color:#666;">Início do experimento:</td><td style="font-weight:600;">${toBR(new Date(state.cfg.startDate + 'T00:00:00'))}</td></tr>
          <tr><td style="padding:4px 0;color:#666;">Duração:</td><td style="font-weight:600;">${state.cfg.days} dias</td></tr>
          <tr><td style="padding:4px 0;color:#666;">Término:</td><td style="font-weight:600;">${toBR(new Date(new Date(state.cfg.startDate).setDate(new Date(state.cfg.startDate).getDate() + state.cfg.days)))}</td></tr>
        </table>
      </div>
      <div>
        <h2 style="font-size:12pt;font-weight:700;color:#333;border-left:4px solid #30d158;padding-left:8px;margin:0 0 8px;">Estrutura</h2>
        <table style="width:100%;border-collapse:collapse;font-size:10pt;">
          <tr><td style="padding:4px 0;color:#666;">Número de caixas:</td><td style="font-weight:600;">${state.cfg.boxes}</td></tr>
          <tr><td style="padding:4px 0;color:#666;">Tratamentos:</td><td style="font-weight:600;">${state.cfg.treats}</td></tr>
          <tr><td style="padding:4px 0;color:#666;">Peixes por caixa:</td><td style="font-weight:600;">${state.cfg.fishPerBox}</td></tr>
          <tr><td style="padding:4px 0;color:#666;">Total de peixes:</td><td style="font-weight:600;">${state.cfg.boxes * state.cfg.fishPerBox}</td></tr>
        </table>
      </div>
    </div>
    <div style="margin-bottom:16px;">
      <h2 style="font-size:12pt;font-weight:700;color:#333;border-left:4px solid #ff9f0a;padding-left:8px;margin:0 0 10px;">Distribuição dos Tratamentos</h2>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">`;
      
  for (let t = 0; t < state.cfg.treats; t++) {
    const boxesT = (state.assigns[t] || []).slice().sort((a,b)=>a-b);
    capa += `
        <div style="background:${T_PRINT_BG[t]};border-left:4px solid ${T_PRINT_FG[t]};padding:6px 12px;border-radius:4px;min-width:180px;">
          <span style="font-weight:800;color:${T_PRINT_FG[t]};margin-right:8px;">${state.cfg.treatmentNames[t]}</span>
          <span style="font-family:'SF Mono',monospace;font-size:9pt;">${boxesT.map(c => 'C'+String(c).padStart(2,'0')).join(', ') || '—'}</span>
        </div>`;
  }
  
  capa += `
      </div>
    </div>
    <div style="margin-top:auto;">
      <h2 style="font-size:12pt;font-weight:700;color:#333;border-left:4px solid #bf5af2;padding-left:8px;margin:0 0 8px;">Biometrias programadas</h2>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">`;
      
  const sortedBio = [...state.bioDates].sort((a,b)=>a.dia-b.dia);
  sortedBio.forEach(b => {
    capa += `<span style="background:#f0f0f0;padding:4px 12px;border-radius:16px;font-size:9pt;">${b.label} (Dia ${b.dia})</span>`;
  });
  
  capa += `
      </div>
    </div>
    <div style="margin-top:20px;font-size:8pt;color:#999;text-align:right;border-top:1px solid #ddd;padding-top:6px;">
      Desenvolvido por Me. Victor César Freitas Pandolfi (UEL/NEPAG) – v1.0.0 – Licença GPLv3<br>
      Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
    </div>
  </div>
  `;

  let pages = '';
  days.forEach((day, di) => {
    const wkdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const wk = wkdays[day.date.getDay()];
    const dateStr = `${wk}, ${day.date.toLocaleDateString('pt-BR')}`;
    const diaStr = day.diaExp === 0 ? '0' : (day.diaExp > 0 ? '+' + day.diaExp : '' + day.diaExp);

    let periodLabel, headerBg, headerColor, headerBorder;
    if (day.period === 'acclim') {
      periodLabel = 'ACLIMATAÇÃO';
      headerBg = '#ede9fc';
      headerColor = '#4a30a0';
      headerBorder = '#b8a8f0';
    } else if (day.period === 'bio') {
      periodLabel = day.bioLabel || 'BIOMETRIA';
      headerBg = '#fff8dc';
      headerColor = '#7a5a00';
      headerBorder = '#f0d060';
    } else if (day.period === 'adicional') {
      periodLabel = 'ADICIONAL';
      headerBg = '#f5f5f5';
      headerColor = '#555555';
      headerBorder = '#bbbbbb';
    } else {
      periodLabel = 'EXPERIMENTO';
      headerBg = '#e2f5ea';
      headerColor = '#1a5e2e';
      headerBorder = '#80d0a0';
    }

    const activeBoxes = getActiveBoxes(day, state.cfg.boxes);
    const amNote = activeBoxes ? 'Amônia/Nitrito: ' + activeBoxes.map(c => 'C' + String(c).padStart(2, '0')).join(', ') : 'Amônia/Nitrito: todas as caixas';

    let tbRows = '';
    boxes.forEach((c, bi) => {
      const t = b2t[c] ?? 0;
      const rowBg = bi % 2 === 0 ? '#ffffff' : '#f2f2f2';
      const active = activeBoxes === null || activeBoxes.includes(c);
      const amBg = active ? rowBg : '#000000';
      const amBorder = active ? '1px solid #bbb' : '1px solid #000';
      const tBg = T_PRINT_BG[t] || '#eee';
      const tFg = T_PRINT_FG[t] || '#333';

      tbRows += `
      <tr style="height:5.8mm;background:${rowBg}">
        <td style="border:1px solid #ccc;padding:0 6px;font-size:8pt;font-weight:700;text-align:left;vertical-align:middle">
          <span style="background:${tBg};color:${tFg};padding:1px 5px;border-radius:3px;font-size:7pt;font-weight:800;margin-right:4px">
            ${state.cfg.treatmentNames[t]}
          </span>
          C${String(c).padStart(2, '0')}
        </td>
        <td style="border:1px solid #ccc;background:${rowBg}"></td>
        <td style="border:1px solid #ccc;background:${rowBg}"></td>
        <td style="border:1px solid #ccc;background:${rowBg}"></td>
        <td style="border:1px solid #ccc;background:${rowBg}"></td>
        <td style="border:1px solid #ccc;background:${rowBg}"></td>
        <td style="border:1px solid #ccc;background:${rowBg}"></td>
        <td style="border:${amBorder};background:${amBg}"></td>
        <td style="border:${amBorder};background:${amBg}"></td>
      </tr>`;
    });

    const isLast = di === days.length - 1;
    pages += `<div style="width:277mm;height:180mm;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;${isLast ? '' : 'page-break-after:always;'}overflow:hidden;padding:0">
      <div style="display:flex;align-items:stretch;border:2px solid #333;border-radius:5px 5px 0 0;background:${headerBg};border-color:${headerBorder};flex-shrink:0">
        <div style="flex:1;padding:5px 10px;border-right:1px solid ${headerBorder}">
          <div style="font-size:8pt;font-weight:800;color:${headerColor};letter-spacing:.04em;text-transform:uppercase">${title}</div>
          ${researcher ? `<div style="font-size:7pt;color:#666;margin-top:1px">Pesquisador: ${researcher}</div>` : ''}
        </div>
        <div style="padding:4px 14px;border-right:1px solid ${headerBorder};display:flex;flex-direction:column;justify-content:center;align-items:center;min-width:100px">
          <div style="font-size:6.5pt;font-weight:700;color:#777;text-transform:uppercase;letter-spacing:.06em">Data</div>
          <div style="font-size:9pt;font-weight:700;color:#111;white-space:nowrap">${dateStr}</div>
        </div>
        <div style="padding:4px 14px;border-right:1px solid ${headerBorder};display:flex;flex-direction:column;justify-content:center;align-items:center;min-width:70px">
          <div style="font-size:6.5pt;font-weight:700;color:#777;text-transform:uppercase;letter-spacing:.06em">Dia Exp.</div>
          <div style="font-size:18pt;font-weight:900;color:#111;line-height:1.1">${diaStr}</div>
        </div>
        <div style="padding:4px 18px;display:flex;align-items:center;justify-content:center;min-width:140px">
          <span style="background:${headerColor};color:#fff;font-size:8pt;font-weight:800;padding:5px 14px;border-radius:20px;letter-spacing:.07em;text-transform:uppercase">${periodLabel}</span>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;flex:1;table-layout:fixed;border-left:2px solid #333;border-right:2px solid #333">
        <colgroup>${CWPCT.map(w => `<col style="width:${w}%">`).join('')}</colgroup>
        <thead>
          <tr style="background:#1a1a1a;color:#fff">
            ${HCOLS.map(c => `<th style="padding:5px 3px;font-size:7.5pt;font-weight:700;text-align:center;border:1px solid #000;letter-spacing:.02em">${c}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${tbRows}</tbody>
      </table>
      <div style="border:2px solid #333;border-top:1px solid #aaa;border-radius:0 0 5px 5px;padding:5px 10px 4px;background:#fafafa;flex-shrink:0">
        <div style="display:flex;align-items:baseline;gap:16px;margin-bottom:3px">
          <span style="font-size:8pt;font-weight:700;color:#222">Observações:</span>
          <span style="font-size:6.5pt;color:#888;font-style:italic">${amNote}</span>
        </div>
        <div>
          ${Array(2).fill(0).map(() => `<div style="border-bottom:0.75px solid #ccc;height:6mm"></div>`).join('')}
        </div>
      </div>
    </div>`;
  });

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Fichas Diárias — ${title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4 landscape;margin:20mm 10mm 10mm 10mm}
body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
tr, td, th { page-break-inside: avoid; }
@media print{body{background:#fff}}
</style>
</head><body>${capa}${pages}</body></html>`;
}