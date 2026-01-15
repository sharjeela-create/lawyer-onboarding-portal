# Agent Licensing System - Complete Documentation

## Overview
The Agent Licensing System is a comprehensive feature that tracks which insurance carriers and states each agent is licensed to work with. This enables automatic filtering and assignment of leads to eligible agents based on carrier and state requirements.

## Business Problem Solved
Previously, there was no systematic way to:
- Track which carriers each agent is licensed to sell
- Track which states each agent is licensed in
- Automatically find eligible agents for a specific lead
- Prevent assignment of leads to unlicensed agents

## Database Schema

### 1. `carriers` Table
Stores all available insurance carriers in the system.

**Columns:**
- `id` (UUID, PK): Primary key
- `carrier_name` (TEXT, UNIQUE): Full name of the carrier
- `carrier_code` (TEXT): Short code or abbreviation
- `is_active` (BOOLEAN): Whether carrier is active for new business
- `display_order` (INTEGER): Order for displaying in dropdowns
- `notes` (TEXT): Additional notes
- `created_at`, `updated_at` (TIMESTAMPTZ): Audit timestamps

**Preloaded Carriers:**
Liberty Bankers, AMAM, Pioneer, Occidental, MOA, Royal Neighbors, Aetna, Aflac, Americo, CoreBridge, TransAmerica, CICA, GTL, SBLI, Chubb, Foresters, Baltimore Life

### 2. `states` Table
Stores all US states and territories.

**Columns:**
- `id` (UUID, PK): Primary key
- `state_name` (TEXT, UNIQUE): Full state name
- `state_code` (TEXT, UNIQUE): Two-letter state code (e.g., "AL")
- `is_active` (BOOLEAN): Whether state is active for business
- `display_order` (INTEGER): Order for displaying
- `notes` (TEXT): Additional notes
- `created_at`, `updated_at` (TIMESTAMPTZ): Audit timestamps

**Preloaded States:**
All 50 US states + DC, Puerto Rico, Guam, Virgin Islands (54 total)

### 3. `agent_carrier_licenses` Table
Junction table linking agents to carriers they can sell.

**Columns:**
- `id` (UUID, PK): Primary key
- `agent_user_id` (UUID, FK): Reference to auth.users
- `carrier_id` (UUID, FK): Reference to carriers
- `is_licensed` (BOOLEAN): Whether agent is currently licensed
- `license_start_date` (DATE): When license became active
- `license_end_date` (DATE): When license expires
- `notes` (TEXT): Additional notes
- `created_at`, `updated_at` (TIMESTAMPTZ): Audit timestamps

**Constraints:**
- UNIQUE(agent_user_id, carrier_id) - One record per agent-carrier pair
- ON DELETE CASCADE - Cleanup when agent or carrier is deleted

**Indexes:**
- `idx_agent_carrier_licenses_agent` on agent_user_id
- `idx_agent_carrier_licenses_carrier` on carrier_id
- `idx_agent_carrier_licenses_active` on (agent_user_id, is_licensed) WHERE is_licensed = true

### 4. `agent_state_licenses` Table
Junction table linking agents to states they're licensed in.

**Columns:**
- `id` (UUID, PK): Primary key
- `agent_user_id` (UUID, FK): Reference to auth.users
- `state_id` (UUID, FK): Reference to states
- `is_licensed` (BOOLEAN): Whether agent is currently licensed
- `license_number` (TEXT): Optional state license number
- `license_start_date` (DATE): When license became active
- `license_end_date` (DATE): When license expires
- `notes` (TEXT): Additional notes
- `created_at`, `updated_at` (TIMESTAMPTZ): Audit timestamps

**Constraints:**
- UNIQUE(agent_user_id, state_id) - One record per agent-state pair
- ON DELETE CASCADE - Cleanup when agent or state is deleted

**Indexes:**
- `idx_agent_state_licenses_agent` on agent_user_id
- `idx_agent_state_licenses_state` on state_id
- `idx_agent_state_licenses_active` on (agent_user_id, is_licensed) WHERE is_licensed = true

## Database Functions

### 1. `get_eligible_agents(p_carrier_name TEXT, p_state_name TEXT)`
Returns all agents who are licensed for BOTH the specified carrier AND state.

**Parameters:**
- `p_carrier_name`: Carrier name (case-insensitive)
- `p_state_name`: State name (case-insensitive)

**Returns:**
```sql
TABLE (
  agent_user_id UUID,
  agent_name TEXT,
  agent_email TEXT,
  agent_code TEXT,
  carrier_licensed BOOLEAN,
  state_licensed BOOLEAN
)
```

**Usage Example:**
```sql
SELECT * FROM public.get_eligible_agents('Americo', 'California');
```

