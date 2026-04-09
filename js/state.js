// js/state.js
export const state = {
  cfg: {
    startDate: '',
    acclimStart: '',
    days: 30,
    boxes: 16,
    treats: 4,
    fishPerBox: 10,
    potWeights: {}
  },
  assigns: {},
  dailyData: [],
  bioData: [],
  bioDates: [],
  confirmed: false
};

export function loadState() {
  const saved = localStorage.getItem('experimentState');
  if (saved) {
    try { Object.assign(state, JSON.parse(saved)); }
    catch (e) { console.warn('Falha ao carregar estado:', e); }
  }
}

export function saveState() {
  localStorage.setItem('experimentState', JSON.stringify(state));
}

export function resetState() {
  state.cfg = { startDate: '', acclimStart: '', days: 30, boxes: 16, treats: 4, fishPerBox: 10, potWeights: {} };
  state.assigns = {};
  state.dailyData = [];
  state.bioData = [];
  state.bioDates = [];
  state.confirmed = false;
  saveState();
}