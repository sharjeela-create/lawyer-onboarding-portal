# Dashboard Commission Stats for Closers

## Overview
The main Dashboard now displays commission statistics for licensed agents, providing visibility into their pending commission approvals and product type breakdown.

## Implementation Details

### Features Added

#### 1. **Licensed Agent Detection**
- Automatically detects if logged-in user is a licensed agent
- Checks `profiles` table for `display_name` 
- Uses `display_name` to match against `licensed_agent_account` in `daily_deal_flow`

#### 2. **Commission Stats Cards (4 Additional Cards)**

**For Closers Only**, the dashboard displays 8 stat cards total (2 rows):

**Row 1 - Standard Stats (All Users):**
1. Total Leads
2. Submitted
3. Pending
4. This Week

**Row 2 - Commission Stats (Closers Only):**
5. **Pending Commissions** - Total count of pending approvals
6. **Total Premium** - Sum of all monthly premiums for pending commissions
7. **Level Products** - Count and percentage of Level products
8. **GI Products** - Count and percentage of GI products (including GTL Graded)

#### 3. **Product Type Classification**

**Level Products:**
- Products with `product_type = 'Level'`
- Products with `product_type = 'Graded'` (EXCEPT GTL Graded)

**GI Products:**
- Products with `product_type = 'GI'`
- Products with `product_type = 'Immediate'`
- Products with `product_type = 'ROP'` (Return of Premium)
- Products with `product_type = 'Modified'`
- Products with `product_type = 'Standard'`
- Products with `product_type = 'Preferred'`
- **GTL Graded** - Products with `carrier = 'GTL'` AND `product_type = 'Graded'`

### Technical Implementation

#### State Management
```typescript
// Commission stats for licensed agents
const [commissionStats, setCommissionStats] = useState({
  totalPending: 0,
  totalPremium: 0,
  levelProducts: 0,
  giProducts: 0,
});

const [isLicensedAgent, setIsLicensedAgent] = useState(false);
const [licensedAgentName, setLicensedAgentName] = useState<string>('');
```

#### Functions

**`checkIfLicensedAgent()`**
- Checks if user has a `display_name` in profiles table
- Sets licensed agent status and name
- Triggers commission stats fetch

**`fetchCommissionStats(displayName)`**
- Queries `daily_deal_flow` table
- Filters by `licensed_agent_account = displayName`
- Filters by `status = 'Pending Approval'`
- Calculates totals and product type breakdown
- Special logic for GTL Graded classification

#### Product Classification Logic
```typescript
// GTL Graded → GI
if (productType.includes('graded') && carrier.includes('gtl')) {
  giCount++;
}
// Level or non-GTL Graded → Level
else if (productType.includes('level') || productType.includes('graded')) {
  levelCount++;
}
// GI-related products → GI
else if (
  productType.includes('gi') ||
  productType.includes('immediate') ||
  productType.includes('rop') ||
  productType.includes('modified') ||
  productType.includes('standard') ||
  productType.includes('preferred')
) {
  giCount++;
}
```

### UI/UX

#### Visual Design

**Standard Users (4 Cards):**
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Total Leads │ Submitted   │ Pending     │ This Week   │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**Closers (8 Cards in 2 Rows):**
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Total Leads │ Submitted   │ Pending     │ This Week   │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ Pending     │ Total       │ Level       │ GI          │
│ Commissions │ Premium     │ Products    │ Products    │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

#### Card Details

**Pending Commissions Card:**
- Icon: DollarSign (emerald-500)
- Shows: Total count of pending commission approvals
- Example: "47"

**Total Premium Card:**
- Icon: DollarSign (green-600)
- Shows: Sum of all monthly premiums
- Example: "$56,195.68"

**Level Products Card:**
- Icon: BarChart3 (blue-600)
- Shows: Count of Level products
- Sub-text: Percentage of total
- Example: "31 (19% of total)"

**GI Products Card:**
- Icon: BarChart3 (orange-600)
- Shows: Count of GI products (including GTL Graded)
- Sub-text: Percentage of total
- Example: "125 (81% of total)"

### Data Source

**Table:** `daily_deal_flow`

**Filters:**
- `licensed_agent_account = [user's display_name]`
- `status = 'Pending Approval'`

**Fields Used:**
- `monthly_premium` - For total premium calculation
- `face_amount` - For face amount totals (available but not shown)
- `product_type` - For product classification
- `carrier` - For GTL Graded identification

### Example Scenarios

#### Scenario 1: Regular Agent (Non-Licensed)
**User:** John (Buffer Agent)
**Display:** 4 stat cards only
- No commission stats shown
- Standard analytics only

#### Scenario 2: Licensed Agent
**User:** Benjamin (Licensed Agent)
**Display:** 8 stat cards
- Standard analytics (row 1)
- Commission stats (row 2)
- Data filtered by `licensed_agent_account = 'Benjamin'`

#### Scenario 3: Product Classification
**Licensed Agent:** Claudia

**Pending Products:**
- 12 Level → Counted as Level
- 28 Non-GTL Graded → Counted as Level
- 166 GI → Counted as GI
- 131 Immediate → Counted as GI
- 48 ROP → Counted as GI
- 5 Preferred → Counted as GI
- (Hypothetical) 10 GTL Graded → Counted as GI

**Result:**
- Level Products: 40 (10%)
- GI Products: 360 (90%)

### Benefits

1. **Unified Dashboard** - Licensed agents see all relevant data in one place
2. **Product Mix Visibility** - Understand balance between Level and GI products
3. **Performance Tracking** - Quick view of pending commissions
4. **Revenue Visibility** - Total premium gives revenue insight
5. **Accurate Classification** - GTL Graded correctly counted as GI per business rules

### Future Enhancements (Optional)

- [ ] Add trend indicators (↑ ↓) for week-over-week changes
- [ ] Add drill-down to view detailed list of pending commissions
- [ ] Add average premium per product type
- [ ] Add face amount totals
- [ ] Add commission amount estimates
- [ ] Add month-to-date tracking
- [ ] Add year-to-date comparison

### Testing

**Test Case 1: Licensed Agent Login**
1. Login as user with `display_name` in profiles
2. Verify 8 stat cards appear
3. Verify commission numbers match Commission Portal

**Test Case 2: Regular Agent Login**
1. Login as user without `display_name`
2. Verify only 4 stat cards appear
3. Verify no commission stats shown

**Test Case 3: Product Classification**
1. Check a licensed agent with GTL Graded products
2. Verify GTL Graded counted in GI Products, not Level
3. Verify percentages add up correctly

**Test Case 4: Empty State**
1. Login as licensed agent with no pending commissions
2. Verify all commission stats show 0
3. Verify no errors occur

### Database Query Performance

The commission stats are fetched with a single query:
```sql
SELECT monthly_premium, face_amount, product_type, carrier
FROM daily_deal_flow
WHERE licensed_agent_account = '[display_name]'
  AND status = 'Pending Approval'
```

**Performance:** Fast query with indexed columns
**Data Volume:** Typically 100-500 rows per licensed agent
**Refresh:** On dashboard load and after data changes

## Notes

- Commission stats only shown when user has `display_name` in profiles table
- GTL Graded is specifically treated as GI product per business requirements
- Stats refresh automatically when dashboard loads
- Numbers formatted with thousand separators for readability
- Percentages rounded to nearest whole number

## Support

For issues or questions:
1. Verify user has `display_name` in profiles table
2. Check that `licensed_agent_account` matches display name exactly
3. Verify `status = 'Pending Approval'` in daily_deal_flow
4. Check browser console for any errors