### 2. `is_agent_eligible(p_agent_user_id UUID, p_carrier_name TEXT, p_state_name TEXT)`
Checks if a specific agent is eligible for a carrier/state combination.

**Parameters:**
- `p_agent_user_id`: Agent's user ID
- `p_carrier_name`: Carrier name (case-insensitive)
- `p_state_name`: State name (case-insensitive)

**Returns:** BOOLEAN (true if licensed for both)

**Usage Example:**
```sql
SELECT public.is_agent_eligible(
  '424f4ea8-1b8c-4c0f-bc13-3ea699900c79',
  'Americo',
  'California'
);
```

### 3. `get_agent_licensing_summary(p_agent_user_id UUID)`
Returns a summary of all carriers and states an agent is licensed for.

**Parameters:**
- `p_agent_user_id`: Agent's user ID

**Returns:**
```sql
TABLE (
  total_carriers INTEGER,
  total_states INTEGER,
  carrier_names TEXT[],
  state_names TEXT[]
)
```

**Usage Example:**
```sql
SELECT * FROM public.get_agent_licensing_summary(
  '424f4ea8-1b8c-4c0f-bc13-3ea699900c79'
);
```

## Row Level Security (RLS)

### Carriers & States Tables
- **SELECT**: Any authenticated user can view
- **INSERT/UPDATE**: Only admins (users with agent_code in profiles)

### License Tables (agent_carrier_licenses, agent_state_licenses)
- **SELECT**: Closers can view their own licenses; Admins can view all
- **INSERT/UPDATE/DELETE**: Only admins

## User Interface Components

### 1. AgentLicenseManager Component
Location: `src/components/AgentLicenseManager.tsx`

**Features:**
- Select an agent from dropdown
- View current license counts (carriers/states)
- Manage carrier licenses via checkboxes
- Manage state licenses via checkboxes
- Bulk select/deselect all
- Save changes with optimistic updates
- Tab-based interface for carriers vs states

**Access:** Admin users only (via `/agent-licensing` route)

### 2. EligibleAgentFinder Component
Location: `src/components/EligibleAgentFinder.tsx`

**Features:**
- Search by carrier name and state name
- Display list of eligible agents
- Shows agent details (name, email, code)
- Visual indicators for licensing status
- Handles "no results" gracefully

**Access:** Admin users only (via `/agent-licensing` route)

### 3. AgentLicensing Page
Location: `src/pages/AgentLicensing.tsx`

Combines both components in a tabbed interface:
- **Manage Licenses** tab: AgentLicenseManager
- **Find Closers** tab: EligibleAgentFinder

**Route:** `/agent-licensing`
**Protection:** ProtectedRoute (requires authentication)

## Setup Instructions

### 1. Apply Database Migration
The migration has already been applied to your Supabase project.

```bash
# Migration file: 20251010000000-agent-licensing-system.sql
```

### 2. Seed Initial Data
The carriers and states have been preloaded. You now have:
- 17 carriers
- 54 states/territories

### 3. Set Up an Agent's Licenses
Use the helper script to configure an agent:

```sql
-- Edit: supabase/migrations/helper-setup-agent-licenses.sql
-- Replace 'AGENT_EMAIL_HERE' with the agent's email
-- Modify the carrier and state lists as needed
-- Run the script
```

**Example for Agent "Ben":**
```sql
-- Update email in script
v_agent_email TEXT := 'ben@example.com';

-- Licensed Carriers:
'Liberty Bankers', 'AMAM', 'Pioneer', 'Occidental', 'MOA',
'Royal Neighbors', 'Aetna', 'Americo', 'CoreBridge', 'TransAmerica'

-- Licensed States:
'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California',
'Colorado', 'Connecticut', 'District of Columbia', 'Florida',
... (41 total as per your data)
```

### 4. Access the UI
1. Log in as an admin user (user with agent_code)
2. Navigate to Menu → Agent Licensing
3. Select "Manage Licenses" to configure agents
4. Select "Find Closers" to search for eligible agents

## Integration Points

### Finding Eligible Closers in Code
```typescript
import { supabase } from '@/integrations/supabase/client';

// Get all eligible agents for a lead
const { data: agents, error } = await supabase
  .rpc('get_eligible_agents', {
    p_carrier_name: lead.carrier,
    p_state_name: lead.state
  });

if (agents && agents.length > 0) {
  // Assign to first available agent
  const selectedAgent = agents[0];
  // ... assignment logic
} else {
  // No eligible agents - show warning or reassign
  console.log('No agents licensed for this carrier/state combination');
}
```

