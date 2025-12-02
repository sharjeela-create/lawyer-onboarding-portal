import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
// Google OAuth credentials
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const GOOGLE_REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN");
// Hardcoded spreadsheet ID and sheet name
const SPREADSHEET_ID = "1nd1kxEj_Vwh7WIoGWcbZ1nm425irkQmvcLiuL9-4XDY";
const SHEET_NAME = "MainSheet";
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  const startTime = Date.now();
  console.log("🔄 [SHEETS-UPDATE] Starting google-sheets-update function");

  try {
    const { submissionId, callResult } = await req.json();
    
    console.log("📊 [SHEETS-UPDATE] Received data:", {
      submissionId,
      hasCallResult: !!callResult,
      callResultKeys: callResult ? Object.keys(callResult) : []
    });

    if (!submissionId || !callResult) {
      throw new Error("submissionId and callResult are required");
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
      throw new Error("Google OAuth credentials not configured");
    }

    console.log("🔐 [SHEETS-UPDATE] Starting OAuth token refresh...");

    // Step 1: Get access token with retry logic
    let tokenResponse;
    let accessToken;
    
    try {
      tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: GOOGLE_REFRESH_TOKEN,
          grant_type: "refresh_token"
        })
      });

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        throw new Error(`Failed to refresh access token: ${errText}`);
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;
      console.log("✅ [SHEETS-UPDATE] OAuth token refreshed successfully");
      
    } catch (error) {
      console.error("❌ [SHEETS-UPDATE] OAuth token refresh failed:", error);
      throw error;
    }

    console.log("📖 [SHEETS-UPDATE] Reading spreadsheet data...");

    // Step 2: Read current sheet data with timeout
    const readResponse = await Promise.race([
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Spreadsheet read timeout")), 10000)
      )
    ]) as Response;

    if (!readResponse.ok) {
      const errorText = await readResponse.text();
      console.error("❌ [SHEETS-UPDATE] Failed to read spreadsheet:", errorText);
      throw new Error(`Failed to read spreadsheet: ${errorText}`);
    }

    const readData = await readResponse.json();
    const rows = readData.values || [];
    console.log(`📋 [SHEETS-UPDATE] Read ${rows.length} rows from spreadsheet`);

    // Step 3: Find the row with matching submissionId (column X, index 23)
    let rowIndex = -1;
    let foundRow: any[] | null = null;
    
    console.log("🔍 [SHEETS-UPDATE] Searching for submission ID:", submissionId);
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && rows[i][23] === submissionId) {
        rowIndex = i + 1; // Sheets are 1-indexed
        foundRow = rows[i];
        break;
      }
    }

    if (rowIndex === -1) {
      console.error("❌ [SHEETS-UPDATE] Submission ID not found:", submissionId);
      console.log("🔍 [SHEETS-UPDATE] Available submission IDs in column X:", 
        rows.slice(1, 10).map((row, idx) => `Row ${idx + 2}: ${row[23] || 'empty'}`));
      throw new Error(`Submission ID ${submissionId} not found in spreadsheet`);
    }

    console.log(`✅ [SHEETS-UPDATE] Found submission ID at row ${rowIndex}`);
    console.log("📝 [SHEETS-UPDATE] Current row data:", foundRow ? foundRow.slice(0, 10) : "No data");
    // Status mapping function (same as create-new-callback-sheet)
    const mapStatusToSheetValue = (userSelectedStatus)=>{
      const statusMap = {
        // New statuses map to themselves
        "Incomplete Transfer": "Incomplete Transfer",
        "Returned To Center - DQ": "Returned To Center - DQ",
        "Previously Sold BPO": "Previously Sold BPO",
        "Needs BPO Callback": "Needs BPO Callback",
        "Application Withdrawn": "Application Withdrawn",
        "Pending Information": "Pending Information",
        // Legacy mappings for backward compatibility
        "Needs callback": "Needs BPO Callback",
        "Call Never Sent": "Incomplete Transfer",
        "Not Interested": "Returned To Center - DQ",
        "DQ": "DQ'd Can't be sold",
        "⁠DQ": "DQ'd Can't be sold",
        "Future Submission Date": "Application Withdrawn",
        "Call Back Fix": "Call Back Fix",
        "Disconnected": "Incomplete Transfer",
        "Disconnected - Never Retransferred": "Incomplete Transfer",
        "GI - Currently DQ": "Returned To Center - DQ"
      };
      return statusMap[userSelectedStatus] || userSelectedStatus;
    };
    // Determine status based on call result data (same logic as create-new-callback-sheet)
    let finalStatus = "";
    if (callResult.application_submitted === true) {
      finalStatus = callResult.sent_to_underwriting === true ? "Pending Approval" : "Pending Approval";
    } else if (callResult.application_submitted === false) {
      finalStatus = mapStatusToSheetValue(callResult.status || 'Not Submitted');
    }

    // Determine call result status
    let callResultStatus = "";
    if (callResult.application_submitted === true) {
      callResultStatus = callResult.sent_to_underwriting === true ? "Underwriting" : "Submitted";
    } else if (callResult.application_submitted === false) {
      callResultStatus = "Not Submitted";
    }

    console.log("📊 [SHEETS-UPDATE] Calculated statuses:", {
      finalStatus,
      callResultStatus,
      applicationSubmitted: callResult.application_submitted,
      sentToUnderwriting: callResult.sent_to_underwriting,
      originalStatus: callResult.status
    });

    // Prepare notes with existing content
    const existingNotes = rows[rowIndex - 1][17] || ""; // Column R (Notes) is index 17
    const updatedNotes = [
      existingNotes,
      callResult.notes || ""
    ].filter(Boolean).join(" | ");

    console.log("📝 [SHEETS-UPDATE] Notes update:", {
      existingNotes: existingNotes.substring(0, 50) + (existingNotes.length > 50 ? "..." : ""),
      newNotes: callResult.notes || "none",
      updatedNotesLength: updatedNotes.length
    });
    // Step 4: Prepare individual cell updates for specific columns
    // Column mapping: G=6, H=7, I=8, J=9, K=10, L=11, M=12, N=13, O=14, P=15, Q=16, R=17
    const updates = [
      {
        range: `${SHEET_NAME}!G${rowIndex}`,
        values: [
          [
            callResult.buffer_agent || ""
          ]
        ]
      },
      {
        range: `${SHEET_NAME}!H${rowIndex}`,
        values: [
          [
            callResult.agent_who_took_call || ""
          ]
        ]
      },
      {
        range: `${SHEET_NAME}!I${rowIndex}`,
        values: [
          [
            callResult.licensed_agent_account || ""
          ]
        ]
      },
      {
        range: `${SHEET_NAME}!J${rowIndex}`,
        values: [
          [
            finalStatus
          ]
        ]
      },
      {
        range: `${SHEET_NAME}!K${rowIndex}`,
        values: [
          [
            callResultStatus
          ]
        ]
      },
      {
        range: `${SHEET_NAME}!L${rowIndex}`,
        values: [
          [
            callResult.carrier || "N/A"
          ]
        ]
      },
      {
        range: `${SHEET_NAME}!M${rowIndex}`,
        values: [
          [
            callResult.product_type || "N/A"
          ]
        ]
      },
      {
        range: `${SHEET_NAME}!N${rowIndex}`,
        values: [
          [
            callResult.draft_date || "N/A"
          ]
        ]
      },
      {
        range: `${SHEET_NAME}!O${rowIndex}`,
        values: [
          [
            callResult.monthly_premium != null ? callResult.monthly_premium : "N/A"
          ]
        ]
      },
      {
        range: `${SHEET_NAME}!P${rowIndex}`,
        values: [
          [
            callResult.face_amount != null ? callResult.face_amount : "N/A"
          ]
        ]
      },
      {
        range: `${SHEET_NAME}!Q${rowIndex}`,
        values: [
          [
            rows[rowIndex - 1][16] || "FALSE"
          ]
        ]
      },
      {
        range: `${SHEET_NAME}!R${rowIndex}`,
        values: [
          [
            updatedNotes
          ]
        ]
      }
    ];
    // Step 5: Batch update all cells with enhanced error handling
    console.log("📤 [SHEETS-UPDATE] Preparing batch update with", updates.length, "cell updates");
    console.log("🎯 [SHEETS-UPDATE] Update target row:", rowIndex);

    const batchUpdateResponse = await Promise.race([
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          valueInputOption: "RAW",
          data: updates
        })
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Batch update timeout")), 15000)
      )
    ]) as Response;

    if (!batchUpdateResponse.ok) {
      const errText = await batchUpdateResponse.text();
      console.error("❌ [SHEETS-UPDATE] Batch update failed:", errText);
      throw new Error(`Failed to update spreadsheet: ${errText}`);
    }

    const updateResult = await batchUpdateResponse.json();
    const elapsed = Date.now() - startTime;
    
    console.log("✅ [SHEETS-UPDATE] Batch update successful:", {
      updatedCells: updateResult.totalUpdatedCells,
      updatedRows: updateResult.totalUpdatedRows,
      updatedSheets: updateResult.totalUpdatedSheets,
      elapsedMs: elapsed
    });

    console.log(`🎉 [SHEETS-UPDATE] Successfully updated row ${rowIndex} for submission ID: ${submissionId}`);

    return new Response(JSON.stringify({
      success: true,
      updatedCells: updateResult.totalUpdatedCells,
      updatedRows: updateResult.totalUpdatedRows,
      rowIndex,
      submissionId,
      finalStatus,
      callResultStatus,
      elapsedMs: elapsed
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error("❌ [SHEETS-UPDATE] Error in google-sheets-update:", {
      error: error.message,
      stack: error.stack,
      elapsedMs: elapsed
    });
    
    return new Response(JSON.stringify({
      error: error.message,
      elapsedMs: elapsed
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
