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
