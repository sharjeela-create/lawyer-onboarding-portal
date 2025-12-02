-- Migration: Add accident and contact-related fields to `daily_deal_flow` table
-- Generated: 2025-12-02

BEGIN;

ALTER TABLE public.daily_deal_flow
  ADD COLUMN IF NOT EXISTS accident_date DATE,
  ADD COLUMN IF NOT EXISTS prior_attorney_involved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS prior_attorney_details TEXT,
  ADD COLUMN IF NOT EXISTS medical_attention TEXT,
  ADD COLUMN IF NOT EXISTS police_attended BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS accident_location TEXT,
  ADD COLUMN IF NOT EXISTS accident_scenario TEXT,
  ADD COLUMN IF NOT EXISTS insured BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS injuries TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_registration TEXT,
  ADD COLUMN IF NOT EXISTS insurance_company TEXT,
  ADD COLUMN IF NOT EXISTS third_party_vehicle_registration TEXT,
  ADD COLUMN IF NOT EXISTS other_party_admit_fault BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS passengers_count INTEGER,
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_number TEXT,
  ADD COLUMN IF NOT EXISTS contact_address TEXT;

COMMIT;