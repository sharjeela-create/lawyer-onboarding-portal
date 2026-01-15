# Agent Licensing System - Quick Start Guide

## 🚀 What You Have Now

✅ **Database Tables Created:**
- `carriers` - 17 carriers preloaded
- `states` - 54 states/territories preloaded
- `agent_carrier_licenses` - Junction table for agent-carrier relationships
- `agent_state_licenses` - Junction table for agent-state relationships

✅ **Database Functions:**
- `get_eligible_agents(carrier, state)` - Find all eligible agents
- `is_agent_eligible(agent_id, carrier, state)` - Check specific agent
- `get_agent_licensing_summary(agent_id)` - Get agent summary

✅ **UI Components:**
- Agent License Manager - Configure agent licenses
- Eligible Agent Finder - Search for eligible agents
- Combined page at `/agent-licensing`

## 🎯 How to Use

### Step 1: Set Up Agent Licenses

**Option A: Use the UI (Recommended)**
1. Navigate to **Menu → Agent Licensing**
2. Select "Manage Licenses" tab
3. Choose an agent from the dropdown
4. Check/uncheck carriers and states
5. Click "Save Changes"

**Option B: Use SQL Helper Script**
1. Edit `helper-setup-agent-licenses.sql`
2. Replace `'AGENT_EMAIL_HERE'` with agent's email
3. Modify carrier and state lists
4. Run the script in Supabase SQL Editor

### Step 2: Find Eligible Closers

**Option A: Use the UI**
1. Navigate to **Menu → Agent Licensing**
2. Select "Find Closers" tab
3. Enter carrier name (e.g., "Americo")
4. Enter state name (e.g., "California")
5. Click "Search for Eligible Closers"

**Option B: Use SQL Query**
```sql
SELECT * FROM get_eligible_agents('Americo', 'California');
```

### Step 3: Integrate Into Your Workflow

**Example: Filter Closers in Claim Modal**
```typescript
// In your claim modal component
const fetchEligibleAgents = async (lead) => {
  const { data: agents } = await supabase
    .rpc('get_eligible_agents', {
      p_carrier_name: lead.carrier,
      p_state_name: lead.state
    });
  
  setAvailableAgents(agents || []);
};
```

**Example: Validate Agent Assignment**
```typescript
// Before assigning a lead
const { data: isEligible } = await supabase
  .rpc('is_agent_eligible', {
    p_agent_user_id: selectedAgentId,
    p_carrier_name: lead.carrier,
    p_state_name: lead.state
  });

if (!isEligible) {
  toast({
    title: 'Agent Not Eligible',
    description: 'This agent is not licensed for this carrier/state combination',
    variant: 'destructive'
  });
  return;
}
```

## 📊 Example Data Setup

### Example Agent: Ben
Based on your requirements, here's the setup for agent Ben:

**Licensed Carriers (10):**
- Liberty Bankers ✅
- AMAM ✅
- Pioneer ✅
- Occidental ✅
- MOA ✅
- Royal Neighbors ✅
- Aetna ✅
- Americo ✅
- CoreBridge ✅
- TransAmerica ✅

**NOT Licensed Carriers (7):**
- Aflac ❌
- CICA ❌
- GTL ❌
- SBLI ❌
- Chubb ❌
- Foresters ❌
- Baltimore Life ❌

**Licensed States (41):**
Alabama, Alaska, Arizona, Arkansas, California, Colorado, Connecticut, District of Columbia, Florida, Georgia, Idaho, Illinois, Indiana, Iowa, Kansas, Kentucky, Louisiana, Maine, Maryland, Massachusetts, Michigan, Minnesota, Mississippi, Missouri, Montana, Nebraska, New Jersey, New York, North Carolina, Ohio, Oklahoma, Oregon, Pennsylvania, South Carolina, Tennessee, Texas, Utah, Virginia, Washington, West Virginia, Wisconsin

**NOT Licensed States (13):**
Delaware, Guam, Hawaii, Nevada, New Hampshire, New Mexico, North Dakota, Puerto Rico, Rhode Island, South Dakota, Vermont, Virgin Islands, Wyoming

## 🔍 Common Queries

### View All Carriers
```sql
SELECT carrier_name, is_active 
FROM carriers 
ORDER BY carrier_name;
```

### View All States
```sql
SELECT state_name, state_code 
FROM states 
ORDER BY state_name;
```

### View Agent's Licenses
```sql
-- Carrier licenses
SELECT 
  c.carrier_name,
  acl.is_licensed
FROM agent_carrier_licenses acl
JOIN carriers c ON c.id = acl.carrier_id
WHERE acl.agent_user_id = 'YOUR_AGENT_USER_ID'
ORDER BY c.carrier_name;

-- State licenses
SELECT 
  s.state_name,
  asl.is_licensed
FROM agent_state_licenses asl
JOIN states s ON s.id = asl.state_id
WHERE asl.agent_user_id = 'YOUR_AGENT_USER_ID'
ORDER BY s.state_name;
```

### Find Eligible Closers for Lead
```sql
-- Example: Americo in California
SELECT * FROM get_eligible_agents('Americo', 'California');

-- Example: Liberty Bankers in Texas
SELECT * FROM get_eligible_agents('Liberty Bankers', 'Texas');
```

### Check Agent Eligibility
```sql
-- Check if specific agent can handle a lead
SELECT is_agent_eligible(
  'YOUR_AGENT_USER_ID',
  'Americo',
  'California'
) as is_eligible;
```

### Get Agent Summary
```sql
SELECT * FROM get_agent_licensing_summary('YOUR_AGENT_USER_ID');
```

## 🛠️ Next Steps

1. **Set up licenses for all your agents** using the UI or SQL
2. **Test the search functionality** with different carrier/state combinations
3. **Integrate into lead assignment logic** to filter eligible agents
4. **Add validation** to prevent assignment to ineligible agents
5. **Monitor and maintain** licenses as agents get certified

## 💡 Pro Tips

- **Case-insensitive search**: Functions handle "california", "California", "CALIFORNIA" all the same
- **Partial matching**: Make sure to use exact carrier/state names from the database
- **Bulk operations**: Use "Select All" / "Deselect All" buttons for efficiency
- **License tracking**: Use the optional `license_start_date` and `license_end_date` fields for expiration management

## 🚨 Troubleshooting

**No agents in dropdown?**
→ Check that agents have profiles in the `profiles` table

**Can't save changes?**
→ Ensure you're logged in as an admin (user with `agent_code`)

**Search returns empty?**
→ Verify exact spelling of carrier/state names (check the database)

**Permission errors?**
→ RLS policies require authentication and admin status for modifications

## 📞 Support

For issues or questions:
1. Check the full documentation: `AGENT_LICENSING_SYSTEM.md`
2. Review SQL migration files in `supabase/migrations/`
3. Inspect component code in `src/components/`

---

**Quick Access:** Navigate to `/agent-licensing` in your app to get started! 🎉
