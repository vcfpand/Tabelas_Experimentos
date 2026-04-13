# Detalhes Técnicos

## Arquitetura do Aplicativo Web

O aplicativo é uma **Single Page Application (SPA)** construída com HTML, CSS e JavaScript puro (ES6 módulos). Não requer backend – todos os dados são armazenados no `localStorage` do navegador.

### Estrutura de Módulos
- `main.js` – ponto de entrada, inicializa painéis e tema.
- `state.js` – gerenciamento de estado centralizado (configuração, dados diários, biometria).
- `navigation.js` – controle de navegação entre painéis e sidebar.
- `configPanel.js` – painel de configuração (datas, tratamentos, etc.).
- `treatmentPanel.js` – atribuição de caixas e pesos dos potes.
- `experimentalTablesPanel.js` – abas de parâmetros diários e biometria.
- `printPanel.js` – geração de fichas para impressão (HTML dinâmico).
- `exportExcel.js` – exportação para Excel com SheetJS, incluindo fórmulas.
- `utils.js` – funções auxiliares (datas, toasts, tema, etc.).
- `aboutPanel.js` – painel "Sobre".

### Estado (`state.js`)
```javascript
state = {
  cfg: { startDate, acclimStart, days, boxes, treats, fishPerBox, potWeights, treatmentNames, initialFeedKg, expTitle, expResearcher },
  assigns: {},   // caixas por tratamento
  dailyData: [], // parâmetros diários
  bioData: [],   // biometria
  bioDates: [],  // datas de biometria
  confirmed: false
}