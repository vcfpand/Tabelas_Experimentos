// js/state.js
export const state = {
  cfg: {
    startDate: '',
    acclimStart: '',
    days: 30,
    boxes: 16,
    treats: 4,
    fishPerBox: 10,
    potWeights: {},
    treatmentNames: [],
    initialFeedKg: [],
    expTitle: '',
    expResearcher: ''
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
    try {
      const parsed = JSON.parse(saved);
      Object.assign(state, parsed);
    } catch (e) {
      console.warn('Falha ao carregar estado salvo:', e);
    }
  }
}

export function saveState() {
  localStorage.setItem('experimentState', JSON.stringify(state));
}

export function resetState() {
  state.cfg = {
    startDate: '',
    acclimStart: '',
    days: 30,
    boxes: 16,
    treats: 4,
    fishPerBox: 10,
    potWeights: {},
    treatmentNames: [],
    initialFeedKg: [],
    expTitle: '',
    expResearcher: ''
  };
  state.assigns = {};
  state.dailyData = [];
  state.bioData = [];
  state.bioDates = [];
  state.confirmed = false;
  saveState();
}