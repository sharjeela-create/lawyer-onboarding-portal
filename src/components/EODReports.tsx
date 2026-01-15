import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CalendarIcon, FileText, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { parseESTDate } from "@/lib/dateUtils";

interface EODReportsProps {
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
}

export const EODReports = ({ className }: EODReportsProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // Lead vendors that get additional columns (MP and Face Amount)
  const allowedVendors = [
    "Ark Tech", "GrowthOnics BPO", "Maverick", "Omnitalk BPO", "Vize BPO",
    "Corebiz", "Digicon", "Ambition", "Benchmark", "Poshenee", "Plexi",
    "Gigabite", "Everline solution", "Progressive BPO", "Cerberus BPO",
    "NanoTech", "Optimum BPO", "Ethos BPO", "Trust Link", "Crown Connect BPO",
    "Quotes BPO", "Zupax Marketing", "Argon Comm", "Care Solutions",
    "Cutting Edge", "Next Era",
    "Rock BPO", "Avenue Consultancy",
    "AJ BPO",
    "Pro Solutions BPO",
    "Emperor BPO",
    "TechPlanet",
    "Networkize",
    "LightVerse BPO",
    "Leads BPO",
    "Helix BPO",
    "Exito BPO",
    "StratiX BPO",
    "Lumenix BPO",
    "All-Star BPO",
    "DownTown BPO",
    "Livik BPO",
    "NexGen BPO",
    "Quoted-Leads BPO",
    "SellerZ BPO",
    "Venom BPO",
    "WinBPO"
  ];

  // Base columns for all reports
  const baseReportColumns = [
    "Date",
    "INSURED NAME", 
    "Buffer Agent",
    "Agent",
    "GHL Status", // Renamed from "Status"
    "Carrier",
    "Product Type", 
    "Draft Date",
    "From Callback?",
    "Notes"
  ];

  // Additional columns for allowed vendors
  const additionalColumns = ["MP", "Face Amount"];
  
  // Custom additional columns for all vendors
  const customAdditionalColumns = ["Licensed Agent Account", "Call Result"];

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

  const groupDataByVendor = (data: DailyDealFlowData[]) => {
    const grouped: { [vendor: string]: DailyDealFlowData[] } = {};
    
    data.forEach(row => {
      const vendor = row.lead_vendor || 'Unknown Vendor';
      if (!grouped[vendor]) {
        grouped[vendor] = [];
      }
      grouped[vendor].push(row);
    });

    return grouped;
  };

  const createExcelFile = (vendorData: DailyDealFlowData[], vendor: string, fileDate: string) => {
    // Determine columns for this vendor
    let headers = [...baseReportColumns];
    if (allowedVendors.includes(vendor)) {
      headers.push(...additionalColumns);
    }
    headers.push(...customAdditionalColumns);

    // Helper function to safely format dates avoiding timezone shifts
    const formatDateSafe = (dateStr: string | undefined): string => {
      if (!dateStr) return '';
      try {
        // Parse the date string as EST to avoid timezone shifts
        const estDate = parseESTDate(dateStr);
        return format(estDate, "MM/dd/yyyy");
      } catch (error) {
        console.error('Date formatting error:', error);
        return dateStr; // Return original string if parsing fails
      }
    };

    // Helper function to convert row data to Excel format
    const convertRowToExcelData = (row: DailyDealFlowData) => {
      const baseRowData = [
        formatDateSafe(row.date),
        row.insured_name || '',
        row.buffer_agent || 'N/A',
        row.agent || 'N/A',
        row.status || '', // This becomes "GHL Status" in the header
        row.carrier || 'N/A',
        row.product_type || 'N/A',
        formatDateSafe(row.draft_date),
        row.from_callback ? 'Yes' : 'No',
        row.notes || ''
      ];

      // Add additional columns for allowed vendors
      if (allowedVendors.includes(vendor)) {
        baseRowData.push(
          row.monthly_premium ? `$${row.monthly_premium.toFixed(2)}` : '',
          row.face_amount ? `$${row.face_amount.toLocaleString()}` : ''
        );
      }

      // Add custom additional columns for all vendors
      baseRowData.push(
        row.licensed_agent_account || 'N/A',
        row.call_result || 'N/A'
      );

      return baseRowData;
    };

    // Separate data into BPO Transfers and Internal Callbacks
    const bpoTransfers = vendorData.filter(row => !row.from_callback);
    const internalCallbacks = vendorData.filter(row => row.from_callback);

    // Build the worksheet data array
    const worksheetData: any[][] = [];

    // Add BPO Transfers section
    if (bpoTransfers.length > 0) {
      // Add section header
      worksheetData.push(['BPO Transfers']);
      worksheetData.push([]); // Empty row for spacing
      
      // Add column headers
      worksheetData.push(headers);
      
      // Add BPO transfer data
      bpoTransfers.forEach(row => {
        worksheetData.push(convertRowToExcelData(row));
      });
      
      // Add spacing between sections
      worksheetData.push([]);
      worksheetData.push([]);
    }

    // Add Internal Callbacks section
    if (internalCallbacks.length > 0) {
      // Add section header
      worksheetData.push(['Internal Callbacks']);
      worksheetData.push([]); // Empty row for spacing
      
      // Add column headers
      worksheetData.push(headers);
      
      // Add internal callback data
      internalCallbacks.forEach(row => {
        worksheetData.push(convertRowToExcelData(row));
      });
    }

    // Create workbook with better formatting
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Auto-size columns with better widths
    const colWidths = headers.map((header, index) => {
      switch (header) {
        case 'Date':
        case 'Draft Date':
          return { wch: 12 };
        case 'INSURED NAME':
          return { wch: 20 };
        case 'Notes':
          return { wch: 30 };
        case 'GHL Status':
          return { wch: 18 };
        case 'Licensed Agent Account':
          return { wch: 18 };
        case 'Face Amount':
          return { wch: 15 };
        case 'From Callback?':
          return { wch: 12 };
        default:
          return { wch: 15 };
      }
    });
    ws['!cols'] = colWidths;

    // Add formatting for section headers and column headers
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    
    // Track row positions for styling
    let currentRow = 0;
    
    // Style BPO Transfers section
    if (bpoTransfers.length > 0) {
      // Section header styling
      const sectionHeaderCell = XLSX.utils.encode_cell({ r: currentRow, c: 0 });
      if (ws[sectionHeaderCell]) {
        ws[sectionHeaderCell].s = {
          font: { bold: true, sz: 14 },
          fill: { fgColor: { rgb: "E6F3FF" } }
        };
      }
      
      currentRow += 2; // Skip section header and empty row
      
      // Column headers styling
      for (let C = 0; C < headers.length; ++C) {
        const headerCell = XLSX.utils.encode_cell({ r: currentRow, c: C });
        if (ws[headerCell]) {
          ws[headerCell].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: "CCCCCC" } }
          };
        }
      }
      
      currentRow += bpoTransfers.length + 3; // Skip data rows and spacing
    }

    // Style Internal Callbacks section
    if (internalCallbacks.length > 0) {
      // Section header styling
      const sectionHeaderCell = XLSX.utils.encode_cell({ r: currentRow, c: 0 });
      if (ws[sectionHeaderCell]) {
        ws[sectionHeaderCell].s = {
          font: { bold: true, sz: 14 },
          fill: { fgColor: { rgb: "E6F3FF" } }
        };
      }
      
      currentRow += 2; // Skip section header and empty row
      
      // Column headers styling
      for (let C = 0; C < headers.length; ++C) {
        const headerCell = XLSX.utils.encode_cell({ r: currentRow, c: C });
        if (ws[headerCell]) {
          ws[headerCell].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: "CCCCCC" } }
          };
        }
      }
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'EOD Report');

    // Generate buffer
    const fileName = `${vendor} Daily Report ${fileDate}.xlsx`;
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    
    return { buffer, fileName };
  };

  const generateReports = async () => {
    if (!selectedDate) {
      toast({
        title: "Date Required",
        description: "Please select a date for the EOD report",
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

      // Group data by vendor
      const groupedData = groupDataByVendor(data);
      const vendors = Object.keys(groupedData);

      if (vendors.length === 0) {
        toast({
          title: "No Vendors Found",
          description: "No vendor data available for the selected date",
          variant: "destructive",
        });
        return;
      }

      // Format date for file naming
      const fileDate = format(selectedDate, "MM_dd");
      const folderName = `EOD-${format(selectedDate, "MM-dd-yyyy")}`;

      // Create ZIP file
      const zip = new JSZip();
      let fileCount = 0;

      // Generate Excel file for each vendor
      for (const vendor of vendors) {
        const vendorData = groupedData[vendor];
        if (vendorData.length > 0) {
          const { buffer, fileName } = createExcelFile(vendorData, vendor, fileDate);
          zip.file(fileName, buffer);
          fileCount++;
        }
      }

      if (fileCount === 0) {
        toast({
          title: "No Files Generated",
          description: "No valid data found to generate reports",
          variant: "destructive",
        });
        return;
      }

      // Generate ZIP blob
      const zipBlob = await zip.generateAsync({ type: "blob" });
      
      // Download the ZIP file
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${folderName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the object URL
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      toast({
        title: "Reports Generated Successfully",
        description: `Generated ${fileCount} reports for ${format(selectedDate, "MMM dd, yyyy")}`,
      });

      setIsDialogOpen(false);

    } catch (error) {
      console.error("Error generating reports:", error);
      toast({
        title: "Error Generating Reports",
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
          <FileText className="h-4 w-4" />
          EOD Reports
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate EOD Reports
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="report-date">Select Report Date</Label>
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
            <Label>Report Details</Label>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• Reports will be generated by lead vendor</p>
              <p>• Each vendor gets a separate Excel file</p>
              <p>• All files will be packaged in a ZIP file</p>
              <p>• Data split into "BPO Transfers" and "Internal Callbacks" sections</p>
              <p>• Premium vendors include MP and Face Amount columns</p>
              <p>• Includes: Date, Name, Closers, Status, Carrier, Product Type, Draft Date, Notes</p>
            </div>
          </div>

          {selectedDate && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-900">
                📊 Report will be generated for: {format(selectedDate, "MMMM dd, yyyy")}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Files will be named: [Vendor] Daily Report {format(selectedDate, "MM_dd")}.xlsx
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
              onClick={generateReports}
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
                  Generate Reports
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};