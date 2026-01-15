import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // Log incoming request for debugging
    const rawBody = await req.text();
    console.log('[DEBUG] Notify eligible agents (with upline check) request:', rawBody);
    const { carrier, state, lead_vendor } = JSON.parse(rawBody);
    if (!SLACK_BOT_TOKEN) {
      console.error('[ERROR] SLACK_BOT_TOKEN not configured');
      throw new Error('SLACK_BOT_TOKEN not configured');
    }
    if (!carrier || !state || !lead_vendor) {
      console.error('[ERROR] Missing required fields: carrier, state, or lead_vendor');
      return new Response(JSON.stringify({
        success: false,
        message: 'Missing required fields: carrier, state, or lead_vendor'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // Center mapping for different lead vendors
    const leadVendorCenterMapping = {
      "Ark Tech": "#orbit-team-ark-tech",
      "Lumenix BPO": "#orbit-team-lumenix-bpo",
      "GrowthOnics BPO": "#orbit-team-growthonics-bpo",
      "Maverick": "#sample-center-transfer-channel",
      "Omnitalk BPO": "#orbit-team-omnitalk-bpo",
      "Vize BPO": "#orbit-team-vize-bpo",
      "Corebiz": "#orbit-team-corebiz-bpo",
      "Digicon": "#orbit-team-digicon-bpo",
      "Ambition": "#orbit-team-ambition-bpo",
      "AJ BPO": "#orbit-team-aj-bpo",
      "Pro Solutions BPO": "#orbit-team-pro-solutions-bpo",
      "Emperor BPO": "#orbit-team-emperor-bpo",
      "Benchmark": "#orbit-team-benchmark-bpo",
      "Poshenee": "#orbit-team-poshenee-tech-bpo",
      "Plexi": "#orbit-team-plexi-bpo",
      "Gigabite": "#orbit-team-gigabite-bpo",
      "Everline solution": "#orbit-team-everline-bpo",
      "Progressive BPO": "#orbit-team-progressive-bpo",
      "Cerberus BPO": "#orbit-team-cerberus-bpo",
      "NanoTech": "#orbit-team-nanotech-bpo",
      "Optimum BPO": "#orbit-team-optimum-bpo",
      "Ethos BPO": "#orbit-team-ethos-bpo",
      "Trust Link": "#orbit-team-trust-link",
      "Quotes BPO": "#obit-team-quotes-bpo",
      "Zupax Marketing": "#orbit-team-zupax-marketing",
      "Argon Comm": "#orbit-team-argon-comm",
      "Care Solutions": "#unlimited-team-care-solutions",
      "Cutting Edge": "#unlimited-team-cutting-edge",
      "Next Era": "#unlimited-team-next-era",
      "Rock BPO": "#orbit-team-rock-bpo",
      "Avenue Consultancy": "#orbit-team-avenue-consultancy",
      "Crown Connect BPO": "#orbit-team-crown-connect-bpo",
      "Networkize": "#orbit-team-networkize",
      "LightVerse BPO": "#orbit-team-lightverse-bpo",
      "Leads BPO": "#orbit-team-leads-bpo",
      "Helix BPO": "#orbit-team-helix-bpo",
      "Exito BPO": "#orbit-team-exito-bpo",
      "CrossNotch": "#orbit-team-crossnotch",
      "TechPlanet": "#orbit-team-techplanet",
      "StratiX BPO": "#orbit-team-stratix-bpo",
      "Test": "#test-bpo"
    };
    // Agent Slack ID mapping with full display names
    const agentSlackIdMapping = {
      "Abdul": {
        slackId: "U07ULU99VD4",
        displayName: "Benjamin Wunder - Sales Manager"
      },
      "Benjamin": {
        slackId: "U07ULU99VD4",
        displayName: "Benjamin Wunder - Sales Manager"
      },
      "Zack": {
        slackId: "U09AWBNGBQF",
        displayName: "Zack Lesnar - Insurance Agent"
      },
      "Lydia": {
        slackId: "U08216BSGE4",
        displayName: "Lydia Sutton - Insurance Agent"
      },
      "Tatumn": {
        slackId: "U09FKU50KFT",
        displayName: "Tatumn - Insurance Agent"
      },
      "Isaac": {
        slackId: "U099W0RKYDB",
        displayName: "Isaac Reed - Insurance Agent"
      }
    };
    const centerChannel = leadVendorCenterMapping[lead_vendor];
    if (!centerChannel) {
      console.error(`[ERROR] No center channel mapping for vendor: ${lead_vendor}`);
      return new Response(JSON.stringify({
        success: false,
        message: `No center channel mapping for vendor: ${lead_vendor}`
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get eligible agents from database using the upline-aware function
    console.log(`[DEBUG] Fetching eligible agents (with upline check) for carrier: ${carrier}, state: ${state}`);
    let eligibleAgents;
    let agentsError;
    // Special handling for Aetna - uses separate state availability table
    if (carrier.toLowerCase() === 'aetna') {
      console.log('[DEBUG] Using Aetna-specific eligibility function');
      const result = await supabase.rpc('get_eligible_agents_for_aetna', {
        p_state_name: state
      });
      eligibleAgents = result.data;
      agentsError = result.error;
    } else {
      // Use existing function for other carriers
      const result = await supabase.rpc('get_eligible_agents_with_upline_check', {
        p_carrier_name: carrier,
        p_state_name: state
      });
      eligibleAgents = result.data;
      agentsError = result.error;
    }
    if (agentsError) {
      console.error('[ERROR] Failed to fetch eligible agents:', agentsError);
      throw new Error(`Failed to fetch eligible agents: ${agentsError.message}`);
    }
    console.log(`[DEBUG] Found ${eligibleAgents?.length || 0} eligible agents (after upline check):`, eligibleAgents);
    // Check if this is an override state
    const hasOverrideState = eligibleAgents && eligibleAgents.length > 0 && eligibleAgents[0]?.upline_required;
    if (!eligibleAgents || eligibleAgents.length === 0) {
      console.log('[INFO] No eligible agents found for this carrier/state combination');
      // Send notification with additional context about override states
      const noAgentsMessage = {
        channel: centerChannel,
        text: `🚨 *New Lead Available* - No eligible agents found for ${carrier} in ${state}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🚨 New Lead Available',
              emoji: true
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Call Center:*\n${lead_vendor}`
              },
              {
                type: 'mrkdwn',
                text: `*Carrier:*\n${carrier}`
              },
              {
                type: 'mrkdwn',
                text: `*State:*\n${state}`
              }
            ]
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '⚠️ *No eligible agents found for this carrier/state combination*'
            }
          }
        ]
      };
      const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(noAgentsMessage)
      });
      const slackResult = await slackResponse.json();
      console.log('[DEBUG] Slack API response (no agents):', slackResult);
      return new Response(JSON.stringify({
        success: true,
        eligible_agents_count: 0,
        message: 'No eligible agents found (after upline checks), notification sent',
        channel: centerChannel
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Build agent mentions for Slack with full display names
    // Sort agents so Sales Managers appear at the bottom
    const sortedAgents = [
      ...eligibleAgents
    ].sort((a, b)=>{
      const aInfo = agentSlackIdMapping[a.agent_name];
      const bInfo = agentSlackIdMapping[b.agent_name];
      // If both have display names, check if one is a Sales Manager
      if (aInfo && bInfo) {
        const aIsSalesManager = aInfo.displayName.includes('Sales Manager');
        const bIsSalesManager = bInfo.displayName.includes('Sales Manager');
        if (aIsSalesManager && !bIsSalesManager) return 1;
        if (!aIsSalesManager && bIsSalesManager) return -1;
      }
      return a.agent_name.localeCompare(b.agent_name);
    });
    
    // Deduplicate agents by Slack ID to avoid duplicate mentions
    const seenSlackIds = new Set();
    const uniqueAgents = sortedAgents.filter((agent)=>{
      const agentInfo = agentSlackIdMapping[agent.agent_name];
      if (agentInfo) {
        if (seenSlackIds.has(agentInfo.slackId)) {
          return false; // Skip duplicate
        }
        seenSlackIds.add(agentInfo.slackId);
        return true;
      }
      return true; // Keep agents without Slack ID mapping
    });
    
    const agentMentions = uniqueAgents.map((agent)=>{
      const agentInfo = agentSlackIdMapping[agent.agent_name];
      if (agentInfo) {
        return `• <@${agentInfo.slackId}>`;
      }
      return `• ${agent.agent_name}`;
    }).join('\n');
    // Build the Slack message
    const slackText = `🔔 *New Lead Available for ${carrier} in ${state}*`;
    const messageBlocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔔 New Lead Available',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Call Center:*\n${lead_vendor}`
          },
          {
            type: 'mrkdwn',
            text: `*Carrier:*\n${carrier}`
          },
          {
            type: 'mrkdwn',
            text: `*State:*\n${state}`
          }
        ]
      }
    ];
    // Add override state warning if applicable
    messageBlocks.push({
      type: 'divider'
    }, {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Closers who can take this call:*\n${agentMentions}`
      }
    }, {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${eligibleAgents.length} eligible agent(s)`
        }
      ]
    });
    const slackMessage = {
      channel: centerChannel,
      text: slackText,
      blocks: messageBlocks
    };
    console.log('[DEBUG] Slack message payload:', JSON.stringify(slackMessage, null, 2));
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(slackMessage)
    });
    const slackResult = await slackResponse.json();
    console.log('[DEBUG] Slack API response:', slackResult);
    if (!slackResult.ok) {
      console.error('[ERROR] Slack API error:', slackResult);
      return new Response(JSON.stringify({
        success: false,
        message: slackResult.error,
        debug: slackResult
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      eligible_agents_count: eligibleAgents.length,
      eligible_agents: eligibleAgents.map((a)=>({
          name: a.agent_name,
          upline: a.upline_name,
          upline_required: a.upline_required
        })),
      override_state: hasOverrideState,
      messageTs: slackResult.ts,
      channel: centerChannel,
      debug: slackResult
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('[ERROR] Exception in notify-eligible-agents-with-upline function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      debug: String(error)
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
