"""Busca vagas de desenvolvedor .NET para o Leonardo, dá nota de compatibilidade e gera planilha (xlsx + csv).
NÃO se candidata a nada: você abre o link das melhores e se candidata com o currículo adaptado.

Uso (dentro da pasta backend, com JSEARCH_KEY no .env):
  python buscar_dev.py                       # busca nas APIs e gera saida/vagas_AAAA-MM-DD.xlsx
  python buscar_dev.py --dias 7              # só vagas dos últimos 7 dias
  python buscar_dev.py --arquivo vagas.json  # pontua uma lista de vagas que você já tem
  python buscar_dev.py --arquivo vaga.txt    # pontua UMA vaga colada em texto (ex.: do LinkedIn)
"""
import argparse
import csv
import json
import os
import re
import sys
import urllib.parse
from datetime import date
from pathlib import Path

from app.compat import carregar_perfil, ranquear
from app.config import carregar_env

carregar_env()
from app.vagas import PAIS_CODIGO, BuscaReal, _http_json  # noqa: E402

COLUNAS = ["nota", "faixa", "titulo", "empresa", "local", "remoto", "casou", "faltou", "alertas", "salario", "tipo", "data", "fonte", "link", "status"]


def buscar_jsearch(busca_real, consulta, remoto, dias):
    janela = "today" if dias <= 1 else "3days" if dias <= 3 else "week" if dias <= 7 else "month"
    params = {"query": consulta, "page": "1", "num_pages": "1", "date_posted": janela, "country": PAIS_CODIGO["BR"]}
    if remoto:
        params["work_from_home"] = "true"
    url, cab = busca_real._jsearch_url(params)
    bruto = busca_real.http(url, cabecalhos=cab)
    saida = []
    for j in bruto.get("data") or []:
        salario = ""
        if j.get("job_min_salary") or j.get("job_max_salary"):
            faixa = " - ".join(str(int(v)) for v in (j.get("job_min_salary"), j.get("job_max_salary")) if v)
            salario = f'{faixa} {j.get("job_salary_currency") or ""} {j.get("job_salary_period") or ""}'.strip()
        local = " ".join(x for x in (j.get("job_city"), j.get("job_state")) if x) or (j.get("job_location") or "")
        saida.append({"titulo": j.get("job_title"), "empresa": j.get("employer_name"), "local": local, "remoto": bool(j.get("job_is_remote")),
                      "link": j.get("job_apply_link"), "fonte": j.get("job_publisher") or "Google Vagas", "data": (j.get("job_posted_at_datetime_utc") or "")[:10],
                      "salario": salario, "tipo": j.get("job_employment_type") or "", "descricao": (j.get("job_description") or "")[:6000]})
    return saida


def buscar_jooble(busca_real, consulta, remoto):
    chave = busca_real.jooble.get("br", "")
    if not chave:
        return []
    bruto = busca_real.http(f"https://br.jooble.org/api/{chave}", metodo="POST",
                            corpo={"keywords": consulta, "location": "Brasil" if remoto else "Foz do Iguaçu", "page": 1, "ResultOnPage": 20})
    return [{"titulo": re.sub(r"<[^>]+>", "", j.get("title") or ""), "empresa": j.get("company"), "local": j.get("location") or "",
             "remoto": remoto, "link": j.get("link"), "fonte": j.get("source") or "Jooble", "data": (j.get("updated") or "")[:10],
             "salario": j.get("salary") or "", "tipo": j.get("type") or "", "descricao": re.sub(r"<[^>]+>", "", j.get("snippet") or "")}
            for j in bruto.get("jobs") or []]


def coletar(perfil, dias):
    br = BuscaReal(os.environ)
    if not br.ligada:
        sys.exit("Sem chave de API. Coloque JSEARCH_KEY (e/ou JOOBLE_KEY_BR) no arquivo backend/.env. Veja o README.")
    todas = []
    for b in perfil["buscas"]:
        for nome, fn in (("JSearch", (lambda: buscar_jsearch(br, b["q"], b["remoto"], dias)) if br.jsearch_key else None),
                         ("Jooble", lambda: buscar_jooble(br, b["q"], b["remoto"]))):
            if not fn:
                continue
            try:
                achadas = fn()
                print(f'  {nome}: "{b["q"]}" -> {len(achadas)} vagas')
                todas.extend(achadas)
            except Exception as erro:  # noqa: BLE001
                print(f'  {nome}: "{b["q"]}" falhou ({type(erro).__name__}: {erro})')
    return todas


