-- Add accident-related fields and carrier attempted fields to call_results table
-- This migration adds all the accident information fields that were previously only in leads/daily_deal_flow
-- Plus the carrier_attempted fields for GI - Currently DQ status tracking

ALTER TABLE public.call_results
  -- Accident date and location
  ADD COLUMN IF NOT EXISTS accident_date DATE,
  ADD COLUMN IF NOT EXISTS accident_location TEXT,
  ADD COLUMN IF NOT EXISTS accident_scenario TEXT,
  
  -- Injury and medical information
  ADD COLUMN IF NOT EXISTS injuries TEXT,
  ADD COLUMN IF NOT EXISTS medical_attention TEXT,
  
  -- Police and insurance information
  ADD COLUMN IF NOT EXISTS police_attended BOOLEAN,
  ADD COLUMN IF NOT EXISTS insured BOOLEAN,
  
  -- Vehicle and insurance details
  ADD COLUMN IF NOT EXISTS vehicle_registration TEXT,
  ADD COLUMN IF NOT EXISTS insurance_company TEXT,
  ADD COLUMN IF NOT EXISTS third_party_vehicle_registration TEXT,
  
  -- Fault and witnesses
  ADD COLUMN IF NOT EXISTS other_party_admit_fault BOOLEAN,
  ADD COLUMN IF NOT EXISTS passengers_count INTEGER,
  
  -- Attorney information
  ADD COLUMN IF NOT EXISTS prior_attorney_involved BOOLEAN,
  ADD COLUMN IF NOT EXISTS prior_attorney_details TEXT,
  
  -- Carrier attempted fields (for GI - Currently DQ status)
  ADD COLUMN IF NOT EXISTS carrier_attempted_1 TEXT,
  ADD COLUMN IF NOT EXISTS carrier_attempted_2 TEXT,
  ADD COLUMN IF NOT EXISTS carrier_attempted_3 TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.call_results.accident_date IS 'Date when the accident/incident occurred';
COMMENT ON COLUMN public.call_results.accident_location IS 'Location where the accident took place';
COMMENT ON COLUMN public.call_results.accident_scenario IS 'Description of how the accident happened';
COMMENT ON COLUMN public.call_results.injuries IS 'Description of injuries sustained';
COMMENT ON COLUMN public.call_results.medical_attention IS 'Type of medical attention received';
COMMENT ON COLUMN public.call_results.police_attended IS 'Whether police attended the scene';
COMMENT ON COLUMN public.call_results.insured IS 'Whether the person was insured at the time';
COMMENT ON COLUMN public.call_results.vehicle_registration IS 'Vehicle registration number';
COMMENT ON COLUMN public.call_results.insurance_company IS 'Name of the insurance company';
COMMENT ON COLUMN public.call_results.third_party_vehicle_registration IS 'Third party vehicle registration';
COMMENT ON COLUMN public.call_results.other_party_admit_fault IS 'Whether the other party admitted fault';
COMMENT ON COLUMN public.call_results.passengers_count IS 'Number of passengers in the vehicle';
COMMENT ON COLUMN public.call_results.prior_attorney_involved IS 'Whether an attorney was previously involved';
COMMENT ON COLUMN public.call_results.prior_attorney_details IS 'Details about the prior attorney';
COMMENT ON COLUMN public.call_results.carrier_attempted_1 IS 'First carrier attempted for GI - Currently DQ status';
COMMENT ON COLUMN public.call_results.carrier_attempted_2 IS 'Second carrier attempted for GI - Currently DQ status';
COMMENT ON COLUMN public.call_results.carrier_attempted_3 IS 'Third carrier attempted for GI - Currently DQ status';
