import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    const { submissionId, leadData, callResult } = await req.json();
    if (!SLACK_BOT_TOKEN) {
      throw new Error('SLACK_BOT_TOKEN not configured');
    }
    // Center mapping for different lead vendors
    const leadVendorCenterMapping = {
      "Zupax Marketing": "#crash-guard-team-zupax-bpo",
      "Prime BPO":"#crash-guard-team-prime-bpo",
      "Brainiax BPO":"#crash-guard-team-brainiax-bpo",
      "KP Leads":"#crash-guard-team-kp-leads",
      "Hello Support Network":"#crash-guard-team-hello-support-network",
      "Fonex Media":"#crash-guard-team-fonex-media",
      "Rapid Squad":"#crash-guard-team-rapid-squad"
    };
    // Send notifications for all call results (submitted or not)
    // No filtering - centers need to know about all outcomes
    console.log('Debug - callResult data:', JSON.stringify(callResult, null, 2));
    console.log('Debug - leadData:', JSON.stringify(leadData, null, 2));
    // Get the lead vendor from callResult or leadData
    const leadVendor = callResult?.lead_vendor || leadData?.lead_vendor;
    if (!leadVendor) {
      console.log('No lead vendor found, cannot determine center channel');
      return new Response(JSON.stringify({
        success: false,
        message: 'No lead vendor specified'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const centerChannel = leadVendorCenterMapping[leadVendor];
    if (!centerChannel) {
      console.log(`No center channel mapping found for lead vendor: "${leadVendor}"`);
      return new Response(JSON.stringify({
        success: false,
        message: `No center channel mapping for vendor: ${leadVendor}`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Create the notification message with notes and reason
    const statusText = callResult.status || 'Not Submitted';
    const reasonText = callResult.dq_reason || 'No specific reason provided';
    const notesText = callResult.notes || 'No additional notes';
    const customerName = leadData.customer_full_name || 'Unknown Customer';
    const phoneNumber = leadData.phone_number || 'No phone number';
    const email = leadData.email || 'No email';

    // Format the message with status emoji based on your dropdown options
    // Dropdown options: Incomplete Transfer, Returned To Center - DQ, Previously Sold BPO, Needs BPO Callback, Application Withdrawn
    const normalizedStatus = (callResult.status || '').trim().normalize('NFKC');
    const normalizedReason = (callResult.dq_reason || '').trim().normalize('NFKC');
    
    let statusEmoji = '📋'; // Default

    // Map statuses to emojis based on your dropdown options
    if (normalizedStatus.includes('Incomplete Transfer')) {
      statusEmoji = '⚠️';
    } else if (normalizedStatus.includes('Returned To Center - DQ') || normalizedStatus.includes('DQ')) {
      statusEmoji = '🚫';
    } else if (normalizedStatus.includes('Previously Sold BPO')) {
      statusEmoji = '✅';
    } else if (normalizedStatus.includes('Needs BPO Callback') || normalizedStatus.includes('callback') || normalizedStatus.includes('Callback')) {
      statusEmoji = '📞';
    } else if (normalizedStatus.includes('Application Withdrawn')) {
      statusEmoji = '📅';
    } else if (normalizedStatus.includes('Not Interested')) {
      statusEmoji = '🙅‍♂️';
    } else if (normalizedStatus.includes('Disconnected')) {
      statusEmoji = '📵';
    }

    // NOTE: Accident information is NOT included in center notifications
    // because this function is only called for NOT submitted applications.
    // Accident details are only relevant for submitted applications and are
    // sent via the slack-notification function instead.
    
    const centerSlackMessage = {
      channel: centerChannel,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${statusEmoji} ${statusText}`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Submission ID:*\n${submissionId}`
            },
            {
              type: 'mrkdwn',
              text: `*Customer:*\n${customerName}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Status:* ${statusText}\n*Reason:* ${reasonText}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Notes:*\n${notesText}`
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `🏢 Vendor: *${leadVendor}* | 👤 Agent: *${callResult.agent_who_took_call || 'N/A'}* | 🔄 Buffer: *${callResult.buffer_agent || 'N/A'}*`
            }
          ]
        }
      ]
    };
    console.log(`Sending center notification to ${centerChannel} for vendor ${leadVendor}`);
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(centerSlackMessage)
    });
    const slackResult = await slackResponse.json();
    console.log(`Center Slack API Response for ${centerChannel}:`, JSON.stringify(slackResult, null, 2));
    if (!slackResult.ok) {
      console.error(`Slack API error: ${slackResult.error}`);
      if (slackResult.error === 'channel_not_found') {
        console.log(`Channel ${centerChannel} not found, center may need to create it or invite the bot`);
        return new Response(JSON.stringify({
          success: false,
          message: `Channel ${centerChannel} not found`,
          error: slackResult.error
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      } else {
        throw new Error(`Slack API error: ${slackResult.error}`);
      }
    }
    console.log(`Center notification sent to ${centerChannel} successfully`);
    return new Response(JSON.stringify({
      success: true,
      messageTs: slackResult.ts,
      channel: centerChannel,
      leadVendor: leadVendor,
      status: statusText,
      reason: reasonText
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in center-notification:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});