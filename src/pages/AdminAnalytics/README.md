# Admin Analytics Module

## Overview
This module provides comprehensive analytics and performance tracking for the insurance team, including agents, lead vendors, carriers, and daily sales statistics.

**🚀 Tab-Based Lazy Loading**: Data is only fetched when you click on a tab that needs it, providing instant page load and better performance.

## Performance Features
- **Tab-Based Lazy Loading**: Data only loads when clicking on Agent, Vendor, or Carrier tabs
- **Instant Page Load**: No waiting when first visiting /admin-analytics
- **Smart Caching**: Once loaded, data is cached for 5 minutes across all tabs
- **Manual Refresh**: Users can refresh data on-demand with the "Refresh Data" button
- **Loading Indicators**: Beautiful loading states for each tab while data fetches
- **No Window Refetch**: Data doesn't auto-refetch when switching tabs/windows

## Cache Strategy
- **Enabled on Demand**: Query only runs when visiting tabs that need data (agents, vendors, carriers)
- **Stale Time**: 5 minutes - Data stays fresh without refetching
- **GC Time**: 10 minutes - Cache cleared after 10 minutes of inactivity
- **Query Key**: `['admin-analytics-placements']` - Shared across all tabs
- **Retry**: 1 automatic retry on failure

## Folder Structure

```
AdminAnalytics/
├── AdminAnalytics.tsx              # Main component with state management and data logic
└── components/
    ├── AnalyticsSidebar.tsx        # Sidebar navigation for switching between tabs
    ├── AnalyticsFilters.tsx        # Filter controls (date, carrier, status)
    ├── OverviewStats.tsx           # Top-level statistics cards
    ├── AgentsPerformanceTab.tsx    # Agent performance breakdown
    ├── VendorsPerformanceTab.tsx   # Lead vendor performance breakdown
    ├── CarriersPerformanceTab.tsx  # Carrier performance breakdown
    ├── DailySalesTab.tsx           # Daily sales statistics (placeholder)
    └── AnalyticsLoadingScreen.tsx  # Animated loading screen with progress bar
```

## Components

### AdminAnalytics.tsx (Main Component)
- **Purpose**: Main container component with business logic
- **Responsibilities**:
  - Fetches all placement data from Monday.com
  - Manages state for filters and active tab
  - Calculates performance metrics for agents, vendors, and carriers
  - Coordinates child components

### AnalyticsSidebar.tsx
- **Props**: `activeTab`, `onTabChange`
- **Purpose**: Navigation sidebar with 4 main sections
- **Features**: Highlights active tab, provides icon-based navigation

### AnalyticsFilters.tsx
- **Props**: Filter values, handlers, unique carriers/statuses, onRefresh, isRefreshing
- **Purpose**: Comprehensive filtering system with manual refresh
- **Features**:
  - Time period filter (All Time, Last 7 Days, This Month, Custom Range)
  - Carrier filter (dropdown with all unique carriers)
  - Status filter (dropdown with all unique statuses)
  - **Refresh Data button** with spinning icon animation
  - Clear all filters button
  - Custom date range picker (shown when "Custom Range" selected)

### OverviewStats.tsx
- **Props**: `totalPlacements`, `totalPremium`, `avgPremium`, `activeCarriers`, `totalGiDeals`, `totalNonGiDeals`, `giPercentage`
- **Purpose**: Display 7 key metric cards at the top including GI/Non-GI statistics
- **Features**: 
  - Color-coded icons, formatted numbers
  - **GI Deals**: Count of placements with Policy Type = "GI"
  - **Non-GI Deals**: Count of placements with Policy Type = "Non GI"
  - **GI Percentage**: Percentage of GI deals vs total classified deals

