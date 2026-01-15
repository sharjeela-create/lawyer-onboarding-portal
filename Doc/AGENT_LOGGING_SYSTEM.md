# Agent Performance Logging & Reporting System

## Overview

This system provides comprehensive logging and reporting for agent performance tracking, including both Closers (LA) and Buffer Closers. It tracks every significant event in the verification and call result workflow to provide detailed analytics.

## Database Schema

### Call Update Logs Table (`call_update_logs`)

Stores individual events for tracking agent performance:

```sql
- id: UUID (Primary Key)
- submission_id: TEXT (References lead submission)
- agent_id: UUID (References auth.users)
- agent_type: TEXT ('buffer' or 'licensed')
- agent_name: TEXT (Display name of agent)
- event_type: TEXT (Type of event - see Event Types below)
- event_details: JSONB (Additional context data)
- session_id: UUID (Optional session reference)
- verification_session_id: UUID (References verification_sessions)
- call_result_id: UUID (References call result)
- customer_name: TEXT (Customer name for reporting)
- lead_vendor: TEXT (Lead vendor for analytics)
- created_at: TIMESTAMP (Event timestamp)
- updated_at: TIMESTAMP (Last updated)
```

### Daily Agent Stats View (`daily_agent_stats`)

Aggregated daily statistics for agent performance:

```sql
- log_date: DATE
- agent_id: UUID
- agent_name: TEXT
- agent_type: TEXT ('buffer' or 'licensed')
- picked_up_calls: INTEGER
- dropped_calls: INTEGER (LA only)
- not_submitted: INTEGER (LA only)
- submitted_sales: INTEGER (LA only)
- disconnected_calls: INTEGER (Buffer only)
- transferred_to_agent_calls: INTEGER (Buffer only)
- not_submitted_transfers: INTEGER (Buffer only)
- submitted_transfers_sales: INTEGER (Buffer only)
```

## Event Types

### Licensed Agent (LA) Events

1. **`verification_started`** - LA starts verification process directly
2. **`call_claimed`** - LA claims a dropped call
3. **`call_dropped`** - LA drops/loses a call
4. **`application_submitted`** - LA successfully submits an application
5. **`application_not_submitted`** - LA completes call but doesn't submit application

### Buffer Agent Events

1. **`verification_started`** - Buffer agent starts verification workflow
2. **`call_picked_up`** - Buffer agent connects with customer
3. **`call_disconnected`** - Buffer agent loses connection or call drops
4. **`transferred_to_la`** - Buffer agent transfers call to Licensed Agent
5. **`application_submitted`** - Final result: application was submitted (tracked on transfer)
6. **`application_not_submitted`** - Final result: application was not submitted (tracked on transfer)

## Logging Implementation

### Automatic Logging Points

1. **StartVerificationModal** - Logs when verification starts
2. **VerificationPanel** - Logs transfers to LA and call drops
3. **CallResultForm** - Logs final application results
4. **ClaimDroppedCallModal** - Logs when calls are claimed

### Manual Logging

Use the `logCallUpdate` function from `@/lib/callLogging`:

```typescript
import { logCallUpdate, getLeadInfo } from "@/lib/callLogging";

// Example: Log a call pickup
const { customerName, leadVendor } = await getLeadInfo(submissionId);
await logCallUpdate({
  submissionId,
  agentId: agent.id,
  agentType: 'buffer',
  agentName: agent.display_name,
  eventType: 'call_picked_up',
  eventDetails: {
    workflow_type: 'buffer_to_la',
    session_id: sessionId
  },
  verificationSessionId: sessionId,
  customerName,
  leadVendor
});
```

## Reporting Dashboard

### Access
Navigate to `/reports` in the application to view the Agent Reports & Call Logs dashboard.

### Features

#### Summary Statistics Cards
- LA Picked Up Calls
- LA Dropped Calls  
- LA Sales (Submitted Applications)
- Buffer Picked Up Calls
- Buffer Transferred Calls

