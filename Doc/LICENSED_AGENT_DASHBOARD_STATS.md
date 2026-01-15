# Licensed Agent Dashboard Stats - Updated Implementation

## Overview
The Dashboard now shows comprehensive sales metrics for licensed agents, providing insights into total sales, weekly performance, daily submissions, and product mix analysis with premiums.

## New Metrics for Closers

### 📊 **Row 1: Standard Analytics (All Users)**
1. **Total Leads** - System-wide lead count
2. **Submitted** - All submitted applications
3. **Pending** - Pending leads
4. **This Week** - Leads from last 7 days

### 💼 **Row 2: Personal Sales Metrics (Closers Only)**

#### 1. Your Total Sales
- **Value**: Total count of ALL submissions by this agent
- **Data Source**: `daily_deal_flow` WHERE `licensed_agent_account = [agent_name]`
- **Time Period**: All-time
- **Icon**: CheckCircle (emerald)
- **Sub-text**: "All-time submissions"

#### 2. This Week Sales
- **Value**: Submissions in the last 7 days
- **Calculation**: Count where `created_at >= NOW() - 7 days`
- **Icon**: Calendar (blue)
- **Sub-text**: "Last 7 days"

#### 3. Premium This Week
- **Value**: Sum of `monthly_premium` for submissions in last 7 days
- **Format**: Currency with thousand separators
- **Icon**: DollarSign (green)
- **Sub-text**: "Weekly total"

#### 4. Today's Submissions
- **Value**: Submissions made today (since midnight)
- **Calculation**: Count where `created_at >= TODAY`
- **Icon**: Clock (orange)
- **Sub-text**: "So far today"

### 📈 **Product Mix Analysis (2 Large Cards)**

#### Level Products Card
**Metrics Displayed:**
- **Total Count**: Number of Level product submissions
- **Total Premium**: Sum of all Level product premiums
- **Percentage**: Level products as % of total sales
- **Avg Premium**: Average premium per Level product

**Classification:**
- `product_type = 'Level'`
- `product_type = 'Graded'` (EXCEPT GTL Graded)

#### GI Products Card
**Metrics Displayed:**
- **Total Count**: Number of GI product submissions
- **Total Premium**: Sum of all GI product premiums
- **Percentage**: GI products as % of total sales
- **Avg Premium**: Average premium per GI product

**Classification:**
- `product_type = 'GI'`
- `product_type = 'Immediate'`
- `product_type = 'ROP'` (Return of Premium)
- `product_type = 'Modified'`
- `product_type = 'Standard'`
- `product_type = 'Preferred'`
- **GTL Graded**: `carrier LIKE '%GTL%'` AND `product_type = 'Graded'`

## Visual Layout

### Regular Users (4 Cards)
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Total Leads │ Submitted   │ Pending     │ This Week   │
│   2,040     │   1,172     │    949      │    238      │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### Closers (Benjamin Example)
```
Row 1: Standard Stats
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Total Leads │ Submitted   │ Pending     │ This Week   │
│   2,040     │   1,172     │    949      │    238      │
└─────────────┴─────────────┴─────────────┴─────────────┘

Row 2: Personal Sales
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Your Total  │ This Week   │ Premium     │ Today's     │
│ Sales       │ Sales       │ This Week   │ Submissions │
│    185      │     6       │  $272.48    │     1       │
│ All-time    │ Last 7 days │ Weekly total│ So far today│
└─────────────┴─────────────┴─────────────┴─────────────┘

Product Mix Analysis (2 Large Cards)
┌─────────────────────────────────┬─────────────────────────────────┐
│ 📊 Level Products       42 sales│ 📊 GI Products         143 sales│
│ ─────────────────────────────── │ ─────────────────────────────── │
│ Total Count:          42        │ Total Count:          143       │
│ Total Premium:    $2,390.32     │ Total Premium:    $54,401.00    │
│ Percentage:           23%       │ Percentage:           77%       │
│ Avg Premium:         $57        │ Avg Premium:         $380       │
└─────────────────────────────────┴─────────────────────────────────┘
```

## Real Data Examples

### Benjamin (Licensed Agent)
```
Total Sales: 185 submissions
This Week: 6 submissions
Weekly Premium: $272.48
Today: 1 submission

Level Products:
  - Count: 42 (23%)
  - Premium: $2,390.32
  - Avg: $57/sale

GI Products:
  - Count: 143 (77%)
  - Premium: $54,401.00
  - Avg: $380/sale
```

### Claudia (Licensed Agent)
```
Total Sales: 409 submissions
This Week: 13 submissions
Weekly Premium: $673.10
Today: 0 submissions

Level Products:
  - Count: 51 (12%)
  - Premium: $7,443.82
  - Avg: $146/sale

GI Products:
  - Count: 358 (88%)
  - Premium: $28,014.88
  - Avg: $78/sale
```

## Technical Implementation

