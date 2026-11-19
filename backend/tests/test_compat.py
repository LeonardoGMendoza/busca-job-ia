import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.compat import carregar_perfil, pontuar, ranquear  # noqa: E402

PERFIL = carregar_perfil()


def vaga(titulo, desc="", local="Brasil", remoto=True, **extra):
    return {"titulo": titulo, "descricao": desc, "local": local, "remoto": remoto, "link": "https://exemplo.com/" + titulo, "empresa": "X", **extra}


class TestCompat(unittest.TestCase):
    def test_vaga_ideal_tem_nota_alta(self):
        r = pontuar(vaga("Desenvolvedor .NET Pleno", "C#, ASP.NET Core, SQL Server, RabbitMQ, Docker, microsserviços, Azure DevOps, Entity Framework, REST"), PERFIL)
        self.assertGreaterEqual(r["nota"], 85)
        self.assertEqual(r["faixa"], "Alta")
        self.assertIn("rabbitmq", r["casou"])

    def test_stack_diferente_fica_baixa(self):
        r = pontuar(vaga("Desenvolvedor Java Pleno", "Spring Boot, Kafka, AWS, Kubernetes"), PERFIL)
        self.assertLessEqual(r["nota"], 25)
        self.assertEqual(r["faixa"], "Baixa")
        self.assertTrue(any("Stack" in a for a in r["alertas"]))
        self.assertIn("kafka", r["faltou"])

    def test_senior_e_junior_geram_alerta_e_perdem_ponto(self):
        d = "C#, .NET, SQL Server"
        pleno = pontuar(vaga("Desenvolvedor .NET Pleno", d), PERFIL)["nota"]
        self.assertLess(pontuar(vaga("Desenvolvedor .NET Sênior", d), PERFIL)["nota"], pleno)
        self.assertLess(pontuar(vaga("Estágio .NET", d), PERFIL)["nota"], pleno)

    def test_presencial_longe_perde_e_foz_nao(self):
        d = "C#, .NET, SQL Server, Docker"
        longe = pontuar(vaga("Desenvolvedor .NET Pleno", d, local="Recife PE", remoto=False), PERFIL)
        foz = pontuar(vaga("Desenvolvedor .NET Pleno", d, local="Foz do Iguaçu PR", remoto=False), PERFIL)
        self.assertGreater(foz["nota"], longe["nota"])
        self.assertTrue(any("Presencial" in a for a in longe["alertas"]))

    def test_pleno_junto_com_senior_ou_junior_conta_como_pleno(self):
        d = "C#, .NET, SQL Server"
        base = pontuar(vaga("Desenvolvedor .NET Pleno", d), PERFIL)["nota"]
        for t in ("Desenvolvedor .NET Pleno/Sênior", "Desenvolvedor .NET Júnior/Pleno"):
            r = pontuar(vaga(t, d), PERFIL)
            self.assertEqual(r["nota"], base)
            self.assertEqual(r["alertas"], [])

    def test_sem_csharp_nem_dotnet_nunca_e_alta(self):
        r = pontuar(vaga("Desenvolvedor Python/Go Lang Pleno", "Python, RabbitMQ, Docker, microsserviços, Azure DevOps, REST, Git"), PERFIL)
        self.assertLessEqual(r["nota"], 60)
        self.assertNotEqual(r["faixa"], "Alta")

    def test_ingles_avancado_alerta(self):
        r = pontuar(vaga("Desenvolvedor .NET", "C#. Inglês fluente obrigatório."), PERFIL)
        self.assertTrue(any("inglês" in a.lower() for a in r["alertas"]))

    def test_ranking_dedup_filtro_de_dias_e_ordem(self):
        hoje = date(2026, 11, 18)
        vagas = [vaga("Desenvolvedor .NET Pleno", "C# .NET SQL Server Docker", data="2026-11-17"),
                 vaga("Desenvolvedor .NET Pleno", "C# .NET", data="2026-11-17"),          # repetida
                 vaga("Analista Java", "Spring", data="2026-11-17"),
                 vaga("Desenvolvedor C# Pleno", "C# .NET", data="2026-09-01"),           # velha
                 {"titulo": "Sem link", "descricao": "C#"}]
        r = ranquear(vagas, PERFIL, dias=14, hoje=hoje)
        self.assertEqual([v["titulo"] for v in r], ["Desenvolvedor .NET Pleno", "Analista Java"])
        self.assertGreater(r[0]["nota"], r[1]["nota"])


if __name__ == "__main__":
    unittest.main()
