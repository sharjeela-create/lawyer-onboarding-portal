# Agent Licensing System - Data Flow & Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     AGENT LICENSING SYSTEM                       │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                         DATABASE LAYER                           │
│                         (Supabase)                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐         ┌─────────────┐                        │
│  │  carriers   │         │   states    │                        │
│  │  (17 rows)  │         │  (54 rows)  │                        │
│  ├─────────────┤         ├─────────────┤                        │
│  │ id (PK)     │         │ id (PK)     │                        │
│  │ name        │         │ name        │                        │
│  │ code        │         │ code        │                        │
│  │ is_active   │         │ is_active   │                        │
│  └─────────────┘         └─────────────┘                        │
│         │                        │                               │
│         │                        │                               │
│         ▼                        ▼                               │
│  ┌──────────────────────────────────────────┐                   │
│  │   agent_carrier_licenses (Junction)      │                   │
│  ├──────────────────────────────────────────┤                   │
│  │ agent_user_id (FK) → auth.users          │                   │
│  │ carrier_id (FK) → carriers               │                   │
│  │ is_licensed (BOOL)                       │                   │
│  │ license_start_date                       │                   │
│  │ license_end_date                         │                   │
│  └──────────────────────────────────────────┘                   │
│                                                                   │
│  ┌──────────────────────────────────────────┐                   │
│  │   agent_state_licenses (Junction)        │                   │
│  ├──────────────────────────────────────────┤                   │
│  │ agent_user_id (FK) → auth.users          │                   │
│  │ state_id (FK) → states                   │                   │
│  │ is_licensed (BOOL)                       │                   │
│  │ license_number                           │                   │
│  │ license_start_date                       │                   │
│  │ license_end_date                         │                   │
│  └──────────────────────────────────────────┘                   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │           DATABASE FUNCTIONS                             │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │ get_eligible_agents(carrier, state)                      │    │
│  │   → Returns all agents licensed for BOTH                 │    │
│  │                                                           │    │
│  │ is_agent_eligible(agent_id, carrier, state)              │    │
│  │   → Returns TRUE/FALSE for specific agent                │    │
│  │                                                           │    │
│  │ get_agent_licensing_summary(agent_id)                    │    │
│  │   → Returns counts and lists of licenses                 │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
                                │
                                │ Supabase Client
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                              │
│                   (React + TypeScript)                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Route: /agent-licensing                                         │
│  Protection: ProtectedRoute (requires auth)                      │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         AgentLicensing Page (Tabbed Interface)          │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │                                                           │    │
│  │  Tab 1: Manage Licenses                                  │    │
│  │  ┌────────────────────────────────────────────────┐      │    │
│  │  │      AgentLicenseManager Component             │      │    │
│  │  ├────────────────────────────────────────────────┤      │    │
│  │  │ • Select agent from dropdown                   │      │    │
│  │  │ • View current licenses (carriers & states)    │      │    │
│  │  │ • Checkbox grid for carriers                   │      │    │
│  │  │ • Checkbox grid for states                     │      │    │
│  │  │ • Bulk select/deselect all                     │      │    │
│  │  │ • Save changes                                 │      │    │
│  │  └────────────────────────────────────────────────┘      │    │
│  │                                                           │    │
│  │  Tab 2: Find Closers                                      │    │
│  │  ┌────────────────────────────────────────────────┐      │    │
│  │  │     EligibleAgentFinder Component              │      │    │
│  │  ├────────────────────────────────────────────────┤      │    │
│  │  │ • Input: Carrier name                          │      │    │
│  │  │ • Input: State name                            │      │    │
│  │  │ • Search button                                │      │    │
│  │  │ • Results: List of eligible agents             │      │    │
│  │  │ • Badge indicators for licensing status        │      │    │
│  │  └────────────────────────────────────────────────┘      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Navigation: Menu → Agent Licensing                              │
│  Icon: ShieldCheck                                               │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow Examples

### Flow 1: Setting Up Agent Licenses

```
Admin User
    │
    ▼
Navigates to /agent-licensing
    │
    ▼
Selects "Manage Licenses" tab
    │
    ▼
Chooses "Ben" from dropdown
    │
    ▼
Component fetches Ben's current licenses
    │
    ├──> Query: agent_carrier_licenses WHERE agent_user_id = ben_id
    │
    └──> Query: agent_state_licenses WHERE agent_user_id = ben_id
    │
    ▼
Admin checks/unchecks carriers and states
    │
    ▼
Admin clicks "Save Changes"
    │
    ▼
Component upserts license records
    │
    ├──> UPSERT: agent_carrier_licenses (10 records for Ben)
    │
    └──> UPSERT: agent_state_licenses (41 records for Ben)
    │
    ▼
Success toast displayed
    │
    ▼
Licenses are now saved in database
```

