import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColoredProgress } from "@/components/ui/colored-progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Clock, User, Filter, Search, RefreshCw, UserCheck, ChevronDown, ChevronUp, CalendarDays, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ClaimDroppedCallModal } from "./ClaimDroppedCallModal";
import { ClaimLicensedAgentModal } from "./ClaimLicensedAgentModal";
import { logCallUpdate, getLeadInfo } from "@/lib/callLogging";

interface VerificationSession {
  id: string;
  submission_id: string;
  status: string;
  progress_percentage: number;
  total_fields: number;
  verified_fields: number;
  started_at: string;
  buffer_agent_id?: string;
  licensed_agent_id?: string;
  buffer_agent_profile?: {
    display_name: string;
  };
  licensed_agent_profile?: {
    display_name: string;
  };
  leads?: {
    customer_full_name: string;
    phone_number: string;
  };
}

export const VerificationDashboard = () => {
  // Modal type state
  const [modalType, setModalType] = useState<'dropped' | 'licensed' | null>(null);
  const [sessions, setSessions] = useState<VerificationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [agentTypeFilter, setAgentTypeFilter] = useState("all"); // all, buffer, licensed
  const [agentNameFilter, setAgentNameFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activePage, setActivePage] = useState(1);
  const [incompletePage, setIncompletePage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const [incompleteCollapsed, setIncompleteCollapsed] = useState(false);
  const [completedCollapsed, setCompletedCollapsed] = useState(false);
  const [itemsPerPage] = useState(10);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchVerificationSessions();
    
    // Set up auto-refresh every 5 seconds
    const autoRefreshInterval = setInterval(() => {
      fetchVerificationSessions();
    }, 5000);
    
    // Set up real-time subscription for verification sessions
    const subscription = supabase
      .channel('verification_dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'verification_sessions',
        },
        () => {
          fetchVerificationSessions();
        }
      )
      .subscribe();

    return () => {
      clearInterval(autoRefreshInterval);
      subscription.unsubscribe();
    };
  }, []);

  const fetchVerificationSessions = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      }
      
      const { data, error } = await supabase
        .from('verification_sessions')
        .select(`
          *,
          leads!inner(customer_full_name, phone_number)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get profiles for buffer and licensed agents separately
      const bufferAgentIds = data?.map(session => session.buffer_agent_id).filter(Boolean) || [];
      const licensedAgentIds = data?.map(session => session.licensed_agent_id).filter(Boolean) || [];
      const allAgentIds = [...new Set([...bufferAgentIds, ...licensedAgentIds])];

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', allAgentIds);

      // Combine the data
      const sessionsWithProfiles = data?.map(session => ({
        ...session,
        buffer_agent_profile: profiles?.find(p => p.user_id === session.buffer_agent_id),
        licensed_agent_profile: profiles?.find(p => p.user_id === session.licensed_agent_id)
      })) || [];

      setSessions(sessionsWithProfiles);
    } catch (error) {
      console.error('Error fetching verification sessions:', error);
      toast({
        title: "Error",
        description: "Failed to load verification sessions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      if (isManualRefresh) {
        setRefreshing(false);
      }
    }
  };

  const handleManualRefresh = () => {
    fetchVerificationSessions(true);
  };

  // Modal state for claiming dropped call
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimSessionId, setClaimSessionId] = useState<string | null>(null);
  const [claimSubmissionId, setClaimSubmissionId] = useState<string | null>(null);
  const [claimLicensedAgent, setClaimLicensedAgent] = useState<string>("");
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimLead, setClaimLead] = useState<any>(null);
  const [licensedAgents, setLicensedAgents] = useState<any[]>([]);
  const [fetchingAgents, setFetchingAgents] = useState(false);

  // Modal open logic
  // Open correct modal type
  const openClaimModal = async (sessionId: string, submissionId: string, agentTypeOverride?: 'licensed') => {
    setClaimSessionId(sessionId);
    setClaimSubmissionId(submissionId);
    setClaimModalOpen(true);
    // Fetch lead info
    const { data: lead } = await supabase
      .from('leads')
      .select('lead_vendor, customer_full_name')
      .eq('submission_id', submissionId)
      .single();
    setClaimLead(lead);
    if (agentTypeOverride === 'licensed') {
      setModalType('licensed');
      setClaimLicensedAgent("");
      fetchAgents('licensed');
    } else {
      setModalType('dropped');
      setClaimLicensedAgent("");
      fetchAgents('licensed');
    }
  };

  // Fetch agents for dropdowns
  const fetchAgents = async (type: 'licensed') => {
    setFetchingAgents(true);
    try {
      const { data: agentStatus } = await supabase
        .from('agent_status')
        .select('user_id')
        .eq('agent_type', type);
      const ids = agentStatus?.map(a => a.user_id) || [];
      let profiles = [];
      if (ids.length > 0) {
        const { data: fetchedProfiles } = await (supabase as any)
          .from('app_users')
          .select('user_id, display_name, email')
          .in('user_id', ids);
        profiles = (fetchedProfiles || []).map((u: any) => ({
          user_id: u.user_id,
          display_name: u.display_name || (u.email ? String(u.email).split('@')[0] : '')
        }));
      }
      setLicensedAgents(profiles);
    } catch (error) {
      // Optionally handle error
    } finally {
      setFetchingAgents(false);
    }
  };

  const handleClaimDroppedCall = async () => {
    setClaimLoading(true);
    try {
      const agentId = claimLicensedAgent;
      if (!agentId) {
        toast({
          title: "Error",
          description: "Please select a licensed agent",
          variant: "destructive",
        });
        setClaimLoading(false);
        return;
      }
      // Update verification session
      const updateFields: any = {
        status: 'in_progress'
      };
      updateFields.licensed_agent_id = agentId;
      await supabase
        .from('verification_sessions')
        .update(updateFields)
        .eq('id', claimSessionId);

      // Log the call claim event
      const agentName = licensedAgents.find(a => a.user_id === agentId)?.display_name || 'Licensed Agent';

      const { customerName, leadVendor } = await getLeadInfo(claimSubmissionId!);
      
      // Determine the event type based on the claim scenario
      let eventType: 'call_claimed' | 'transferred_to_licensed_agent' = 'call_claimed';
      
      // Get the current session to check if there was a previous licensed agent
      const { data: currentSession } = await supabase
        .from('verification_sessions')
        .select('licensed_agent_id, buffer_agent_id')
        .eq('id', claimSessionId)
        .single();
      
      // If a licensed agent is claiming a call that was previously with another licensed agent
      if (currentSession?.licensed_agent_id && currentSession.licensed_agent_id !== agentId) {
        eventType = 'transferred_to_licensed_agent';
      }
      
      await logCallUpdate({
        submissionId: claimSubmissionId!,
        agentId: agentId,
        agentType: 'licensed',
        agentName: agentName,
        eventType: eventType,
        eventDetails: {
          verification_session_id: claimSessionId,
          claimed_at: new Date().toISOString(),
          claimed_from_dashboard: true,
          previous_agent_id: currentSession?.licensed_agent_id || currentSession?.buffer_agent_id,
          transfer_type: eventType === 'transferred_to_licensed_agent' ? 'licensed_to_licensed' : 'claim'
        },
        verificationSessionId: claimSessionId!,
        customerName,
        leadVendor
      });

      // Send notification
      await supabase.functions.invoke('center-transfer-notification', {
        body: {
          type: 'reconnected',
          submissionId: claimSubmissionId,
          agentType: 'licensed',
          agentName: agentName,
          leadData: claimLead
        }
      });

      toast({
        title: "Call Reconnected",
        description: `${licensedAgents.find(a => a.user_id === agentId)?.display_name} get connected with ${claimLead?.customer_full_name}`,
      });

      setClaimModalOpen(false);
      setClaimLoading(false);
      fetchVerificationSessions();
      navigate(`/call-result-update?submissionId=${claimSubmissionId}`);
    } catch (error) {
      setClaimLoading(false);
      toast({
        title: "Error",
        description: "Failed to claim dropped call",
        variant: "destructive",
      });
    }
  };

  // Helper function for date filtering
  const matchesDateFilter = (session: VerificationSession) => {
    if (!startDate && !endDate) return true;
    
    const sessionDate = new Date(session.started_at);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    
    // Set end date to end of day if provided
    if (end) {
      end.setHours(23, 59, 59, 999);
    }
    
    if (start && end) {
      return sessionDate >= start && sessionDate <= end;
    } else if (start) {
      return sessionDate >= start;
    } else if (end) {
      return sessionDate <= end;
    }
    return true;
  };

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = 
      session.leads?.customer_full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.submission_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || session.status === statusFilter;
    
    const matchesAgentType = agentTypeFilter === "all" || 
      (agentTypeFilter === "buffer" && session.buffer_agent_profile?.display_name) ||
      (agentTypeFilter === "licensed" && session.licensed_agent_profile?.display_name);
    
    const matchesAgentName = agentNameFilter === "all" ||
      session.buffer_agent_profile?.display_name === agentNameFilter ||
      session.licensed_agent_profile?.display_name === agentNameFilter;
    
    const matchesDate = matchesDateFilter(session);
    
    return matchesSearch && matchesStatus && matchesAgentType && matchesAgentName && matchesDate;
  });

  // Categorize sessions
  const categorizeSessions = () => {
    const activeStatuses = ['in_progress', 'pending', 'ready_for_transfer', 'transferred'];
    const incompleteStatuses = ['call_dropped'];
    const completedStatuses = ['buffer_done', 'la_done', 'completed'];

    return {
      active: filteredSessions.filter(session => activeStatuses.includes(session.status)),
      incomplete: filteredSessions.filter(session => incompleteStatuses.includes(session.status)),
      completed: filteredSessions.filter(session => completedStatuses.includes(session.status))
    };
  };

  const { active, incomplete, completed } = categorizeSessions();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'ready_for_transfer': return 'bg-green-100 text-green-800';
      case 'transferred': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-emerald-100 text-emerald-800';
      case 'call_dropped': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressLabel = (percentage: number) => {
    if (percentage >= 76) return "Ready for Transfer";
    if (percentage >= 51) return "Nearly Complete";
    if (percentage >= 26) return "In Progress";
    return "Just Started";
  };

  const getProgressTextColor = (percentage: number) => {
    if (percentage >= 76) return "text-green-600";
    if (percentage >= 51) return "text-yellow-600";
    if (percentage >= 26) return "text-orange-600";
    return "text-red-600";
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  // Get unique agent names based on type filter
  const getAgentNames = () => {
    const names = new Set<string>();
    sessions.forEach(session => {
      if (agentTypeFilter === "all" || agentTypeFilter === "buffer") {
        if (session.buffer_agent_profile?.display_name) {
          names.add(session.buffer_agent_profile.display_name);
        }
      }
      if (agentTypeFilter === "all" || agentTypeFilter === "licensed") {
        if (session.licensed_agent_profile?.display_name) {
          names.add(session.licensed_agent_profile.display_name);
        }
      }
    });
    return Array.from(names).sort();
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
  };

  const handleAgentTypeFilterChange = (value: string) => {
    setAgentTypeFilter(value);
    setAgentNameFilter("all"); // Reset agent name when type changes
  };

  const handleAgentNameFilterChange = (value: string) => {
    setAgentNameFilter(value);
  };

  const viewSession = (submissionId: string) => {
    navigate(`/call-result-update?submissionId=${submissionId}`);
  };

  // Reusable Session Table Component
  const SessionTable = ({ 
    sessions, 
    title, 
    emptyMessage, 
    currentPage, 
    onPageChange,
    collapsible = false,
    collapsed = false,
    onToggleCollapse
  }: { 
    sessions: VerificationSession[], 
    title: string, 
    emptyMessage: string,
    currentPage: number,
    onPageChange: (page: number) => void,
    collapsible?: boolean,
    collapsed?: boolean,
    onToggleCollapse?: () => void
  }) => {
    const paginatedSessions = sessions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(sessions.length / itemsPerPage);

    const handlePageChange = (page: number) => {
      onPageChange(page);
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {collapsible && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleCollapse}
                  className="p-1 h-6 w-6"
                >
                  {collapsed ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </Button>
              )}
              <span>{title} ({sessions.length})</span>
            </div>
            {totalPages > 1 && !collapsed && (
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
            )}
          </CardTitle>
        </CardHeader>
        {!collapsed && (
          <CardContent>
            {paginatedSessions.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Buffer Agent</TableHead>
                      <TableHead>LA Agent</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{session.leads?.customer_full_name}</div>
                            <div className="text-sm text-muted-foreground">{session.leads?.phone_number}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>{session.buffer_agent_profile?.display_name || 'Unassigned'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>{session.licensed_agent_profile?.display_name || 'Not Assigned'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className={`font-semibold ${getProgressTextColor(session.progress_percentage)}`}>
                                {session.progress_percentage}%
                              </span>
                              <span className="text-muted-foreground">
                                {session.verified_fields}/{session.total_fields}
                              </span>
                            </div>
                            <ColoredProgress 
                              value={session.progress_percentage} 
                              className="h-3 transition-all duration-500"
                            />
                            <div className={`text-xs font-medium px-2 py-1 rounded-full text-center ${
                              session.progress_percentage >= 76 ? 'bg-green-100 text-green-800' :
                              session.progress_percentage >= 51 ? 'bg-yellow-100 text-yellow-800' :
                              session.progress_percentage >= 26 ? 'bg-orange-100 text-orange-800' : 
                              'bg-red-100 text-red-800'
                            }`}>
                              {getProgressLabel(session.progress_percentage)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(session.status)}>
                            {session.status === 'call_dropped' ? 'Call Dropped' : session.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm">{formatTimeAgo(session.started_at)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {session.status === 'call_dropped' && (
                              <Button
                                variant="outline"
                                onClick={() => openClaimModal(session.id, session.submission_id)}
                                className="text-red-600 border-red-600"
                              >
                                Claim Dropped Call
                              </Button>
                            )}
                            {(session.status === 'transferred' && (!session.licensed_agent_id || session.licensed_agent_id === '')) && (
                              <Button
                                variant="outline"
                                onClick={() => openClaimModal(session.id, session.submission_id, 'licensed')}
                                className="text-purple-600 border-purple-600"
                              >
                                Claim as Licensed Agent
                              </Button>
                            )}
                            {session.status === 'ready_for_transfer' && (
                              <Button
                                variant="outline"
                                onClick={() => openClaimModal(session.id, session.submission_id, 'licensed')}
                                className="text-purple-600 border-purple-600"
                              >
                                Claim as Licensed Agent
                              </Button>
                            )}
                            {/* Show button for completed sessions */}
                            {(session.status === 'buffer_done' || session.status === 'la_done' || session.status === 'completed') && (
                              <Button
                                variant="outline"
                                onClick={() => viewSession(session.submission_id)}
                                className="text-blue-600 border-blue-600"
                              >
                                Show Session
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sessions.length)} of {sessions.length} entries
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {(() => {
                          const maxVisiblePages = 5;
                          const pages = [];
                          
                          if (totalPages <= maxVisiblePages) {
                            // Show all pages if total is small
                            for (let i = 1; i <= totalPages; i++) {
                              pages.push(
                                <Button
                                  key={i}
                                  variant={currentPage === i ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handlePageChange(i)}
                                  className="w-8 h-8 p-0"
                                >
                                  {i}
                                </Button>
                              );
                            }
                          } else {
                            // Show first page
                            pages.push(
                              <Button
                                key={1}
                                variant={currentPage === 1 ? "default" : "outline"}
                                size="sm"
                                onClick={() => handlePageChange(1)}
                                className="w-8 h-8 p-0"
                              >
                                1
                              </Button>
                            );
                            
                            // Show ellipsis if current page is far from start
                            if (currentPage > 3) {
                              pages.push(<span key="start-ellipsis" className="px-2">...</span>);
                            }
                            
                            // Show pages around current page
                            const start = Math.max(2, currentPage - 1);
                            const end = Math.min(totalPages - 1, currentPage + 1);
                            
                            for (let i = start; i <= end; i++) {
                              if (i !== 1 && i !== totalPages) {
                                pages.push(
                                  <Button
                                    key={i}
                                    variant={currentPage === i ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handlePageChange(i)}
                                    className="w-8 h-8 p-0"
                                  >
                                    {i}
                                  </Button>
                                );
                              }
                            }
                            
                            // Show ellipsis if current page is far from end
                            if (currentPage < totalPages - 2) {
                              pages.push(<span key="end-ellipsis" className="px-2">...</span>);
                            }
                            
                            // Show last page
                            if (totalPages > 1) {
                              pages.push(
                                <Button
                                  key={totalPages}
                                  variant={currentPage === totalPages ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handlePageChange(totalPages)}
                                  className="w-8 h-8 p-0"
                                >
                                  {totalPages}
                                </Button>
                              );
                            }
                          }
                          
                          return pages;
                        })()}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {emptyMessage}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }
  return (
    <>
    {/* Claim Dropped Call Modal */}
    <ClaimDroppedCallModal
      open={claimModalOpen && modalType === 'dropped'}
      loading={claimLoading}
      licensedAgents={licensedAgents}
      fetchingAgents={fetchingAgents}
      claimLicensedAgent={claimLicensedAgent}
      onLicensedAgentChange={setClaimLicensedAgent}
      isRetentionCall={false}
      onRetentionCallChange={() => {}}
      onCancel={() => setClaimModalOpen(false)}
      onClaim={handleClaimDroppedCall}
    />
    {/* Claim Licensed Agent Modal */}
    <ClaimLicensedAgentModal
      open={claimModalOpen && modalType === 'licensed'}
      loading={claimLoading}
      licensedAgents={licensedAgents}
      fetchingAgents={fetchingAgents}
      claimLicensedAgent={claimLicensedAgent}
      isRetentionCall={false}
      onLicensedAgentChange={setClaimLicensedAgent}
      onRetentionCallChange={() => {}}
      onCancel={() => setClaimModalOpen(false)}
      onClaim={handleClaimDroppedCall}
    />
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Verification Dashboard</h1>
          <p className="text-muted-foreground">Monitor verification sessions across different stages (Auto-refreshes every 5 seconds)</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm">Active ({active.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="text-sm">Incomplete ({incomplete.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm">Completed ({completed.length})</span>
          </div>
          <Button 
            onClick={handleManualRefresh}
            variant="outline"
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* First row - Search and Status */}
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by customer name or submission ID..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="w-48">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="ready_for_transfer">Ready for Transfer</SelectItem>
                  <SelectItem value="transferred">Transferred</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="call_dropped">Call Dropped</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Second row - Agent filters and Date */}
            <div className="flex gap-4">
              <Select value={agentTypeFilter} onValueChange={handleAgentTypeFilterChange}>
                <SelectTrigger className="w-48">
                  <User className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Agent type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agent Types</SelectItem>
                  <SelectItem value="buffer">Buffer Agents</SelectItem>
                  <SelectItem value="licensed">Licensed Agents</SelectItem>
                </SelectContent>
              </Select>

              <Select value={agentNameFilter} onValueChange={handleAgentNameFilterChange}>
                <SelectTrigger className="w-48">
                  <User className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Agent name" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {getAgentNames().map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium whitespace-nowrap">Start Date:</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-40"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium whitespace-nowrap">End Date:</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-40"
                />
              </div>

              {/* Clear Filters Button */}
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setAgentTypeFilter("all");
                  setAgentNameFilter("all");
                  setStartDate("");
                  setEndDate("");
                }}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Currently Active Sessions */}
      <SessionTable
        sessions={active}
        title="Currently Active"
        emptyMessage="No active verification sessions"
        currentPage={activePage}
        onPageChange={setActivePage}
      />

      {/* Incomplete/Dropped Calls */}
      <SessionTable
        sessions={incomplete}
        title="Incomplete Calls/Dropped Calls"
        emptyMessage="No incomplete or dropped calls"
        currentPage={incompletePage}
        onPageChange={setIncompletePage}
        collapsible={true}
        collapsed={incompleteCollapsed}
        onToggleCollapse={() => setIncompleteCollapsed(!incompleteCollapsed)}
      />

      {/* Completed Calls */}
      <SessionTable
        sessions={completed}
        title="Completed Calls"
        emptyMessage="No completed verification sessions"
        currentPage={completedPage}
        onPageChange={setCompletedPage}
        collapsible={true}
        collapsed={completedCollapsed}
        onToggleCollapse={() => setCompletedCollapsed(!completedCollapsed)}
      />
    </div>
    </>
  );
}
