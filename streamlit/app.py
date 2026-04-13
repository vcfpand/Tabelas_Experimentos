import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import numpy as np
import requests
from io import BytesIO
import logging
from datetime import datetime

# ==========================================
# CONFIGURAÇÃO DA PÁGINA E TEMA
# ==========================================
st.set_page_config(
    page_title="Dashboard de Experimento",
    layout="wide",
    page_icon="🐟",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
    .stApp { background-color: #0d0d0f; color: #f2f2f7; }
    div[data-testid="stVerticalBlock"] > div[style*="flex"] {
        background: rgba(28, 28, 30, 0.6);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border-radius: 12px;
        border: 0.5px solid rgba(255, 255, 255, 0.1);
        padding: 20px;
        margin-bottom: 14px;
        box-shadow: 0 8px 20px rgba(0,0,0,0.2);
    }
    section[data-testid="stSidebar"] > div {
        background: rgba(18, 18, 20, 0.5);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border-right: 0.5px solid rgba(255,255,255,0.04);
    }
    div[data-testid="stMetric"] {
        background: rgba(44, 44, 48, 0.5);
        backdrop-filter: blur(15px);
        border-radius: 12px;
        border: 0.5px solid rgba(255,255,255,0.08);
        padding: 14px 16px;
    }
    h1, h2, h3 { color: #f2f2f7 !important; }
</style>
""", unsafe_allow_html=True)

# ==========================================
# LOGGING E SECRETS
# ==========================================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REQUIRED_SECRETS = ["SENHA_ACESSO", "URL_ONEDRIVE"]
for secret in REQUIRED_SECRETS:
    if secret not in st.secrets:
        st.error(f"❌ Secret ausente: `{secret}`.")
        st.stop()

# ==========================================
# AUTENTICAÇÃO
# ==========================================
if "autenticado" not in st.session_state:
    st.session_state["autenticado"] = False

if not st.session_state["autenticado"]:
    col_login, _ = st.columns([1, 2])
    with col_login:
        st.title("🐟 Monitoramento — Aquicultura")
        with st.container(border=True):
            st.markdown("**Acesso Restrito**")
            senha = st.text_input("Senha:", type="password")
            if st.button("Entrar", type="primary", use_container_width=True):
                if senha == st.secrets.get("SENHA_ACESSO", ""):
                    st.session_state["autenticado"] = True
                    st.rerun()
                else:
                    st.error("❌ Senha incorreta.")
    st.stop()

# ==========================================
# INTEGRAÇÃO GEMINI (OPCIONAL)
# ==========================================
usa_gemini = False
client = None
GEMINI_MODEL = "gemini-2.0-flash-exp"

def call_gemini_api(model, prompt):
    raise RuntimeError("Gemini não disponível")

try:
    from google import genai
    from tenacity import retry, stop_after_attempt, wait_exponential
    if "GEMINI_API_KEY" in st.secrets:
        client = genai.Client(api_key=st.secrets["GEMINI_API_KEY"])
        usa_gemini = True
        @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10), reraise=True)
        def call_gemini_api(model, prompt):
            return client.models.generate_content(model=model, contents=prompt)
except ImportError:
    st.sidebar.warning("⚠️ Biblioteca 'google-genai' ou 'tenacity' não instalada.")
except Exception as e:
    st.sidebar.warning(f"⚠️ Erro ao inicializar Gemini: {e}")

# ==========================================
# CONSTANTES DE QUALIDADE DE ÁGUA
# ==========================================
NH3_SEGURO   = 0.02
NH3_ATENCAO  = 0.05
NH3_CRITICO  = 0.10
NH3_LIMITE_ALERTA  = NH3_SEGURO
NH3_LIMITE_CRITICO = NH3_CRITICO

NITRITO_ACEIT    = 0.25
NITRITO_CRITICO  = 0.50
NITRITO_PERIGOSO = 1.00

ALERTAS_AGUA = {
    "od":   {"min": 5.0,  "label": "OD (mg/L)"},
    "ph":   {"min": 6.5, "max": 8.5, "label": "pH"},
    "temp": {"min": 24.0, "max": 30.0, "label": "Temperatura (°C)"},
}

# ==========================================
# FUNÇÕES AUXILIARES
# ==========================================
def calcular_nh3_toxica(amonia_total, ph, temp_c):
    """NH₃ não ionizada (Emerson et al., 1975)."""
    if any(pd.isna(v) for v in [amonia_total, ph, temp_c]):
        return float("nan")
    pka = 0.09018 + (2729.92 / (temp_c + 273.15))
    f   = 1.0 / (10 ** (pka - ph) + 1.0)
    return amonia_total * f


def remove_outliers_zscore(df_in: pd.DataFrame, colunas_alvo: list, limite_z: float = 3) -> pd.DataFrame:
    df_limpo = df_in.copy()
    for col in colunas_alvo:
        if col in df_limpo.columns and df_limpo[col].notna().any() and df_limpo[col].std() > 0:
            z = np.abs((df_limpo[col] - df_limpo[col].mean()) / df_limpo[col].std())
            df_limpo = df_limpo[(z < limite_z) | (df_limpo[col].isna())]
    return df_limpo


def validate_data(df_in: pd.DataFrame) -> pd.DataFrame:
    required_cols = ["caixa", "tratamento", "dia_exp"]
    missing = [c for c in required_cols if c not in df_in.columns]
    if missing:
        raise ValueError(f"❌ Colunas obrigatórias ausentes: {missing}")
    if df_in.empty:
        raise ValueError("❌ DataFrame vazio após carregamento")
    return df_in


def calcular_alertas(df_trat: pd.DataFrame) -> list[dict]:
    """Alertas automáticos de qualidade da água."""
    alertas = []
    df_sorted = df_trat.sort_values("dia_exp")

    # Parâmetros avaliados pela média do período
    for param, limites in ALERTAS_AGUA.items():
        if param not in df_trat.columns:
            continue
        valor = df_trat[param].mean()
        if pd.isna(valor):
            continue
        if "max" in limites and valor > limites["max"]:
            alertas.append({"param": limites["label"], "valor": valor, "tipo": "⚠️ ALTO",  "limite": limites["max"], "nh3": False, "rotulo": "média"})
        if "min" in limites and valor < limites["min"]:
            alertas.append({"param": limites["label"], "valor": valor, "tipo": "⚠️ BAIXO", "limite": limites["min"], "nh3": False, "rotulo": "média"})

    # Nitrito — último valor registrado com escala de severidade
    ult_nitrito = df_sorted.dropna(subset=["nitrito"])
    if not ult_nitrito.empty:
        nitrito_val = ult_nitrito["nitrito"].iloc[-1]
        dia_nit     = int(ult_nitrito["dia_exp"].iloc[-1])
        if nitrito_val >= NITRITO_PERIGOSO:
            tipo, faixa, nivel = "🔴 PERIGOSO", f"≥ {NITRITO_PERIGOSO} mg/L", "perigoso"
        elif nitrito_val >= NITRITO_CRITICO:
            tipo, faixa, nivel = "🟠 CRÍTICO", f"{NITRITO_CRITICO}–{NITRITO_PERIGOSO} mg/L", "critico"
        elif nitrito_val >= NITRITO_ACEIT:
            tipo, faixa, nivel = "🟡 ACEITÁVEL", f"{NITRITO_ACEIT}–{NITRITO_CRITICO} mg/L", "aceitavel"
        else:
            tipo, faixa, nivel = "🟢 IDEAL", f"< {NITRITO_ACEIT} mg/L", "ideal"
        alertas.append({"param": f"Nitrito NO₂⁻ (Dia {dia_nit})", "valor": nitrito_val,
                         "tipo": tipo, "faixa": faixa, "nivel": nivel, "nh3": False, "nitrito": True})

    # Amônia total e NH₃ tóxica — último valor registrado
    ult_amonia = df_sorted.dropna(subset=["amonia"])
    ult_ph     = df_sorted.dropna(subset=["ph"])
    ult_temp   = df_sorted.dropna(subset=["temp"])
    if not ult_amonia.empty:
        amonia_val = ult_amonia["amonia"].iloc[-1]
        dia_ref    = int(ult_amonia["dia_exp"].iloc[-1])
        ph_val     = ult_ph["ph"].iloc[-1]    if not ult_ph.empty   else float("nan")
        temp_val   = ult_temp["temp"].iloc[-1] if not ult_temp.empty else float("nan")
        nh3 = calcular_nh3_toxica(amonia_val, ph_val, temp_val)
        if pd.notna(nh3):
            if nh3 >= NH3_CRITICO:
                tipo, nivel, faixa = "🔴 PERIGOSO", "perigoso", f"≥ {NH3_CRITICO} mg/L"
            elif nh3 >= NH3_ATENCAO:
                tipo, nivel, faixa = "🟠 CRÍTICO", "critico", f"{NH3_ATENCAO}–{NH3_CRITICO} mg/L"
            elif nh3 >= NH3_SEGURO:
                tipo, nivel, faixa = "🟡 ATENÇÃO", "atencao", f"{NH3_SEGURO}–{NH3_ATENCAO} mg/L"
            else:
                tipo, nivel, faixa = "🟢 SEGURO", "seguro", f"< {NH3_SEGURO} mg/L"
            alertas.append({"param": f"NH₃ Tóxica (Dia {dia_ref})", "valor": nh3,
                             "tipo": tipo, "nivel": nivel, "faixa": faixa, "nh3": True,
                             "amonia_total": amonia_val, "ph_ref": ph_val, "temp_ref": temp_val})
    return alertas


# ==========================================
# CARREGAMENTO DE DADOS — DINÂMICO
# ==========================================
CACHE_TTL = 120

@st.cache_data(ttl=CACHE_TTL, show_spinner="Carregando dados...")
def load_data():
    try:
        url = st.secrets["URL_ONEDRIVE"].strip()
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        raw = resp.content

        def read_sheet(name):
            return pd.read_excel(BytesIO(raw), sheet_name=name, engine="openpyxl")

        # ── Descoberta automática das abas disponíveis ──────────────────
        import openpyxl
        wb_names = openpyxl.load_workbook(BytesIO(raw), read_only=True).sheetnames

        SHEET_DAILY   = next((s for s in wb_names if "param" in s.lower()), None)
        SHEET_BIO     = next((s for s in wb_names if "bio"   in s.lower()), None)
        SHEET_RESUMO  = next((s for s in wb_names if "resumo" in s.lower() or "caixa" in s.lower()), None)
        SHEET_CONFIG  = next((s for s in wb_names if "config" in s.lower()), None)
        SHEET_TRAT    = next((s for s in wb_names if "trat"  in s.lower()), None)

        if not SHEET_DAILY:
            raise ValueError("Aba de parâmetros diários não encontrada. Verifique a planilha.")

        df_daily  = read_sheet(SHEET_DAILY)
        df_bio    = read_sheet(SHEET_BIO)    if SHEET_BIO    else pd.DataFrame()
        df_resumo = read_sheet(SHEET_RESUMO) if SHEET_RESUMO else pd.DataFrame()
        df_config = read_sheet(SHEET_CONFIG) if SHEET_CONFIG else pd.DataFrame()

        # ── Padronização de colunas ──────────────────────────────────────
        def norm_cols(d):
            d.columns = [str(c).strip().lower() for c in d.columns]
            return d

        df_daily  = norm_cols(df_daily)
        df_bio    = norm_cols(df_bio)    if not df_bio.empty    else df_bio
        df_resumo = norm_cols(df_resumo) if not df_resumo.empty else df_resumo
        df_config = norm_cols(df_config) if not df_config.empty else df_config

        # ── Extração da Config ──────────────────────────────────────────
        titulo = ""
        pesquisador = ""
        dias_totais = 60  # default seguro
        racao_inicial_config: dict = {}

        if not df_config.empty:
            for _, row in df_config.iterrows():
                param = str(row.iloc[0]).strip()
                valor = row.iloc[1] if len(row) > 1 else None
                if param in ("Título", "Titulo"):
                    titulo = str(valor)
                elif param == "Pesquisador":
                    pesquisador = str(valor)
                elif "Dura" in param and "dia" in param.lower():
                    try:
                        dias_totais = int(float(valor))
                    except (ValueError, TypeError):
                        pass
                elif "Ra" in param and "inicial" in param.lower():
                    # "Ração inicial T1 (kg)" → extrai "T1"
                    partes = param.replace("(kg)", "").replace("(g)", "").split()
                    trat_key = [p for p in partes if p.startswith("T") and len(p) <= 4]
                    if trat_key:
                        try:
                            racao_inicial_config[trat_key[0]] = float(valor)
                        except (ValueError, TypeError):
                            pass

        # ── Conversão numérica em Parametros_diarios ────────────────────
        numeric_cols = ["ph", "temp", "od", "cond", "amonia", "nitrito", "mort",
                        "consumo", "dia_exp", "pote_inicio", "pote_fim",
                        "racao_disp", "pote_vazio", "pote_novo"]
        for col in numeric_cols:
            if col in df_daily.columns:
                if df_daily[col].dtype == object:
                    df_daily[col] = df_daily[col].astype(str).str.replace(",", ".")
                df_daily[col] = pd.to_numeric(df_daily[col], errors="coerce")

        # ── Recálculo de consumo a partir de pote_inicio e pote_fim ─────
        # A coluna "consumo" pode conter fórmulas Excel (texto) ou estar ausente.
        # Sempre recalculamos onde pote_inicio e pote_fim estão disponíveis.
        if "pote_inicio" in df_daily.columns and "pote_fim" in df_daily.columns:
            mask = df_daily["pote_inicio"].notna() & df_daily["pote_fim"].notna()
            df_daily.loc[mask, "consumo"] = (
                df_daily.loc[mask, "pote_inicio"] - df_daily.loc[mask, "pote_fim"]
            )
        elif "consumo" not in df_daily.columns:
            df_daily["consumo"] = np.nan

        # Garante que valores negativos (erro de pesagem) virem NaN
        if "consumo" in df_daily.columns:
            df_daily.loc[df_daily["consumo"] < 0, "consumo"] = np.nan

        # ── Recálculo de racao_disp a partir de pote_fim e pote_vazio ───
        if "pote_fim" in df_daily.columns and "pote_vazio" in df_daily.columns:
            mask_rd = df_daily["pote_fim"].notna() & df_daily["pote_vazio"].notna()
            df_daily.loc[mask_rd, "racao_disp"] = (
                df_daily.loc[mask_rd, "pote_fim"] - df_daily.loc[mask_rd, "pote_vazio"]
            )
            df_daily.loc[df_daily["racao_disp"] < 0, "racao_disp"] = np.nan

        # ── Peso médio inicial a partir da Biometria (dia 0) ────────────
        # A coluna peso_medio_inicial em Resumo_Caixas contém fórmulas.
        # Recalculamos direto da aba Biometria.
        bio_dia0 = pd.DataFrame(columns=["caixa", "peso_medio_inicial_calc"])

        if not df_bio.empty and "caixa" in df_bio.columns:
            # Detecta coluna de dia experimental (nome pode variar)
            dia_bio_col = next(
                (c for c in df_bio.columns if "dia" in c and ("exp" in c or "exper" in c)),
                next((c for c in df_bio.columns if "dia" in c), None)
            )
            # Detecta coluna de peso (nome pode variar)
            peso_bio_col = next(
                (c for c in df_bio.columns if "peso" in c),
                None
            )
            if dia_bio_col and peso_bio_col:
                df_bio["caixa"] = df_bio["caixa"].astype(str).str.strip()
                df_bio[dia_bio_col]  = pd.to_numeric(df_bio[dia_bio_col],  errors="coerce")
                df_bio[peso_bio_col] = pd.to_numeric(df_bio[peso_bio_col], errors="coerce")
                bio_dia0 = (
                    df_bio[df_bio[dia_bio_col] == 0]
                    .groupby("caixa")[peso_bio_col]
                    .mean()
                    .reset_index()
                    .rename(columns={peso_bio_col: "peso_medio_inicial_calc"})
                )

        # ── Resumo_Caixas: aplica peso calculado ─────────────────────────
        if not df_resumo.empty and "caixa" in df_resumo.columns:
            df_resumo["caixa"] = df_resumo["caixa"].astype(str).str.strip()
            df_resumo["n_peixes_inicial"] = pd.to_numeric(
                df_resumo.get("n_peixes_inicial", pd.Series(dtype=float)), errors="coerce"
            )
            df_resumo["peso_medio_inicial"] = pd.to_numeric(
                df_resumo.get("peso_medio_inicial", pd.Series(dtype=float)), errors="coerce"
            )
            if not bio_dia0.empty:
                df_resumo = df_resumo.merge(bio_dia0, on="caixa", how="left")
                # Prioriza o valor calculado da Biometria; fallback para o da planilha
                df_resumo["peso_medio_inicial"] = df_resumo["peso_medio_inicial_calc"].fillna(
                    df_resumo["peso_medio_inicial"]
                )
                df_resumo.drop(columns=["peso_medio_inicial_calc"], inplace=True, errors="ignore")
        else:
            # Se não há Resumo_Caixas, monta a partir de daily + bio
            if not bio_dia0.empty:
                df_resumo = bio_dia0.rename(columns={"peso_medio_inicial_calc": "peso_medio_inicial"})
            else:
                df_resumo = pd.DataFrame(columns=["caixa", "n_peixes_inicial", "peso_medio_inicial"])

        # ── Merge principal ──────────────────────────────────────────────
        df_daily["caixa"] = df_daily["caixa"].astype(str).str.strip()
        cols_resumo = ["caixa"] + [c for c in ["n_peixes_inicial", "peso_medio_inicial"] if c in df_resumo.columns]
        df = pd.merge(df_daily, df_resumo[cols_resumo], on="caixa", how="left")
        df["caixa"] = df["caixa"].astype(str)

        # ── Fallback para peso_medio_inicial caso ainda falte ───────────
        if "peso_medio_inicial" not in df.columns or df["peso_medio_inicial"].isna().all():
            df["peso_medio_inicial"] = 10.0  # placeholder; sinaliza na UI
            logger.warning("peso_medio_inicial não encontrado — usando placeholder 10 g")

        if "n_peixes_inicial" not in df.columns or df["n_peixes_inicial"].isna().all():
            df["n_peixes_inicial"] = 15  # placeholder
            logger.warning("n_peixes_inicial não encontrado — usando placeholder 15")

        # ── Tratamentos ──────────────────────────────────────────────────
        tratamentos = sorted(df["tratamento"].dropna().unique().tolist())

        # ── RACAO_INICIAL (kg por tratamento) ────────────────────────────
        # Prioridade: (1) Config, (2) racao_disp dia 1, (3) zero
        if racao_inicial_config:
            racao_inicial = racao_inicial_config
        elif "racao_disp" in df.columns:
            racao_inicial = {}
            for trat in tratamentos:
                subset = (
                    df[(df["tratamento"] == trat) & df["racao_disp"].notna()]
                    .sort_values("dia_exp")
                )
                if not subset.empty:
                    # Soma do racao_disp inicial de todas as caixas do tratamento (dia mínimo)
                    dia_min = subset["dia_exp"].min()
                    total_g = subset[subset["dia_exp"] == dia_min].groupby("caixa")["racao_disp"].first().sum()
                    racao_inicial[trat] = round(total_g / 1000, 3)
                else:
                    racao_inicial[trat] = 0.0
        else:
            racao_inicial = {t: 0.0 for t in tratamentos}

        # ── Cores dos tratamentos ────────────────────────────────────────
        cores = px.colors.qualitative.Plotly[:len(tratamentos)]
        cor_tratamento = {trat: cores[i] for i, trat in enumerate(tratamentos)}

        logger.info(f"✅ Dados: {len(df)} linhas | Tratamentos: {tratamentos} | Dias totais: {dias_totais}")
        return df, df_bio, df_resumo, dias_totais, tratamentos, racao_inicial, titulo, pesquisador, cor_tratamento

    except requests.exceptions.Timeout:
        st.error("❌ Timeout ao baixar planilha. Verifique sua conexão.")
        return None
    except requests.exceptions.HTTPError as e:
        st.error(f"❌ Erro HTTP: {e}")
        return None
    except Exception as e:
        st.error(f"❌ Erro ao carregar dados: {e}")
        logger.error(f"Erro load_data: {e}", exc_info=True)
        return None


# ==========================================
# EXECUÇÃO DO CARREGAMENTO
# ==========================================
data = load_data()
if data is None:
    st.stop()

df, df_bio, df_resumo, DIAS_TOTAIS, TRATAMENTOS, RACAO_INICIAL, TITULO, PESQUISADOR, COR_TRATAMENTO = data

try:
    df = validate_data(df)
except ValueError as e:
    st.error(str(e))
    st.stop()

# ==========================================
# SIDEBAR
# ==========================================
st.sidebar.header("⚙️ Configurações")
col1, col2 = st.sidebar.columns(2)
if col1.button("🔄 Recarregar", use_container_width=True, help="Força recarga do OneDrive"):
    st.cache_data.clear()
    st.rerun()
if col2.button("🚪 Sair", use_container_width=True):
    st.session_state["autenticado"] = False
    st.rerun()

remover_outliers = st.sidebar.toggle("Limpar Outliers (Z-Score=3)", value=False)
st.sidebar.divider()

st.sidebar.header("🎯 Projeção de Abate")
peso_alvo = st.sidebar.slider("Peso Final Esperado (g)", 40.0, 500.0, 90.0)
peso_ini = df["peso_medio_inicial"].mean()
tce = (np.log(peso_alvo) - np.log(peso_ini)) / DIAS_TOTAIS if peso_ini > 0 else 0
st.sidebar.info(f"TCE Necessária: **{tce * 100:.2f}% /dia**")
st.sidebar.divider()

trat_sel = st.sidebar.multiselect("Tratamentos", TRATAMENTOS, default=TRATAMENTOS)

if remover_outliers:
    df = remove_outliers_zscore(
        df, [c for c in ["ph", "temp", "od", "cond", "amonia", "nitrito", "consumo"] if c in df.columns]
    )

# ==========================================
# PRÉ-PROCESSAMENTO
# ==========================================
df_unico = df.drop_duplicates(subset=["caixa", "dia_exp"]).copy()
df_unico["consumo_preenchido"] = df_unico["consumo"].fillna(0)
df_unico["consumo_acum"] = df_unico.groupby("caixa")["consumo_preenchido"].cumsum()
df_unico["mort_preenchida"] = df_unico.get("mort", pd.Series(0, index=df_unico.index)).fillna(0)
df_unico["mort_acum"] = df_unico.groupby("caixa")["mort_preenchida"].cumsum()

df = pd.merge(
    df,
    df_unico[["caixa", "dia_exp", "consumo_acum", "mort_acum"]],
    on=["caixa", "dia_exp"],
    how="left",
)

df["peso_est"] = df["peso_medio_inicial"] * np.exp(tce * df["dia_exp"])
df["n_peixes_atual"] = df["n_peixes_inicial"] - df["mort_acum"]
df["biomassa_est_g"] = df["peso_est"] * df["n_peixes_atual"]
df["ganho_biomassa_g"] = df["biomassa_est_g"] - (df["peso_medio_inicial"] * df["n_peixes_inicial"])

df["caa_est"] = np.where(
    (df["ganho_biomassa_g"] > 0.01) & (df["ganho_biomassa_g"].notna()),
    df["consumo_acum"] / df["ganho_biomassa_g"],
    np.nan,
)
df["taxa_arracoamento"] = np.where(
    (df["biomassa_est_g"] > 0) & (df["biomassa_est_g"].notna()),
    (df["consumo"] / df["biomassa_est_g"]) * 100,
    np.nan,
)
df["sobrevivencia_pct"] = np.where(
    df["n_peixes_inicial"] > 0,
    (df["n_peixes_atual"] / df["n_peixes_inicial"]) * 100,
    np.nan,
)

df_real = df.dropna(subset=["consumo"])
dia_max_preenchido = int(df_real["dia_exp"].max()) if not df_real.empty else 1

dias_sel = st.sidebar.slider("Filtro de Dias", 0, dia_max_preenchido, (0, dia_max_preenchido))

df_f = df[
    (df["tratamento"].isin(trat_sel)) & (df["dia_exp"].between(dias_sel[0], dias_sel[1]))
].dropna(subset=["dia_exp", "tratamento"])

# ==========================================
# CABEÇALHO E PROGRESSO
# ==========================================
st.title(f"📊 {TITULO if TITULO else 'Dashboard de Experimento'}")
if PESQUISADOR:
    st.caption(f"Pesquisador: {PESQUISADOR}")
st.divider()

prog_col1, prog_col2 = st.columns([3, 1])
with prog_col1:
    st.write(f"**Progresso:** Dia {dia_max_preenchido} de {DIAS_TOTAIS} ({dia_max_preenchido / DIAS_TOTAIS * 100:.0f}%)")
    st.progress(min(dia_max_preenchido / DIAS_TOTAIS, 1.0))
with prog_col2:
    st.metric("Dias Restantes", f"{DIAS_TOTAIS - dia_max_preenchido}")
st.divider()

# ==========================================
# ALERTAS AUTOMÁTICOS
# ==========================================
if trat_sel:
    todos_alertas: dict = {}
    for trat in trat_sel:
        d_trat = df_f[df_f["tratamento"] == trat]
        alertas = calcular_alertas(d_trat)
        if alertas:
            todos_alertas[trat] = alertas

    if todos_alertas:
        with st.expander("⚠️ Alertas de Qualidade da Água", expanded=True):
            for trat, alertas in todos_alertas.items():
                st.markdown(f"**{trat}**")
                for a in alertas:
                    if a.get("nh3"):
                        msg = (
                            f"{a['tipo']} — **{a['param']}**: `{a['valor']:.4f} mg/L` — Faixa: {a['faixa']}\n\n"
                            f"Calculada com: NH₄⁺ Total = `{a['amonia_total']:.3f} mg/L` | "
                            f"pH = `{a['ph_ref']:.2f}` | Temp = `{a['temp_ref']:.1f} °C`\n\n"
                            f"Ref: Emerson et al. (1975) | 🟢 <0.02 | 🟡 0.02–0.05 | 🟠 0.05–0.10 | 🔴 ≥0.10"
                        )
                        nivel = a.get("nivel", "seguro")
                        if nivel == "perigoso":   st.error(msg)
                        elif nivel == "critico":  st.warning(msg)
                        elif nivel == "atencao":  st.info(msg)
                        else:                     st.success(msg)
                    elif a.get("nitrito"):
                        msg = (
                            f"{a['tipo']} — **{a['param']}**: `{a['valor']:.3f} mg/L`  \n"
                            f"Faixa: {a['faixa']}  \n"
                            f"Referência: 0.00 🟢 Ideal | 0.25 🟡 Aceitável | 0.50 🟠 Crítico | ≥1.00 🔴 Perigoso"
                        )
                        nivel = a.get("nivel", "ideal")
                        if nivel == "perigoso":   st.error(msg)
                        elif nivel == "critico":  st.warning(msg)
                        elif nivel == "aceitavel": st.info(msg)
                        else:                     st.success(msg)
                    else:
                        st.warning(
                            f"{a['tipo']} — {a['param']}: **{a['valor']:.3f}** "
                            f"({a.get('rotulo', 'média')}, limite: {a['limite']})"
                        )

# ==========================================
# CARDS KPI POR TRATAMENTO
# ==========================================
st.subheader(f"📊 Desempenho Zootécnico — Dia {dias_sel[0]} a {dias_sel[1]}")
cols_kpi = st.columns(len(trat_sel)) if trat_sel else []
dados_gemini: dict = {}

for i, trat in enumerate(trat_sel):
    d_trat       = df_f[df_f["tratamento"] == trat]
    d_trat_unico = d_trat.drop_duplicates(subset=["caixa", "dia_exp"])
    df_tc        = d_trat_unico.dropna(subset=["consumo"])

    if not df_tc.empty:
        ultimo_dia   = df_tc["dia_exp"].max()
        dia_anterior = df_tc[df_tc["dia_exp"] < ultimo_dia]["dia_exp"].max()
        d_hoje  = df_tc[df_tc["dia_exp"] == ultimo_dia]
        d_ontem = df_tc[df_tc["dia_exp"] == dia_anterior] if pd.notna(dia_anterior) else pd.DataFrame()
        dia_ref = f"Dia {int(ultimo_dia)}"
    else:
        d_hoje = d_ontem = pd.DataFrame()
        dia_ref = "Sem Dados"

    m_ph   = d_trat["ph"].mean()   if "ph"   in d_trat.columns else float("nan")
    m_temp = d_trat["temp"].mean() if "temp" in d_trat.columns else float("nan")
    m_od   = d_trat["od"].mean()   if "od"   in d_trat.columns else float("nan")
    m_cond = d_trat["cond"].mean() if "cond" in d_trat.columns else float("nan")
    m_sobrev = d_trat["sobrevivencia_pct"].mean()

    _ult_amonia  = d_trat_unico.dropna(subset=["amonia"]).sort_values("dia_exp")  if "amonia"  in d_trat_unico.columns else pd.DataFrame()
    _ult_nitrito = d_trat_unico.dropna(subset=["nitrito"]).sort_values("dia_exp") if "nitrito" in d_trat_unico.columns else pd.DataFrame()
    m_amonia  = _ult_amonia["amonia"].iloc[-1]   if not _ult_amonia.empty  else float("nan")
    m_nitrito = _ult_nitrito["nitrito"].iloc[-1] if not _ult_nitrito.empty else float("nan")
    dia_amonia  = int(_ult_amonia["dia_exp"].iloc[-1])  if not _ult_amonia.empty  else None
    dia_nitrito = int(_ult_nitrito["dia_exp"].iloc[-1]) if not _ult_nitrito.empty else None

    _nh3_card = calcular_nh3_toxica(m_amonia, m_ph, m_temp)

    cons_acumulado = d_trat_unico.groupby("caixa")["consumo_acum"].max().sum() if not d_trat_unico.empty else 0
    cons_hoje  = d_hoje["consumo"].sum()  if not d_hoje.empty  else 0
    cons_ontem = d_ontem["consumo"].sum() if not d_ontem.empty else 0
    delta_cons = ((cons_hoje - cons_ontem) / cons_ontem * 100) if cons_ontem > 0 else 0
    est_restante_kg = RACAO_INICIAL.get(trat, 0) - (cons_acumulado / 1000)
    mort_total = d_trat_unico.groupby("caixa")["mort_acum"].max().sum() if not d_trat_unico.empty else 0

    dados_gemini[trat] = {
        "Consumo_Ultimo_Dia":    cons_hoje,
        "Consumo_Dia_Anterior":  cons_ontem,
        "Var_%":                 round(delta_cons, 2),
        "Mort":                  int(mort_total),
        "Amonia_total_ultimo":   round(m_amonia, 3)  if pd.notna(m_amonia)  else "N/A",
        "NH3_toxica_calculada":  round(_nh3_card, 4) if pd.notna(_nh3_card) else "N/A",
        "OD":                    round(m_od, 2)      if pd.notna(m_od)      else "N/A",
        "Sobrevivencia_%":       round(m_sobrev, 1)  if pd.notna(m_sobrev)  else "N/A",
    }

    cor = COR_TRATAMENTO.get(trat, "#888888")
    with cols_kpi[i]:
        with st.container(border=True):
            st.markdown(f"<h3 style='text-align:center;color:{cor};'>{trat}</h3>", unsafe_allow_html=True)
            st.markdown("**🌊 Parâmetros Ambientais**")
            c_a, c_b = st.columns(2)
            c_a.metric("pH",        f"{m_ph:.2f}"   if pd.notna(m_ph)   else "—")
            c_b.metric("Temp (°C)", f"{m_temp:.1f}" if pd.notna(m_temp) else "—")
            c_a.metric("OD (mg/L)", f"{m_od:.2f}"   if pd.notna(m_od)   else "—")
            c_b.metric("Cond (µS)", f"{m_cond:.1f}" if pd.notna(m_cond) else "—")
            _nh3_label = (
                "🔴 NH₃" if (pd.notna(_nh3_card) and _nh3_card >= NH3_LIMITE_CRITICO) else
                "⚠️ NH₃" if (pd.notna(_nh3_card) and _nh3_card >= NH3_LIMITE_ALERTA)  else
                "✅ NH₃"
            )
            c_a.metric(
                f"NH₄⁺ Total (D{dia_amonia})" if dia_amonia else "NH₄⁺ Total",
                f"{m_amonia:.3f}" if pd.notna(m_amonia) else "—",
                help="Amônia total (NH₄⁺ + NH₃) — último valor registrado",
            )
            c_b.metric(
                f"Nitrito (D{dia_nitrito})" if dia_nitrito else "Nitrito",
                f"{m_nitrito:.3f}" if pd.notna(m_nitrito) else "—",
                help="Último valor registrado (não média)",
            )
            c_a.metric(
                _nh3_label + " Tóxica",
                f"{_nh3_card:.4f} mg/L" if pd.notna(_nh3_card) else "—",
                help=f"NH₃ não ionizada (Emerson 1975). Alerta: {NH3_LIMITE_ALERTA} | Crítico: {NH3_LIMITE_CRITICO} mg/L",
            )
            st.divider()
            st.markdown(f"**🍽️ Arraçoamento ({dia_ref})**")
            st.metric("Acumulado", f"{cons_acumulado:.0f} g")
            ca, cb = st.columns(2)
            ca.metric("Ant.",    f"{cons_ontem:.0f} g")
            cb.metric("Último",  f"{cons_hoje:.0f} g", f"{delta_cons:+.1f}%")
            st.divider()
            st.markdown("**📋 Gestão**")
            c1, c2 = st.columns(2)
            c1.metric("Ração Disp.", f"{est_restante_kg:.2f} kg")
            c2.metric("Mortalidade", f"{int(mort_total)}")
            if pd.notna(m_sobrev):
                sobrev_color = "normal" if m_sobrev >= 95 else "inverse"
                st.metric("Sobrevivência", f"{m_sobrev:.1f}%", delta_color=sobrev_color)

# ==========================================
# ANÁLISE GEMINI
# ==========================================
if usa_gemini and client is not None:
    with st.container(border=True):
        st.markdown("#### 🧠 Análise Geral (Google Gemini)")
        if st.button("Gerar Relatório Zootécnico Diário", type="primary"):
            with st.spinner("Analisando..."):
                prompt = f"""Atue como Especialista em Aquicultura. Analise os dados de '{TITULO}':
{dados_gemini}
Produza análise em 2 parágrafos:
1. Avalie a resposta alimentar: algum tratamento reduziu consumo abruptamente?
2. Avalie sanidade e ambiente: correlação entre amônia/OD e mortalidade?
Responda de forma profissional e objetiva."""
                try:
                    resposta = call_gemini_api(model=GEMINI_MODEL, prompt=prompt)
                    st.info(resposta.text)
                except Exception as err:
                    causa = getattr(err, "message", None) or str(err)
                    st.error(f"❌ Erro na API Gemini: {causa}")

st.divider()

# ==========================================
# ABAS PRINCIPAIS
# ==========================================
tab1, tab2, tab3, tab4, tab5 = st.tabs(
    ["📈 Zootecnia", "🧪 Água", "📉 Mortalidade", "🔬 Estatística", "📥 Dados"]
)

# ─── TAB 1: ZOOTECNIA ───────────────────────────────────────────────────────
with tab1:
    st.subheader("Desempenho Biológico")
    c1, c2, c3 = st.columns(3)
    try:
        fig_peso = px.line(df_f, x="dia_exp", y="peso_est", color="tratamento",
                           color_discrete_map=COR_TRATAMENTO, title="Peso Projetado (g)",
                           template="plotly_dark", markers=True)
        c1.plotly_chart(fig_peso, use_container_width=True)
        fig_caa = px.line(df_f, x="dia_exp", y="caa_est", color="tratamento",
                          color_discrete_map=COR_TRATAMENTO, title="CAA Estimada",
                          template="plotly_dark", markers=True)
        c2.plotly_chart(fig_caa, use_container_width=True)
        fig_bio = px.line(df_f, x="dia_exp", y="biomassa_est_g", color="tratamento",
                          color_discrete_map=COR_TRATAMENTO, title="Biomassa Estimada (g)",
                          template="plotly_dark", markers=True)
        c3.plotly_chart(fig_bio, use_container_width=True)
    except Exception as e:
        st.error(f"❌ Erro nos gráficos de zootecnia: {e}")

    st.subheader("Consumo e Taxa de Arraçoamento")
    c4, c5 = st.columns(2)
    try:
        df_cons_agg = (
            df_f.dropna(subset=["consumo"])
            .groupby(["dia_exp", "tratamento"])["consumo"]
            .mean()
            .reset_index()
        )
        fig_cons = px.bar(df_cons_agg, x="dia_exp", y="consumo", color="tratamento",
                          color_discrete_map=COR_TRATAMENTO, barmode="group",
                          title="Consumo Diário Médio por Tratamento (g)", template="plotly_dark")
        c4.plotly_chart(fig_cons, use_container_width=True)
        fig_ta = px.line(df_f, x="dia_exp", y="taxa_arracoamento", color="tratamento",
                         color_discrete_map=COR_TRATAMENTO,
                         title="Taxa de Arraçoamento (% Biomassa/dia)",
                         template="plotly_dark", markers=True)
        c5.plotly_chart(fig_ta, use_container_width=True)
    except Exception as e:
        st.error(f"❌ Erro nos gráficos de consumo: {e}")

    # Resumo comparativo de desempenho
    st.subheader("📊 Resumo Comparativo de Desempenho")
    resumo_rows = []
    for trat in trat_sel:
        d = df_f[df_f["tratamento"] == trat].dropna(subset=["peso_est"])
        if d.empty:
            continue
        peso_ini_trat   = d["peso_medio_inicial"].mean()
        dia_max_trat    = d["dia_exp"].max()
        peso_final_trat = d[d["dia_exp"] == dia_max_trat]["peso_est"].mean()
        dias            = dia_max_trat - d["dia_exp"].min()
        tce_trat = (
            (np.log(peso_final_trat) - np.log(peso_ini_trat)) / dias * 100
            if dias > 0 and peso_ini_trat > 0 else np.nan
        )
        gp = peso_final_trat - peso_ini_trat
        d_un = d.drop_duplicates(subset=["caixa", "dia_exp"])
        mort = d_un.groupby("caixa")["mort_acum"].max().sum()
        resumo_rows.append({
            "Tratamento":         trat,
            "Peso Inicial (g)":   round(peso_ini_trat, 2),
            "Peso Final Est. (g)":round(peso_final_trat, 2),
            "GP (g)":             round(gp, 2),
            "TCE (%/dia)":        round(tce_trat, 3) if pd.notna(tce_trat) else "—",
            "Mortalidade Total":  int(mort),
        })
    if resumo_rows:
        st.dataframe(pd.DataFrame(resumo_rows).set_index("Tratamento"), use_container_width=True)

# ─── TAB 2: ÁGUA ────────────────────────────────────────────────────────────
with tab2:
    st.subheader("Evolução dos Parâmetros Físico-Químicos")
    tipo_grafico = st.radio(
        "Visualização:",
        ["Linha (Média Tratamento)", "Linha (Por Caixa)", "Boxplot (Distribuição)"],
        horizontal=True,
    )
    param_list = [p for p in ["temp", "od", "amonia", "nitrito", "ph", "cond"] if p in df_f.columns]
    try:
        for i in range(0, len(param_list), 3):
            cols_agua = st.columns(3)
            for j in range(3):
                if i + j >= len(param_list):
                    break
                p = param_list[i + j]
                if tipo_grafico == "Linha (Média Tratamento)":
                    df_agg = df_f.groupby(["dia_exp", "tratamento"])[p].mean().reset_index()
                    fig = px.line(df_agg, x="dia_exp", y=p, color="tratamento",
                                  color_discrete_map=COR_TRATAMENTO,
                                  title=p.upper(), template="plotly_dark", markers=True)
                elif tipo_grafico == "Linha (Por Caixa)":
                    fig = px.line(df_f, x="dia_exp", y=p, color="caixa",
                                  facet_col="tratamento", facet_col_wrap=2,
                                  title=p.upper(), template="plotly_dark")
                else:
                    fig = px.box(df_f, x="tratamento", y=p, color="tratamento",
                                 color_discrete_map=COR_TRATAMENTO,
                                 title=p.upper(), template="plotly_dark", points="all")
                cols_agua[j].plotly_chart(fig, use_container_width=True)
    except Exception as e:
        st.error(f"❌ Erro nos gráficos de água: {e}")

    st.subheader("🌡️ Heatmap — Médias por Tratamento")
    try:
        df_heat = df_f.groupby("tratamento")[param_list].mean().round(3)
        fig_heat = px.imshow(
            df_heat.T, text_auto=True, color_continuous_scale="RdYlGn_r",
            title="Médias dos Parâmetros por Tratamento", template="plotly_dark",
            labels={"x": "Tratamento", "y": "Parâmetro", "color": "Valor"},
        )
        st.plotly_chart(fig_heat, use_container_width=True)
    except Exception as e:
        st.error(f"❌ Erro no heatmap: {e}")

# ─── TAB 3: MORTALIDADE ─────────────────────────────────────────────────────
with tab3:
    st.subheader("📉 Análise de Mortalidade e Sobrevivência")
    c_m1, c_m2 = st.columns(2)
    try:
        df_mort_agg = (
            df_f.drop_duplicates(["caixa", "dia_exp"])
            .groupby(["dia_exp", "tratamento"])["mort_acum"]
            .mean()
            .reset_index()
        )
        fig_mort = px.line(df_mort_agg, x="dia_exp", y="mort_acum", color="tratamento",
                           color_discrete_map=COR_TRATAMENTO,
                           title="Mortalidade Acumulada Média por Tratamento",
                           template="plotly_dark", markers=True)
        c_m1.plotly_chart(fig_mort, use_container_width=True)

        df_sobrev = (
            df_f.drop_duplicates(["caixa", "dia_exp"])
            .groupby(["dia_exp", "tratamento"])["sobrevivencia_pct"]
            .mean()
            .reset_index()
        )
        fig_sobrev = px.line(df_sobrev, x="dia_exp", y="sobrevivencia_pct", color="tratamento",
                             color_discrete_map=COR_TRATAMENTO,
                             title="Sobrevivência (%) por Tratamento",
                             template="plotly_dark", markers=True, range_y=[80, 101])
        fig_sobrev.add_hline(y=95, line_dash="dash", line_color="yellow", annotation_text="Alerta 95%")
        c_m2.plotly_chart(fig_sobrev, use_container_width=True)
    except Exception as e:
        st.error(f"❌ Erro nos gráficos de mortalidade: {e}")

    try:
        if "mort" in df_f.columns:
            st.subheader("Eventos de Mortalidade Diária")
            df_mort_dia = (
                df_f.dropna(subset=["mort"])
                .groupby(["dia_exp", "tratamento"])["mort"]
                .sum()
                .reset_index()
            )
            fig_mort_dia = px.bar(
                df_mort_dia, x="dia_exp", y="mort", color="tratamento",
                color_discrete_map=COR_TRATAMENTO, barmode="group",
                title="Mortalidade Diária por Tratamento", template="plotly_dark",
            )
            st.plotly_chart(fig_mort_dia, use_container_width=True)
    except Exception as e:
        st.error(f"❌ Erro na mortalidade diária: {e}")

# ─── TAB 4: ESTATÍSTICA ─────────────────────────────────────────────────────
with tab4:
    st.subheader("🔬 Correlação Ambiental e Comportamental")
    c_e1, c_e2 = st.columns(2)

    with c_e1:
        param_opts = [p for p in ["amonia", "od", "temp", "ph", "nitrito", "cond"] if p in df_f.columns]
        p_corr = st.selectbox("Eixo X:", param_opts)
        try:
            fig_sc = px.scatter(
                df_f, x=p_corr, y="taxa_arracoamento", color="tratamento",
                color_discrete_map=COR_TRATAMENTO, trendline="ols",
                title=f"Impacto de {p_corr.upper()} no Apetite", template="plotly_dark",
            )
            st.plotly_chart(fig_sc, use_container_width=True)
        except Exception as e:
            st.error(f"❌ Erro no scatter: {e}")

    with c_e2:
        st.markdown("**Matriz de Correlação de Pearson**")
        try:
            cols_corr_base = ["taxa_arracoamento", "amonia", "od", "temp", "ph",
                              "nitrito", "cond", "biomassa_est_g"]
            df_corr = df_f[[c for c in cols_corr_base if c in df_f.columns]].dropna()
            if len(df_corr) >= 3:
                matriz = df_corr.corr().round(2)
                fig_corr = px.imshow(
                    matriz, text_auto=True, color_continuous_scale="RdBu_r",
                    zmin=-1, zmax=1, template="plotly_dark", title="Correlações (Pearson)",
                )
                st.plotly_chart(fig_corr, use_container_width=True)
            else:
                st.warning("⚠️ Dados insuficientes para calcular correlações.")
        except Exception as e:
            st.error(f"❌ Erro na matriz de correlação: {e}")

    if usa_gemini and client is not None:
        if st.button("🧠 Gerar Relatório Estatístico (IA)", key="btn_estat_ai"):
            with st.spinner("Processando..."):
                try:
                    cols_calc = ["taxa_arracoamento", "amonia", "od", "temp", "ph"]
                    df_limpo_corr = df_f[[c for c in cols_calc if c in df_f.columns]].dropna()
                    if len(df_limpo_corr) < 3:
                        st.warning("⚠️ Dados insuficientes.")
                    else:
                        matriz_corr = df_limpo_corr.corr().round(3).to_dict()
                        prompt_estat = f"""Atue como Investigador Biostatístico. Experimento: '{TITULO}'.
Matriz de correlação de Pearson: {matriz_corr}.
Relate em 3 tópicos:
1. Interpretação da correlação entre {p_corr.upper()} e taxa de arraçoamento.
2. Impacto multivariado: OD e Amônia interagem com o consumo?
3. Conclusão para manejo.
Use linguagem científica formal."""
                        resposta_estat = call_gemini_api(model=GEMINI_MODEL, prompt=prompt_estat)
                        st.success(resposta_estat.text)
                except Exception as e:
                    causa = getattr(e, "message", None) or str(e)
                    st.error(f"❌ Erro na análise estatística: {causa}")

# ─── TAB 5: DADOS E EXPORTAÇÃO ──────────────────────────────────────────────
with tab5:
    st.subheader("📥 Dados Filtrados e Exportação")
    col_exp1, col_exp2 = st.columns([2, 1])

    with col_exp1:
        st.markdown("**Tabela de Dados Brutos** (tratamentos e período selecionados)")
        colunas_exibir = [
            "tratamento", "caixa", "dia_exp", "consumo", "consumo_acum",
            "ph", "temp", "od", "cond", "amonia", "nitrito",
            "mort", "mort_acum", "peso_est", "biomassa_est_g",
            "taxa_arracoamento", "sobrevivencia_pct",
        ]
        colunas_disp = [c for c in colunas_exibir if c in df_f.columns]
        df_exibir = df_f[colunas_disp].sort_values(["tratamento", "caixa", "dia_exp"])

        busca = st.text_input("🔍 Filtrar por caixa ou tratamento:", "")
        if busca:
            mask = df_exibir.apply(
                lambda row: row.astype(str).str.contains(busca, case=False).any(), axis=1
            )
            df_exibir = df_exibir[mask]

        st.dataframe(df_exibir.reset_index(drop=True), use_container_width=True, height=350)
        st.caption(f"{len(df_exibir)} registros exibidos")

    with col_exp2:
        st.markdown("**Exportar Dados**")

        csv_data = df_exibir.to_csv(index=False).encode("utf-8")
        st.download_button(
            label="⬇️ Baixar CSV",
            data=csv_data,
            file_name=f"dados_{datetime.now().strftime('%Y%m%d_%H%M')}.csv",
            mime="text/csv",
            use_container_width=True,
        )

        try:
            buffer = BytesIO()
            with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
                df_exibir.to_excel(writer, sheet_name="Dados_Filtrados", index=False)
                resumo_stat = df_exibir.groupby("tratamento")[
                    [c for c in ["consumo", "ph", "temp", "od", "amonia", "taxa_arracoamento"]
                     if c in df_exibir.columns]
                ].describe().round(3)
                resumo_stat.to_excel(writer, sheet_name="Resumo_Estatistico")
            buffer.seek(0)
            st.download_button(
                label="⬇️ Baixar Excel",
                data=buffer,
                file_name=f"dados_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True,
            )
        except Exception as e:
            st.warning(f"⚠️ Excel indisponível: {e}")

        st.divider()
        st.markdown("**Estatísticas Rápidas**")
        if not df_exibir.empty:
            for col_stat in ["consumo", "ph", "temp", "od"]:
                if col_stat in df_exibir.columns:
                    val = df_exibir[col_stat].mean()
                    if pd.notna(val):
                        st.metric(col_stat.upper(), f"{val:.2f}")

# ==========================================
# SOBRE E RODAPÉ
# ==========================================
with st.sidebar.expander("ℹ️ Sobre"):
    st.markdown(f"""
    **Dashboard de Experimento — Aquicultura**  
    Versão 2.1.0

    Desenvolvido por **Me. Victor César Freitas Pandolfi**  
    Doutorando — PPG Ciência Animal — UEL  
    Membro do NEPAG

    📧 victor.pandolfi@uel.br  
    🔗 [GitHub](https://github.com/vcfpand/Tabelas_Experimentos)

    Licença: GNU GPL v3.0
    """)

st.divider()
st.caption(
    f"🐟 Dashboard v2.1 · {TITULO} · "
    f"Dia {dia_max_preenchido}/{DIAS_TOTAIS} · "
    f"Atualizado: {datetime.now().strftime('%d/%m/%Y %H:%M')}"
)
