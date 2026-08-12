-- Dashboard Meta Ads — schema inicial
-- Ver especificação completa no documento de arquitetura (artifact publicado no chat).

-- ============================================================
-- Tabelas alimentadas pela Meta (somente leitura para o usuário)
-- ============================================================

CREATE TABLE meta_ad_accounts (
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
CREATE TABLE campaigns (
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

CREATE TABLE adsets (
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

CREATE TABLE ads (
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
CREATE TABLE campaign_insights_daily (
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
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (campaign_id, adset_id, ad_id, date)
);

-- Leads nativos da Meta (Lead Ads) — só populada se o Caminho A estiver em uso
CREATE TABLE meta_leads (
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

CREATE TABLE patient_leads (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  meta_lead_id INTEGER REFERENCES meta_leads(id),
  patient_name TEXT NOT NULL,
  phone TEXT,
  source_channel TEXT NOT NULL DEFAULT 'whatsapp'
    CHECK (source_channel IN ('meta_lead_form', 'whatsapp', 'site', 'indicacao', 'evento', 'outro')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled BOOLEAN NOT NULL DEFAULT false,
  scheduled_at TIMESTAMPTZ,
  attended BOOLEAN NOT NULL DEFAULT false,
  attended_at TIMESTAMPTZ,
  closed BOOLEAN NOT NULL DEFAULT false,
  closed_at TIMESTAMPTZ,
  sale_value NUMERIC(10,2),
  notes TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE manual_daily_spend (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  date DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  entered_by TEXT,
  entered_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (campaign_id, date)
);

CREATE TABLE sync_logs (
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
CREATE INDEX idx_insights_date ON campaign_insights_daily(date);
CREATE INDEX idx_insights_campaign ON campaign_insights_daily(campaign_id);
CREATE INDEX idx_patient_leads_campaign ON patient_leads(campaign_id);
CREATE INDEX idx_patient_leads_received ON patient_leads(received_at);
