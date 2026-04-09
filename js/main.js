// js/main.js
import { state, loadState, saveState } from './state.js';
import { buildSidebar } from './navigation.js';
import { initConfigPanel } from './configPanel.js';
import { initTreatmentPanel } from './treatmentPanel.js';
import { initDailyPanel } from './dailyPanel.js';
import { initBiometryPanel } from './biometryPanel.js';
import { initPrintPanel } from './printPanel.js';

// Carrega estado salvo (se existir)
loadState();

// Constrói a barra lateral de navegação
buildSidebar();

// Inicializa cada painel (cada módulo preenche seu respectivo div)
initConfigPanel();
initTreatmentPanel();
initDailyPanel();
initBiometryPanel();
initPrintPanel();

// Salva automaticamente o estado a cada alteração relevante
// (os módulos devem chamar state.save() quando apropriado)
window.addEventListener('beforeunload', () => {
  saveState();
});

// Define o painel ativo inicial baseado no estado
import { setActivePanel } from './navigation.js';
setActivePanel(0);