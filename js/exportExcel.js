// js/exportExcel.js
import { state } from './state.js';
import { showToast } from './utils.js';

/* global XLSX */

export function exportUnifiedExcel() {
  if (!state.confirmed) {
    alert('Configure e confirme os tratamentos primeiro.');
    return;
  }
  if (typeof XLSX === 'undefined') {
    alert('Biblioteca Excel não carregada.');
    return;
  }

  const wb = XLSX.utils.book_new();

  // ===== Aba 1: Configuração =====
  // Nota: a célula B7 conterá o número de caixas (state.cfg.boxes)
  const configData = [
    ['Parâmetro', 'Valor'],
    ['Título', state.cfg.expTitle || ''],
    ['Pesquisador', state.cfg.expResearcher || ''],
    ['Início Experimento', state.cfg.startDate],
    ['Duração (dias)', state.cfg.days],
    ['Início Aclimatação', state.cfg.acclimStart],
    ['Nº Caixas', state.cfg.boxes],
    ['Nº Tratamentos', state.cfg.treats],
    ['Peixes/caixa', state.cfg.fishPerBox]
  ];
  state.cfg.treatmentNames.forEach((name, i) => {
    configData.push([`Ração inicial ${name} (kg)`, state.cfg.initialFeedKg[i]]);
  });
  const wsConfig = XLSX.utils.aoa_to_sheet(configData);
  XLSX.utils.book_append_sheet(wb, wsConfig, 'Config');

  // ===== Aba 2: Tratamentos =====
  const treatData = [['Caixa', 'Tratamento', 'Peso Pote (g)']];
  for (let t = 0; t < state.cfg.treats; t++) {
    (state.assigns[t] || []).forEach(c => {
      treatData.push([
        `C${String(c).padStart(2, '0')}`,
        state.cfg.treatmentNames[t],
        state.cfg.potWeights[c] ?? ''
      ]);
    });
  }
  const wsTreat = XLSX.utils.aoa_to_sheet(treatData);
  XLSX.utils.book_append_sheet(wb, wsTreat, 'Tratamentos');

  // ===== Aba 3: Parâmetros Diários =====
  const dailyCols = [
    'data', 'dia_exp', 'tratamento', 'caixa',
    'ph', 'temp', 'od', 'cond', 'amonia', 'nitrito', 'mort',
    'pote_inicio', 'pote_fim', 'consumo', 'racao_disp', 'pote_vazio', 'pote_novo'
  ];
  const dailyRows = [dailyCols];

  const numOrNull = (v) => (v === undefined || v === null || v === '') ? null : (isNaN(parseFloat(v)) ? v : parseFloat(v));

  state.dailyData.forEach(row => {
    dailyRows.push([
      row.data,
      row.dia_exp,
      row.tratamento,
      row.caixa,
      numOrNull(row.ph),
      numOrNull(row.temp),
      numOrNull(row.od),
      numOrNull(row.cond),
      numOrNull(row.amonia),
      numOrNull(row.nitrito),
      numOrNull(row.mort),
      row.dia_exp === 1 ? numOrNull(row.pote_inicio) : null, // dia 1: valor manual
      numOrNull(row.pote_fim),
      null, // consumo
      null, // racao_disp
      numOrNull(row.pote_vazio),
      numOrNull(row.pote_novo)
    ]);
  });

  const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows);

  if (dailyRows.length > 1) {
    const range = XLSX.utils.decode_range(wsDaily['!ref']);
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const diaExpCell = XLSX.utils.encode_cell({ r: R, c: 1 }); // coluna B (dia_exp)
      const diaExp = wsDaily[diaExpCell]?.v;

      // Fórmula para pote_inicio (coluna L, índice 11) a partir do dia 2
      if (diaExp > 1) {
        wsDaily[XLSX.utils.encode_cell({ r: R, c: 11 })] = {
          f: `=IF(INDIRECT("Q"&ROW()-Config!$B$7)="", INDIRECT("M"&ROW()-Config!$B$7), INDIRECT("Q"&ROW()-Config!$B$7))`
        };
      }

      // Consumo (coluna N, índice 13) = pote_inicio - pote_fim
      wsDaily[XLSX.utils.encode_cell({ r: R, c: 13 })] = {
        f: `=IF(OR(L${R+1}="", M${R+1}=""), "", L${R+1}-M${R+1})`
      };

      // Ração Disp (coluna O, índice 14) = pote_fim - pote_vazio, com proteção contra negativo
      wsDaily[XLSX.utils.encode_cell({ r: R, c: 14 })] = {
        f: `=IF(OR(M${R+1}="", P${R+1}=""), "", IF(M${R+1}-P${R+1}<0, 0, M${R+1}-P${R+1}))`
      };
    }
  }
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Parametros_diarios');

  // ===== Aba 4: Biometria =====
  const bioCols = ['data', 'dia_experimental', 'tratamento', 'caixa', 'peixe', 'peso_g', 'ct_cm', 'cp_cm'];
  const bioRows = [bioCols];
  state.bioData.forEach(row => {
    bioRows.push([
      row.data,
      row.dia_experimental,
      row.tratamento,
      row.caixa,
      row.peixe,
      numOrNull(row.peso_g),
      numOrNull(row.ct_cm),
      numOrNull(row.cp_cm)
    ]);
  });
  const wsBio = XLSX.utils.aoa_to_sheet(bioRows);
  XLSX.utils.book_append_sheet(wb, wsBio, 'Biometria');

  // ===== Aba 5: Resumo Caixas =====
  const resumoCaixasRows = [['caixa', 'n_peixes_inicial', 'peso_medio_inicial']];
  const boxes = Array.from({ length: state.cfg.boxes }, (_, i) => i + 1);
  boxes.forEach(c => {
    const cxName = `C${String(c).padStart(2, '0')}`;
    resumoCaixasRows.push([cxName, state.cfg.fishPerBox, '']);
  });
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoCaixasRows);
  for (let i = 1; i < resumoCaixasRows.length; i++) {
    const row = i + 1;
    wsResumo[XLSX.utils.encode_cell({ r: i, c: 2 })] = {
      f: `=IFERROR(AVERAGEIFS(Biometria!F:F, Biometria!D:D, A${row}, Biometria!B:B, 0), "")`
    };
  }
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo_Caixas');

  // ===== Aba 6: Consolidado =====
  const consRows = [[
    'Tratamento', 'Nº Caixas', 'Peso Médio Final (g)', 'Ganho Peso Médio (g)',
    'Consumo Total (g)', 'Conversão Alimentar'
  ]];
  for (let t = 0; t < state.cfg.treats; t++) {
    consRows.push([state.cfg.treatmentNames[t], '', '', '', '', '']);
  }
  const wsCons = XLSX.utils.aoa_to_sheet(consRows);
  for (let i = 0; i < state.cfg.treats; i++) {
    const row = i + 2;
    wsCons[XLSX.utils.encode_cell({ r: row-1, c: 1 })] = { f: `=COUNTIF(Tratamentos!B:B, A${row})` };
    wsCons[XLSX.utils.encode_cell({ r: row-1, c: 2 })] = { f: `=IFERROR(AVERAGEIFS(Biometria!F:F, Biometria!C:C, A${row}, Biometria!B:B, MAX(Biometria!B:B)), "")` };
    wsCons[XLSX.utils.encode_cell({ r: row-1, c: 3 })] = { f: `=IFERROR(C${row} - AVERAGEIFS(Biometria!F:F, Biometria!C:C, A${row}, Biometria!B:B, 0), "")` };
    wsCons[XLSX.utils.encode_cell({ r: row-1, c: 4 })] = { f: `=SUMIF(Parametros_diarios!C:C, A${row}, Parametros_diarios!N:N)` };
    wsCons[XLSX.utils.encode_cell({ r: row-1, c: 5 })] = { f: `=IFERROR(E${row} / (D${row} * B${row} * ${state.cfg.fishPerBox}), "")` };
  }
  XLSX.utils.book_append_sheet(wb, wsCons, 'Consolidado');

  // ===== Gera arquivo =====
  const safeDate = state.cfg.startDate.replace(/[^0-9-]/g, '') || 'data';
  const today = new Date().toISOString().slice(0, 10);
  const fileName = `experimento_${safeDate}_${today}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast('✓ Excel exportado com sucesso!');
}

export function copyUnifiedTSV() {
  let tsv = '';
  const dailyCols = ['Data', 'Dia Exp', 'Trat', 'Caixa', 'pH', 'Temp (°C)', 'OD (mg/L)', 'Cond (µS)', 'Amônia', 'Nitrito', 'Mortalidade', 'Pote Início', 'Pote Fim', 'Consumo', 'Ração Disp', 'Pote Vazio', 'Pote Novo'];
  tsv += dailyCols.join('\t') + '\n';
  state.dailyData.forEach(r => {
    tsv += [
      r.data, r.dia_exp, r.tratamento, r.caixa,
      r.ph, r.temp, r.od, r.cond, r.amonia, r.nitrito, r.mort,
      r.pote_inicio, r.pote_fim, r.consumo, r.racao_disp, r.pote_vazio, r.pote_novo
    ].map(v => v ?? '').join('\t') + '\n';
  });
  tsv += '\n\n';
  const bioCols = ['Data', 'Dia Exp', 'Trat', 'Caixa', 'Peixe', 'Peso (g)', 'CT (cm)', 'CP (cm)'];
  tsv += bioCols.join('\t') + '\n';
  state.bioData.forEach(r => {
    tsv += [r.data, r.dia_experimental, r.tratamento, r.caixa, r.peixe, r.peso_g, r.ct_cm, r.cp_cm].map(v => v ?? '').join('\t') + '\n';
  });
  navigator.clipboard.writeText(tsv).then(() => showToast('✓ Copiado!')).catch(() => showToast('⚠ Erro ao copiar.'));
}