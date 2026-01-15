# Monday.com Integration for Commission Portal

## Overview
The Commission Portal now integrates with Monday.com to display **actual policy placements** alongside writing leads. This provides licensed agents with a complete view of their pipeline and placements.

## Features

### Multi-Section Layout
The portal is divided into two tabs:
1. **Actual Placements** (Primary View) - Shows policies placed on carriers from Monday.com
2. **Writing Leads** - Shows pending commission approvals from the internal database

### Actual Placements Section
- Fetches data from Monday.com boards via GraphQL API
- Filters by Sales Agent (currently hardcoded for Isaac Reed)
- Displays policy placement details including:
  - Item name and ID
  - Group/category
  - All column values from Monday.com board
  - Total placement count

## Setup Instructions

### 1. Get Your Monday.com API Token
1. Log in to your Monday.com account
2. Click your profile picture → **Developers**
3. Navigate to **API** section
4. Click **Show** to reveal your personal API token
5. Copy the token

### 2. Configure Environment Variables
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add your Monday.com credentials to `.env`:
   ```env
   VITE_MONDAY_API_TOKEN=your_actual_token_here
   VITE_MONDAY_BOARD_ID=your_board_id_here
   ```

### 3. Find Your Board ID
1. Open your Monday.com board
2. The board ID is in the URL: `https://your-account.monday.com/boards/1234567890`
3. Copy the numeric ID (e.g., `1234567890`)

### 4. Restart Development Server
After configuring environment variables, restart the dev server:
```bash
npm run dev
```

## Configuration Details

### Monday.com API Service
Location: `src/lib/mondayApi.ts`

Key functions:
- `fetchBoardItemsBySalesAgent(boardId, salesAgent, limit)` - Fetches items filtered by Sales Agent
- `fetchAllBoardItems(boardId, limit)` - Fetches all items without filtering
- `fetchBoardMetadata(boardId)` - Gets board structure and column definitions
- `isMondayApiConfigured()` - Checks if API token is set

### Current Implementation
**Hardcoded for Isaac Reed**:
- Sales Agent filter: `"Isaac Reed"`
- This is currently hardcoded in the `fetchPlacements()` function in CommissionPortal.tsx

### GraphQL Query Structure
```graphql
query ($boardId: [ID!]!, $limit: Int!, $salesAgent: [String!]) {
  boards(ids: $boardId) {
    items_page(
      limit: $limit
      query_params: {
        rules: [
          {
            column_id: "person"
            compare_value: $salesAgent
            operator: contains_text
          }
        ]
        operator: and
      }
    ) {
      cursor
      items {
        id
        name
        column_values {
          id
          text
          value
        }
        group {
          id
          title
        }
      }
    }
  }
}
```

## Customization

### Change the Sales Agent Filter
Edit `src/pages/CommissionPortal.tsx`, line ~120:
```typescript
const salesAgentName = displayName === 'Isaac Reed' ? 'Isaac Reed' : displayName;
```

### Change Column Display
The placements display all column values. To filter specific columns, modify the mapping in CommissionPortal.tsx around line ~370:
```typescript
{item.column_values
  .filter(col => col.text && col.text.trim() !== '')
  .slice(0, 6) // Limit to 6 columns
  .map((col, idx) => (...))}
```

### Adjust Item Limit
Current limit: 500 items. To change:
```typescript
const items = await fetchBoardItemsBySalesAgent(
  undefined,
  salesAgentName,
  500 // Change this number
);
```

## API Reference

### Monday.com Column Filter Operators
- `contains_text` - Text contains value (used for Sales Agent)
- `any_of` - Match any of specified values
- `not_any_of` - Exclude specified values
- `between` - Range filter (for dates/numbers)
- `is_empty` / `is_not_empty` - Check for empty values

### Monday.com API Documentation
- API Reference: https://developer.monday.com/api-reference/docs
- GraphQL Playground: https://monday.com/developers/v2/try-it-yourself
- Items Page: https://developer.monday.com/api-reference/reference/items-page

## Troubleshooting

### "Monday.com API Not Configured" Message
- Ensure `VITE_MONDAY_API_TOKEN` is set in your `.env` file
- Restart the development server after adding the token
- Check that the token is valid and not expired

### No Data Returned
1. Verify the board ID is correct
2. Check that the "Sales Agent" column exists in your Monday.com board
3. Verify the column ID is "person" or update the query
4. Check browser console for API errors

### Permission Errors
- Ensure your API token has access to the board
- Check board permissions in Monday.com
- Verify the token is from the correct Monday.com account

## Future Enhancements

### Planned Features
1. **Dynamic Sales Agent Mapping** - Map licensed agent display names to Monday.com sales agents
2. **Date Filtering** - Add date columns to show monthly/weekly stats
3. **Column Mapping** - Smart detection of carrier, premium, and policy details
4. **Pagination** - Implement cursor-based pagination for large datasets
5. **Real-time Updates** - Use Monday.com webhooks for live updates
6. **Export Functionality** - Export placement data to CSV/Excel

### Making it Dynamic for All Closers
To make this work for all licensed agents (not just Isaac Reed):

1. **Create Agent Mapping Table** in Supabase:
   ```sql
   CREATE TABLE agent_monday_mapping (
     id UUID PRIMARY KEY,
     licensed_agent_name TEXT,
     monday_sales_agent_name TEXT,
     monday_board_id TEXT
   );
   ```

2. **Update fetchPlacements()** to look up mapping:
   ```typescript
   const { data: mapping } = await supabase
     .from('agent_monday_mapping')
     .select('monday_sales_agent_name, monday_board_id')
     .eq('licensed_agent_name', displayName)
     .single();
   
   const salesAgentName = mapping?.monday_sales_agent_name || displayName;
   const boardId = mapping?.monday_board_id || BOARD_ID;
   ```

3. **Admin Interface** - Create UI for admins to manage agent mappings

## Security Notes

⚠️ **Important Security Considerations**:
- Never commit `.env` file to version control
- API tokens should be kept secret
- Consider using backend proxy for production to hide tokens
- Rotate API tokens periodically
- Use minimal permission scopes when possible

## Testing

### Test with Postman
```bash
curl -X POST https://api.monday.com/v2 \
  -H "Authorization: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { boards(ids: 1234567890) { items_page(limit: 10) { items { id name } } } }"
  }'
```

### Test in Browser Console
```javascript
const response = await fetch('https://api.monday.com/v2', {
  method: 'POST',
  headers: {
    'Authorization': 'YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: 'query { me { id name } }'
  })
});
console.log(await response.json());
```

## Support

For questions or issues:
1. Check Monday.com API documentation
2. Review browser console for error messages
3. Verify environment configuration
4. Check Supabase connection (for writing leads)

## Change Log

### Version 1.0 (Current)
- ✅ Initial Monday.com integration
- ✅ Tabbed interface (Placements + Writing Leads)
- ✅ Sales Agent filtering (hardcoded: Isaac Reed)
- ✅ Display all board items and column values
- ✅ Error handling and loading states
- ✅ Environment variable configuration
