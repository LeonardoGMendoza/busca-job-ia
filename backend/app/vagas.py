"""BuscaJob IA: entende o pedido ("garçom em Buenos Aires à noite"), guarda as vagas das empresas parceiras e
traz vagas remotas do Remote OK (API pública, com crédito ao site). Nunca inventa vaga."""
import json
import logging
import re
import threading
import time
import unicodedata
import urllib.request
from datetime import date
from pathlib import Path

log = logging.getLogger("buscajob")
PASTA = Path(__file__).resolve().parent
CATALOGO = json.loads((PASTA / "catalogo.json").read_text(encoding="utf-8"))
IDS_CIDADE = {c["id"] for c in CATALOGO["cidades"]}
IDS_AREA = {a["id"] for a in CATALOGO["areas"]}
IDS_PERIODO = {p["id"] for p in CATALOGO["periodos"]}


def sem_acento(s):
    return "".join(c for c in unicodedata.normalize("NFD", (s or "").lower()) if unicodedata.category(c) != "Mn")


def entender(texto, catalogo=CATALOGO):
    """Mesma regra do site (web/src/app.js): a palavra mais longa que aparece ganha."""
    s = " " + re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", sem_acento(texto))) + " "

    def achar(lista):
        melhor, tam = None, 0
        for item in lista:
            for p in item.get("palavras", []):
                if f" {sem_acento(p)} " in s and len(p) > tam:
                    melhor, tam = item, len(p)
        return melhor["id"] if melhor else ""

    return {"cidade": achar(catalogo["cidades"]), "area": achar(catalogo["areas"]),
            "periodo": achar([p for p in catalogo["periodos"] if p["id"]]), "livre": extrair_livre(texto, catalogo)}


GATILHOS = r"(?:trabalh\w*|vagas?|empregos?|servicos?|trabaj\w*|empleos?|puestos?|jobs?|work\w*|procuro|busco|quero ser|quiero ser)"
CORTES = r"\b(?:em|en|in|na|no|a noite|de noite|a la noche|meio periodo|medio tiempo|fim de semana|fines de semana|home office|remoto|remote|por favor)\b"


def extrair_livre(texto, catalogo=CATALOGO):
    """Profissão que não está na lista ("vaga de recepcionista de hotel em Foz" -> "recepcionista de hotel")."""
    s = re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", sem_acento(texto))).strip()
    m = re.search(GATILHOS + r"\s+(?:de|como|como um|como uma|as|as a|of)?\s*(.+)", s)
    if not m:
        return ""
    resto = re.split(CORTES, " " + m.group(1) + " ")[0].strip()
    palavras = resto.split()
    inuteis = {"um", "uma", "a", "o", "de", "da", "do", "como", "un", "una", "el", "la", "as", "of", "trabalho", "trabalhar", "emprego",
               "vaga", "vagas", "trabajo", "trabajar", "empleo", "job", "work", "algo", "qualquer", "ser", "para"}
    while palavras and palavras[0] in inuteis:      # tira só as palavras do começo ("emprego de motorista" -> "motorista")
        palavras.pop(0)
    while palavras and palavras[-1] in inuteis:
        palavras.pop()
    livre = " ".join(palavras[:4])
    return livre if len(livre) >= 3 else ""


PROMPT = """Você é a atendente de voz do aplicativo BuscaJob IA, que ajuda estudantes (muitos de medicina) a achar trabalho em
Foz do Iguaçu, Ponta Porã, São Borja, Ciudad del Este, Asunción, Buenos Aires, La Plata, Córdoba, Mar del Plata, Rosario, Mendoza, Lima ou home office.
O aplicativo NÃO tem vagas próprias: ele abre a busca nos sites de emprego reais. Nunca invente vaga, empresa, salário ou lei.
Responda SEMPRE em {idioma}, em no máximo 2 frases curtas (vai ser falado).

Cidades válidas (id): {cidades}
Áreas válidas (id): {areas}
Horários válidos (id): meio, fds, noite (ou vazio)
Escolha atual na tela: cidade={cidade_atual}, área={area_atual}, horário={periodo_atual}
REGRA IMPORTANTE: se o aluno falar de OUTRO trabalho ou profissão, TROQUE a área (ou use "livre" se não houver área parecida) e deixe a área antiga de lado.
Só mantenha a área atual se ele não falar de nenhuma profissão (ex.: só mudou a cidade ou o horário).
Minha leitura automática da frase: {regra}

Responda SOMENTE com JSON válido:
{{"cidade": "id ou vazio", "area": "id ou vazio", "periodo": "id ou vazio", "livre": "profissão em poucas palavras SÓ se não couber em nenhuma área, senão vazio",
  "resposta": "o que você fala: confirme a busca e, se faltar cidade ou área, pergunte; pode dar UMA dica curta de como se candidatar"}}

O aluno disse: "{texto}" """
IDIOMA_NOME = {"es": "español (neutro, de Paraguay)", "pt": "português do Brasil", "en": "English"}


