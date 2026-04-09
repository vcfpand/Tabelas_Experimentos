// js/state.js
export const state = {
  cfg: {
    startDate: '',
    acclimStart: '',
    days: 30,
    boxes: 16,
    treats: 4,
    fishPerBox: 10
  },
  assigns: {},
  dailyData: [],
  bioData: [],
  bioDates: [],
  confirmed: false
};

// Carrega do localStorage, se existir
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

// Salva no localStorage
export function saveState() {
  localStorage.setItem('experimentState', JSON.stringify(state));
}

// Função para resetar o estado (útil para novo experimento)
export function resetState() {
  state.cfg = {
    startDate: '',
    acclimStart: '',
    days: 30,
    boxes: 16,
    treats: 4,
    fishPerBox: 10
  };
  state.assigns = {};
  state.dailyData = [];
  state.bioData = [];
  state.bioDates = [];
  state.confirmed = false;
  saveState();
}