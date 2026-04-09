// js/aboutPanel.js
export function initAboutPanel() {
  const panel = document.getElementById('panel4');
  panel.innerHTML = `
    <div class="panel-title">Sobre</div>
    <div class="panel-sub">Informações sobre o desenvolvimento, autoria e licenciamento.</div>
    <div class="card"><div class="card-title">Aplicativo</div><div class="info-box">
      <p><strong>Planilha de Experimento</strong> – v1.0.0</p>
      <p>Ferramenta para planejamento, coleta e organização de dados em experimentos aquícolas.</p>
    </div></div>
    <div class="card"><div class="card-title">Desenvolvedor</div><div class="info-box">
      <p><strong>Me. Victor César Freitas Pandolfi</strong></p>
      <p>Doutorando – Programa de Pós-Graduação em Ciência Animal – UEL</p>
      <p>Membro do NEPAG – Núcleo de Estudo em Aquicultura e Genética</p>
      <p>E-mail: victor.pandolfi@uel.br</p>
    </div></div>
    <div class="card"><div class="card-title">Licença</div><div class="info-box">
      <p>GNU GPL v3.0 – Repositório: <a href="https://github.com/vcfpand/Tabelas_Experimentos">github.com/vcfpand/Tabelas_Experimentos</a></p>
    </div></div>
  `;
}