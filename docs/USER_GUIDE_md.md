# Guia do Usuário – Planilha de Experimento

## Sumário
1. [Primeiros Passos](#primeiros-passos)
2. [Configuração do Experimento](#configuração-do-experimento)
3. [Distribuição de Tratamentos](#distribuição-de-tratamentos)
4. [Parâmetros Diários](#parâmetros-diários)
5. [Biometrias](#biometrias)
6. [Fichas Diárias e Impressão](#fichas-diárias-e-impressão)
7. [Exportação para Excel](#exportação-para-excel)
8. [Dashboard Streamlit](#dashboard-streamlit)
9. [Backup e Restauração](#backup-e-restauração)

---

### Primeiros Passos
Acesse o aplicativo web em [https://vcfpand.github.io/Tabelas_Experimentos](https://vcfpand.github.io/Tabelas_Experimentos). Todos os dados são salvos automaticamente no seu navegador (localStorage). Você pode fechar e reabrir a página sem perder as informações.

### Configuração do Experimento
1. Preencha o **Título** e **Pesquisador**.
2. Defina a **Data de início** e a **Duração** (dias).
3. Informe a **Data de início da aclimatação** (período pré-experimento).
4. Configure o **Número de caixas**, **Número de tratamentos** e **Peixes por caixa**.
5. Na seção **Detalhes dos Tratamentos**, dê um nome a cada tratamento (ex.: Controle, 10%, 20%) e informe a **Ração inicial (kg)** disponível para cada um.
6. Clique em **Próximo: Tratamentos →**.

### Distribuição de Tratamentos
- Selecione um tratamento na lista superior.
- Clique nas caixas disponíveis para atribuí-las ao tratamento ativo.
- Você pode remover caixas clicando no "✕" ao lado do número.
- Quando todas as caixas estiverem atribuídas, aparecerá a seção **Peso dos Potes (g)**. Informe o peso vazio de cada pote.
- Use os botões:
  - **💾 Salvar distribuição**: exporta um CSV com a distribuição atual.
  - **📂 Importar distribuição**: carrega um CSV previamente salvo.
- Após confirmar, o botão **Confirmar e continuar →** será habilitado.

### Parâmetros Diários
- A tabela exibe todas as caixas para cada dia do experimento.
- Colunas editáveis: pH, temperatura, OD, condutividade, amônia total, nitrito, mortalidade, pote_fim, pote_novo.
- **Consumo** e **Ração Disp.** são calculados automaticamente.
- **pote_inicio** é preenchido automaticamente a partir do dia 2 (usa o `pote_fim` ou `pote_novo` do dia anterior).
- Use os botões no final da página para copiar TSV ou exportar Excel.

### Biometrias
- Defina as datas das biometrias (inicial e final são fixas; intermediárias são opcionais).
- Clique em **Gerar Tabela de Biometria** para criar a tabela de dados.
- Preencha peso (g), comprimento total (cm) e comprimento padrão (cm) para cada peixe.

### Fichas Diárias e Impressão
- Visualize um **Preview da Capa** com as informações principais.
- Clique em **🖨️ Abrir para Impressão / Salvar PDF** para gerar as fichas.
- A primeira página é uma capa com resumo; as demais são fichas diárias (A4 paisagem).

### Exportação para Excel
- O arquivo Excel contém as abas:
  1. **Config** – parâmetros gerais e rações iniciais.
  2. **Tratamentos** – relação caixa × tratamento × peso do pote.
  3. **Parametros_diarios** – todos os registros diários com fórmulas.
  4. **Biometria** – dados de biometria por peixe.
  5. **Resumo_Caixas** – número inicial de peixes e peso médio inicial por caixa.
  6. **Consolidado** – métricas agregadas por tratamento.

### Dashboard Streamlit
- O dashboard lê o arquivo Excel (hospedado no OneDrive/Google Drive) e exibe gráficos interativos.
- Acesse com a senha definida nos Secrets do Streamlit.
- Utilize os filtros na barra lateral para explorar os dados.

### Backup e Restauração
- No painel **Configuração**, use:
  - **📤 Exportar backup**: salva todo o estado do experimento em um arquivo `.json`.
  - **📥 Importar backup**: restaura um backup anterior.