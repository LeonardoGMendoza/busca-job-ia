# BuscaJob IA

**PT** · App para quem quer trabalhar enquanto estuda (pensado para estudantes de medicina no Paraguai, na Argentina e no Peru, mas serve para qualquer pessoa). Você fala com a atendente 3D, por exemplo "quero trabalhar de garçom em Buenos Aires à noite", e o app abre a busca já filtrada nos sites de emprego reais de cada país. Também mostra as vagas das empresas parceiras e, com o servidor ligado, vagas remotas do dia.
**ES** · App para trabajar mientras estudias: hablas con la asistente 3D y abre la búsqueda filtrada en los sitios de empleo reales de cada país.
**EN** · Talk to a 3D assistant and it opens filtered searches on each country's real job sites, plus partner and remote jobs.

> O app **não inventa vagas**. As vagas de parceiros em `backend/app/vagas.json` são **de exemplo** (`"exemplo": true`) e aparecem com aviso até você publicar vagas reais.

## Onde busca

| País | Cidades | Sites |
| --- | --- | --- |
| 🇧🇷 Brasil | Foz do Iguaçu, Ponta Porã, São Borja | Indeed, LinkedIn, Google Vagas |
| 🇵🇾 Paraguai | Ciudad del Este, Asunción | Computrabajo, LinkedIn, Google Vagas |
| 🇦🇷 Argentina | Buenos Aires, La Plata, Córdoba, Mar del Plata, Rosario, Mendoza | Computrabajo, Indeed, LinkedIn, Google Vagas |
| 🇵🇪 Peru | Lima | Computrabajo, Indeed, LinkedIn, Google Vagas |
| 🌎 Home office | mundo | LinkedIn (remoto), We Work Remotely, Remote OK, Google Vagas |

Áreas: TI/Dev, enfermagem, cuidador(a), garçom, cozinha, limpeza/Airbnb, eventos, atendimento, vendas, entregas, aulas particulares, ensinar português, marketing digital. Horário: qualquer, meio período, fim de semana, à noite.
O termo de busca vai no idioma do país (português no Brasil, espanhol no Paraguai/Argentina/Peru, inglês no remoto). Para adicionar cidade, área ou site, edite `backend/app/catalogo.json` e copie para `web/catalogo.json`.

## Vagas reais dentro do app

Com o servidor ligado e uma chave configurada, o app mostra as vagas de verdade (título, empresa, cidade, salário quando houver e "Candidatar-se"):

- **JSearch** (Google Vagas, que junta LinkedIn, Indeed, Glassdoor e sites das empresas): crie a chave grátis em openwebninja.com (200 buscas/mês) e coloque em `JSEARCH_KEY`. Se usar pelo RapidAPI, ponha também `JSEARCH_PROVEDOR=rapidapi`.
- **Jooble** (API oficial e gratuita): uma chave por país (`JOOBLE_KEY_BR`, `JOOBLE_KEY_AR`, `JOOBLE_KEY_PE`, `JOOBLE_KEY_PY`), pedida em `https://<país>.jooble.org/api/about`.

Cada busca fica 6 horas em cache, para gastar pouca cota. Rota: `GET /api/buscar?cidade=&area=&livre=&periodo=`.
Não usamos robôs no Indeed/LinkedIn/Computrabajo (os termos deles proíbem): só APIs que liberam os dados.

## Nota de compatibilidade no site (para qualquer área)