### AgentsPerformanceTab.tsx
- **Props**: `agentPerformance`, `uniqueStatuses`, `selectedStatuses`, `onStatusFilterChange`
- **Purpose**: Display ranked agent performance with status and policy type filtering
- **Features**:
  - **Multi-select status filter** - Filter placements by one or multiple statuses
  - **Policy Type breakdown** - Shows GI vs Non-GI deal counts per agent
  - Status breakdown for each agent showing placement count per status
  - Ranked display (#1, #2, etc.)
  - Shows: Total Placements, Total Premium, Avg Premium, Unique Carriers
  - Color-coded metrics and policy type badges
  - Hover effects
  - Real-time filtering without API calls

### VendorsPerformanceTab.tsx
- **Props**: `vendorPerformance` (array of vendor data)
- **Purpose**: Display lead vendor performance
- **Features**: Same layout as agents, green color theme

### CarriersPerformanceTab.tsx
- **Props**: `carrierPerformance` (array of carrier data)
- **Purpose**: Display carrier performance
- **Features**: Same layout as agents, orange color theme

### DailySalesTab.tsx
- **Purpose**: Placeholder for future daily sales breakdown
- **Status**: Coming soon (does not trigger data fetch)

### TabLoading.tsx
- **Purpose**: Loading indicator shown while tab data is being fetched
- **Features**:
  - Spinning loader icon
  - Custom loading message per tab
  - Animated bouncing dots
  - Clean, centered layout
  - Better UX than full-page loading screen

## Data Flow

1. **Initial Page Load**: 
   - User navigates to `/admin-analytics`
   - Page loads instantly (NO data fetch)
   - Sidebar and empty content area render immediately
   - Default tab: "Closers" (marked as visited)

2. **First Tab Click (Closers/Vendors/Carriers)**:
   - React Query checks cache for `['admin-analytics-placements']`
   - If cache hit (< 5 min old): Use cached data instantly (no loading)
   - If cache miss: Show TabLoading component → Fetch from Monday.com → Cache result
   - Data shared across all tabs (agents, vendors, carriers)

3. **Tab Switching**:
   - **Daily tab**: No data fetch needed (placeholder)
   - **Closers/Vendors/Carriers tabs**: Use cached data (instant render)
   - No loading screen on subsequent visits to same tabs

4. **Manual Refresh**:
   - User clicks "Refresh Data" button
   - Force new API call (bypass cache)
   - Show "Refreshing..." with spinning icon
   - Update cache with new data
   - Toast notification confirms refresh

5. **Visited Tab Tracking**:
   - Track which tabs user has visited in session
   - Only fetch data when needed (agents, vendors, carriers)
   - Daily tab never triggers fetch

6. **Cache Expiry**:
   - After 5 minutes: Data becomes "stale" (still usable but will refetch in background if page revisited)
   - After 10 minutes of no use: Cache garbage collected

## Agent Mapping

The component uses a hardcoded agent email-to-name mapping:
```typescript
const agentEmailMap = {
  'isaac.r@heritageinsurance.io': 'Isaac Reed',
  'benjamin.w@unlimitedinsurance.io': 'Benjamin Wunder',
  'lydia.s@unlimitedinsurance.io': 'Lydia Sutton',
  'noah@unlimitedinsurance.io': 'Noah Brock',
  'tatumn.s@heritageinsurance.io': 'Trinity Queen'
};
```

## Monday.com Column IDs

- **Agent**: `color_mkq0rkaw` (Sales Agent column)
- **Carrier**: `color_mknkq2qd` (Carrier column)
- **Premium**: `numbers` (Premium column)
- **Issue Date**: `date_mkq1d86z` (Issue Date column)
- **Status**: `status` (Issue Status column)
- **Lead Source**: `dropdown_mkq2x0kx` (Lead Source/Vendor column)
- **Policy Type**: `text_mkxdrsg2` (Policy Type: "GI" or "Non GI")

## Filter Logic

### Global Filters (Top of Page)
These filters affect ALL tabs and the overview stats:

### Date Filters
- **All Time**: No date filtering
- **Last 7 Days**: `placementDate >= (today - 7 days)`
- **This Month**: `placementDate.month === currentMonth`
- **Custom Range**: User-defined start and end dates

### Carrier Filter
- Filters by exact carrier name match

### Status Filter
- Filters by exact status match

### Combined Filters
- All filters work together (AND logic)
- Filters are applied sequentially to narrow down results

### Agent Performance Tab - Additional Status Filter
The Agent Performance tab has its own **multi-select status filter** that works in addition to the global filters:

- **Purpose**: Filter agent placements by specific statuses to track placement progress
- **Type**: Multi-select (can select multiple statuses at once)
- **Behavior**: 
  - Applies AFTER global filters (date, carrier, status)
  - Works independently per agent
  - Shows status breakdown for each agent
  - Real-time filtering without page refresh
- **Example Use Cases**:
  - See only "Issued Paid" and "Issued Not Paid" placements
  - Track "Pending" placements across all agents
  - Compare "Closed as Incomplete" rates between agents

## Policy Type Classification (GI vs Non-GI)

### Overview
The system now tracks and analyzes policy placements by type, classifying them as either "GI" (Guaranteed Issue) or "Non GI" (Non-Guaranteed Issue) based on the Monday.com Policy Type column.

### Features
- **GI Deal Tracking**: Count and percentage of GI placements
- **Non-GI Deal Tracking**: Count and percentage of Non-GI placements  
- **Agent-Level Breakdown**: Each agent's GI vs Non-GI performance
- **Overview Statistics**: Top-level GI/Non-GI metrics across all data
- **Visual Indicators**: Color-coded badges (emerald for GI, amber for Non-GI)

### Data Source
- **Column ID**: `text_mkxdrsg2`
- **Values**: "GI" or "Non GI"
- **Integration**: Automatically included in all Monday.com API fetches

### Calculations
```typescript
// Overall GI/Non-GI Stats
const totalGiDeals = placements.filter(p => getPolicyType(p) === 'GI').length;
const totalNonGiDeals = placements.filter(p => getPolicyType(p) === 'Non GI').length;
const giPercentage = Math.round((totalGiDeals / (totalGiDeals + totalNonGiDeals)) * 100);

// Per-Agent Breakdown
const policyTypeBreakdown = {
  'GI': countOfGiDealsForAgent,
  'Non GI': countOfNonGiDealsForAgent
};
```

### UI Components
- **Overview Cards**: GI Deals, Non-GI Deals, GI Percentage
- **Agent Cards**: Policy Type breakdown badges with counts
- **Color Coding**: Emerald (GI), Amber (Non-GI), Indigo (percentage)

### Agent Performance
```typescript
{
  name: string,
  totalPlacements: number,
  totalPremium: number,
  avgPremium: number,
  uniqueCarriers: number,
  statusBreakdown: Record<string, number>,     // Status counts per agent
  policyTypeBreakdown: Record<string, number>  // GI/Non-GI counts per agent
}
```

### Vendor Performance
```typescript
{
  name: string,
  totalPlacements: number,
  totalPremium: number,
  avgPremium: number
}
```

### Carrier Performance
```typescript
{
  name: string,
  totalPlacements: number,
  totalPremium: number,
  avgPremium: number
}
```

## Usage

The component is registered in App.tsx:
```tsx
<Route 
  path="/admin-analytics" 
  element={
    <ProtectedRoute>
      <AdminAnalytics />
    </ProtectedRoute>
  } 
/>
```

Access at: `/admin-analytics`

## Future Enhancements

- [ ] Add Daily Sales Stats implementation
- [ ] Add export functionality (CSV/Excel)
- [ ] Add date range comparison
- [ ] Add charts/graphs for visual analytics
- [ ] Add agent-specific drill-down views
- [ ] Add commission calculations
- [ ] Add real-time data refresh
- [ ] Add saved filter presets

## Dependencies

- **@tanstack/react-query**: Lazy loading, caching, and state management
- React hooks (useState, useEffect)
- shadcn/ui components
- Monday.com API via `mondayApi.ts`
- Authentication via `useAuth` and `useLicensedAgent` hooks
- Toast notifications via `useToast`

## Related Files

- `/src/hooks/useAdminAnalyticsData.ts` - Custom React Query hook for data fetching
- `/src/lib/mondayApi.ts` - Monday.com API integration
- `/src/main.tsx` - React Query client configuration with cache settings

## Styling

- Uses Tailwind CSS utility classes
- shadcn/ui component library
- Responsive grid layouts
- Color-coded metrics (blue, green, purple, orange)
- Hover effects and transitions
