// js/exportExcel.js
import { state } from './state.js';
import { TL, showToast } from './utils.js';

/* global XLSX */

export function exportUnifiedExcel() {
  if (!state.confirmed) { alert('Configure e confirme os tratamentos primeiro.'); return; }
  if (typeof XLSX === 'undefined') { alert('Erro: Biblioteca Excel não carregada.'); return; }

  const wb = XLSX.utils.book_new();

  // Parâmetros Diários
  const dailyCols = ['Data','Dia Exp','Trat','Caixa','pH','Temp (°C)','OD (mg/L)','Cond (µS)','Amônia','Nitrito','Mortalidade','Pote Início','Pote Fim','Consumo','Ração Disp','Pote Vazio'];
  const dailyRows = [dailyCols];
  const numOrNull = v => (v === undefined || v === null || v === '') ? null : (isNaN(parseFloat(v)) ? v : parseFloat(v));
  state.dailyData.forEach(r => dailyRows.push([r.data, r.dia_exp, r.tratamento, r.caixa, numOrNull(r.ph), numOrNull(r.temp), numOrNull(r.od), numOrNull(r.cond), numOrNull(r.amonia), numOrNull(r.nitrito), numOrNull(r.mort), numOrNull(r.pote_inicio), numOrNull(r.pote_fim), null, null, numOrNull(r.pote_vazio)]));
  const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows);
  if (dailyRows.length > 1) {
    const range = XLSX.utils.decode_range(wsDaily['!ref']);
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      wsDaily[XLSX.utils.encode_cell({ r: R, c: 13 })] = { f: `=IF(OR(L${R+1}="", M${R+1}=""), "", L${R+1}-M${R+1})` };
      wsDaily[XLSX.utils.encode_cell({ r: R, c: 14 })] = { f: `=IF(OR(M${R+1}="", P${R+1}=""), "", M${R+1}-P${R+1})` };
    }
  }
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Parâmetros Diários');

  // Biometria
  const bioCols = ['Data','Dia Exp','Trat','Caixa','Peixe','Peso (g)','CT (cm)','CP (cm)'];
  const bioRows = [bioCols];
  state.bioData.forEach(r => bioRows.push([r.data, r.dia_experimental, r.tratamento, r.caixa, r.peixe, numOrNull(r.peso_g), numOrNull(r.ct_cm), numOrNull(r.cp_cm)]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bioRows), 'Biometria');

  // Consolidado
  const consRows = [['Tratamento','Nº Caixas','Peso Médio Final (g)','Ganho Peso Médio (g)','Consumo Total (g)','Conversão Alimentar']];
  for (let t=0; t<state.cfg.treats; t++) consRows.push([TL[t],'','','','','']);
  const wsCons = XLSX.utils.aoa_to_sheet(consRows);
  for (let i=0; i<state.cfg.treats; i++) {
    const row = i+2;
    wsCons[XLSX.utils.encode_cell({ r: row-1, c: 1 })] = { f: `=COUNTIF(Tratamentos!B:B, A${row})` };
    wsCons[XLSX.utils.encode_cell({ r: row-1, c: 2 })] = { f: `=AVERAGEIF(Biometria!C:C, A${row}, Biometria!F:F)` };
    wsCons[XLSX.utils.encode_cell({ r: row-1, c: 3 })] = { f: `=IFERROR(AVERAGEIFS(Biometria!F:F, Biometria!C:C, A${row}, Biometria!B:B, MAX(Biometria!B:B)) - AVERAGEIFS(Biometria!F:F, Biometria!C:C, A${row}, Biometria!B:B, 0), "")` };
    wsCons[XLSX.utils.encode_cell({ r: row-1, c: 4 })] = { f: `=SUMIF('Parâmetros Diários'!C:C, A${row}, 'Parâmetros Diários'!O:O)` };
    wsCons[XLSX.utils.encode_cell({ r: row-1, c: 5 })] = { f: `=IFERROR(E${row} / (D${row} * B${row} * ${state.cfg.fishPerBox}), "")` };
  }
  XLSX.utils.book_append_sheet(wb, wsCons, 'Consolidado');

  // Tratamentos
  const treatData = [['Caixa','Tratamento','Peso Pote (g)']];
  for (let t=0; t<state.cfg.treats; t++) (state.assigns[t]||[]).forEach(c => treatData.push([`C${String(c).padStart(2,'0')}`, TL[t], state.cfg.potWeights[c]??'']));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(treatData), 'Tratamentos');

  // Configuração
  const configData = [['Parâmetro','Valor'],['Título', document.getElementById('expTitle')?.value||''],['Pesquisador', document.getElementById('expResearcher')?.value||''],['Início Experimento', state.cfg.startDate],['Duração (dias)', state.cfg.days],['Início Aclimatação', state.cfg.acclimStart],['Nº Caixas', state.cfg.boxes],['Nº Tratamentos', state.cfg.treats],['Peixes/caixa', state.cfg.fishPerBox]];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(configData), 'Configuração');

  XLSX.writeFile(wb, `experimento_${state.cfg.startDate}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

export function copyUnifiedTSV() {
  let tsv = '';
  tsv += ['Data','Dia Exp','Trat','Caixa','pH','Temp (°C)','OD (mg/L)','Cond (µS)','Amônia','Nitrito','Mortalidade','Pote Início','Pote Fim','Consumo','Ração Disp','Pote Vazio'].join('\t') + '\n';
  state.dailyData.forEach(r => tsv += [r.data, r.dia_exp, r.tratamento, r.caixa, r.ph, r.temp, r.od, r.cond, r.amonia, r.nitrito, r.mort, r.pote_inicio, r.pote_fim, r.consumo, r.racao_disp, r.pote_vazio].map(v=>v??'').join('\t') + '\n');
  tsv += '\n\n';
  tsv += ['Data','Dia Exp','Trat','Caixa','Peixe','Peso (g)','CT (cm)','CP (cm)'].join('\t') + '\n';
  state.bioData.forEach(r => tsv += [r.data, r.dia_experimental, r.tratamento, r.caixa, r.peixe, r.peso_g, r.ct_cm, r.cp_cm].map(v=>v??'').join('\t') + '\n');
  navigator.clipboard.writeText(tsv).then(()=>showToast('✓ Copiado!')).catch(()=>showToast('⚠ Erro'));
}