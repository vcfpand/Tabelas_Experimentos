// js/main.js
import { state, loadState, saveState } from './state.js';
import { buildSidebar } from './navigation.js';
import { initConfigPanel } from './configPanel.js';
import { initTreatmentPanel } from './treatmentPanel.js';
import { initExperimentalTablesPanel } from './experimentalTablesPanel.js';
import { initPrintPanel } from './printPanel.js';
import { initAboutPanel } from './aboutPanel.js';

loadState();
buildSidebar();

initConfigPanel();
initTreatmentPanel();
initExperimentalTablesPanel();
initPrintPanel();
initAboutPanel();

window.addEventListener('beforeunload', () => saveState());

import { setActivePanel } from './navigation.js';
setActivePanel(0);