Em **Vagas**, o cartão **"Meu perfil"** pede as habilidades (ex.: *UTI, curativos, COREN* para enfermagem; *C#, .NET, SQL Server* para TI), o nível e se aceita remoto. As vagas reais passam a aparecer **ordenadas pela compatibilidade** (0 a 100%), com o que combina e alertas (nível acima/abaixo, local fora da cidade). O perfil fica só no navegador (`localStorage`), nada é enviado ao servidor.

- A nota soma: título da vaga com a profissão buscada (30), habilidades que aparecem na vaga (45), nível (15) e local/remoto (10). Código em `frontend/src/compat.js`; testes: `cd frontend && npm test`.
- É uma estimativa pelo título e pelo resumo; a pessoa deve ler a vaga completa antes de se candidatar.
- Depois de mexer no site: `cd frontend && npm run build`, depois `git add . && git commit && git push` (a pasta `web/` é a publicada). O servidor também precisa de `git pull` e novo `docker build` (a API agora devolve mais texto da vaga).

## Busca de vagas .NET com nota de compatibilidade (uso pessoal)

Script que procura vagas de desenvolvedor .NET (remotas e em Foz do Iguaçu), compara com o perfil do Leonardo e gera uma planilha ordenada da melhor para a pior. **Não se candidata sozinho**: você abre o link e envia o currículo.

```bash
cd backend
pip install -r requirements.txt
copy .env.example .env            # coloque JSEARCH_KEY (e/ou JOOBLE_KEY_BR)
python buscar_dev.py              # gera saida/vagas_AAAA-MM-DD.xlsx e .csv
python buscar_dev.py --dias 7     # só vagas dos últimos 7 dias
python buscar_dev.py --arquivo vaga.txt   # nota de UMA vaga colada (LinkedIn, e-mail do RH...)
python -m unittest discover tests
```

- A nota (0 a 100) soma: título (30), tecnologias que casam (45), nível pleno (15) e local/remoto (10). A planilha mostra o que **casou**, o que **falta** (Kubernetes, AWS, Kafka...) e **alertas** (sênior, inglês fluente, presencial longe, stack diferente).
- Ajuste pesos, buscas e cidade em `backend/perfil_leonardo.json`. Coluna `status` fica livre para você marcar enviado, entrevista etc.
- Usa só APIs que liberam os dados (JSearch e Jooble), sem robô no LinkedIn/Indeed.

## Moradia para estudantes (aba "Moradia")

- **Locais reais** (pensionatos, residências estudantis, imobiliárias) com endereço, telefone, nota e mapa, vindos do Google Maps pela API **Local Business Data** da OpenWeb Ninja — usa a mesma chave (`JSEARCH_KEY`), mas é preciso ativar o plano grátis dessa API no painel. Rota: `GET /api/moradia?cidade=&tipo=` (cache 24 h).
- **Portais de aluguel** de cada país (OLX, ZAP, Viva Real, InfoCasas, Clasipar, Facebook Marketplace, ZonaProp, Argenprop, Mercado Libre, Urbania, Adondevivir, Airbnb), com a busca pronta.
- Aviso contra golpes (nunca pagar sinal antes de visitar e assinar contrato).

## Premium (lista de espera)

Botão **Premium** no topo e cartão na aba Vagas: ainda não cobra nada, só registra quem tem interesse (`POST /api/interesse`) e o contato opcional. Veja os números em `GET /api/cliques` (com `x-token`).

## O que vem dos outros projetos

- **Atendente 3D que fala** (TalkingHead, igual StudentMedical/HablaPY/CambioFronteira), conversa por voz em PT/ES/EN.
- **Volume no iPhone** (sessão de áudio volta para o alto-falante principal depois do microfone).
- **Propagandas do UniRideX**: carrossel (Enfermeira Feridas, Serenya, Doutor Feridas, "Sua empresa contratando?") e "Uniformes & Faculdades" (UCP, UMAX).
- **Cliques contados** (sites, anúncios, vagas) para mostrar aos parceiros.
- **IA da Oracle** no servidor (opcional): entende frases livres e responde curto, sem inventar vaga.

## Site em React (pasta `frontend/`)

O site é feito em **React 19 + Vite** (igual aos outros projetos). O código fica em `frontend/src` e o build vai para `web/`, que é a pasta publicada no GitHub Pages.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173/?api=   (o "?api=" vazio usa só o navegador, sem servidor)
npm run build      # gera ../web — depois é só git add/commit/push
```

A assistente 3D (TalkingHead) fica em `frontend/public/assistente/` e carrega fora do pacote do React.

## Rodar o servidor no PC

```bash
cd web && python -m http.server 5500      # abra http://localhost:5500/?api=
cd backend && pip install -r requirements.txt && copy .env.example .env
uvicorn app.main:app --reload --port 8000  # site: http://localhost:5500/?api=http://localhost:8000
python -m unittest discover tests
```

## Publicar uma vaga de parceiro

```bash
curl -X PUT http://localhost:8000/api/vagas/bar-centro-1 -H "x-token: SEU_BJ_TOKEN" -H "Content-Type: application/json" \
  -d '{"empresa":"Bar Centro","titulo":{"pt":"Garçom à noite","es":"Mozo de noche"},"cidade":"cde","area":"garcom","periodo":"noite","contato":"595981000000","exemplo":false}'
```

## API

| Método | Rota | O que faz |
| --- | --- | --- |
| POST | `/api/perguntar` `{texto, idioma, cidade, area, periodo}` | entende o pedido (IA ou regra) |
| GET | `/api/vagas?cidade=&area=` | vagas de parceiros |
| PUT / DELETE | `/api/vagas/{id}` (header `x-token`) | publica / remove vaga |
| GET | `/api/remotas?q=` | vagas remotas do Remote OK (cache 6 h, com crédito) |
| POST | `/api/clique` · GET `/api/cliques` | conta e mostra cliques |

Aviso no app: o BuscaJob IA não é agência; nunca pague para conseguir vaga. Estudante estrangeiro deve confirmar se o visto/radicação permite trabalhar.
