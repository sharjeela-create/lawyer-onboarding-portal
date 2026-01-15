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

interface WeeklyReportsProps {
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

export const WeeklyReports = ({ className }: WeeklyReportsProps) => {
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
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
    "TechPlanet",
    "Pro Solutions BPO",
    "Emperor BPO",
    "Networkize",
    "LightVerse BPO",
    "Leads BPO",
    "Helix BPO",
    "StratiX BPO",
    "Exito BPO"
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

  const fetchDataForDateRange = async (start: Date, end: Date): Promise<DailyDealFlowData[]> => {
    try {
      // Format dates correctly to avoid timezone issues
      const startYear = start.getFullYear();
      const startMonth = String(start.getMonth() + 1).padStart(2, '0');
      const startDay = String(start.getDate()).padStart(2, '0');
      const startDateStr = `${startYear}-${startMonth}-${startDay}`;

      const endYear = end.getFullYear();
      const endMonth = String(end.getMonth() + 1).padStart(2, '0');
      const endDay = String(end.getDate()).padStart(2, '0');
      const endDateStr = `${endYear}-${endMonth}-${endDay}`;

      const { data, error } = await supabase
        .from('daily_deal_flow')
        .select('*')
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: true })
        .order('lead_vendor', { ascending: true })
        .order('insured_name', { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error("Error fetching data:", error);
      throw new Error("Failed to fetch data for the selected date range");
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

  const createExcelFile = (vendorData: DailyDealFlowData[], vendor: string, startDate: string, endDate: string) => {
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

    // Convert data to Excel format
    const excelData = vendorData.map(row => {
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
    });

    // Create workbook with better formatting
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...excelData]);

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

    // Add some basic formatting
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

    // Style header row
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const headerCell = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[headerCell]) continue;
      ws[headerCell].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "CCCCCC" } }
      };
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Weekly Report');

    // Generate buffer
    const fileName = `${vendor} Weekly Report ${startDate}_to_${endDate}.xlsx`;
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    return { buffer, fileName };
  };

  const generateReports = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Date Range Required",
        description: "Please select both start and end dates for the weekly report",
        variant: "destructive",
      });
      return;
    }

    if (startDate > endDate) {
      toast({
        title: "Invalid Date Range",
        description: "Start date cannot be after end date",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Fetch data for the selected date range
      const data = await fetchDataForDateRange(startDate, endDate);

      if (data.length === 0) {
        toast({
          title: "No Data Found",
          description: "No records found for the selected date range",
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
          description: "No vendor data available for the selected date range",
          variant: "destructive",
        });
        return;
      }

      // Format dates for file naming
      const startFileDate = format(startDate, "MM_dd");
      const endFileDate = format(endDate, "MM_dd");
      const folderName = `Weekly-${format(startDate, "MM-dd-yyyy")}_to_${format(endDate, "MM-dd-yyyy")}`;

      // Create ZIP file
      const zip = new JSZip();
      let fileCount = 0;

      // Generate Excel file for each vendor
      for (const vendor of vendors) {
        const vendorData = groupedData[vendor];
        if (vendorData.length > 0) {
          const { buffer, fileName } = createExcelFile(vendorData, vendor, startFileDate, endFileDate);
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
        title: "Weekly Reports Generated Successfully",
        description: `Generated ${fileCount} reports for ${format(startDate, "MMM dd")} - ${format(endDate, "MMM dd, yyyy")}`,
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
          Weekly Reports
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Weekly Reports
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "MMM dd") : "Pick start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "MMM dd") : "Pick end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Report Details</Label>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• Reports will be generated by lead vendor</p>
              <p>• Each vendor gets a separate Excel file</p>
              <p>• All files will be packaged in a ZIP file</p>
              <p>• Premium vendors include MP and Face Amount columns</p>
              <p>• Includes: Date, Name, Closers, Status, Carrier, Product Type, Draft Date, Notes</p>
            </div>
          </div>

          {startDate && endDate && (
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-sm font-medium text-green-900">
                📊 Report will be generated for: {format(startDate, "MMMM dd")} - {format(endDate, "MMMM dd, yyyy")}
              </p>
              <p className="text-xs text-green-700 mt-1">
                Files will be named: [Vendor] Weekly Report {format(startDate, "MM_dd")}_to_{format(endDate, "MM_dd")}.xlsx
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
              disabled={!startDate || !endDate || isGenerating}
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