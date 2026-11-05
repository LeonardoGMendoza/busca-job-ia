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
