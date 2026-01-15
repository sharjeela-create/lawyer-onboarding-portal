# Notify Eligible Closers Edge Function

## Overview
This Supabase Edge Function sends Slack notifications to center channels, tagging all agents who are licensed to handle a specific lead based on carrier and state requirements.

## Function Name
`notify-eligible-agents`

## Purpose
When a new lead comes in, this function:
1. Queries the database to find all agents licensed for the specific carrier AND state
2. Sends a Slack notification to the appropriate center channel
3. Tags all eligible agents in the message
4. Provides lead details (customer name, carrier, state, submission ID)

## Input Parameters

```typescript
{
  submission_id: string;      // Lead submission ID (optional)
  carrier: string;            // Required - Carrier name (e.g., "Liberty Bankers")
  state: string;              // Required - State name (e.g., "Alabama")
  lead_vendor: string;        // Required - Lead vendor/center name (e.g., "Ark Tech")
  customer_name?: string;     // Optional - Customer's name
}
```

## Example Usage

### JavaScript/TypeScript
```typescript
import { supabase } from '@/integrations/supabase/client';

const notifyEligibleAgents = async (leadData) => {
  const { data, error } = await supabase.functions.invoke('notify-eligible-agents', {
    body: {
      submission_id: 'SUB-12345',
      carrier: 'Liberty Bankers',
      state: 'Alabama',
      lead_vendor: 'Ark Tech',
      customer_name: 'John Doe'
    }
  });

  if (error) {
    console.error('Failed to notify agents:', error);
    return;
  }

  console.log('Notification sent:', data);
};
```

### cURL
```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/notify-eligible-agents' \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_id": "SUB-12345",
    "carrier": "Liberty Bankers",
    "state": "Alabama",
    "lead_vendor": "Ark Tech",
    "customer_name": "John Doe"
  }'
```

## Response Format

### Success Response (with eligible agents)
```json
{
  "success": true,
  "eligible_agents_count": 3,
  "eligible_agents": ["Benjamin", "Lydia", "Noah"],
  "messageTs": "1234567890.123456",
  "channel": "#orbit-team-ark-tech",
  "debug": {
    "ok": true,
    "channel": "C01234567",
    "ts": "1234567890.123456"
  }
}
```

### Success Response (no eligible agents)
```json
{
  "success": true,
  "eligible_agents_count": 0,
  "message": "No eligible agents found, notification sent",
  "channel": "#orbit-team-ark-tech"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Missing required fields: carrier, state, or lead_vendor"
}
```

## Slack Message Format

### With Eligible Closers
```
🔔 New Lead Available

Call Center: Ark Tech
Customer: John Doe
Carrier: Liberty Bankers
State: Alabama

─────────────────────

Closers who can take this call:

• @Benjamin (Benjamin)
• @Lydia (Lydia)
• @Noah (Noah)

Submission ID: SUB-12345 • 3 eligible agent(s)
```

### No Eligible Closers
```
🚨 New Lead Available

Call Center: Ark Tech
Customer: John Doe
Carrier: Liberty Bankers
State: Alabama

⚠️ No eligible agents found for this carrier/state combination

Submission ID: SUB-12345
```

## Agent Slack ID Mapping

The function includes a mapping of agent names to their Slack user IDs. **You need to update these with real Slack member IDs:**

```typescript
const agentSlackIdMapping: Record<string, string> = {
  "Benjamin": "U06UV9ZMHBL",  // ⚠️ Replace with actual Slack member ID
  "Noah": "U06UV9ZMHBL",      // ⚠️ Replace with actual Slack member ID
  "Lydia": "U06UV9ZMHBL",     // ⚠️ Replace with actual Slack member ID
  "Tatumn": "U06UV9ZMHBL"     // ⚠️ Replace with actual Slack member ID
};
```

### How to Find Slack Member IDs:
1. In Slack, click on a user's profile
2. Click "More" → "Copy member ID"
3. Update the mapping in the edge function code

