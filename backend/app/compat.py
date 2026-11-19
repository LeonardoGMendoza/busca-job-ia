"""Nota de compatibilidade (0 a 100) entre uma vaga e o perfil do Leonardo. Não envia candidatura nenhuma:
só explica por que a vaga combina (o que casou), o que falta e quais alertas existem."""
import json
import re
from datetime import date, datetime
from pathlib import Path

from .vagas import sem_acento

PASTA = Path(__file__).resolve().parent.parent
PERFIL_PADRAO = PASTA / "perfil_leonardo.json"

PESO_TITULO, PESO_SKILLS, PESO_NIVEL, PESO_LOCAL = 30, 45, 15, 10
SKILLS_PARA_NOTA_CHEIA = 12      # soma dos pesos que dá 100% do bloco de skills

SENIOR = r"\b(senior|sr|especialista|lead|tech lead|arquiteto|principal|staff|coordenador|gerente)\b"
JUNIOR = r"\b(junior|jr|estagio|estagiario|trainee|aprendiz)\b"
PLENO = r"\b(pleno|pl|mid|middle|intermediario)\b"
INGLES = r"(ingles (avancado|fluente)|english (fluent|advanced)|fluent english|advanced english|fluencia em ingles)"


def carregar_perfil(caminho=PERFIL_PADRAO):
    return json.loads(Path(caminho).read_text(encoding="utf-8"))


def _norm(s):
    return re.sub(r"\s+", " ", sem_acento(s or ""))


def _achou(padroes, texto):
    return any(re.search(p, texto) for p in padroes)


def _tem_palavra(lista, texto):
    return [p for p in lista if re.search(r"(?<![a-z0-9])" + re.escape(p) + r"(?![a-z0-9])", texto)]


def pontuar(vaga, perfil):
    titulo = _norm(vaga.get("titulo"))
    corpo = _norm(" ".join([vaga.get("titulo") or "", vaga.get("resumo") or "", vaga.get("descricao") or ""]))
    local = _norm(vaga.get("local"))
    alertas = []

    # 1) Título
    nota_titulo = 0
    if _tem_palavra([".net", "dotnet", "c#"], titulo) or re.search(r"(?<![a-z0-9])c#|\.net(?![a-z])|dotnet", titulo):
        nota_titulo = PESO_TITULO
    elif _tem_palavra(perfil["titulos_alvo"], titulo):
        nota_titulo = PESO_TITULO * 0.5

    # 2) Skills (título e descrição)
    casou, soma = [], 0.0
    for nome, s in perfil["skills"].items():
        if _achou(s["padroes"], corpo):
            casou.append(nome)
            soma += s["peso"]
    nota_skills = PESO_SKILLS * min(1.0, soma / SKILLS_PARA_NOTA_CHEIA)
    tem_dotnet = "c#" in casou or ".net" in casou

    # 3) Senioridade
    if re.search(PLENO, titulo):                  # "Pleno/Sênior" ou "Júnior/Pleno" aceitam pleno
        nota_nivel = PESO_NIVEL
    elif re.search(SENIOR, titulo):
        nota_nivel = PESO_NIVEL * 0.35
        alertas.append("Sênior/liderança: vaga acima do pleno (dá para tentar, mostrando a liderança do projeto K2)")
    elif re.search(JUNIOR, titulo):
        nota_nivel = PESO_NIVEL * 0.2
        alertas.append("Júnior/estágio: abaixo do seu nível")
    else:
        nota_nivel = PESO_NIVEL * 0.67

    # 4) Local / modalidade
    cidades = [_norm(c) for c in perfil["local"]["cidades"]]
    estados = [_norm(e) for e in perfil["local"]["estado"]]
    if vaga.get("remoto") and perfil["local"].get("aceita_remoto", True):
        nota_local = PESO_LOCAL
    elif any(c in local for c in cidades):
        nota_local = PESO_LOCAL
    elif _tem_palavra(estados, local):
        nota_local = PESO_LOCAL * 0.5
    elif re.search(r"remot|home office|anywhere|brasil|brazil", local + " " + corpo[:400]):
        nota_local = PESO_LOCAL * 0.6
    else:
        nota_local = 0
        alertas.append("Presencial fora de Foz do Iguaçu")

    nota = nota_titulo + nota_skills + nota_nivel + nota_local

    # Stack principal diferente: limita a nota
    fora = _tem_palavra(perfil.get("stack_fora", []), titulo)
    if fora and not tem_dotnet:
        nota = min(nota, 25)
        alertas.append("Stack principal diferente: " + ", ".join(fora))
    elif not tem_dotnet:
        # sem C# nem .NET na vaga: nunca "Alta" (ex.: Python/Go com RabbitMQ e Docker)
        nota = min(nota, 30 if not casou else 60)
        alertas.append("Não cita C# nem .NET: confira a stack antes de se candidatar")

    if re.search(INGLES, corpo):
        alertas.append("Pede inglês avançado/fluente (seu inglês é B2)")

    # Lacunas: tecnologias citadas na vaga que não estão no seu currículo
    lacunas = _tem_palavra(perfil.get("lacunas_comuns", []), corpo)

    nota = int(round(max(0, min(100, nota))))
    faixa = "Alta" if nota >= 70 else "Média" if nota >= 45 else "Baixa"
    return {"nota": nota, "faixa": faixa, "casou": casou, "faltou": lacunas, "alertas": alertas}


def _data(texto):
    try:
        return datetime.strptime((texto or "")[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def ranquear(vagas, perfil, dias=None, hoje=None):
    """Tira repetidas, pontua e ordena da melhor para a pior. Se `dias`, descarta vagas mais antigas que isso."""
    hoje = hoje or date.today()
    vistos, saida = set(), []
    for v in vagas:
        if not v.get("titulo") or not v.get("link"):
            continue
        chave = (_norm(v["titulo"]), _norm(v.get("empresa")))
        if chave in vistos:
            continue
        vistos.add(chave)
        d = _data(v.get("data"))
        if dias and d and (hoje - d).days > dias:
            continue
        saida.append({**v, **pontuar(v, perfil)})
    saida.sort(key=lambda x: x.get("data") or "", reverse=True)      # mais novas primeiro
    saida.sort(key=lambda x: -x["nota"])                              # depois a maior nota (estável)
    return saida
