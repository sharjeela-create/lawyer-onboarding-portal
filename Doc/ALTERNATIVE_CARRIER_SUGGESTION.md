# Alternative Carrier Suggestion System

## Overview
This system provides intelligent carrier suggestions when no agents are available for a specific carrier/state combination. It analyzes all possible carrier alternatives for a given state and recommends the carrier with the most eligible agents.

## Architecture

### Edge Function
**Function Name**: `suggest-alternative-carrier`
**Location**: `supabase/functions/suggest-alternative-carrier/index.ts`

### How It Works

1. **Input**: Receives a state and optionally an original carrier
2. **Analysis**: Queries all carriers to find eligible agents in that state
3. **Ranking**: Sorts carriers by number of eligible agents (descending)
4. **Output**: Returns the top carrier suggestion plus all alternatives

### Special Handling

#### Aetna Detection
- When checking alternatives for Aetna, uses `get_eligible_agents_for_aetna()` for Aetna-specific state availability
- For other carriers as alternatives, uses `get_eligible_agents_with_upline_check()`
- Automatically excludes the original carrier from suggestions

#### Upline Verification
- All agent eligibility checks include upline verification
- Closers without required uplines are excluded from suggestions
- Upline information is included in the response for transparency

## API Reference

### Endpoint
```
POST /functions/v1/suggest-alternative-carrier
```

### Request Body
```json
{
  "state": "Pennsylvania",           // Required: State name
  "original_carrier": "Aetna"        // Optional: Carrier to exclude from suggestions
}
```

### Response Structure
```json
{
  "success": true,
  "state": "Pennsylvania",
  "original_carrier": "Aetna",
  "total_alternatives": 5,
  "suggested_carrier": {
    "carrier_id": "uuid",
    "carrier_name": "American Amicable",
    "agent_count": 3,
    "eligible_agents": [
      {
        "user_id": "uuid",
        "display_name": "Benjamin Smith",
        "agent_code": "AGENT001",
        "slack_user_id": "U123456",
        "has_upline": true,
        "upline_name": "Senior Agent"
      }
    ]
  },
  "all_alternatives": [
    // Array of all carrier suggestions sorted by agent_count
  ],
  "message": "Found 5 alternative carrier(s) for Pennsylvania. Suggested: American Amicable with 3 eligible agent(s)."
}
```

## Use Cases

### 1. No Closers Available Scenario
**Scenario**: A Pennsylvania lead comes in for Aetna, but no agents are licensed/available
**Action**: Call the function to get alternative carrier suggestions
**Result**: System suggests "American Amicable" with 3 eligible agents

### 2. Slack Notification Enhancement
**Current**: "No agents can submit this lead as quoted"
**Enhanced**: "No agents can submit this lead as quoted. Suggested Carrier: American Amicable - 3 eligible agents"

### 3. Lead Routing Optimization
**Purpose**: Automatically reroute leads to carriers where agents are available
**Benefit**: Reduces lead loss and improves conversion rates

## Integration Examples

### Example 1: Basic Alternative Search
```typescript
const response = await supabase.functions.invoke('suggest-alternative-carrier', {
  body: {
    state: 'Pennsylvania',
    original_carrier: 'Aetna'
  }
});

if (response.data.suggested_carrier) {
  console.log(`Suggest: ${response.data.suggested_carrier.carrier_name}`);
  console.log(`Available Closers: ${response.data.suggested_carrier.agent_count}`);
}
```

### Example 2: Notify Closers with Suggestions
```typescript
// After finding no agents for original carrier
const { data: alternatives } = await supabase.functions.invoke('suggest-alternative-carrier', {
  body: { state: 'Pennsylvania', original_carrier: 'Aetna' }
});

if (alternatives.suggested_carrier) {
  // Send Slack notification with alternative carrier suggestion
  await sendSlackNotification({
    channel: centerChannel,
    message: `No agents available for ${originalCarrier} in ${state}.
    
** Suggested Carrier: ${alternatives.suggested_carrier.carrier_name} **

Closers who can submit with ${alternatives.suggested_carrier.carrier_name}:
${alternatives.suggested_carrier.eligible_agents.map(a => `• ${a.display_name}`).join('\n')}

${alternatives.suggested_carrier.agent_count} eligible agent(s)`
  });
}
```