def responder(texto, idioma="pt", atual=None, chat=None):
    atual = atual or {}
    regra = entender(texto)
    base = {k: regra[k] or atual.get(k, "") for k in ("cidade", "periodo")}
    # área: a nova da frase; se ele pediu uma profissão fora da lista, ela substitui a antiga (não guarda a anterior)
    base["area"] = regra["area"] or ("" if regra["livre"] else atual.get("area", ""))
    base["livre"] = "" if regra["area"] else regra["livre"]
    if chat is None:
        return {**base, "resposta": None, "modo": "regra"}
    prompt = PROMPT.format(idioma=IDIOMA_NOME.get(idioma, IDIOMA_NOME["pt"]), cidades=", ".join(sorted(IDS_CIDADE)),
                           areas=", ".join(sorted(IDS_AREA)), cidade_atual=atual.get("cidade", ""), area_atual=atual.get("area", ""),
                           periodo_atual=atual.get("periodo", ""), regra=json.dumps(regra), texto=texto[:400])
    try:
        bruto = chat(prompt, max_tokens=250, temperature=0.2)
        d = json.loads(re.search(r"\{.*\}", bruto, re.S).group(0))
    except Exception as erro:  # noqa: BLE001
        log.warning("IA falhou: %s", type(erro).__name__)
        return {**base, "resposta": None, "modo": "regra"}
    livre_ia = str(d.get("livre") or "")[:40].strip()
    area_ia = d.get("area") if d.get("area") in IDS_AREA else ""
    saida = {
        "cidade": d.get("cidade") if d.get("cidade") in IDS_CIDADE else base["cidade"],
        "area": area_ia or ("" if (livre_ia or base["livre"]) else base["area"]),
        "periodo": d.get("periodo") if d.get("periodo") in IDS_PERIODO else base["periodo"],
        "livre": "" if area_ia else (livre_ia or base["livre"]),
        "resposta": str(d.get("resposta") or "").strip() or None,
        "modo": "ia",
    }
    return saida


