import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.vagas import Remotas, Vagas, entender, responder  # noqa: E402


class IAFalsa:
    def __init__(self, resposta):
        self.resposta, self.prompts = resposta, []

    def __call__(self, prompt, **_):
        self.prompts.append(prompt)
        return self.resposta


class TestEntender(unittest.TestCase):
    def test_frases(self):
        casos = {
            "quero trabalhar de garçom em Buenos Aires à noite": ("buenos-aires", "garcom", "noite"),
            "vaga de enfermeira em Foz do Iguaçu": ("foz", "enfermagem", ""),
            "trabajo de limpieza airbnb en ciudad del este fines de semana": ("cde", "limpeza", "fds"),
            "dev home office meio período": ("remoto", "ti", "meio"),
            "mozo en mar de plata": ("mar-del-plata", "garcom", ""),
            "teach portuguese in lima": ("lima", "idiomas", ""),
            "eventos em ponta porã": ("ponta-pora", "eventos", ""),
            "cuidadora de idosos em assunção": ("asuncion", "cuidador", ""),
        }
        for frase, (c, a, p) in casos.items():
            r = entender(frase)
            self.assertEqual((r["cidade"], r["area"], r["periodo"]), (c, a, p), frase)

    def test_ia_so_aceita_ids_validos(self):
        ia = IAFalsa('{"cidade": "marte", "area": "garcom", "periodo": "noite", "livre": "", "resposta": "Pronto!"}')
        r = responder("mozo de noche en cordoba", "es", {}, ia)
        self.assertEqual(r["cidade"], "cordoba")   # 'marte' não existe: fica a leitura da regra
        self.assertEqual(r["area"], "garcom")
        self.assertEqual(r["resposta"], "Pronto!")
        self.assertIn("NÃO tem vagas próprias", ia.prompts[0])

    def test_troca_de_area_nao_guarda_a_antiga(self):
        r = responder("agora quero vaga de garçom", "pt", {"cidade": "foz", "area": "ti"})
        self.assertEqual((r["cidade"], r["area"], r["livre"]), ("foz", "garcom", ""))
        r = responder("quero trabalhar de motorista de van em Foz", "pt", {"area": "ti"})
        self.assertEqual((r["cidade"], r["area"], r["livre"]), ("foz", "", "motorista de van"))
        r = responder("busco trabajo de chofer en Lima de noche", "es", {"area": "ti"})
        self.assertEqual((r["cidade"], r["area"], r["livre"], r["periodo"]), ("lima", "", "chofer", "noite"))
        ia = IAFalsa('{"cidade": "foz", "area": "ti", "periodo": "", "livre": "", "resposta": "ok"}')
        r = responder("quero ser motorista de aplicativo", "pt", {"cidade": "foz", "area": "ti"}, ia)
        self.assertIn("TROQUE a área", ia.prompts[0])

    def test_sem_ia_usa_regra_e_escolha_atual(self):
        r = responder("à noite", "pt", {"cidade": "foz", "area": "garcom"})
        self.assertEqual((r["cidade"], r["area"], r["periodo"], r["modo"]), ("foz", "garcom", "noite", "regra"))


class TestVagas(unittest.TestCase):
    def test_listar_salvar_remover(self):
        v = Vagas(tempfile.mkdtemp())
        self.assertTrue(v.listar()["exemplo"])
        self.assertTrue(all(x["cidade"] == "cde" for x in v.listar("cde")["vagas"]))
        v.salvar_vaga("nova", {"empresa": "Bar X", "titulo": {"pt": "Garçom"}, "cidade": "foz", "area": "garcom", "exemplo": False})
        self.assertEqual(v.listar("foz", "garcom")["vagas"][-1]["empresa"], "Bar X")
        self.assertFalse(v.listar()["exemplo"])
        with self.assertRaises(ValueError):
            v.salvar_vaga("ruim", {"cidade": "marte"})
        self.assertTrue(v.remover_vaga("nova"))
        self.assertEqual(v.registrar_clique("site", "linkedin"), 1)


class TestRemotas(unittest.TestCase):
    def test_filtra_e_cacheia(self):
        chamadas = []

        def falso():
            chamadas.append(1)
            return [{"legal": "aviso"}, {"position": "React Developer", "company": "A", "tags": ["react"], "url": "u1", "date": "2026-11-01T00:00:00"},
                    {"position": "Customer Support", "company": "B", "tags": ["support"], "url": "u2"}]
        r = Remotas(buscar=falso)
        self.assertEqual([j["empresa"] for j in r.buscar("developer")["vagas"]], ["A"])
        self.assertEqual(len(r.buscar("")["vagas"]), 2)
        self.assertEqual(len(chamadas), 1)
        self.assertEqual(r.buscar("x")["fonte"], "Remote OK")


if __name__ == "__main__":
    unittest.main()


