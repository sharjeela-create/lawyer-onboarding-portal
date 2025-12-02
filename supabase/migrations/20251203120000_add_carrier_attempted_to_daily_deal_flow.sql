-- Migration: Add carrier_attempted fields to daily_deal_flow table
-- Generated: 2025-12-03
-- These fields track which carriers were attempted for GI - Currently DQ status

BEGIN;

ALTER TABLE public.daily_deal_flow
  ADD COLUMN IF NOT EXISTS carrier_attempted_1 TEXT,
  ADD COLUMN IF NOT EXISTS carrier_attempted_2 TEXT,
  ADD COLUMN IF NOT EXISTS carrier_attempted_3 TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.daily_deal_flow.carrier_attempted_1 IS 'First carrier attempted for GI - Currently DQ status';
COMMENT ON COLUMN public.daily_deal_flow.carrier_attempted_2 IS 'Second carrier attempted for GI - Currently DQ status';
COMMENT ON COLUMN public.daily_deal_flow.carrier_attempted_3 IS 'Third carrier attempted for GI - Currently DQ status';

COMMIT;
