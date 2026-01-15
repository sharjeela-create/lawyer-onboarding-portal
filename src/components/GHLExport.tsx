import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CalendarIcon, Upload, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { parseESTDate } from "@/lib/dateUtils";

interface GHLExportProps {
  className?: string;
}

interface DailyDealFlowData {
  id: string;
  submission_id: string;
  client_phone_number?: string;
  lead_vendor?: string;
  date?: string;
  insured_name?: string;
  buffer_agent?: string;
  agent?: string;
  licensed_agent_account?: string;
  status?: string;
  call_result?: string;
  carrier?: string;
  product_type?: string;
  draft_date?: string;
  monthly_premium?: number;
  face_amount?: number;
  from_callback?: boolean;
  notes?: string;
  policy_number?: string;
  carrier_audit?: string;
  product_type_carrier?: string;
  level_or_gi?: string;
}

export const GHLExport = ({ className }: GHLExportProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // Required CSV columns in exact order
  const csvColumns = [
    "Found in Carrier?",
    "Updated in GHL?", 
    "Client Phone Number",
    "Lead Vender", // Note: keeping original spelling as per requirements
    "Date",
    "INSURED NAME",
    "Buffer Agent",
    "Agent",
    "Status",
    "Carrier",
    "Product Type",
    "Draft Date",
    "From Callback?",
    "Notes",
    "Policy Number",
    "Carrier Audit",
    "ProductTypeCarrier",
    "Level Or GI"
  ];

  const fetchDataForDate = async (date: Date): Promise<DailyDealFlowData[]> => {
    try {
      // Format date correctly to avoid timezone issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const { data, error } = await supabase
        .from('daily_deal_flow')
        .select('*')
        .eq('date', dateStr)
        .order('lead_vendor', { ascending: true })
        .order('insured_name', { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error("Error fetching data:", error);
      throw new Error("Failed to fetch data for the selected date");
    }
  };

  // Helper function to safely format dates avoiding timezone shifts
  const formatDateSafeCSV = (dateStr: string | undefined): string => {
    if (!dateStr) return 'N/A';
    try {
      // Parse the date string as EST to avoid timezone shifts
      const estDate = parseESTDate(dateStr);
      return format(estDate, "M/d/yyyy");
    } catch (error) {
      console.error('Date formatting error:', error);
      return dateStr; // Return original string if parsing fails
    }
  };

  const convertToCSVRow = (row: DailyDealFlowData): string[] => {
    return [
      // Found in Carrier? - Default to N/A since this isn't in daily_deal_flow
      "N/A",
      
      // Updated in GHL? - Default to N/A since this isn't in daily_deal_flow  
      "N/A",
      
      // Client Phone Number
      row.client_phone_number || "N/A",
      
      // Lead Vender (keeping original spelling)
      row.lead_vendor || "N/A",
      
      // Date - Format as M/d/yyyy with EST timezone handling
      formatDateSafeCSV(row.date),
      
      // INSURED NAME
      row.insured_name || "N/A",
      
      // Buffer Agent
      row.buffer_agent || "N/A",
      
      // Agent
      row.agent || "N/A",
      
      // Status
      row.status || "N/A",
      
      // Carrier
      row.carrier || "N/A",
      
      // Product Type
      row.product_type || "N/A",
      
      // Draft Date - Format as M/d/yyyy with EST timezone handling
      formatDateSafeCSV(row.draft_date),
      
      // From Callback? - Convert boolean to Yes/No
      row.from_callback ? "Yes" : "No",
      
      // Notes
      row.notes || "N/A",
      
      // Policy Number - Use existing column or N/A
      row.policy_number || "N/A",
      
      // Carrier Audit - Use existing column or N/A
      row.carrier_audit || "N/A",
      
      // ProductTypeCarrier - Use existing column or N/A
      row.product_type_carrier || "N/A",
      
      // Level Or GI - Use existing column or N/A
      row.level_or_gi || "N/A"
    ];
  };

  const escapeCSVField = (field: string): string => {
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  const generateCSV = (data: DailyDealFlowData[]): string => {
    // Create header row
    const headerRow = csvColumns.map(col => escapeCSVField(col)).join(',');
    
    // Create data rows
    const dataRows = data.map(row => {
      const csvRow = convertToCSVRow(row);
      return csvRow.map(field => escapeCSVField(field)).join(',');
    });
    
    // Combine header and data
    return [headerRow, ...dataRows].join('\n');
  };

  const downloadCSV = (csvContent: string, fileName: string) => {
    // Create blob with UTF-8 BOM for proper Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the object URL
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const generateGHLExport = async () => {
    if (!selectedDate) {
      toast({
        title: "Date Required",
        description: "Please select a date for the GHL export",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Fetch data for the selected date
      const data = await fetchDataForDate(selectedDate);

      if (data.length === 0) {
        toast({
          title: "No Data Found",
          description: "No records found for the selected date",
          variant: "destructive",
        });
        return;
      }

      // Generate CSV content
      const csvContent = generateCSV(data);
      
      // Generate filename with date
      const formattedDate = format(selectedDate, "MM_dd_yyyy");
      const fileName = `GHL_Update_Export_${formattedDate}.csv`;
      
      // Download the CSV file
      downloadCSV(csvContent, fileName);

      toast({
        title: "Export Generated Successfully",
        description: `Generated GHL export with ${data.length} records for ${format(selectedDate, "MMM dd, yyyy")}`,
      });

      setIsDialogOpen(false);

    } catch (error) {
      console.error("Error generating GHL export:", error);
      toast({
        title: "Error Generating Export",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={cn("flex items-center gap-2", className)}
        >
          <Upload className="h-4 w-4" />
          GHL Export
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Generate GHL Update Export
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="export-date">Select Export Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Export Details</Label>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• Exports all records for the selected date</p>
              <p>• Contains all 18 required GHL columns</p>
              <p>• Missing columns filled with "N/A"</p>
              <p>• CSV format compatible with Excel</p>
              <p>• Includes: Phone, Lead Vendor, Closers, Status, Carrier, etc.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>CSV Columns (18 total)</Label>
            <div className="max-h-32 overflow-y-auto p-2 bg-gray-50 rounded text-xs">
              <div className="grid grid-cols-2 gap-1">
                {csvColumns.map((col, index) => (
                  <div key={index} className="text-gray-700">
                    {index + 1}. {col}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {selectedDate && (
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-sm font-medium text-green-900">
                📊 Export will be generated for: {format(selectedDate, "MMMM dd, yyyy")}
              </p>
              <p className="text-xs text-green-700 mt-1">
                File name: GHL_Update_Export_{format(selectedDate, "MM_dd_yyyy")}.csv
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={generateGHLExport}
              disabled={!selectedDate || isGenerating}
              className="flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Generate CSV
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};