class TestBuscaReal(unittest.TestCase):
    def test_jsearch_e_jooble_juntos_sem_repetir_e_com_cache(self):
        from app.vagas import BuscaReal
        chamadas = []

        def http(url, metodo="GET", corpo=None, cabecalhos=None):
            chamadas.append((url, metodo, corpo, cabecalhos))
            if "openwebninja" in url:
                return {"data": [{"job_title": "Mozo", "employer_name": "Bar A", "job_location": "Ciudad del Este", "job_apply_link": "https://a",
                                  "job_publisher": "LinkedIn", "job_posted_at_datetime_utc": "2026-11-03T10:00:00Z", "job_min_salary": 3000000, "job_salary_currency": "PYG"}]}
            return {"jobs": [{"title": "<b>Mozo</b>", "company": "Bar A", "link": "https://dup"}, {"title": "Mozo de eventos", "company": "B", "link": "https://b", "location": "CDE"}]}
        b = BuscaReal(env={"JSEARCH_KEY": "k", "JOOBLE_KEY_PY": "j"}, http=http)
        r = b.buscar("cde", "garcom")
        self.assertEqual([v["titulo"] for v in r["vagas"]], ["Mozo", "Mozo de eventos"])   # "Mozo / Bar A" repetido some
        self.assertEqual(r["fontes"], ["JSearch", "Jooble"])
        self.assertIn("country=py", chamadas[0][0])
        self.assertEqual(chamadas[0][3], {"x-api-key": "k"})
        self.assertTrue(chamadas[1][0].startswith("https://py.jooble.org/api/j"))
        self.assertEqual(r["vagas"][0]["salario"], "3000000 PYG")
        b.buscar("cde", "garcom")
        self.assertEqual(len(chamadas), 2)   # segunda vez veio do cache

    def test_sem_chaves_nao_chama_nada(self):
        from app.vagas import BuscaReal
        b = BuscaReal(env={}, http=lambda *a, **k: self.fail("não devia chamar"))
        r = b.buscar("foz", "enfermagem")
        self.assertEqual((r["vagas"], r["ligada"]), ([], False))

    def test_remoto_e_livre(self):
        from app.vagas import BuscaReal
        urls = []
        b = BuscaReal(env={"JSEARCH_KEY": "k"}, http=lambda url, **k: urls.append(url) or {"data": []})
        b.buscar("remoto", livre="motorista de van")
        self.assertIn("work_from_home=true", urls[0])
        self.assertIn("motorista+de+van+remote", urls[0])


class TestErroNaoFicaNoCache(unittest.TestCase):
    def test_erro(self):
        from app.vagas import BuscaReal
        n = []

        def http(url, **k):
            n.append(1)
            raise OSError("sem rede")
        b = BuscaReal(env={"JSEARCH_KEY": "k"}, http=http)
        r = b.buscar("foz", "ti")
        self.assertEqual(r["erros"], ["JSearch: OSError"])
        b.buscar("foz", "ti")
        self.assertEqual(len(n), 2)


class TestSegundaTentativa(unittest.TestCase):
    def test_busca_mais_ampla_quando_vazio(self):
        from app.vagas import BuscaReal
        urls = []

        def http(url, **k):
            urls.append(url)
            return {"data": []} if len(urls) == 1 else {"data": [{"job_title": "Mesero", "employer_name": "X", "job_apply_link": "https://x"}]}
        r = BuscaReal(env={"JSEARCH_KEY": "k"}, http=http).buscar("cde", "garcom", periodo_id="noite")
        self.assertEqual(len(urls), 2)
        self.assertIn("mozo+nocturno+Ciudad+del+Este%2C+Paraguay", urls[0])
        self.assertIn("query=mozo+Ciudad+del+Este&", urls[1])
        self.assertEqual(r["vagas"][0]["titulo"], "Mesero")


class TestLocalLimpo(unittest.TestCase):
    def test_local(self):
        from app.vagas import BuscaReal
        http = lambda url, **k: {"data": [{"job_title": "A", "employer_name": "B", "job_apply_link": "https://a",
                                           "job_location": "Cd. del Este     •  a través de LinkedIn Paraguay"}]}
        r = BuscaReal(env={"JSEARCH_KEY": "k"}, http=http).buscar("cde", "atendimento")
        self.assertEqual(r["vagas"][0]["local"], "Ciudad del Este")


class TestMoradia(unittest.TestCase):
    def test_locais_reais(self):
        from app.vagas import Moradia
        urls = []

        def http(url, **k):
            urls.append((url, k.get("cabecalhos")))
            return {"status": "OK", "data": [
                {"name": "Residencia Estudiantil Ejemplo", "full_address": "Calle 1, Ciudad del Este", "phone_number": "+595 981 000000",
                 "rating": 4.6, "review_count": 31, "place_link": "https://maps.google.com/?cid=1", "business_status": "OPEN"},
                {"name": "Fechada", "business_status": "CLOSED_PERMANENTLY"}]}
        m = Moradia(env={"JSEARCH_KEY": "k"}, http=http)
        r = m.buscar("cde", "pensionato")
        self.assertEqual([x["nome"] for x in r["locais"]], ["Residencia Estudiantil Ejemplo"])
        self.assertIn("local-business-data/search", urls[0][0])
        self.assertIn("region=py", urls[0][0])
        self.assertEqual(urls[0][1], {"x-api-key": "k"})
        m.buscar("cde", "pensionato")
        self.assertEqual(len(urls), 1)
        self.assertEqual(m.buscar("remoto", "pensionato")["locais"], [])