### Checking Agent Eligibility
```typescript
// Check if specific agent can handle a lead
const { data: isEligible, error } = await supabase
  .rpc('is_agent_eligible', {
    p_agent_user_id: agentId,
    p_carrier_name: lead.carrier,
    p_state_name: lead.state
  });

if (isEligible) {
  // Proceed with assignment
} else {
  // Block assignment or show error
  toast({
    title: 'Agent Not Eligible',
    description: `This agent is not licensed for ${lead.carrier} in ${lead.state}`,
    variant: 'destructive'
  });
}
```

### Getting Agent Summary
```typescript
// Display agent's licensing summary
const { data: summary } = await supabase
  .rpc('get_agent_licensing_summary', {
    p_agent_user_id: agentId
  });

console.log(`Agent licensed for ${summary.total_carriers} carriers and ${summary.total_states} states`);
console.log('Carriers:', summary.carrier_names);
console.log('States:', summary.state_names);
```

## Future Enhancements

### 1. Automatic Lead Routing
Add logic to verification/claim flows:
- When a lead is ready for assignment, automatically filter available agents
- Show only eligible agents in claim modals
- Prevent claiming by ineligible agents

### 2. License Expiration Tracking
- Add alerts for expiring licenses
- Automatically disable expired licenses
- Send notifications to admins

### 3. Bulk Import/Export
- CSV import for bulk license setup
- Export agent licenses for reporting
- Audit trail for license changes

### 4. License Requirements by Carrier
- Track specific requirements per carrier
- Store training completion status
- Link to certification documents

### 5. State Reciprocity
- Handle states with reciprocal licensing agreements
- Auto-enable related states

### 6. Lead Assignment Queue
- Priority-based assignment (based on license date, experience, etc.)
- Round-robin distribution among eligible agents
- Workload balancing

## Testing

### Manual Testing Checklist
- [ ] Create carrier and state records
- [ ] Assign licenses to an agent
- [ ] Search for eligible agents (positive case)
- [ ] Search for eligible agents (no results case)
- [ ] Update agent licenses
- [ ] Verify RLS policies (non-admin can't modify)
- [ ] Test bulk select/deselect
- [ ] Test tab switching in UI
- [ ] Verify license counts display correctly

### SQL Testing Queries
```sql
-- View all carriers
SELECT * FROM public.carriers ORDER BY carrier_name;

-- View all states
SELECT * FROM public.states ORDER BY state_name;

-- View agent's carrier licenses
SELECT 
  p.display_name,
  c.carrier_name,
  acl.is_licensed
FROM agent_carrier_licenses acl
JOIN profiles p ON p.user_id = acl.agent_user_id
JOIN carriers c ON c.id = acl.carrier_id
WHERE p.display_name = 'Ben'
ORDER BY c.carrier_name;

-- View agent's state licenses
SELECT 
  p.display_name,
  s.state_name,
  asl.is_licensed
FROM agent_state_licenses asl
JOIN profiles p ON p.user_id = asl.agent_user_id
JOIN states s ON s.id = asl.state_id
WHERE p.display_name = 'Ben'
ORDER BY s.state_name;

-- Find eligible agents for Americo in California
SELECT * FROM get_eligible_agents('Americo', 'California');

-- Check specific agent eligibility
SELECT is_agent_eligible(
  (SELECT user_id FROM profiles WHERE display_name = 'Ben'),
  'Americo',
  'California'
);

-- Get licensing summary
SELECT * FROM get_agent_licensing_summary(
  (SELECT user_id FROM profiles WHERE display_name = 'Ben')
);
```

## Troubleshooting

### Issue: No agents showing in dropdown
**Solution:** Ensure agents have profiles in the `profiles` table.

### Issue: Can't save licenses
**Solution:** Verify user has `agent_code` in their profile (admin permission).

### Issue: Search returns no results
**Solution:** Check spelling of carrier/state names. Function is case-insensitive but spelling must match.

### Issue: RLS policy errors
**Solution:** Verify the user is authenticated and has proper permissions.

## Files Created

### Database
- `supabase/migrations/20251010000000-agent-licensing-system.sql` - Main migration
- `supabase/migrations/20251010000001-seed-licensing-data.sql` - Seed data
- `supabase/migrations/helper-setup-agent-licenses.sql` - Helper script

### Frontend
- `src/components/AgentLicenseManager.tsx` - License management UI
- `src/components/EligibleAgentFinder.tsx` - Agent search UI
- `src/pages/AgentLicensing.tsx` - Main page combining both
- Updated `src/App.tsx` - Added route
- Updated `src/components/NavigationHeader.tsx` - Added menu item

### Documentation
- `AGENT_LICENSING_SYSTEM.md` - This file

## Contact & Support
For questions or issues with the Agent Licensing System, contact the development team.
