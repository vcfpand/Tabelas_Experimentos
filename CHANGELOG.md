# Changelog

## [1.2.0] - 2026-04-13

### Adicionado
- Campo de identificação (título e pesquisador) no painel Configuração.
- Preview da capa de impressão na aba Fichas Diárias.
- Botão "Importar distribuição" para carregar CSV de tratamentos.
- Coluna `pote_novo` nos parâmetros diários para substituição do pote vazio.
- Aba `Resumo_Caixas` no Excel exportado com fórmulas.
- Tema claro/escuro com alternador e efeito Frosted Glass.
- Backup e restauração de estado via JSON (exportar/importar).
- Dashboard Streamlit adaptado ao novo formato de Excel.

### Corrigido
- Recarga da página ao exportar distribuição (substituído por `data:text/csv`).
- Propagação automática de `pote_inicio` entre dias consecutivos.
- Fórmulas do Excel: `INDIRECT` para referência correta e proteção contra negativo.
- Legibilidade do tema claro (contraste e cores ajustadas).
- Quebra de página na impressão (altura das linhas reduzida, observações removidas).
- Reset indesejado da distribuição ao alternar painéis.

### Alterado
- Nomes de tratamentos agora personalizáveis (não fixos como T0, T1...).
- Rações iniciais definidas por tratamento na configuração.
- Padronização dos nomes de colunas entre app web e dashboard.
- Documentação completa para GitHub (README, CONTRIBUTING, etc.).
- Versão exibida na sidebar e no painel Sobre.

## [1.1.0] - 2026-04-01
- Adicionado nomes de tratamentos personalizáveis e ração inicial.
- Backup e restauração de estado.
- Tema claro/escuro.
- Tooltips informativas.

## [1.0.0] - 2026-03-15
- Lançamento inicial do aplicativo web.
- Configuração de experimento, tratamentos, parâmetros diários, biometria.
- Geração de fichas diárias e exportação para Excel.
- Dashboard Streamlit para análise de dados.