## Center Channel Mapping

The function maps lead vendors to their corresponding Slack channels:

```typescript
"Ark Tech" → "#orbit-team-ark-tech"
"GrowthOnics BPO" → "#orbit-team-growthonics-bpo"
"Test" → "#test-bpo"
// ... etc.
```

## Integration Examples

### When Creating a New Lead
```typescript
const handleLeadCreation = async (leadData) => {
  // Create the lead in database
  const { data: newLead, error: leadError } = await supabase
    .from('leads')
    .insert(leadData)
    .select()
    .single();

  if (leadError) {
    console.error('Failed to create lead:', leadError);
    return;
  }

  // Notify eligible agents
  await supabase.functions.invoke('notify-eligible-agents', {
    body: {
      submission_id: newLead.submission_id,
      carrier: newLead.carrier,
      state: newLead.state,
      lead_vendor: newLead.lead_vendor,
      customer_name: newLead.customer_full_name
    }
  });
};
```

### When a Lead is Assigned to a Center
```typescript
const handleCenterAssignment = async (lead, centerName) => {
  // Update lead assignment
  await supabase
    .from('leads')
    .update({ lead_vendor: centerName })
    .eq('id', lead.id);

  // Notify agents in that center's channel
  await supabase.functions.invoke('notify-eligible-agents', {
    body: {
      submission_id: lead.submission_id,
      carrier: lead.carrier,
      state: lead.state,
      lead_vendor: centerName,
      customer_name: lead.customer_full_name
    }
  });
};
```

## Requirements

### Environment Variables
The function requires these environment variables to be set in Supabase:
- `SLACK_BOT_TOKEN` - Your Slack Bot OAuth token
- `SUPABASE_URL` - Auto-configured by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-configured by Supabase

### Database Setup
The function uses the `get_eligible_agents` database function, which requires:
- `carriers` table
- `states` table
- `agent_carrier_licenses` table
- `agent_state_licenses` table
- `profiles` table (for agent names)

## Error Handling

The function handles several error cases:
1. **Missing required fields** → Returns 400 error
2. **Unknown lead vendor** → Returns 400 error with message
3. **Database query failure** → Returns 500 error
4. **Slack API failure** → Returns 500 error with Slack error details
5. **No eligible agents** → Sends notification indicating no agents found

## Testing

### Test with Sample Data
```typescript
// Test with known carrier/state combination
await supabase.functions.invoke('notify-eligible-agents', {
  body: {
    submission_id: 'TEST-001',
    carrier: 'Liberty Bankers',
    state: 'Arizona',
    lead_vendor: 'Test',
    customer_name: 'Test Customer'
  }
});
```

Expected: Should tag Ben, Lydia, and Noah (all licensed for Liberty Bankers in Arizona)

### Test with No Eligible Closers
```typescript
await supabase.functions.invoke('notify-eligible-agents', {
  body: {
    submission_id: 'TEST-002',
    carrier: 'Liberty Bankers',
    state: 'Maine',
    lead_vendor: 'Test',
    customer_name: 'Test Customer'
  }
});
```

Expected: Should send notification but indicate no Lydia or Tatum (only Ben and Noah licensed for Maine)

## Deployment

The function is already deployed to your Supabase project. To update it:

```bash
supabase functions deploy notify-eligible-agents
```

## Next Steps

1. **Update Slack Member IDs**: Replace the placeholder IDs with real Slack member IDs
2. **Test the Function**: Use the testing examples above
3. **Integrate into Lead Creation Flow**: Add function calls wherever new leads are created
4. **Monitor Logs**: Check Supabase function logs for any errors
5. **Add More Closers**: Update the `agentSlackIdMapping` when new agents are added

## Support

For issues or questions:
- Check Supabase function logs: Dashboard → Edge Functions → notify-eligible-agents → Logs
- Verify Slack bot has permission to post in the target channels
- Ensure agent licensing data is properly configured in the database
