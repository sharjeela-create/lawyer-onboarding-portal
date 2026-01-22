import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const leadData = await req.json();

    if (!leadData.submission_id) {
      throw new Error('Missing submission_id');
    }

    console.log('Processing (Upserting) lead for submission:', leadData.submission_id);

    // Prepare lead data object
    const processedLeadData = {
      submission_id: leadData.submission_id,
      submission_date: leadData.submission_date || new Date().toISOString(),
      customer_full_name: leadData.customer_full_name || '',
      street_address: leadData.street_address || '',
      city: leadData.city || '',
      state: leadData.state || '',
      zip_code: leadData.zip_code || '',
      phone_number: leadData.phone_number || '',
      email: leadData.email || '',
      birth_state: leadData.birth_state || '',
      date_of_birth: leadData.date_of_birth || null,
      age: leadData.age ? parseInt(leadData.age) : null,
      social_security: leadData.social_security || '',
      driver_license: leadData.driver_license || '',
      additional_notes: leadData.additional_notes || '',
      lead_vendor: leadData.lead_vendor || null,
      buffer_agent: leadData.buffer_agent || '',
      agent: leadData.agent || '',
      
      // Accident fields
      accident_date: leadData.accident_date || null,
      accident_location: leadData.accident_location || '',
      accident_scenario: leadData.accident_scenario || '',
      injuries: leadData.injuries || '',
      medical_attention: leadData.medical_attention || '',
      police_attended: leadData.police_attended === 'true' || leadData.police_attended === true,
      insured: leadData.insured === 'true' || leadData.insured === true,
      vehicle_registration: leadData.vehicle_registration || '',
      insurance_company: leadData.insurance_company || '',
      third_party_vehicle_registration: leadData.third_party_vehicle_registration || '',
      other_party_admit_fault: leadData.other_party_admit_fault === 'true' || leadData.other_party_admit_fault === true,
      passengers_count: leadData.passengers_count ? parseInt(leadData.passengers_count) : null,
      
      // Legal fields
      prior_attorney_involved: leadData.prior_attorney_involved === 'true' || leadData.prior_attorney_involved === true,
      prior_attorney_details: leadData.prior_attorney_details || '',
      contact_name: leadData.contact_name || '',
      contact_number: leadData.contact_number || '',
      contact_address: leadData.contact_address || '',

      // NEW FIELDS (Will now update if they were null)
      accident_last_12_months: leadData.accident_last_12_months === 'true' || leadData.accident_last_12_months === true,
      is_lead_at_fault: leadData.is_lead_at_fault === 'true' || leadData.is_lead_at_fault === true,
      currently_represented: leadData.currently_represented === 'true' || leadData.currently_represented === true,
      is_injured: leadData.is_injured === 'true' || leadData.is_injured === true,
      received_medical_treatment: leadData.received_medical_treatment === 'true' || leadData.received_medical_treatment === true,
      ip_address: leadData.ip_address || '',
      source_url: leadData.source_url || '',
      trustedform_cert_url: leadData.trustedform_cert_url || ''
    };

    // Perform UPSERT (Insert or Update) based on submission_id
    const { data, error } = await supabase
      .from('leads')
      .upsert(processedLeadData, { onConflict: 'submission_id' })
      .select()
      .single();

    if (error) {
      console.error('Error storing lead:', error);
      throw error;
    }

    console.log('Lead stored/updated successfully:', data.id);

    return new Response(JSON.stringify({
      success: true,
      leadId: data.id,
      submissionId: data.submission_id,
      message: 'Lead processed and stored successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in process-lead:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});