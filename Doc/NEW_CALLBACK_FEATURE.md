# New Callback Feature Documentation

## Overview
The New Callback feature allows agents to manually create lead entries directly from the dashboard and immediately process them through the call result workflow.

## Features Implemented

### 1. New Callback Page (`/new-callback`)
- **Location**: `src/pages/NewCallback.tsx`
- **Purpose**: Manual lead entry form
- **Features**:
  - Required fields: Customer Full Name, Phone Number, Lead Vendor
  - Optional fields: Email, Address, Personal Information, Health Conditions, Notes
  - Automatic unique submission ID generation (`CB{timestamp}{random}`)
  - Form validation
  - Automatic navigation to call result form after creation

### 2. Dashboard Integration
- **Location**: `src/pages/Dashboard.tsx`
- **Changes**: Added "Quick Actions" section with "New Callback" button
- **Navigation**: Direct link to `/new-callback`

### 3. Google Sheets Integration
- **Location**: `supabase/functions/create-new-callback-sheet/index.ts`
- **Purpose**: Creates new entries at the top of Google Sheets (instead of updating existing rows)
- **Features**:
  - Fetches current sheet data
  - Inserts new callback entry at top (after header row)
  - Updates entire sheet with new data structure
  - Handles error cases gracefully

### 4. Enhanced Call Result Update Page
- **Location**: `src/pages/CallResultUpdate.tsx`
- **Changes**: 
  - Detects if coming from callback (`fromCallback` URL parameter)
  - Updates page title and description accordingly
  - Same form functionality for both regular leads and callbacks

### 5. Database Schema
- **No changes required**: Uses existing `leads` table structure
- **Unique identifier**: Callback entries use `CB{timestamp}{random}` format for `submission_id`

## Workflow

### Creating a New Callback
1. Agent clicks "New Callback" button on dashboard
2. Agent fills out the callback form with customer information
3. System generates unique submission ID
4. Lead data is saved to `leads` table
5. Google Sheets function creates new entry at top of spreadsheet
6. Agent is automatically redirected to call result update form
7. Agent can then update the call status using existing form

### Data Flow
```
Dashboard → New Callback Form → Database Insert → Google Sheets Update → Call Result Form
```

## Configuration Required

### Environment Variables (Supabase)
Set these in your Supabase Project Settings > API > Environment Variables:

1. `GOOGLE_SHEETS_API_KEY`: Your Google Sheets API key
2. `GOOGLE_SPREADSHEET_ID`: Your Google Spreadsheet ID

### Google Sheets API Setup
1. Go to Google Cloud Console
2. Enable Google Sheets API
3. Create API Key credentials
4. Restrict API key to Google Sheets API only (recommended)
5. Copy the API key for environment variable

### Google Sheets Structure
The function expects the following column order in your Google Sheet:
- Submission ID
- Submission Date
- Customer Full Name
- Phone Number
- Email
- Street Address
- City
- State
- ZIP Code
- Date of Birth
- Age
- Social Security
- Health Conditions
- Carrier
- Product Type
- Coverage Amount
- Monthly Premium
- Draft Date
- Future Draft Date
- Beneficiary Institution
- Beneficiary Routing
- Beneficiary Account
- Additional Notes
- Lead Vendor
- Buffer Agent
- Agent
- Status Indicator
- Call Result

## File Structure
```
src/
├── pages/
│   ├── NewCallback.tsx          # New callback form page
│   ├── CallResultUpdate.tsx     # Enhanced to handle callbacks
│   └── Dashboard.tsx            # Added quick actions section
├── App.tsx                      # Added new route
supabase/
├── functions/
│   └── create-new-callback-sheet/
│       └── index.ts             # Google Sheets integration
└── functions/
    └── .env.example             # Environment variables template
```

## Usage Instructions

### For Closers
1. Login to the dashboard
2. Click "New Callback" in the Quick Actions section
3. Fill out customer information (name, phone, and vendor are required)
4. Click "Create Callback"
5. System will automatically take you to the call result form
6. Update the call status as normal

### For Administrators
1. Set up Google Sheets API credentials
2. Configure environment variables in Supabase
3. Deploy the new Google Sheets function
4. Test the workflow end-to-end

## Notes
- Callback entries are marked with "New Callback" status in Google Sheets
- Submission IDs for callbacks start with "CB" prefix
- All existing call result functionality works with callback entries
- The feature integrates seamlessly with existing workflow
