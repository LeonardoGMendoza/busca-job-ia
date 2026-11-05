# Subir a API do BuscaJob IA na VPS (para a atendente usar a IA da Oracle)

Mesmo padrão dos outros projetos: Docker em 127.0.0.1, Nginx na frente, DNS no Cloudflare.
Porta sugerida: **8070** (confira antes se está livre: `ss -ltnp | grep 8070`). Domínio: **buscajob.sandlj.com.br**.

1. **Cloudflare**: crie o registro `A` `buscajob` apontando para o IP da VPS (proxy laranja ligado).

2. **Na VPS**:
   ```bash
   cd /opt && git clone https://github.com/LeonardoGMendoza/busca-job-ia.git && cd busca-job-ia/backend
   cp .env.example .env
   nano .env   # cole as MESMAS chaves OCI do StudentMedical/VinaCare e crie um BJ_TOKEN (senha para publicar vagas)
   docker build -t busca-job-ia .
   docker run -d --name busca-job-ia --restart always --env-file .env \
     -v busca-job-ia-data:/srv/data -p 127.0.0.1:8070:8000 busca-job-ia
   curl -s http://127.0.0.1:8070/api/saude      # tem que mostrar "ia": true
   ```

3. **Nginx**:
   ```bash
   cp /opt/busca-job-ia/deploy/nginx-buscajob.conf /etc/nginx/sites-available/buscajob
   ln -s /etc/nginx/sites-available/buscajob /etc/nginx/sites-enabled/buscajob
   nginx -t && systemctl reload nginx
   curl -s https://buscajob.sandlj.com.br/api/saude
   ```

4. Pronto: o site do GitHub Pages já aponta para `https://buscajob.sandlj.com.br`. Quando a API responde, a atendente passa a usar a IA da Oracle e aparecem as vagas remotas do dia.

**Atualizar depois:** `cd /opt/busca-job-ia && git pull && cd backend && docker build -t busca-job-ia . && docker rm -f busca-job-ia && docker run ...` (o mesmo `docker run` do passo 2).

Para testar a IA sem a VPS, no PC: rode o backend (`uvicorn app.main:app --port 8000`) e abra o site com `?api=http://localhost:8000`.
