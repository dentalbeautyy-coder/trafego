-- Dashboard Meta Ads — schema inicial
-- Ver especificação completa no documento de arquitetura (artifact publicado no chat).

-- ============================================================
-- Tabelas alimentadas pela Meta (somente leitura para o usuário)
-- ============================================================

CREATE TABLE IF NOT EXISTS meta_ad_accounts (
  id SERIAL PRIMARY KEY,
  meta_account_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  timezone TEXT,
  access_token_ref TEXT, -- referência/id do segredo (nunca o token em texto puro)
  connected_at TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active'
);

-- Campanhas: mistura linhas vindas da Meta com linhas criadas manualmente
CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('meta', 'manual')),
  meta_campaign_id TEXT UNIQUE, -- só preenchido se source = 'meta'
  ad_account_id INTEGER REFERENCES meta_ad_accounts(id),
  name TEXT NOT NULL,
  objective TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  daily_budget NUMERIC(10,2),
  lifetime_budget NUMERIC(10,2),
  created_time TIMESTAMPTZ,
  updated_time TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_by TEXT, -- quem criou, se manual
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS adsets (
  id SERIAL PRIMARY KEY,
  meta_adset_id TEXT UNIQUE,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT,
  targeting_summary TEXT,
  daily_budget NUMERIC(10,2),
  created_time TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ads (
  id SERIAL PRIMARY KEY,
  meta_ad_id TEXT UNIQUE,
  adset_id INTEGER NOT NULL REFERENCES adsets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT,
  creative_thumbnail_url TEXT,
  created_time TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ
);

-- Métricas diárias — granularidade fina, nunca sobrescrita às cegas (upsert por chave única)
CREATE TABLE IF NOT EXISTS campaign_insights_daily (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  adset_id INTEGER REFERENCES adsets(id) ON DELETE CASCADE,
  ad_id INTEGER REFERENCES ads(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  spend NUMERIC(10,2) DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  reach BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cpc NUMERIC(10,4),
  cpm NUMERIC(10,4),
  ctr NUMERIC(6,4),
  frequency NUMERIC(6,4),
  results BIGINT DEFAULT 0, -- "Resultados" da Meta: conversas iniciadas por mensagem, extraído de actions
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- Coluna adicionada depois da criação inicial da tabela — ALTER separado para
-- funcionar em bancos que já tinham a tabela sem essa coluna.
ALTER TABLE campaign_insights_daily ADD COLUMN IF NOT EXISTS results BIGINT DEFAULT 0;

-- IMPORTANTE: NULL nunca é igual a NULL para efeito de UNIQUE no Postgres — uma
-- constraint UNIQUE(campaign_id, adset_id, ad_id, date) direta NÃO evita duplicidade
-- quando adset_id/ad_id são NULL (linhas em nível de campanha). Cada sincronização
-- manual repetida inseria uma linha nova em vez de atualizar, multiplicando o
-- investimento e os cliques reportados. Corrigido com um índice único por expressão,
-- tratando NULL como 0 (nenhum registro de anúncio/conjunto real tem id 0).

-- Remove duplicatas já inseridas antes da correção, mantendo a linha mais recente de cada grupo.
DELETE FROM campaign_insights_daily a USING campaign_insights_daily b
WHERE a.id < b.id
  AND a.campaign_id = b.campaign_id
  AND COALESCE(a.adset_id, 0) = COALESCE(b.adset_id, 0)
  AND COALESCE(a.ad_id, 0) = COALESCE(b.ad_id, 0)
  AND a.date = b.date;

-- Remove a constraint antiga (com o nome padrão que o Postgres gerou para o UNIQUE inline).
ALTER TABLE campaign_insights_daily
  DROP CONSTRAINT IF EXISTS campaign_insights_daily_campaign_id_adset_id_ad_id_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_insights_dedup ON campaign_insights_daily (
  campaign_id, COALESCE(adset_id, 0), COALESCE(ad_id, 0), date
);

-- Leads nativos da Meta (Lead Ads) — só populada se o Caminho A estiver em uso
CREATE TABLE IF NOT EXISTS meta_leads (
  id SERIAL PRIMARY KEY,
  meta_leadgen_id TEXT NOT NULL UNIQUE,
  campaign_id INTEGER REFERENCES campaigns(id),
  adset_id INTEGER REFERENCES adsets(id),
  ad_id INTEGER REFERENCES ads(id),
  full_name TEXT,
  phone TEXT,
  email TEXT,
  raw_field_data JSONB,
  created_time TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Tabelas de preenchimento manual — o funil de verdade
-- ============================================================

-- Nunca teve dado real cadastrado — substituída pelo modelo de contadores por anúncio abaixo.
DROP TABLE IF EXISTS patient_leads;

-- Contadores acumulados por anúncio (não por paciente individual, não quebrado por dia).
-- "leads_from_meta" é automático (contagem de meta_leads, só populado se o Caminho A —
-- formulário nativo — estiver em uso); os demais campos são sempre preenchidos manualmente
-- pela equipe, e vão sendo somados/atualizados ao longo do tempo.
CREATE TABLE IF NOT EXISTS ad_manual_funnel (
  id SERIAL PRIMARY KEY,
  ad_id INTEGER NOT NULL UNIQUE REFERENCES ads(id) ON DELETE CASCADE,
  leads_arrived INTEGER NOT NULL DEFAULT 0,   -- chegaram de fato na conversa (WhatsApp etc.)
  scheduled_count INTEGER NOT NULL DEFAULT 0,
  closed_count INTEGER NOT NULL DEFAULT 0,
  sale_value_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS manual_daily_spend (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  date DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  entered_by TEXT,
  entered_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (campaign_id, date)
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id SERIAL PRIMARY KEY,
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('manual_button', 'cron_08h')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
  campaigns_synced INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_skipped_duplicate INTEGER DEFAULT 0,
  error_message TEXT
);

-- Índices de apoio para os filtros do dashboard (período + campanha)
CREATE INDEX IF NOT EXISTS idx_insights_date ON campaign_insights_daily(date);
CREATE INDEX IF NOT EXISTS idx_insights_campaign ON campaign_insights_daily(campaign_id);
