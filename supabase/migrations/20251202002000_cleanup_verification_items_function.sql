-- Migration: Clean up initialize_verification_items to match actual leads table schema
-- Generated: 2025-12-02
-- Removes fields that don't exist in leads table

BEGIN;

CREATE OR REPLACE FUNCTION public.initialize_verification_items(session_id_param uuid, submission_id_param text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  lead_record public.leads%ROWTYPE;
BEGIN
  -- Get the lead data
  SELECT * INTO lead_record FROM public.leads WHERE submission_id = submission_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found with submission_id: %', submission_id_param;
  END IF;
  
  -- Insert verification items ONLY for fields that exist in leads table
  INSERT INTO public.verification_items (session_id, field_name, field_category, original_value) VALUES
    -- Personal Information
    (session_id_param, 'customer_full_name', 'personal', lead_record.customer_full_name),
    (session_id_param, 'date_of_birth', 'personal', lead_record.date_of_birth::TEXT),
    (session_id_param, 'birth_state', 'personal', lead_record.birth_state),
    (session_id_param, 'age', 'personal', lead_record.age::TEXT),
    (session_id_param, 'social_security', 'personal', lead_record.social_security),
    (session_id_param, 'driver_license', 'personal', lead_record.driver_license),
    
    -- Contact Information
    (session_id_param, 'street_address', 'contact', lead_record.street_address),
    (session_id_param, 'city', 'contact', lead_record.city),
    (session_id_param, 'state', 'contact', lead_record.state),
    (session_id_param, 'zip_code', 'contact', lead_record.zip_code),
    (session_id_param, 'phone_number', 'contact', lead_record.phone_number),
    (session_id_param, 'email', 'contact', lead_record.email),
    
    -- Accident/Incident Information
    (session_id_param, 'accident_date', 'accident', lead_record.accident_date::TEXT),
    (session_id_param, 'accident_location', 'accident', lead_record.accident_location),
    (session_id_param, 'accident_scenario', 'accident', lead_record.accident_scenario),
    (session_id_param, 'injuries', 'accident', lead_record.injuries),
    (session_id_param, 'medical_attention', 'accident', lead_record.medical_attention),
    (session_id_param, 'police_attended', 'accident', lead_record.police_attended::TEXT),
    (session_id_param, 'insured', 'accident', lead_record.insured::TEXT),
    (session_id_param, 'vehicle_registration', 'accident', lead_record.vehicle_registration),
    (session_id_param, 'insurance_company', 'accident', lead_record.insurance_company),
    (session_id_param, 'third_party_vehicle_registration', 'accident', lead_record.third_party_vehicle_registration),
    (session_id_param, 'other_party_admit_fault', 'accident', lead_record.other_party_admit_fault::TEXT),
    (session_id_param, 'passengers_count', 'accident', lead_record.passengers_count::TEXT),
    (session_id_param, 'prior_attorney_involved', 'accident', lead_record.prior_attorney_involved::TEXT),
    (session_id_param, 'prior_attorney_details', 'accident', lead_record.prior_attorney_details),
    
    -- Witness/Contact Information
    (session_id_param, 'contact_name', 'witness', lead_record.contact_name),
    (session_id_param, 'contact_number', 'witness', lead_record.contact_number),
    (session_id_param, 'contact_address', 'witness', lead_record.contact_address),
    
    -- Additional Information
    (session_id_param, 'additional_notes', 'additional', lead_record.additional_notes),
    (session_id_param, 'lead_vendor', 'additional', lead_record.lead_vendor);
    
  -- Update total fields count in the session
  UPDATE public.verification_sessions 
  SET total_fields = (SELECT COUNT(*) FROM public.verification_items WHERE session_id = session_id_param)
  WHERE id = session_id_param;
END;
$function$;

COMMIT;
