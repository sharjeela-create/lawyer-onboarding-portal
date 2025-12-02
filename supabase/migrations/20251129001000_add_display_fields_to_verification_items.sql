-- Migration: Add display/order fields to verification_items
-- Generated: 2025-11-29

BEGIN;

ALTER TABLE public.verification_items
  ADD COLUMN IF NOT EXISTS display_label TEXT,
  ADD COLUMN IF NOT EXISTS display_order INTEGER;

COMMIT;

-- Notes:
-- `display_label` can be used to show a friendly label in the verification UI.
-- `display_order` can be used to sort verification items (lower = earlier/top).
