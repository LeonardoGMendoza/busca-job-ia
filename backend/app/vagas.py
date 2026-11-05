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
            "periodo": achar([p for p in catalogo["periodos"] if p["id"]])}


PROMPT = """Você é a atendente de voz do aplicativo BuscaJob IA, que ajuda estudantes (muitos de medicina) a achar trabalho em
Foz do Iguaçu, Ponta Porã, São Borja, Ciudad del Este, Asunción, Buenos Aires, La Plata, Córdoba, Mar del Plata, Rosario, Mendoza, Lima ou home office.
O aplicativo NÃO tem vagas próprias: ele abre a busca nos sites de emprego reais. Nunca invente vaga, empresa, salário ou lei.
Responda SEMPRE em {idioma}, em no máximo 2 frases curtas (vai ser falado).

Cidades válidas (id): {cidades}
Áreas válidas (id): {areas}
Horários válidos (id): meio, fds, noite (ou vazio)
Escolha atual na tela: cidade={cidade_atual}, área={area_atual}, horário={periodo_atual}
Minha leitura automática da frase: {regra}

Responda SOMENTE com JSON válido:
{{"cidade": "id ou vazio", "area": "id ou vazio", "periodo": "id ou vazio", "livre": "profissão em poucas palavras SÓ se não couber em nenhuma área, senão vazio",
  "resposta": "o que você fala: confirme a busca e, se faltar cidade ou área, pergunte; pode dar UMA dica curta de como se candidatar"}}

O aluno disse: "{texto}" """
IDIOMA_NOME = {"es": "español (neutro, de Paraguay)", "pt": "português do Brasil", "en": "English"}


def responder(texto, idioma="pt", atual=None, chat=None):
    atual = atual or {}
    regra = entender(texto)
    base = {k: regra[k] or atual.get(k, "") for k in ("cidade", "area", "periodo")}
    if chat is None:
        return {**base, "livre": "", "resposta": None, "modo": "regra"}
    prompt = PROMPT.format(idioma=IDIOMA_NOME.get(idioma, IDIOMA_NOME["pt"]), cidades=", ".join(sorted(IDS_CIDADE)),
                           areas=", ".join(sorted(IDS_AREA)), cidade_atual=atual.get("cidade", ""), area_atual=atual.get("area", ""),
                           periodo_atual=atual.get("periodo", ""), regra=json.dumps(regra), texto=texto[:400])
    try:
        bruto = chat(prompt, max_tokens=250, temperature=0.2)
        d = json.loads(re.search(r"\{.*\}", bruto, re.S).group(0))
    except Exception as erro:  # noqa: BLE001
        log.warning("IA falhou: %s", type(erro).__name__)
        return {**base, "livre": "", "resposta": None, "modo": "regra"}
    saida = {
        "cidade": d.get("cidade") if d.get("cidade") in IDS_CIDADE else base["cidade"],
        "area": d.get("area") if d.get("area") in IDS_AREA else base["area"],
        "periodo": d.get("periodo") if d.get("periodo") in IDS_PERIODO else base["periodo"],
        "livre": str(d.get("livre") or "")[:40].strip(),
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
