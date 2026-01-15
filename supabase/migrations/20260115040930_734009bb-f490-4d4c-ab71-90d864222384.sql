-- Adicionar campos para rastrear os totais do dia anterior (para calcular diferença diária)
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS last_day_total_entries integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_day_total_exits integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reset_date date DEFAULT CURRENT_DATE;

-- Atualizar registros existentes com os valores atuais
UPDATE public.groups
SET 
  last_day_total_entries = total_entries,
  last_day_total_exits = total_exits,
  last_reset_date = CURRENT_DATE;