def ler_arquivo(caminho):
    p = Path(caminho)
    if p.suffix.lower() == ".json":
        d = json.loads(p.read_text(encoding="utf-8"))
        return d["vagas"] if isinstance(d, dict) else d
    texto = p.read_text(encoding="utf-8")                  # texto colado de UMA vaga
    primeira = next((l.strip() for l in texto.splitlines() if l.strip()), "Vaga")
    return [{"titulo": primeira[:120], "empresa": "", "local": "", "remoto": bool(re.search(r"remot|home office", texto, re.I)),
             "link": "colada", "descricao": texto[:6000]}]


def para_linha(v):
    return {**{c: v.get(c, "") for c in COLUNAS}, "casou": ", ".join(v["casou"]), "faltou": ", ".join(v["faltou"]),
            "alertas": " | ".join(v["alertas"]), "remoto": "sim" if v.get("remoto") else "", "status": ""}


def salvar(ranking, pasta):
    pasta.mkdir(parents=True, exist_ok=True)
    base = pasta / f"vagas_{date.today().isoformat()}"
    linhas = [para_linha(v) for v in ranking]
    with open(f"{base}.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=COLUNAS, delimiter=";")
        w.writeheader()
        w.writerows(linhas)
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Font, PatternFill
    except ImportError:
        print("openpyxl não instalado: gerei só o CSV (pip install openpyxl para o xlsx).")
        return f"{base}.csv"
    wb = Workbook()
    ws = wb.active
    ws.title = "Vagas"
    ws.append(COLUNAS)
    cores = {"Alta": "C6EFCE", "Média": "FFEB9C", "Baixa": "F4CCCC"}
    for c in ws[1]:
        c.font, c.fill = Font(bold=True, color="FFFFFF"), PatternFill("solid", fgColor="1F3A5F")
    for l in linhas:
        ws.append([l[c] for c in COLUNAS])
        r = ws.max_row
        ws.cell(r, 2).fill = PatternFill("solid", fgColor=cores[l["faixa"]])
        if str(l["link"]).startswith("http"):
            ws.cell(r, COLUNAS.index("link") + 1).hyperlink = l["link"]
            ws.cell(r, COLUNAS.index("link") + 1).font = Font(color="0563C1", underline="single")
    larg = {"nota": 7, "faixa": 8, "titulo": 38, "empresa": 24, "local": 22, "remoto": 8, "casou": 36, "faltou": 22, "alertas": 40, "salario": 16, "tipo": 12, "data": 11, "fonte": 14, "link": 30, "status": 14}
    for i, c in enumerate(COLUNAS, 1):
        ws.column_dimensions[ws.cell(1, i).column_letter].width = larg[c]
    for linha in ws.iter_rows(min_row=2):
        for c in linha:
            c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.freeze_panes = "C2"
    ws.auto_filter.ref = ws.dimensions
    wb.save(f"{base}.xlsx")
    return f"{base}.xlsx"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--arquivo", help="JSON de vagas ou .txt com uma vaga colada (não usa as APIs)")
    ap.add_argument("--perfil", default=None, help="outro perfil .json (padrão: perfil_leonardo.json)")
    ap.add_argument("--dias", type=int, default=14, help="ignora vagas mais velhas que N dias (padrão 14)")
    ap.add_argument("--saida", default="saida", help="pasta da planilha (padrão: saida)")
    ap.add_argument("--top", type=int, default=10, help="quantas mostrar no terminal")
    a = ap.parse_args()
    perfil = carregar_perfil(a.perfil) if a.perfil else carregar_perfil()
    vagas = ler_arquivo(a.arquivo) if a.arquivo else coletar(perfil, a.dias)
    ranking = ranquear(vagas, perfil, dias=a.dias if not a.arquivo else None)
    if not ranking:
        sys.exit("Nenhuma vaga encontrada.")
    arq = salvar(ranking, Path(a.saida))
    print(f"\n{len(ranking)} vagas pontuadas. Melhores:\n")
    for v in ranking[: a.top]:
        print(f'[{v["nota"]:>3}] {v["faixa"]:<5} {v["titulo"]} — {v.get("empresa") or "?"} ({v.get("local") or "?"})')
        print(f'       casou: {", ".join(v["casou"]) or "-"}' + (f' | falta: {", ".join(v["faltou"])}' if v["faltou"] else ""))
        for al in v["alertas"]:
            print(f"       ! {al}")
    print(f"\nPlanilha: {arq}")


if __name__ == "__main__":
    main()
