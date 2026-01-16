import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface SubmissionPortalRow {
  id: string;
  submission_id: string;
  date?: string;
  insured_name?: string;
  lead_vendor?: string;
  client_phone_number?: string;
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
  created_at?: string;
  updated_at?: string;
  application_submitted?: boolean;
  sent_to_underwriting?: boolean;
  submission_date?: string;
  dq_reason?: string;
  call_source?: string;
  submission_source?: string;
  verification_logs?: string;
  has_submission_data?: boolean;
  source_type?: string;
}

interface CallLog {
  agent_type: string;
  agent_name: string;
  event_type: string;
  created_at: string;
}

const SubmissionPortalPage = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<SubmissionPortalRow[]>([]);
  const [filteredData, setFilteredData] = useState<SubmissionPortalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState("__ALL__");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showDuplicates, setShowDuplicates] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [dataCompletenessFilter, setDataCompletenessFilter] = useState("__ALL__");
  const itemsPerPage = 50;

  const { toast } = useToast();

  // Remove duplicates based on insured_name, client_phone_number, and lead_vendor
  const removeDuplicates = (records: SubmissionPortalRow[]): SubmissionPortalRow[] => {
    const seen = new Map<string, SubmissionPortalRow>();
    
    records.forEach(record => {
      const key = `${record.insured_name || ''}|${record.client_phone_number || ''}|${record.lead_vendor || ''}`;
      
      // Keep the most recent record (first in our sorted array)
      if (!seen.has(key)) {
        seen.set(key, record);
      }
    });
    
    return Array.from(seen.values());
  };

  // Apply filters and duplicate removal
  const applyFilters = (records: SubmissionPortalRow[]): SubmissionPortalRow[] => {
    let filtered = records;

    // Apply date filter
    if (dateFilter) {
      filtered = filtered.filter(record => record.date === dateFilter);
    }

    // Apply status filter
    if (statusFilter !== "__ALL__") {
      filtered = filtered.filter(record => record.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(record =>
        (record.insured_name?.toLowerCase().includes(searchLower)) ||
        (record.client_phone_number?.toLowerCase().includes(searchLower)) ||
        (record.lead_vendor?.toLowerCase().includes(searchLower)) ||
        (record.agent?.toLowerCase().includes(searchLower)) ||
        (record.buffer_agent?.toLowerCase().includes(searchLower)) ||
        (record.licensed_agent_account?.toLowerCase().includes(searchLower)) ||
        (record.carrier?.toLowerCase().includes(searchLower)) ||
        (record.product_type?.toLowerCase().includes(searchLower))
      );
    }

    // Remove duplicates if enabled
    if (!showDuplicates) {
      filtered = removeDuplicates(filtered);
    }

    // Apply data completeness filter
    if (dataCompletenessFilter === "active_only") {
      filtered = filtered.filter(record => 
        record.has_submission_data && 
        record.status !== "Submitted"
      );
    } else if (dataCompletenessFilter === "missing_logs_only") {
      filtered = filtered.filter(record => 
        !record.has_submission_data
      );
    }

    return filtered;
  };

  // Function to generate verification log summary showing complete call workflow
  const generateVerificationLogSummary = (logs: CallLog[], submission?: any): string => {
    if (!logs || logs.length === 0) {
      // Fallback to data from submission/call_results table if available
      if (submission && submission.has_submission_data) {
        const workflow = [];
        
        if (submission.buffer_agent) {
          workflow.push(`🟡 Buffer: ${submission.buffer_agent}`);
        }
        
        if (submission.agent && submission.agent !== submission.buffer_agent) {
          workflow.push(`📞 Handled by: ${submission.agent}`);
        }
        
        if (submission.licensed_agent_account) {
          if (submission.buffer_agent || submission.agent_who_took_call) {
            workflow.push(`➡️ Transfer to Licensed`);
          }
          workflow.push(`🔵 Licensed: ${submission.licensed_agent_account}`);
        }
        
        if (workflow.length > 0) {
          return workflow.join(' → ');
        }
      }
      
      return "No call activity recorded";
    }

    const sortedLogs = logs.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const workflow: string[] = [];
    let initialAgent: string | null = null;
    let currentAgent: string | null = null;
    let bufferAgent: string | null = null;
    let licensedAgent: string | null = null;
    let hasTransfer = false;
    
    for (const log of sortedLogs) {
      const agentName = log.agent_name || `${log.agent_type} agent`;
      
      switch (log.event_type) {
        case 'verification_started':
          if (!initialAgent) {
            initialAgent = agentName;
            currentAgent = agentName;
            
            if (log.agent_type === 'buffer') {
              bufferAgent = agentName;
              workflow.push(`� Buffer "${agentName}" picked up initially`);
            } else if (log.agent_type === 'licensed') {
              licensedAgent = agentName;
              workflow.push(`🔵 Licensed "${agentName}" picked up initially`);
            }
          }
          break;
          
        case 'call_picked_up':
          if (agentName !== currentAgent) {
            if (log.agent_type === 'buffer') {
              bufferAgent = agentName;
              workflow.push(`� Buffer "${agentName}" picked up`);
            } else {
              licensedAgent = agentName;
              workflow.push(`🔵 Licensed "${agentName}" picked up`);
            }
            currentAgent = agentName;
          }
          break;
          
        case 'call_claimed':
          if (log.agent_type === 'buffer') {
            bufferAgent = agentName;
            workflow.push(`� Buffer "${agentName}" claimed dropped call`);
          } else {
            licensedAgent = agentName;
            workflow.push(`🔵 Licensed "${agentName}" claimed dropped call`);
          }
          currentAgent = agentName;
          break;
          
        case 'transferred_to_la':
          hasTransfer = true;
          workflow.push(`➡️ Transferred to Licensed Agent`);
          break;
          
        case 'call_dropped':
          workflow.push(`❌ "${agentName}" dropped call`);
          break;
          
        case 'application_submitted':
          workflow.push(`✅ Application submitted by "${agentName}"`);
          break;
          
        case 'application_not_submitted':
          workflow.push(`❌ Application not submitted`);
          break;
          
        case 'call_disconnected':
          workflow.push(`📞 Call disconnected from "${agentName}"`);
          break;
      }
    }

    // If no workflow events, show basic structure
    if (workflow.length === 0) {
      return "No detailed workflow events recorded";
    }

    // Add summary at the end showing final state
    const summary = [];
    if (bufferAgent) summary.push(`Buffer: ${bufferAgent}`);
    if (hasTransfer || licensedAgent) summary.push(`Licensed: ${licensedAgent || 'TBD'}`);
    
    if (summary.length > 0) {
      workflow.push(`📋 Summary: ${summary.join(' → ')}`);
    }

    return workflow.join(" → ");
  };

  // Fetch data from Supabase - get all transfers and merge with submission data
  const fetchData = async (showRefreshToast = false) => {
    try {
      setRefreshing(true);

      const pendingApprovalStatus = "Pending Approval";

      let transfersQuery = supabase
        .from('daily_deal_flow')
        .select('*')
        .eq('status', pendingApprovalStatus)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (dateFilter) {
        transfersQuery = transfersQuery.eq('date', dateFilter);
      }

      const { data: transferData, error: transferError } = await transfersQuery;

      if (transferError) {
        console.error("Error fetching submission portal base transfers:", transferError);
        toast({
          title: "Error",
          description: "Failed to fetch transfer portal data",
          variant: "destructive",
        });
        return;
      }

      // Get submission portal data for entries that exist
      let submissionQuery = (supabase as any)
        .from('submission_portal')
        .select('*');

      submissionQuery = submissionQuery.eq('status', pendingApprovalStatus);

      // Apply date filter if set
      if (dateFilter) {
        submissionQuery = submissionQuery.eq('date', dateFilter);
      }

      // Note: We don't apply status filter here to ensure all submission data is available
      // for merging with transfer data, regardless of current filter selection

      const { data: submissionData, error: submissionError } = await submissionQuery;

      if (submissionError) {
        console.warn("Error fetching submission portal data:", submissionError);
        // Continue with just transfer data
      }

      // Create a map of submission data by submission_id for quick lookup
      const submissionMap = new Map();
      if (submissionData) {
        submissionData.forEach((sub: any) => {
          submissionMap.set(sub.submission_id, sub);
        });
      }

      // Merge transfer data with submission data
      const mergedData = ((transferData ?? []) as unknown as SubmissionPortalRow[])?.map(transfer => {
        const submission = submissionMap.get(transfer.submission_id);
        
        if (submission) {
          // Merge submission data with transfer data
          return {
            ...transfer,
            ...submission,
            // Keep transfer data for fields that might be missing in submission
            insured_name: submission.insured_name || transfer.insured_name,
            client_phone_number: submission.client_phone_number || transfer.client_phone_number,
            lead_vendor: submission.lead_vendor || transfer.lead_vendor,
            buffer_agent: submission.buffer_agent || transfer.buffer_agent,
            agent: submission.agent || transfer.agent,
            licensed_agent_account: submission.licensed_agent_account || transfer.licensed_agent_account,
            carrier: submission.carrier || transfer.carrier,
            product_type: submission.product_type || transfer.product_type,
            monthly_premium: submission.monthly_premium || transfer.monthly_premium,
            face_amount: submission.face_amount || transfer.face_amount,
            // Mark as having submission data
            has_submission_data: true
          };
        } else {
          // No submission data - show transfer data with missing label
          const isCallback = Boolean((transfer as any).from_callback) || Boolean((transfer as any).is_callback);
          return {
            ...transfer,
            // Mark as missing submission data
            has_submission_data: false,
            verification_logs: "Update log missing - No submission data found",
            source_type: isCallback ? 'callback' : 'zapier',
          };
        }
      }) || [];

      const mergedWithSourceType = mergedData.map((row) => {
        const isCallback = Boolean((row as any).from_callback) || Boolean((row as any).is_callback);
        return {
          ...row,
          source_type: row.source_type ?? (isCallback ? 'callback' : 'zapier'),
        };
      });

      // Fetch call logs for ALL entries (not just those with submission data)
      const allSubmissionIds = mergedWithSourceType.map(row => row.submission_id);
      
      let callLogsData: Record<string, CallLog[]> = {};
      
      if (allSubmissionIds.length > 0) {
        const { data: logsData, error: logsError } = await supabase
          .from('call_update_logs')
          .select('submission_id, agent_type, agent_name, event_type, created_at')
          .in('submission_id', allSubmissionIds)
          .order('created_at', { ascending: true });

        if (logsError) {
          console.warn("Error fetching call logs:", logsError);
        } else {
          // Group logs by submission_id
          callLogsData = (logsData || []).reduce((acc, log) => {
            if (!acc[log.submission_id]) {
              acc[log.submission_id] = [];
            }
            acc[log.submission_id].push(log);
            return acc;
          }, {} as Record<string, CallLog[]>);
        }
      }

      // Add verification logs to each row
      const dataWithLogs = mergedWithSourceType.map(row => {
        const logs = callLogsData[row.submission_id] || [];
        
        if (logs.length > 0) {
          // Generate verification logs for entries that have call logs
          return {
            ...row,
            verification_logs: generateVerificationLogSummary(logs, row)
          };
        } else if (row.has_submission_data) {
          // Fallback for entries with submission data but no call logs
          return {
            ...row,
            verification_logs: generateVerificationLogSummary([], row)
          };
        } else {
          // No call logs and no submission data
          return {
            ...row,
            verification_logs: "No call activity recorded"
          };
        }
      });

      setData(dataWithLogs);

      if (showRefreshToast) {
        toast({
          title: "Success",
          description: "Data refreshed successfully",
        });
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Update filtered data whenever data or filters change
  useEffect(() => {
    setFilteredData(applyFilters(data));
    setCurrentPage(1); // Reset to first page when filters change
  }, [data, dateFilter, statusFilter, showDuplicates, searchTerm, dataCompletenessFilter]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = useMemo(
    () => filteredData.slice(startIndex, endIndex),
    [filteredData, startIndex, endIndex]
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateFilter]);

  const handleRefresh = () => {
    fetchData(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading submission portal data...</span>
        </div>
      </div>
    );
  }

  const handleView = (row: SubmissionPortalRow) => {
    if (!row?.id) return;
    navigate(`/daily-deal-flow/lead/${encodeURIComponent(row.id)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, phone, vendor..."
                className="max-w-md"
              />

              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="__ALL__">All Statuses</SelectItem>
                    <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                    <SelectItem value="Underwriting">Underwriting</SelectItem>
                    <SelectItem value="Submitted">Submitted</SelectItem>
                    <SelectItem value="DQ'd Can't be sold">DQ'd Can't be sold</SelectItem>
                    <SelectItem value="Returned To Center - DQ">Returned To Center - DQ</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select value={dataCompletenessFilter} onValueChange={(v) => setDataCompletenessFilter(v)}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="All Records" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="__ALL__">All Records</SelectItem>
                    <SelectItem value="active_only">Active Only (Hide Missing Logs & Completed)</SelectItem>
                    <SelectItem value="missing_logs_only">Missing Update Log Only</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-56" />

              <Select value={showDuplicates ? "true" : "false"} onValueChange={(v) => setShowDuplicates(v === "true")}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="true">Show All Records</SelectItem>
                    <SelectItem value="false">Remove Duplicates</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="px-3 py-1">
                {filteredData.length} records
              </Badge>
              <Button onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          <Card className="flex min-h-[650px] flex-1 flex-col">
            <CardContent className="p-0 min-h-0 flex-1 flex flex-col">
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full table-fixed text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-left text-xs uppercase text-muted-foreground">
                      <th className="px-4 py-3 w-[140px]">Date</th>
                      <th className="px-4 py-3">Customer Name</th>
                      <th className="px-4 py-3 w-[180px]">Phone Number</th>
                      <th className="px-4 py-3 w-[200px]">Lead Vendor</th>
                      <th className="px-4 py-3 w-[180px]">Status</th>
                      <th className="px-4 py-3 w-[200px]">Assigned</th>
                      <th className="px-4 py-3 w-[120px] text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPageData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                          No records found.
                        </td>
                      </tr>
                    ) : (
                      currentPageData.map((row) => (
                        <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3">{row.date ?? '—'}</td>
                          <td className="px-4 py-3 font-medium">{row.insured_name ?? '—'}</td>
                          <td className="px-4 py-3">{row.client_phone_number ?? '—'}</td>
                          <td className="px-4 py-3">{row.lead_vendor ?? '—'}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">{row.status ?? '—'}</Badge>
                          </td>
                          <td className="px-4 py-3">{row.licensed_agent_account || row.agent || row.buffer_agent || '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center">
                              <Button variant="outline" size="sm" onClick={() => handleView(row)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t px-4 py-3">
                <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage <= 1}>
                  Previous
                </Button>
                <div className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</div>
                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage >= totalPages}>
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SubmissionPortalPage;