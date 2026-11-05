"""API do BuscaJob IA: entende o pedido por voz, vagas das empresas parceiras e vagas remotas."""
import os
import re
import time
from collections import defaultdict, deque

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import carregar_env

carregar_env()

from .ia import oracle_do_ambiente  # noqa: E402
from .vagas import IDS_AREA, IDS_CIDADE, IDS_PERIODO, IDS_TIPO_MORADIA, BuscaReal, Moradia, Remotas, Vagas, responder  # noqa: E402

DADOS = os.getenv("BJ_DATA_DIR", "./data")
TOKEN = os.getenv("BJ_TOKEN", "")
app = FastAPI(title="BuscaJob IA API", version="0.1.0")
origens = [o.strip() for o in os.getenv("BJ_ORIGENS", "http://localhost:5500,https://leonardogmendoza.github.io,https://buscajob.sandlj.com.br").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origens, allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["*"])

vagas = Vagas(DADOS)
remotas = Remotas()
busca_real = BuscaReal()
moradia = Moradia()
chat = oracle_do_ambiente()
ID_OK = re.compile(r"^[a-zA-Z0-9_-]{1,40}$")
_pedidos = defaultdict(deque)


def limitar(request: Request, maximo=30, janela=60):
    ip = request.headers.get("cf-connecting-ip") or request.headers.get("x-real-ip") or (request.client.host if request.client else "?")
    agora, fila = time.time(), _pedidos[(ip, maximo)]
    while fila and agora - fila[0] > janela:
        fila.popleft()
    if len(fila) >= maximo:
        raise HTTPException(429, "Muitos pedidos. Espere um minuto.")
    fila.append(agora)


def exigir_token(request: Request):
    if not TOKEN:
        raise HTTPException(503, "Defina BJ_TOKEN no .env para publicar vagas.")
    if request.headers.get("x-token", "") != TOKEN:
        raise HTTPException(401, "Token inválido.")


class Pergunta(BaseModel):
    texto: str = Field(..., min_length=1, max_length=400)
    idioma: str = Field("pt", max_length=5)
    cidade: str = Field("", max_length=40)
    area: str = Field("", max_length=40)
    periodo: str = Field("", max_length=10)


class Clique(BaseModel):
    tipo: str = Field(..., pattern=r"^(site|anuncio|vaga)$")
    id: str = Field(..., min_length=1, max_length=120)


class Vaga(BaseModel):
    empresa: str | None = Field(None, max_length=80)
    titulo: dict[str, str] | None = None
    cidade: str | None = Field(None, max_length=40)
    area: str | None = Field(None, max_length=40)
    periodo: str | None = Field(None, max_length=10)
    contato: str | None = Field(None, max_length=20)
    link: str | None = Field(None, max_length=300)
    exemplo: bool | None = None


@app.get("/api/saude")
def saude():
    return {"ok": True, "ia": chat is not None, "vagas_reais": busca_real.ligada, "moradia": moradia.ligada}


@app.post("/api/perguntar")
def perguntar(p: Pergunta, request: Request):
    limitar(request)
    return responder(p.texto, p.idioma, {"cidade": p.cidade, "area": p.area, "periodo": p.periodo}, chat)


@app.get("/api/vagas")
def listar_vagas(cidade: str = "", area: str = ""):
    if (cidade and cidade not in IDS_CIDADE) or (area and area not in IDS_AREA):
        raise HTTPException(422, "Cidade ou área inválida.")
    return vagas.listar(cidade, area)


@app.put("/api/vagas/{vaga_id}")
def salvar_vaga(vaga_id: str, vaga: Vaga, request: Request):
    exigir_token(request)
    if not ID_OK.match(vaga_id):
        raise HTTPException(422, "Identificador inválido.")
    try:
        return vagas.salvar_vaga(vaga_id, vaga.model_dump(exclude_none=True))
    except ValueError as erro:
        raise HTTPException(422, str(erro)) from erro


@app.delete("/api/vagas/{vaga_id}")
def remover_vaga(vaga_id: str, request: Request):
    exigir_token(request)
    return {"ok": vagas.remover_vaga(vaga_id)}


@app.get("/api/buscar")
def buscar_vagas(request: Request, cidade: str, area: str = "", livre: str = "", periodo: str = ""):
    """Vagas reais (JSearch/Google Vagas e Jooble) para mostrar dentro do app."""
    limitar(request, maximo=20)
    if cidade not in IDS_CIDADE or (area and area not in IDS_AREA) or (periodo and periodo not in IDS_PERIODO):
        raise HTTPException(422, "Cidade, área ou jornada inválida.")
    return busca_real.buscar(cidade, area, livre[:60], periodo)


@app.get("/api/moradia")
def buscar_moradia(request: Request, cidade: str, tipo: str = "pensionato"):
    """Pensionatos, residências estudantis e imobiliárias reais da cidade (Google Maps)."""
    limitar(request, maximo=20)
    if cidade not in IDS_CIDADE or tipo not in IDS_TIPO_MORADIA:
        raise HTTPException(422, "Cidade ou tipo inválido.")
    return moradia.buscar(cidade, tipo)


class Interesse(BaseModel):
    plano: str = Field("premium", pattern=r"^(premium|empresa)$")
    contato: str = Field("", max_length=120)
    idioma: str = Field("pt", max_length=5)


@app.post("/api/interesse")
def registrar_interesse(i: Interesse, request: Request):
    """Lista de espera do Premium: conta quantas pessoas querem (o contato é opcional)."""
    limitar(request, maximo=10)
    total = vagas.registrar_clique("interesse", i.plano)
    if i.contato.strip():
        vagas.registrar_clique("interesse-contato", i.contato.strip()[:120])
    return {"ok": True, "total": total}


@app.get("/api/remotas")
def vagas_remotas(q: str = "", request: Request = None):
    limitar(request, maximo=20)
    return remotas.buscar(q[:60])


@app.post("/api/clique")
def clique(c: Clique, request: Request):
    limitar(request, maximo=60)
    return {"ok": True, "total": vagas.registrar_clique(c.tipo, c.id)}


@app.get("/api/cliques")
def ver_cliques(request: Request):
    exigir_token(request)
    return vagas.cliques()