### State Structure
```typescript
const [commissionStats, setCommissionStats] = useState({
  totalSales: 0,           // All-time submissions
  thisWeekSales: 0,        // Last 7 days
  thisWeekPremium: 0,      // Sum of premiums (last 7 days)
  todaySales: 0,           // Today's count
  levelProducts: 0,        // Level product count
  giProducts: 0,           // GI product count
  levelPremium: 0,         // Level premium total
  giPremium: 0,            // GI premium total
});
```

### Data Fetching
```typescript
// Get ALL submissions for licensed agent (not filtered by status)
const { data } = await supabase
  .from('daily_deal_flow')
  .select('monthly_premium, face_amount, product_type, carrier, created_at, date')
  .eq('licensed_agent_account', displayName);
```

### Date Calculations
```typescript
const now = new Date();
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

// Filter for this week
const thisWeekSales = submissionData.filter(item => {
  const itemDate = new Date(item.created_at || item.date);
  return itemDate >= weekAgo;
}).length;

// Filter for today
const todaySales = submissionData.filter(item => {
  const itemDate = new Date(item.created_at || item.date);
  return itemDate >= todayStart;
}).length;
```

### Product Classification
```typescript
submissionData.forEach(item => {
  const productType = item.product_type?.toLowerCase() || '';
  const carrier = item.carrier?.toLowerCase() || '';
  const premium = item.monthly_premium || 0;
  
  if (productType.includes('graded') && carrier.includes('gtl')) {
    giCount++;
    giPremium += premium;
  }
  else if (productType.includes('level') || productType.includes('graded')) {
    levelCount++;
    levelPremium += premium;
  }
  else if (
    productType.includes('gi') ||
    productType.includes('immediate') ||
    // ... other GI types
  ) {
    giCount++;
    giPremium += premium;
  }
});
```

## Key Features

### 1. Real-Time Performance Tracking
- **Daily Progress**: See how many submissions today
- **Weekly Trends**: Track weekly performance
- **Revenue Visibility**: Monitor weekly premium intake

### 2. Product Mix Analysis
- **Visual Comparison**: Side-by-side Level vs GI cards
- **Detailed Breakdown**: Count, premium, percentage, average
- **Strategic Insights**: Understand product balance

### 3. Historical Context
- **All-Time Stats**: Total career submissions
- **Time-Based Filtering**: Week and day breakdowns
- **Premium Tracking**: Revenue per time period

### 4. User Experience
- **Conditional Display**: Only shown to licensed agents
- **Clean Layout**: 8 cards in 2 rows + 2 large product cards
- **Clear Labels**: Descriptive sub-text for context
- **Number Formatting**: Thousand separators and currency

## Benefits

1. **Performance Monitoring** - Track daily and weekly progress
2. **Goal Achievement** - See today's submissions vs targets
3. **Revenue Insights** - Understand premium generation
4. **Product Strategy** - Analyze Level vs GI mix
5. **Historical Context** - All-time achievement tracking
6. **Decision Making** - Data-driven product selection

## Business Rules

### GTL Graded Classification
- **Rule**: GTL Graded products count as GI (not Level)
- **Reason**: Business requirement for commission calculation
- **Implementation**: Check carrier = 'GTL' AND product_type = 'Graded'

### Time Periods
- **This Week**: Last 7 days (rolling)
- **Today**: Since midnight (00:00:00 local time)
- **All-Time**: No date filter

### Status Filtering
- **Changed**: Now includes ALL submissions (not just 'Pending Approval')
- **Reason**: Show complete sales performance
- **Impact**: Higher counts reflecting actual sales activity

## Testing Checklist

- [ ] Licensed agent sees 8 stat cards + 2 product cards
- [ ] Regular user sees only 4 stat cards
- [ ] Total Sales matches all submissions in daily_deal_flow
- [ ] This Week filters correctly (last 7 days)
- [ ] Today's count accurate (since midnight)
- [ ] Weekly premium calculates correctly
- [ ] Level products exclude GTL Graded
- [ ] GI products include GTL Graded
- [ ] Percentages add up to 100%
- [ ] Average premiums calculate correctly
- [ ] Numbers format with thousand separators
- [ ] Currency displays with $ symbol

## Future Enhancements

- [ ] Add month-to-date tracking
- [ ] Show trends (↑ ↓) vs previous period
- [ ] Add charts for visual trend analysis
- [ ] Include face amount totals
- [ ] Add carrier breakdown
- [ ] Show conversion rates
- [ ] Add daily target indicators
- [ ] Export stats to CSV
- [ ] Email weekly summary reports

## Support

**Common Issues:**
1. No stats showing → Check if user has `display_name` in profiles
2. Wrong data → Verify `licensed_agent_account` matches exactly
3. Missing today's sales → Check system timezone settings
4. Premium mismatch → Verify NULL handling in monthly_premium

**Debug Query:**
```sql
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN created_at >= CURRENT_DATE THEN 1 ELSE 0 END) as today,
  SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 ELSE 0 END) as week,
  SUM(monthly_premium) as total_premium
FROM daily_deal_flow
WHERE licensed_agent_account = '[agent_name]';
```
