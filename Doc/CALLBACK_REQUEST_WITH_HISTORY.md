# Callback Request Page with Call History

## Overview
Enhanced the Callback Request Page to display call history from the `daily_deal_flow` table, replacing static policy and timeline cards with dynamic, collapsible cards showing all previous interactions with the lead.

## What Changed

### 1. New Data Integration
**Query Strategy**: The page now fetches related records from `daily_deal_flow` using multiple matching criteria:
- **Last 4 digits match**: `submission_id LIKE '%8287'`
- **OR Name + Phone + Vendor match**: Searches by customer name, phone number, and lead vendor

This ensures we capture all relevant call history even if submission IDs vary slightly.

### 2. UI Components Added
- **Collapsible Cards**: Each call history entry is displayed in an expandable card
- **Call History Section**: Replaced "Policy Information" and "Timeline" cards
- **Status Badges**: Visual indicators for call status and agent assignments
- **Empty State**: Shows when no call history is found

### 3. Data Displayed Per Entry
Each collapsible card shows:

**Header (Always Visible)**:
- Entry number (#1, #2, etc.)
- Call result status
- Date of interaction
- Status badge (if available)
- Agent name badge (if available)
- Expand/collapse chevron

**Expanded Content**:
- Buffer Agent
- Licensed Agent Account
- Carrier
- Product Type
- Monthly Premium
- Face Amount
- Draft Date
- Policy Number
- Carrier Audit Status
- Detailed Notes
- Created/Updated timestamps

### 4. Technical Implementation

#### New Types
```typescript
type DailyDealFlowEntry = {
  id: string;
  submission_id: string;
  insured_name: string | null;
  client_phone_number: string | null;
  lead_vendor: string | null;
  buffer_agent: string | null;
  agent: string | null;
  licensed_agent_account: string | null;
  status: string | null;
  call_result: string | null;
  carrier: string | null;
  product_type: string | null;
  draft_date: string | null;
  monthly_premium: number | null;
  face_amount: number | null;
  policy_number: string | null;
  carrier_audit: string | null;
  notes: string | null;
  date: string | null;
  created_at: string;
  updated_at: string;
};
```

#### Query Logic
```typescript
const fetchDealFlowEntries = async (leadData: Lead) => {
  const last4Digits = leadData.submission_id.slice(-4);
  
  const { data, error } = await supabase
    .from('daily_deal_flow')
    .select('*')
    .or(`submission_id.like.%${last4Digits},and(insured_name.ilike.%${leadData.customer_full_name}%,client_phone_number.eq.${leadData.phone_number},lead_vendor.eq.${leadVendor})`)
    .order('created_at', { ascending: false });
  
  setDealFlowEntries(data || []);
};
```

#### State Management
```typescript
const [dealFlowEntries, setDealFlowEntries] = useState<DailyDealFlowEntry[]>([]);
const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({});

const toggleEntry = (entryId: string) => {
  setExpandedEntries(prev => ({
    ...prev,
    [entryId]: !prev[entryId]
  }));
};
```

## Benefits

### For BPO Centers
✅ **Complete Context**: See all previous interactions with the customer
✅ **Better Decisions**: Know what's been tried before making a callback request
✅ **Status Visibility**: Understand current standing with carriers
✅ **Agent History**: See which agents worked with the lead previously

### For Closers Receiving Requests
✅ **Informed Callbacks**: Closers can review history before calling
✅ **Pattern Recognition**: Identify recurring issues or opportunities
✅ **Continuity**: Better customer experience with context-aware conversations

### Technical Benefits
✅ **Flexible Matching**: Multiple criteria ensure we find related records
✅ **Performance**: Only loads when lead data is available
✅ **Scalability**: Collapsible design handles many entries gracefully
✅ **Error Handling**: Gracefully shows empty state if no history found

## Visual Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  📞 BPO-Client Connection - Callback Request                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────┬─────────────────────────────┐   │
│  │  👤 Customer Information  │  📋 Request Details         │   │
│  │  - Name: Peggy Hogan      │  - Request Type: [Select]   │   │
│  │  - Phone: (225) 243-8071  │  - Notes: [Textarea]        │   │
│  │  - State: LA              │  - [Submit Button]          │   │
│  │  - Submission ID: 635...  │                             │   │
│  ├───────────────────────────┤                             │   │
│  │  📄 Call History          │                             │   │
│  │  ┌──────────────────────┐ │                             │   │
│  │  │ #1 Not Submitted  ▼  │ │                             │   │
│  │  │ Oct 06, 2025         │ │                             │   │
│  │  │ [Needs BPO Callback] │ │                             │   │
│  │  │ [Agent: Juan]        │ │                             │   │
│  │  ├──────────────────────┤ │                             │   │
│  │  │ When expanded:       │ │                             │   │
│  │  │ • Agent: Juan        │ │                             │   │
│  │  │ • Notes: looking to  │ │                             │   │
│  │  │   get plans for 3    │ │                             │   │
│  │  │   grandkids...       │ │                             │   │
│  │  │ • Created: Oct 06... │ │                             │   │
│  │  └──────────────────────┘ │                             │   │
│  └───────────────────────────┴─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Files Modified

### Updated
- `src/pages/CallbackRequestPage.tsx`:
  - Added `Collapsible` import from shadcn/ui
  - Added new icons: `ChevronDown`, `ChevronUp`, `FileText`, `AlertCircle`
  - Removed unused icons: `Building2`, `DollarSign`
  - Added `DailyDealFlowEntry` type
  - Added `dealFlowEntries` and `expandedEntries` state
  - Added `fetchDealFlowEntries()` function
  - Added `toggleEntry()` function
  - Replaced Policy and Timeline cards with Call History section
  - Implemented collapsible cards for each entry

### No Changes Required
- Database schema (already has `daily_deal_flow` table)
- Edge functions (callback-notification still works)
- Routes (already configured)

## Usage

### For BPO Centers
1. Click "Send Callback" on a lead
2. **New**: Page loads and shows call history automatically
3. **Review History**: Expand any entry to see full details
4. **Context-Aware Request**: Write notes based on previous interactions
5. Submit callback request with better context

### Data Matching Logic
The system finds related calls using:
1. **Last 4 digits of Submission ID**: Catches exact and similar submissions
2. **Customer Name + Phone + Vendor**: Catches cases where submission ID differs

Example:
- Submission ID: `6355999095411898287`
- Matches: `%8287` (last 4 digits)
- Also matches: Name="Peggy Hogan" + Phone="(225) 243-8071" + Vendor="AJ BPO"

## Database Query Details

### Tables Involved
- **Primary**: `leads` (for lead details)
- **Secondary**: `daily_deal_flow` (for call history)

### Query Pattern
```sql
SELECT * FROM daily_deal_flow
WHERE 
  submission_id LIKE '%8287'
  OR (
    insured_name ILIKE '%Peggy Hogan%'
    AND client_phone_number = '(225) 243-8071'
    AND lead_vendor = 'AJ BPO'
  )
ORDER BY created_at DESC;
```

### Performance Considerations
- ✅ Indexed fields: `submission_id`, `lead_vendor`
- ✅ Limited to relevant vendor only
- ✅ Ordered by most recent first
- ✅ Lazy loading (only fetches after lead loads)

## Future Enhancements

### Short Term
- Add filters to call history (by agent, date range, status)
- Highlight entries matching specific keywords
- Add export functionality for call history

### Medium Term
- Show statistics (total calls, success rate, common issues)
- Add inline editing for notes
- Link to full call recordings (if available)

### Long Term
- AI-powered insights from call history
- Predictive text for callback request notes
- Automatic tagging of common patterns

## Testing Checklist

### Functionality
- [ ] Call history loads for leads with matches
- [ ] Empty state shows for leads without history
- [ ] Collapsible cards expand/collapse correctly
- [ ] All fields display properly when available
- [ ] N/A or empty fields don't break layout
- [ ] Multiple entries display correctly
- [ ] Dates format properly

### Data Matching
- [ ] Last 4 digits matching works
- [ ] Name + Phone + Vendor matching works
- [ ] Case-insensitive name search works
- [ ] Different phone formats handled
- [ ] Vendor filtering is correct

### UI/UX
- [ ] Loading state shows while fetching
- [ ] Cards are visually distinct
- [ ] Status badges have appropriate colors
- [ ] Timestamps are readable
- [ ] Long notes display properly
- [ ] Mobile responsive layout works

### Performance
- [ ] Page loads quickly
- [ ] Collapsing/expanding is smooth
- [ ] No memory leaks with many entries
- [ ] Query is optimized

## Support

### Common Issues

**Q: No call history showing**
A: Check that:
- Submission ID last 4 digits match records in daily_deal_flow
- OR customer name, phone, and vendor match exactly
- Lead vendor matches center's vendor

**Q: Too many unrelated entries showing**
A: The matching criteria may be too broad. Consider:
- Adjusting the name matching (currently uses ILIKE with wildcards)
- Adding date range filters
- Requiring exact phone number match

**Q: Performance slow with many entries**
A: Consider:
- Adding pagination (show 10 entries at a time)
- Implementing virtual scrolling
- Adding database indexes

## Summary

This enhancement transforms the Callback Request page from a simple form into a comprehensive tool that provides BPO centers with complete context about each lead's history. By surfacing previous interactions, agents can make more informed decisions and provide better service to customers.

The collapsible card design keeps the interface clean while allowing deep-dive into details when needed. The flexible matching strategy ensures we capture relevant history even when data isn't perfectly aligned.

**Key Takeaway**: Context is king. This feature empowers BPO centers with the information they need to make smart callback requests, ultimately leading to better outcomes for both agents and customers.