#### Agent Statistics Table
Daily aggregated performance metrics per agent showing:
- Date
- Agent Name & Type
- Calls Picked Up
- Calls Dropped/Disconnected
- Calls Transferred (Buffer only)
- Applications Not Submitted
- Applications Submitted

#### Call Logs Table
Detailed event log showing:
- Timestamp
- Agent & Type
- Event Type
- Customer Name
- Lead Vendor
- Submission ID

### Filters
- Agent Type (All/Buffer/Licensed)
- Specific Agent
- Date Range (Start/End Date)

### Export Functionality
- Export Agent Stats to CSV
- Export Call Logs to CSV

## Key Metrics Tracked

### Licensed Agent Stats
- **Picked up calls**: Verification started or call claimed
- **Dropped calls**: Calls lost/dropped by LA
- **Not submitted**: Calls handled but no application submitted
- **Submitted sales**: Successfully submitted applications

### Buffer Agent Stats  
- **Picked up calls**: Successfully connected with customer
- **Disconnected calls**: Lost connection during call
- **Transferred to agent calls**: Successfully transferred to LA
- **Not submitted transfers**: Transfers that didn't result in submissions
- **Submitted transfers sales**: Transfers that resulted in successful submissions

## Setup Instructions

### 1. Apply Database Migration

```bash
# Navigate to your Supabase project
cd supabase

# Apply the migration
supabase db push
```

### 2. Update TypeScript Types

After applying the migration, regenerate TypeScript types:

```bash
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

### 3. Update Call Logging Functions

Replace the mock functions in `src/lib/callLogging.ts` with the real implementations that use the new database tables.

### 4. Verify Logging

Check that events are being logged correctly by:
1. Starting a verification session
2. Performing various actions (transfers, drops, submissions)
3. Viewing the logs in the Reports dashboard

## Event Details Schema

Each event can include additional context in the `event_details` JSONB field:

### Common Fields
```json
{
  "workflow_type": "buffer_to_la" | "direct_la",
  "session_id": "uuid",
  "timestamp": "ISO-8601-string"
}
```

### Application Submission Events
```json
{
  "status": "Submitted" | "Underwriting" | "DQ" | "Not Interested",
  "carrier": "Liberty" | "SBLI" | etc.,
  "monthly_premium": number,
  "coverage_amount": number,
  "call_source": "First Time Transfer" | "Reconnected Transfer" | "Agent Callback",
  "dq_reason": string | null,
  "sent_to_underwriting": boolean
}
```

### Transfer Events
```json
{
  "verification_session_id": "uuid",
  "transferred_at": "ISO-8601-string",
  "buffer_agent_id": "uuid",
  "licensed_agent_id": "uuid"
}
```

## Performance Considerations

- Indexes are created on frequently queried fields
- Daily aggregation view reduces query complexity
- Row Level Security (RLS) ensures data access control
- Automatic `updated_at` timestamp management

## Future Enhancements

1. **Real-time Dashboard Updates** - WebSocket integration for live stats
2. **Advanced Analytics** - Conversion rates, time-based metrics
3. **Agent Performance Alerts** - Notifications for performance thresholds
4. **Custom Report Builder** - User-defined report parameters
5. **Integration with External BI Tools** - API endpoints for data export
6. **Mobile Dashboard** - Responsive design for mobile access

## Troubleshooting

### Common Issues

1. **Migration Fails**: Ensure no existing data conflicts with new schema
2. **Logging Not Working**: Check that agent IDs are correctly passed
3. **Stats Not Updating**: Verify the daily_agent_stats view is refreshing
4. **Permission Errors**: Check RLS policies and user authentication

### Debug Logging

The system includes comprehensive console logging for debugging:
- All logging attempts are logged to console
- Error details are captured and logged
- Failed logging attempts don't break the main workflow