class Vagas:
    """Vagas das empresas parceiras: modelo em vagas.json; o que for atualizado pela API vai para DADOS/vagas.json."""

    def __init__(self, pasta_dados, modelo=PASTA / "vagas.json"):
        self.arquivo = Path(pasta_dados) / "vagas.json"
        self.cliques_arquivo = Path(pasta_dados) / "cliques.json"
        self.modelo = Path(modelo)
        self._lock = threading.Lock()

    def dados(self):
        origem = self.arquivo if self.arquivo.exists() else self.modelo
        return json.loads(origem.read_text(encoding="utf-8"))

    def listar(self, cidade="", area=""):
        d = self.dados()
        lista = [v for v in d.get("vagas", []) if (not cidade or v.get("cidade") == cidade) and (not area or v.get("area") == area)]
        return {"exemplo": bool(d.get("exemplo")), "vagas": lista}

    def salvar_vaga(self, vaga_id, nova):
        if nova.get("cidade") and nova["cidade"] not in IDS_CIDADE:
            raise ValueError("cidade inválida")
        if nova.get("area") and nova["area"] not in IDS_AREA:
            raise ValueError("área inválida")
        with self._lock:
            d = self.dados()
            vaga = next((v for v in d["vagas"] if v["id"] == vaga_id), None)
            if vaga is None:
                vaga = {"id": vaga_id, "empresa": "", "titulo": {}, "cidade": "", "area": "", "periodo": "", "contato": "", "link": ""}
                d["vagas"].append(vaga)
            for campo in ("empresa", "titulo", "cidade", "area", "periodo", "contato", "link"):
                if campo in nova:
                    vaga[campo] = nova[campo]
            vaga["publicada"] = date.today().isoformat()
            if "exemplo" in nova:
                d["exemplo"] = bool(nova["exemplo"])
            self.arquivo.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.arquivo.with_suffix(".tmp")
            tmp.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
            tmp.replace(self.arquivo)
            return vaga

    def remover_vaga(self, vaga_id):
        with self._lock:
            d = self.dados()
            antes = len(d["vagas"])
            d["vagas"] = [v for v in d["vagas"] if v["id"] != vaga_id]
            self.arquivo.parent.mkdir(parents=True, exist_ok=True)
            self.arquivo.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
            return antes != len(d["vagas"])

    def registrar_clique(self, tipo, item_id):
        with self._lock:
            try:
                cont = json.loads(self.cliques_arquivo.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                cont = {}
            chave = f"{tipo}:{item_id}"[:120]
            cont[chave] = cont.get(chave, 0) + 1
            self.cliques_arquivo.parent.mkdir(parents=True, exist_ok=True)
            self.cliques_arquivo.write_text(json.dumps(cont, ensure_ascii=False, indent=2), encoding="utf-8")
            return cont[chave]

    def cliques(self):
        try:
            return json.loads(self.cliques_arquivo.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}


class Remotas:
    """Vagas remotas do Remote OK (API pública). Cache de 6 horas e crédito obrigatório ao Remote OK."""
    URL = "https://remoteok.com/api"

    def __init__(self, buscar=None, validade=6 * 3600):
        self._buscar = buscar or self._baixar
        self.validade, self._cache, self._quando = validade, [], 0
        self._lock = threading.Lock()

    def _baixar(self):
        pedido = urllib.request.Request(self.URL, headers={"User-Agent": "BuscaJobIA/0.1"})
        with urllib.request.urlopen(pedido, timeout=15) as r:
            return json.loads(r.read().decode("utf-8"))

    def _todas(self):
        with self._lock:
            if time.time() - self._quando > self.validade:
                try:
                    bruto = self._buscar()
                    self._cache = [j for j in bruto if isinstance(j, dict) and j.get("position")]
                    self._quando = time.time()
                except Exception as erro:  # noqa: BLE001
                    log.warning("Remote OK indisponível: %s", type(erro).__name__)
            return self._cache

    def buscar(self, termo="", limite=12):
        palavras = [p for p in sem_acento(termo).split() if len(p) > 2]
        saida = []
        for j in self._todas():
            alvo = sem_acento(" ".join([j.get("position", ""), " ".join(j.get("tags") or [])]))
            if not palavras or any(p in alvo for p in palavras):
                saida.append({"titulo": j.get("position"), "empresa": j.get("company"), "local": j.get("location") or "Remote",
                              "link": j.get("url"), "data": (j.get("date") or "")[:10]})
            if len(saida) >= limite:
                break
        return {"fonte": "Remote OK", "fonte_link": "https://remoteok.com", "vagas": saida}


# ---------------------------------------------------------------------------------------------
# Vagas reais dentro do app: JSearch (Google Vagas, via OpenWeb Ninja ou RapidAPI) e Jooble (API oficial).
# Só usa serviços que liberam os dados por API (sem robô em Indeed/LinkedIn). Cache de 6 h para gastar pouca cota.
# ---------------------------------------------------------------------------------------------
import os  # noqa: E402
import urllib.error  # noqa: E402
import urllib.parse  # noqa: E402

PAIS_CODIGO = {"BR": "br", "PY": "py", "AR": "ar", "PE": "pe"}


def termo_busca(cidade_id, area_id="", livre="", periodo_id="", com_jornada=True):
    cidade = next((c for c in CATALOGO["cidades"] if c["id"] == cidade_id), None)
    area = next((a for a in CATALOGO["areas"] if a["id"] == area_id), None)
    if not cidade or not (area or livre):
        return None
    lingua = CATALOGO["paises"][cidade["pais"]]["idioma"]
    base = area["termo"][lingua] if area else livre.strip()[:60]
    periodo = next((p for p in CATALOGO["periodos"] if p["id"] == periodo_id), None)
    q = " ".join(x for x in [base, periodo["termo"][lingua] if (com_jornada and periodo) else ""] if x)
    return {"q": q, "base": base, "cidade": cidade, "pais": cidade["pais"], "lingua": lingua}


def _http_json(url, metodo="GET", corpo=None, cabecalhos=None, timeout=20):
    dados = json.dumps(corpo).encode("utf-8") if corpo is not None else None
    pedido = urllib.request.Request(url, data=dados, method=metodo, headers={"User-Agent": "BuscaJobIA/0.2", **(cabecalhos or {})})
    if dados is not None:
        pedido.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(pedido, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


class BuscaReal:
    def __init__(self, env=os.environ, http=_http_json, validade=6 * 3600):
        self.http, self.validade = http, validade
        self.jsearch_key = env.get("JSEARCH_KEY", "")
        self.jsearch_rapidapi = env.get("JSEARCH_PROVEDOR", "openwebninja").lower() == "rapidapi"
        self.jooble = {cc: env.get(f"JOOBLE_KEY_{cc.upper()}", "") for cc in PAIS_CODIGO.values()}
        self._cache, self._lock = {}, threading.Lock()

    @property
    def ligada(self):
        return bool(self.jsearch_key or any(self.jooble.values()))

    # ---- provedores ----
    def _jsearch_url(self, params):
        if self.jsearch_rapidapi:
            return ("https://jsearch.p.rapidapi.com/search?" + urllib.parse.urlencode(params),
                    {"X-RapidAPI-Key": self.jsearch_key, "X-RapidAPI-Host": "jsearch.p.rapidapi.com"})
        return "https://api.openwebninja.com/jsearch/search?" + urllib.parse.urlencode(params), {"x-api-key": self.jsearch_key}

    def _jsearch(self, t):
        remoto = t["pais"] == "REMOTO"
        if remoto:
            tentativas = [{"query": f'{t["q"]} remote', "work_from_home": "true"}]
        else:
            pais = PAIS_CODIGO[t["pais"]]
            # 1ª: termo completo + cidade no país; 2ª (só se vier vazio): só a profissão + nome da cidade, sem jornada
            tentativas = [{"query": f'{t["q"]} {t["cidade"]["local"]}', "country": pais},
                          {"query": f'{t["base"]} {t["cidade"]["nome"]}', "country": pais}]
        bruto = {}
        for extra in tentativas:
            url, cab = self._jsearch_url({"page": "1", "num_pages": "1", "date_posted": "month", **extra})
            bruto = self.http(url, cabecalhos=cab)
            if bruto.get("data"):
                break
        saida = []
        for j in (bruto.get("data") or [])[:20]:
            salario = ""
            if j.get("job_min_salary") or j.get("job_max_salary"):
                faixa = " - ".join(str(int(v)) for v in (j.get("job_min_salary"), j.get("job_max_salary")) if v)
                salario = f'{faixa} {j.get("job_salary_currency") or ""} {j.get("job_salary_period") or ""}'.strip()
            saida.append({"titulo": j.get("job_title"), "empresa": j.get("employer_name"), "local": j.get("job_location") or ("Remote" if remoto else t["cidade"]["nome"]),
                          "link": j.get("job_apply_link"), "fonte": j.get("job_publisher") or "Google Vagas", "data": (j.get("job_posted_at_datetime_utc") or "")[:10],
                          "salario": salario, "tipo": j.get("job_employment_type") or "", "remoto": bool(j.get("job_is_remote")),
                          "resumo": (j.get("job_description") or "")[:220]})
        return saida

    def _jooble(self, t):
        cc = PAIS_CODIGO.get(t["pais"])
        chave = self.jooble.get(cc or "", "")
        if not chave:
            return []
        bruto = self.http(f"https://{cc}.jooble.org/api/{chave}", metodo="POST",
                          corpo={"keywords": t["q"], "location": t["cidade"]["nome"], "page": 1, "ResultOnPage": 20})
        return [{"titulo": re.sub(r"<[^>]+>", "", j.get("title") or ""), "empresa": j.get("company"), "local": j.get("location") or t["cidade"]["nome"],
                 "link": j.get("link"), "fonte": j.get("source") or "Jooble", "data": (j.get("updated") or "")[:10], "salario": j.get("salary") or "",
                 "tipo": j.get("type") or "", "remoto": False, "resumo": re.sub(r"<[^>]+>", "", j.get("snippet") or "")[:220]}
                for j in (bruto.get("jobs") or [])[:20]]

    def buscar(self, cidade_id, area_id="", livre="", periodo_id=""):
        t = termo_busca(cidade_id, area_id, livre, periodo_id)
        if not t:
            return {"vagas": [], "fontes": [], "ligada": self.ligada}
        chave = f'{t["q"]}|{cidade_id}'
        with self._lock:
            em_cache = self._cache.get(chave)
            if em_cache and time.time() - em_cache[0] < self.validade:
                return em_cache[1]
        vagas, fontes, erros = [], [], []
        for nome, funcao in (("JSearch", self._jsearch if self.jsearch_key else None), ("Jooble", self._jooble)):
            if not funcao:
                continue
            try:
                achadas = funcao(t)
                if achadas:
                    fontes.append(nome)
                vagas.extend(achadas)
            except urllib.error.HTTPError as erro:
                corpo = ""
                try:
                    corpo = erro.read().decode("utf-8", "replace")[:200]
                except Exception:  # noqa: BLE001
                    pass
                log.warning("%s falhou: HTTP %s %s", nome, erro.code, corpo)
                erros.append(f"{nome}: HTTP {erro.code} {corpo}".strip())
            except Exception as erro:  # noqa: BLE001
                log.warning("%s falhou: %s %s", nome, type(erro).__name__, erro)
                erros.append(f"{nome}: {type(erro).__name__}")
        vistos, unicas = set(), []
        for v in vagas:
            k = (sem_acento(v["titulo"] or ""), sem_acento(v["empresa"] or ""))
            if v["link"] and v["titulo"] and k not in vistos:
                vistos.add(k)
                unicas.append(v)
        resultado = {"vagas": unicas[:30], "fontes": fontes, "ligada": self.ligada, "termo": t["q"]}
        if erros:
            resultado["erros"] = erros          # mostra o motivo (sem a chave) e NÃO guarda no cache
            return resultado
        with self._lock:
            self._cache[chave] = (time.time(), resultado)
        return resultado
