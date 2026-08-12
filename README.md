# Dashboard Meta Ads — Clínica

Backend inicial da integração Meta Ads + funil manual de leads/agendamentos/fechamentos.
Especificação completa da arquitetura: ver o documento publicado no chat (`dashboard-meta-ads-arquitetura`).

## Status atual

- [x] Schema do banco (`backend/db/schema.sql`)
- [x] Sincronização com a Meta Graph API (campanhas, conjuntos, anúncios, insights diários) — idempotente
- [x] Cron diário às 08:00 (horário de Brasília) + botão de sincronização manual (`POST /api/sync/run`)
- [x] Endpoints do funil manual (leads, agendamento, comparecimento, fechamento, valor vendido)
- [x] Cálculo de métricas (CPL, CPA, CAC, ROI, taxas de conversão)
- [x] Campanhas manuais (indicação, evento) sem sync automático
- [ ] Frontend (telas do dashboard) — próximo passo
- [ ] Login da equipe
- [ ] Deploy no Render

## Rodar localmente

Pré-requisito: Node.js 20+ instalado, e um Postgres (local ou já criado no Render).

```bash
cd backend
npm install
cp .env.example .env
# edite o .env com DATABASE_URL, META_APP_ID, META_APP_SECRET, META_SYSTEM_USER_TOKEN, META_AD_ACCOUNT_ID
npm run migrate   # aplica o schema.sql no banco
npm run dev       # sobe o servidor em http://localhost:3001
```

Teste rápido:

```bash
curl http://localhost:3001/health
curl -X POST http://localhost:3001/api/sync/run
curl "http://localhost:3001/api/metrics?from=2026-08-01&to=2026-08-12"
```

## Endpoints principais

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/campaigns` | Lista campanhas (Meta + manuais) |
| POST | `/api/campaigns/manual` | Cria campanha manual (indicação, evento) |
| GET | `/api/leads` | Lista leads/pacientes do funil |
| POST | `/api/leads` | Cadastra um novo lead, vinculado a uma campanha |
| PATCH | `/api/leads/:id` | Atualiza etapas do funil (scheduled/attended/closed/sale_value) |
| POST | `/api/spend` | Registra investimento diário manual de uma campanha |
| POST | `/api/sync/run` | Dispara sincronização manual com a Meta |
| GET | `/api/sync/logs` | Histórico de sincronizações |
| GET | `/api/metrics?from=&to=&campaignId=` | Métricas calculadas por período |

## Deploy no Render

1. Crie um banco **PostgreSQL** no Render — copie a `Internal Database URL`.
2. Crie um **Web Service** apontando para a pasta `backend/` deste repositório (root directory: `backend`).
   - Build command: `npm install`
   - Start command: `npm start`
3. Em "Environment", cole as mesmas variáveis do `.env.example` (a `DATABASE_URL` é a do passo 1).
4. Após o primeiro deploy, rode a migração uma vez via o "Shell" do próprio serviço no Render: `npm run migrate`.
5. O cron das 8h já roda dentro do próprio processo (`node-cron`), sem precisar de um cron job separado do Render — só o serviço precisa ficar sempre ativo (planos gratuitos do Render "dormem" após inatividade, o que quebraria o cron; para produção real, use um plano pago ou o "Cron Job" nativo do Render chamando `POST /api/sync/run`).

## Segurança

- Nunca commitar `.env` (já está no `.gitignore`).
- O `META_SYSTEM_USER_TOKEN` só existe como variável de ambiente — nunca em código, nunca em chat.