### Example 3: Frontend Integration
```typescript
// In a React component
const findAlternatives = async (state: string, carrier: string) => {
  setLoading(true);
  
  const { data, error } = await supabase.functions.invoke('suggest-alternative-carrier', {
    body: { state, original_carrier: carrier }
  });

  if (data?.suggested_carrier) {
    setAlternativeCarrier(data.suggested_carrier);
    setShowAlternativeSuggestion(true);
  } else {
    toast({
      title: "No Alternatives Found",
      description: `No other carriers have eligible agents in ${state}`,
      variant: "destructive"
    });
  }
  
  setLoading(false);
};
```

## Testing

### PowerShell Test Script
**Location**: `test-alternative-carrier.ps1`

**Run Tests**:
```powershell
.\test-alternative-carrier.ps1
```

### Test Cases Included:
1. **Aetna Alternative**: Find alternatives when Aetna has no agents in Pennsylvania
2. **United Healthcare**: Test with another carrier in California
3. **All Carriers**: Get all available carriers for Texas (no original carrier specified)

### Expected Output Format:
```
================================================
Testing Alternative Carrier Suggestion Function
================================================

Test Case 1: Original Carrier = Aetna, State = Pennsylvania
Looking for alternative carriers...

✅ SUCCESS
State: Pennsylvania
Original Carrier: Aetna
Total Alternatives Found: 5

👉 SUGGESTED CARRIER: American Amicable
   Available Closers: 3

   Eligible Closers:
   • Benjamin Smith (@AGENT001) - ✓ Has Upline: Senior Agent
   • John Doe (@AGENT002) - ✓ Has Upline: Team Lead
   • Jane Smith (@AGENT003) - ✓ Has Upline: Senior Agent

Other Alternatives:
   2. United Healthcare - 2 agent(s)
   3. Cigna - 1 agent(s)
```

## Performance Considerations

### Query Optimization
- Function queries all carriers but only processes those with eligible agents
- Uses indexed RPC functions for fast eligibility checks
- Results are sorted in-memory after database queries

### Caching Recommendations
- Consider caching carrier/state combinations for frequently queried states
- Cache TTL: 5-10 minutes (agents' licensing status changes infrequently)

### Rate Limiting
- Suitable for real-time queries during lead processing
- Can handle concurrent requests for multiple leads

## Deployment

### Deploy Function
```bash
# Deploy to Supabase
npx supabase functions deploy suggest-alternative-carrier
```

### Environment Variables Required
- `SUPABASE_URL` - Automatically provided by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Automatically provided by Supabase

### Database Dependencies
- ✅ `get_eligible_agents_with_upline_check()` function
- ✅ `get_eligible_agents_for_aetna()` function
- ✅ `carriers` table
- ✅ `states` table
- ✅ `agent_carrier_licenses` table
- ✅ `agent_state_licenses` table
- ✅ `aetna_agent_state_availability` table
- ✅ `agent_upline_hierarchy` table

## Future Enhancements

### 1. Smart Scoring Algorithm
Instead of just counting agents, consider:
- Agent performance metrics
- Lead conversion rates per carrier
- Agent availability/capacity

### 2. Historical Data Analysis
- Track which alternative carriers have highest success rates
- Learn patterns of carrier substitutions
- Predictive suggestions based on lead characteristics

### 3. Multi-State Suggestions
For leads that can be written in multiple states:
- Suggest best state/carrier combination
- Consider agent workload distribution

### 4. Real-Time Availability
- Check agent online status
- Consider current lead assignments
- Balance workload across agents

## Monitoring

### Key Metrics to Track
- Number of alternative carrier queries per day
- Success rate of alternative suggestions (leads converted)
- Most frequently suggested carriers
- States with most "no agent" scenarios

### Logging
Function logs include:
- `[INFO]` State and carrier being queried
- `[INFO]` Number of alternatives found
- `[INFO]` Top suggestion details
- `[ERROR]` Any failures in carrier/agent lookups

## Support

### Common Issues

**Issue**: "State not found"
- **Cause**: State name doesn't match database records
- **Solution**: Ensure state name matches exactly (case-insensitive but spelling must match)

**Issue**: "No alternatives found"
- **Cause**: No agents are licensed in that state for any carrier
- **Solution**: Review agent licensing coverage, consider expanding to neighboring states

**Issue**: Function timeout
- **Cause**: Too many carriers to process
- **Solution**: Optimize by limiting carrier query or implementing caching

## Related Documentation
- [AETNA_FRONTEND_TESTING_GUIDE.md](./AETNA_FRONTEND_TESTING_GUIDE.md)
- [AGENT_LICENSING_SYSTEM.md](./AGENT_LICENSING_SYSTEM.md)
- [notify-eligible-agents-with-upline Edge Function](../supabase/functions/notify-eligible-agents-with-upline/)
