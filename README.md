# SOSISP

Monitoramento de tráfego de provedores de internet (equipamentos Huawei) com login e 3 níveis de acesso.
Next.js + TypeScript + Tailwind + shadcn/ui + Prisma + MySQL, coletor NetFlow/IPFIX com pmacct.

| Nível         | Acessa     | Observação                |
| ------------- | ---------- | ------------------------- |
| Administrador | `/admin`   | usuários e cor do tema    |
| Usuário       | `/sistema` | monitoramento de tráfego  |
| Convidado     | `/sistema` | somente leitura           |

Quem tenta abrir uma rota de outro nível é redirecionado para a sua própria; sem login, vai para `/login`.

## Deploy (Docker em Debian 13 ou Dokploy)

O arquivo `docker-compose.prod.yml` sobe **app + MySQL + coletor NetFlow**. As migrações e o administrador
inicial são criados automaticamente na primeira subida.

### Docker em Debian 13

```bash
# 1. Docker (se ainda não tiver): https://docs.docker.com/engine/install/debian/
# repositório privado: use um deploy key (SSH) ou um token de acesso (HTTPS)
git clone git@github.com:jrdecezere/monix-netflowspec.git sosisp && cd sosisp

# 2. Configuração
cp .env.example .env
nano .env          # preencha MYSQL_*, SESSION_SECRET, ADMIN_EMAIL e ADMIN_PASSWORD

# 3. Subir
docker compose -f docker-compose.prod.yml up -d --build
```

- O app escuta em `127.0.0.1:3000`. Coloque um proxy reverso com HTTPS na frente (Caddy, Nginx, Traefik).
  Sem HTTPS o login não funciona; para um teste por HTTP puro use `SESSION_COOKIE_SECURE=false` e `APP_BIND=0.0.0.0`.
- O MySQL **não** é publicado no host.
- Libere `2055/udp` **só para os IPs dos roteadores**, por exemplo:

```bash
sudo ufw allow from <IP-DO-ROTEADOR> to any port 2055 proto udp
```

### Dokploy

1. *Create Service → Compose*, provider Git, repositório e branch deste projeto.
2. *Compose Path*: `docker-compose.prod.yml`.
3. Aba *Environment*: preencha as variáveis de `.env.example` (as de "Produção").
4. Aba *Domains*: adicione o domínio ao serviço `app`, porta `3000`, com HTTPS (Let's Encrypt).
5. *Deploy*. A porta `2055/udp` do coletor é publicada direto no host; restrinja-a no firewall do servidor.

### Atualizar

```bash
git pull && docker compose -f docker-compose.prod.yml up -d --build
```

## Monitoramento de tráfego

Roteadores Huawei exportam NetStream/NetFlow para `<IP do servidor>:2055/udp`. O **pmacct** (`nfacctd`) normaliza pela
taxa de amostragem, agrega em baldes de 1 minuto e grava no MySQL (`flow_dst`, `flow_src_port`, retenção de 7 dias).
O painel em `/sistema` lê essas tabelas.

Configuração do roteador e validação com equipamento real: [docs/fase-0-huawei.md](docs/fase-0-huawei.md).
O modelo do coletor é `pmacct/nfacctd.conf` (UTF-8 **sem BOM**, senão o pmacct não inicia).
Para testar sem roteador: `node tools/netflow-gen.mjs --seconds 120 --attack ntp` (`ntp | dns | memcached | syn`).

## Desenvolvimento

```bash
docker compose up -d                 # MySQL (porta 3307) + coletor
cp .env.example .env                 # use a DATABASE_URL e SEED_DEMO=true de desenvolvimento
npm install
npx prisma migrate deploy && npx prisma generate
npx prisma db seed                   # com SEED_DEMO=true cria as contas de demonstração
npm run dev                          # http://localhost:3000
```

Contas de demonstração (só com `SEED_DEMO=true`; nunca em produção):
`admin@sosisp.local`, `usuario@sosisp.local`, `convidado@sosisp.local`
(senhas em `prisma/seed.ts`).

## Estrutura

- `src/proxy.ts` — redirecionamento rápido por nível (lê o cookie JWT).
- `src/lib/dal.ts` — verificação definitiva no servidor (relê o usuário no banco: excluído/inativo perde acesso na hora). Use `requireAccess` nas páginas e `requireRole` nas Server Actions.
- `src/lib/roles.ts` — mapa de níveis → rotas permitidas.
- `src/lib/traffic.ts` — consultas das tabelas de fluxo.
- `src/app/admin` — gestão de usuários (criar, editar, excluir) e tema.
- `src/app/sistema` — painel de tráfego (Usuário/Convidado). Para ações de escrita, valide com `requireRole("USER")`.
- `pmacct/` — configuração do coletor. `Dockerfile` e `docker-compose*.yml` — deploy.
