import { supabase } from "@/integrations/supabase/client";

export interface CallLogEvent {
  submissionId: string;
  agentId: string;
  agentType: 'buffer' | 'licensed';
  agentName: string;
  eventType: 'verification_started' | 'call_picked_up' | 'call_claimed' | 'call_dropped' | 'call_disconnected' | 'transferred_to_la' | 'transferred_to_licensed_agent' | 'application_submitted' | 'application_not_submitted';
  eventDetails?: Record<string, any>;
  sessionId?: string;
  verificationSessionId?: string;
  callResultId?: string;
  customerName?: string;
  leadVendor?: string;
  isRetentionCall?: boolean;
}

export const logCallUpdate = async (event: CallLogEvent): Promise<string | null> => {
  try {
    console.log('Logging call update:', event);
    
    const { data, error } = await supabase.rpc('log_call_update', {
      p_submission_id: event.submissionId,
      p_agent_id: event.agentId,
      p_agent_type: event.agentType,
      p_agent_name: event.agentName,
      p_event_type: event.eventType,
      p_event_details: event.eventDetails || {},
      p_session_id: event.sessionId || null,
      p_verification_session_id: event.verificationSessionId || null,
      p_call_result_id: event.callResultId || null,
      p_customer_name: event.customerName || null,
      p_lead_vendor: event.leadVendor || null,
      p_is_retention_call: event.isRetentionCall || false
    });

    if (error) {
      console.error('Error logging call update:', error);
      return null;
    }

    console.log('Call update logged successfully with ID:', data);
    return data;
  } catch (error) {
    console.error('Failed to log call update:', error);
    return null;
  }
};

export const getAgentStats = async (
  agentId?: string, 
  agentType?: 'buffer' | 'licensed',
  startDate?: string,
  endDate?: string
) => {
  try {
    let query = supabase
      .from('daily_agent_stats')
      .select('*');

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    if (agentType) {
      query = query.eq('agent_type', agentType);
    }

    if (startDate) {
      query = query.gte('log_date', startDate);
    }

    if (endDate) {
      query = query.lte('log_date', endDate);
    }

    const { data, error } = await query.order('log_date', { ascending: false });

    if (error) {
      console.error('Error fetching agent stats:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to fetch agent stats:', error);
    return null;
  }
};

export const getCallLogs = async (
  submissionId?: string,
  agentId?: string,
  eventType?: string,
  startDate?: string,
  endDate?: string
) => {
  try {
    let query = supabase
      .from('call_update_logs')
      .select('*');

    if (submissionId) {
      query = query.eq('submission_id', submissionId);
    }

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching call logs:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to fetch call logs:', error);
    return null;
  }
};

// Helper function to get agent profile info
export const getAgentProfile = async (agentId: string) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', agentId)
      .single();

    if (error) {
      console.error('Error fetching agent profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to fetch agent profile:', error);
    return null;
  }
};

// Helper function to get lead info for logging
export const getLeadInfo = async (submissionId: string) => {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('customer_full_name, lead_vendor')
      .eq('submission_id', submissionId)
      .single();

    if (error) {
      console.error('Error fetching lead info:', error);
      return { customerName: null, leadVendor: null };
    }

    return {
      customerName: data.customer_full_name,
      leadVendor: data.lead_vendor
    };
  } catch (error) {
    console.error('Failed to fetch lead info:', error);
    return { customerName: null, leadVendor: null };
  }
};
