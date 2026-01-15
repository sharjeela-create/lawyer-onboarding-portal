# Integration Example: Enhanced Slack Notifications with Alternative Carrier Suggestions

## Current Flow vs Enhanced Flow

### BEFORE (Current System)
```
1. Lead comes in: Aetna - Pennsylvania
2. System checks for eligible agents → None found
3. Slack notification sent:
   "❌ No agents can submit this lead as quoted. 
   Caller will need to be requoted with another carrier"
4. Manual work required to find alternative carriers
```

### AFTER (Enhanced System)
```
1. Lead comes in: Aetna - Pennsylvania
2. System checks for eligible agents → None found
3. System automatically queries alternative carriers
4. Slack notification sent with intelligent suggestions:
   "❌ No agents can submit this lead as quoted.
   
   👉 Suggested Carrier: American Amicable
   
   Closers who can submit with American Amicable:
   • @ Benjamin Smith
   • @ John Doe  
   • @ Jane Smith
   
   3 eligible agent(s)"
```

## Code Implementation Example

### Update notify-eligible-agents-with-upline Function

Add this after finding no eligible agents:

```typescript
// In notify-eligible-agents-with-upline/index.ts
// After determining no agents are available...

if (eligibleAgents.length === 0) {
  console.log(`[INFO] No agents found for ${carrier} in ${state}. Searching for alternatives...`);
  
  // Call the alternative carrier suggestion function
  const { data: alternatives, error: altError } = await supabase.functions.invoke(
    'suggest-alternative-carrier',
    {
      body: {
        state: state,
        original_carrier: carrier
      }
    }
  );

  if (!altError && alternatives?.suggested_carrier) {
    const suggestion = alternatives.suggested_carrier;
    
    // Enhanced Slack message with suggestions
    const message = {
      channel: centerChannel,
      text: `🔔 New Lead Available`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🔔 New Lead Available"
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Call Center:*\n${lead_vendor}`
            },
            {
              type: "mrkdwn",
              text: `*Carrier:*\n${carrier}`
            },
            {
              type: "mrkdwn",
              text: `*State:*\n${state}`
            }
          ]
        },
        {
          type: "divider"
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "** No agents can submit this lead as quoted. Caller will need to be requoted with another carrier **"
          }
        },
        {
          type: "divider"
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*👉 Suggested Carrier: ${suggestion.carrier_name}*`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Closers who can submit this caller with ${suggestion.carrier_name}:*\n${
              suggestion.eligible_agents
                .map(agent => `• <@${agent.slack_user_id}> ${agent.display_name}`)
                .join('\n')
            }\n\n${suggestion.agent_count} eligible agent(s)`
          }
        }
      ]
    };

    // Send enhanced notification
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    return new Response(
      JSON.stringify({
        success: true,
        agents_notified: 0,
        message: `No agents for ${carrier}, suggested alternative: ${suggestion.carrier_name} with ${suggestion.agent_count} agents`,
        alternative_suggested: true,
        suggested_carrier: suggestion.carrier_name,
        suggested_agents: suggestion.agent_count
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
  
  // If no alternatives found either, send standard "no agents" message
  // ... existing no-agents notification code ...
}
```

## Visual Output Examples

### Example 1: Aetna → American Amicable Suggestion

```
╔════════════════════════════════════════════╗
║  🔔 New Lead Available                     ║
╠════════════════════════════════════════════╣
║  Call Center: AJ BPO                       ║
║  Carrier: Aetna                            ║
║  State: Pennsylvania                       ║
╠════════════════════════════════════════════╣
║  ** No agents can submit this lead as      ║
║  quoted. Caller will need to be requoted   ║
║  with another carrier **                   ║
╠════════════════════════════════════════════╣
║  👉 Suggested Carrier: American Amicable   ║
║                                            ║
║  Closers who can submit with American       ║
║  Amicable:                                 ║
║  • @Benjamin Smith                         ║
║  • @John Doe                               ║
║  • @Jane Smith                             ║
║                                            ║
║  3 eligible agent(s)                       ║
╚════════════════════════════════════════════╝
```

### Example 2: Multiple Alternatives Available

```
╔════════════════════════════════════════════╗
║  🔔 New Lead Available                     ║
╠════════════════════════════════════════════╣
║  Call Center: Lumenix BPO                  ║
║  Carrier: Cigna                            ║
║  State: California                         ║
╠════════════════════════════════════════════╣
║  ** No agents can submit this lead as      ║
║  quoted. Caller will need to be requoted   ║
║  with another carrier **                   ║
╠════════════════════════════════════════════╣
║  👉 Suggested Carrier: United Healthcare   ║
║                                            ║
║  Closers who can submit with United         ║
║  Healthcare:                               ║
║  • @Benjamin Smith                         ║
║  • @Lydia Jones                            ║
║  • @Zack Williams                          ║
║  • @Isaac Brown                            ║
║                                            ║
║  4 eligible agent(s)                       ║
║                                            ║
║  Other options:                            ║
║  • American Amicable: 2 agents             ║
║  • Aetna: 1 agent                          ║
╚════════════════════════════════════════════╝
```

## Frontend Integration Example

### React Component for Alternative Carrier Search

```typescript
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ThumbsUp, Users } from 'lucide-react';

interface AlternativeCarrierFinderProps {
  state: string;
  originalCarrier: string;
}

export function AlternativeCarrierFinder({ 
  state, 
  originalCarrier 
}: AlternativeCarrierFinderProps) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<any>(null);

  const findAlternatives = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'suggest-alternative-carrier',
        {
          body: { state, original_carrier: originalCarrier }
        }
      );

      if (error) throw error;
      setSuggestion(data);
    } catch (error) {
      console.error('Error finding alternatives:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            No Closers Available
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            No agents are available for {originalCarrier} in {state}.
          </p>
          <Button onClick={findAlternatives} disabled={loading}>
            {loading ? 'Searching...' : 'Find Alternative Carriers'}
          </Button>
        </CardContent>
      </Card>

      {suggestion?.suggested_carrier && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <ThumbsUp className="h-5 w-5" />
              Suggested Alternative
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-lg font-semibold text-green-900">
                {suggestion.suggested_carrier.carrier_name}
              </p>
              <Badge variant="secondary" className="mt-2">
                <Users className="h-3 w-3 mr-1" />
                {suggestion.suggested_carrier.agent_count} agents available
              </Badge>
            </div>

            <div>
              <p className="font-medium mb-2">Eligible Closers:</p>
              <div className="space-y-2">
                {suggestion.suggested_carrier.eligible_agents.map((agent: any) => (
                  <div 
                    key={agent.user_id}
                    className="flex items-center justify-between p-2 bg-white rounded"
                  >
                    <span>{agent.display_name}</span>
                    {agent.has_upline && (
                      <Badge variant="outline" className="text-xs">
                        Upline: {agent.upline_name}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {suggestion.total_alternatives > 1 && (
              <p className="text-sm text-muted-foreground">
                {suggestion.total_alternatives - 1} other carrier option(s) available
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

## Database Query Flow

```
User Request: "No agents for Aetna in Pennsylvania"
     ↓
Call: suggest-alternative-carrier
     ↓
Query 1: Get state_id for "Pennsylvania"
     ↓
Query 2: Get all carriers (excluding Aetna)
     ↓
For each carrier:
  ├─ If carrier = "Aetna" → Use get_eligible_agents_for_aetna()
  └─ Else → Use get_eligible_agents_with_upline_check()
     ↓
Collect results: [
  { carrier: "American Amicable", agents: 3 },
  { carrier: "United Healthcare", agents: 2 },
  { carrier: "Cigna", agents: 1 }
]
     ↓
Sort by agent_count DESC
     ↓
Return top suggestion: American Amicable (3 agents)
```

## Benefits

### 1. Reduced Manual Work
- ✅ Eliminates manual carrier lookup
- ✅ Automatic agent identification
- ✅ Instant slack notifications

### 2. Faster Lead Processing
- ✅ Immediate alternative suggestions
- ✅ Pre-qualified agent lists
- ✅ Reduced requote time

### 3. Better Lead Conversion
- ✅ More leads successfully written
- ✅ Optimal carrier selection
- ✅ Balanced agent workload

### 4. Data-Driven Decisions
- ✅ Shows most viable alternatives
- ✅ Agent count transparency
- ✅ Upline verification included

## Next Steps

1. **Deploy the Edge Function**
   ```bash
   npx supabase functions deploy suggest-alternative-carrier
   ```

2. **Update notify-eligible-agents-with-upline**
   - Add alternative carrier logic
   - Enhance Slack message format
   - Include agent mentions

3. **Test with Real Scenarios**
   ```powershell
   .\test-alternative-carrier.ps1
   ```

4. **Monitor Performance**
   - Track suggestion success rate
   - Measure lead conversion improvement
   - Analyze most common alternatives

5. **Optional Frontend Integration**
   - Add to Lead Management Dashboard
   - Create Alternative Carrier Widget
   - Display in Center Lead Portal