### Flow 2: Finding Eligible Closers

```
User/System
    │
    ▼
Has a lead with:
    • Carrier: "Americo"
    • State: "California"
    │
    ▼
Calls get_eligible_agents() function
    │
    ▼
Database performs JOIN query:
    │
    ├──> profiles (all agents)
    ├──> agent_carrier_licenses (filtered by "Americo")
    └──> agent_state_licenses (filtered by "California")
    │
    ▼
Returns agents WHERE:
    • is_licensed = TRUE for "Americo" carrier
    • AND is_licensed = TRUE for "California" state
    │
    ▼
Result: List of eligible agents
    │
    ├──> Ben (if he's licensed for both)
    ├──> Sarah (if she's licensed for both)
    └──> Tom (if he's licensed for both)
    │
    ▼
System can now:
    • Show only these agents in claim modal
    • Auto-assign to first available
    • Validate assignment before saving
```

### Flow 3: Validating Agent Assignment

```
Licensed Agent Modal
    │
    ▼
User selects agent "Ben" to claim lead
    │
    ▼
Lead has:
    • Carrier: "Aflac"
    • State: "California"
    │
    ▼
System calls is_agent_eligible()
    │
    ├──> Check: Does Ben have Aflac carrier license?
    │        → NO (is_licensed = FALSE)
    │
    └──> Check: Does Ben have California state license?
             → YES (is_licensed = TRUE)
    │
    ▼
Function returns FALSE
    (Ben needs BOTH to be eligible)
    │
    ▼
System shows error toast:
    "Agent Not Eligible: This agent is not 
     licensed for Aflac in California"
    │
    ▼
Assignment is blocked
```

## Security Model

```
┌────────────────────────────────────────────────────────────┐
│                     ROW LEVEL SECURITY                     │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  carriers & states tables:                                 │
│  ├── SELECT: Any authenticated user ✅                     │
│  └── INSERT/UPDATE: Only admins (with agent_code) 🔒      │
│                                                             │
│  agent_carrier_licenses & agent_state_licenses:            │
│  ├── SELECT:                                               │
│  │   ├── Closers can view their own licenses ✅            │
│  │   └── Admins can view all licenses 🔒                  │
│  └── INSERT/UPDATE/DELETE: Only admins 🔒                 │
│                                                             │
│  Functions (SECURITY DEFINER):                             │
│  └── Accessible by authenticated users ✅                  │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

## Integration Points

### Current Integration:
```
/agent-licensing (Standalone Page)
    │
    └──> Manage agent licenses independently
```

### Future Integration:
```
Lead Assignment Flow
    │
    ▼
Lead ready for assignment
    │
    ├──> Get lead.carrier & lead.state
    │
    ▼
Call get_eligible_agents(carrier, state)
    │
    ▼
Filter available agents
    │
    ▼
Show only eligible agents in modal
    │
    ▼
On agent selection:
    │
    └──> Validate with is_agent_eligible()
         │
         ├──> If TRUE: Allow assignment ✅
         └──> If FALSE: Block assignment ❌
```

## Performance Characteristics

```
Table Sizes (Estimated):
    • carriers: 17 rows
    • states: 54 rows
    • agent_carrier_licenses: ~170 rows (10 agents × 17 carriers)
    • agent_state_licenses: ~540 rows (10 agents × 54 states)

Query Performance:
    • get_eligible_agents(): < 50ms (indexed)
    • is_agent_eligible(): < 10ms (indexed, filtered)
    • get_agent_licensing_summary(): < 20ms (aggregated)

Indexes:
    ✅ agent_carrier_licenses.agent_user_id
    ✅ agent_carrier_licenses.carrier_id
    ✅ agent_carrier_licenses (agent_user_id, is_licensed) WHERE is_licensed = true
    ✅ agent_state_licenses.agent_user_id
    ✅ agent_state_licenses.state_id
    ✅ agent_state_licenses (agent_user_id, is_licensed) WHERE is_licensed = true
```

## Maintenance Schedule

```
Weekly:
    • Review agent license changes
    • Verify data accuracy

Monthly:
    • Check for expiring licenses (if using date fields)
    • Generate licensing coverage report
    • Audit trail review

Quarterly:
    • Update carrier list (add/remove carriers)
    • Update state list (rare, but possible)
    • Optimize database if needed

Annually:
    • Full audit of all agent licenses
    • Archive historical data
    • Performance review
```

---

This architecture provides a scalable, secure, and user-friendly solution for managing agent licensing data while ensuring only eligible agents are assigned to appropriate leads.
