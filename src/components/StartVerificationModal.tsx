import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logCallUpdate, getLeadInfo, getAgentProfile } from "@/lib/callLogging";
import { getTodayDateEST } from "@/lib/dateUtils";

interface BufferAgent {
  id: string;
  display_name: string;
  email: string;
  status: 'available' | 'busy' | 'on_call' | 'offline';
}

interface LicensedAgent {
  id: string;
  display_name: string;
  email: string;
  status: 'available' | 'busy' | 'on_call' | 'offline';
}

interface StartVerificationModalProps {
  submissionId: string;
  onVerificationStarted: (sessionId: string) => void;
}

export const StartVerificationModal = ({ submissionId, onVerificationStarted }: StartVerificationModalProps) => {
  const [open, setOpen] = useState(false);
  const [bufferAgents, setBufferAgents] = useState<BufferAgent[]>([]);
  const [licensedAgents, setLicensedAgents] = useState<LicensedAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedLA, setSelectedLA] = useState<string>("");
  const [agentType, setAgentType] = useState<'buffer' | 'licensed'>('buffer');
  const [isRetentionCall, setIsRetentionCall] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingAgents, setFetchingAgents] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchBufferAgents();
      fetchLicensedAgents();
    }
  }, [open]);

  const fetchBufferAgents = async () => {
    setFetchingAgents(true);
    try {
      // Get buffer agents with their current status
      const { data: agents, error } = await supabase
        .from('agent_status')
        .select(`
          user_id,
          status
        `)
        .eq('agent_type', 'buffer');

      if (error) {
        throw error;
      }

      // Get profiles separately for the buffer agents
      const userIds = agents?.map(agent => agent.user_id) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      if (profilesError) {
        console.warn('Could not fetch profiles:', profilesError);
      }

      const formattedAgents = agents?.map(agent => {
        const profile = profiles?.find(p => p.user_id === agent.user_id);
        return {
          id: agent.user_id,
          display_name: profile?.display_name || 'Unknown',
          email: '', // We'll get this separately if needed
          status: agent.status as any
        };
      }) || [];

      setBufferAgents(formattedAgents);
    } catch (error) {
      console.error('Error fetching buffer agents:', error);
      toast({
        title: "Error",
        description: "Failed to load buffer agents",
        variant: "destructive",
      });
    } finally {
      setFetchingAgents(false);
    }
  };

  const fetchLicensedAgents = async () => {
    try {
      // Get licensed agents with their current status
      const { data: agents, error } = await supabase
        .from('agent_status')
        .select(`
          user_id,
          status
        `)
        .eq('agent_type', 'licensed');

      if (error) {
        throw error;
      }

      // Get profiles separately for the licensed agents
      const userIds = agents?.map(agent => agent.user_id) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      if (profilesError) {
        console.warn('Could not fetch licensed agent profiles:', profilesError);
      }

      const formattedAgents = agents?.map(agent => {
        const profile = profiles?.find(p => p.user_id === agent.user_id);
        return {
          id: agent.user_id,
          display_name: profile?.display_name || 'Unknown',
          email: '', // We'll get this separately if needed
          status: agent.status as any
        };
      }) || [];

      setLicensedAgents(formattedAgents);
    } catch (error) {
      console.error('Error fetching licensed agents:', error);
      toast({
        title: "Error",
        description: "Failed to load licensed agents",
        variant: "destructive",
      });
    }
  };

  const startVerification = async () => {
    // Validation based on agent type
    if (agentType === 'buffer' && !selectedAgent) {
      toast({
        title: "Error",
        description: "Please select a buffer agent",
        variant: "destructive",
      });
      return;
    }

    if (agentType === 'licensed' && !selectedLA) {
      toast({
        title: "Error",
        description: "Please select a licensed agent",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("User not authenticated");
      }

      // Fetch lead info for notification
      let leadData = {};
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('lead_vendor, customer_full_name')
        .eq('submission_id', submissionId)
        .single();
      if (!leadError && lead) {
        leadData = {
          lead_vendor: lead.lead_vendor,
          customer_full_name: lead.customer_full_name
        };
      }

      let sessionData;
      let notificationPayload = {};

      if (agentType === 'buffer') {
        // Traditional buffer agent workflow
        const bufferAgentName = bufferAgents.find(a => a.id === selectedAgent)?.display_name || 'Buffer Agent';
        sessionData = {
          submission_id: submissionId,
          buffer_agent_id: selectedAgent,
          status: 'in_progress',
          is_retention_call: isRetentionCall,
          started_at: new Date().toISOString()
        };
        notificationPayload = {
          type: 'verification_started',
          submissionId,
          agentType: 'buffer',
          agentName: bufferAgentName,
          bufferAgentName: bufferAgentName,
          leadData
        };
      } else {
        // Direct LA workflow - agent takes call directly and claims it
        const licensedAgentName = licensedAgents.find(a => a.id === selectedLA)?.display_name || 'Licensed Agent';
        sessionData = {
          submission_id: submissionId,
          licensed_agent_id: selectedLA,
          status: 'in_progress',
          is_retention_call: isRetentionCall,
          started_at: new Date().toISOString()
        };
        notificationPayload = {
          type: 'verification_started',
          submissionId,
          agentType: 'licensed',
          agentName: licensedAgentName,
          licensedAgentName: licensedAgentName,
          leadData
        };
      }

      // Create verification session
      const { data: session, error: sessionError } = await supabase
        .from('verification_sessions')
        .insert(sessionData)
        .select()
        .single();

      if (sessionError) {
        throw sessionError;
      }

      // Update the lead with retention flag
      const { error: leadUpdateError } = await supabase
        .from('leads')
        .update({ is_retention_call: isRetentionCall } as any)
        .eq('submission_id', submissionId);

      if (leadUpdateError) {
        console.warn('Failed to update lead retention flag:', leadUpdateError);
      }

      // Initialize verification items for both workflows
      const { error: initError } = await supabase.rpc(
        'initialize_verification_items',
        {
          session_id_param: session.id,
          submission_id_param: submissionId
        }
      );

      if (initError) {
        throw initError;
      }

      // Update agent status based on workflow type
      const agentId = agentType === 'buffer' ? selectedAgent : selectedLA;
      
      // Check if agent status exists
      const { data: existingStatus } = await supabase
        .from('agent_status')
        .select('id')
        .eq('user_id', agentId)
        .single();

      let statusError;
      if (existingStatus) {
        // Update existing status
        const { error } = await supabase
          .from('agent_status')
          .update({
            status: 'on_call',
            current_session_id: session.id,
            last_activity: new Date().toISOString()
          })
          .eq('user_id', agentId);
        statusError = error;
      } else {
        // Insert new status
        const { error } = await supabase
          .from('agent_status')
          .insert({
            user_id: agentId,
            status: 'on_call',
            agent_type: agentType,
            current_session_id: session.id,
            last_activity: new Date().toISOString()
          });
        statusError = error;
      }

      if (statusError) {
        console.warn('Failed to update agent status:', statusError);
      }

      // Send notification to center when verification starts
      const { data: notificationData, error: notificationError } = await supabase.functions.invoke('center-transfer-notification', {
        body: notificationPayload
      });

      if (notificationError) {
        console.warn('Failed to send notification:', notificationError);
        // Don't throw - continue with verification even if notification fails
      }

      // Log the verification started event
      const { customerName, leadVendor } = await getLeadInfo(submissionId);
      const selectedAgentId = agentType === 'buffer' ? selectedAgent : selectedLA;
      const selectedAgentName = agentType === 'buffer' 
        ? bufferAgents.find(a => a.id === selectedAgent)?.display_name || 'Buffer Agent'
        : licensedAgents.find(a => a.id === selectedLA)?.display_name || 'Licensed Agent';

      await logCallUpdate({
        submissionId,
        agentId: selectedAgentId,
        agentType,
        agentName: selectedAgentName,
        eventType: 'verification_started',
        eventDetails: {
          workflow_type: agentType,
          session_id: session.id,
          started_by: user.id
        },
        verificationSessionId: session.id,
        customerName,
        leadVendor,
        isRetentionCall: isRetentionCall
      });

      // Update daily_deal_flow if entry exists for today's date (buffer workflow only)
      if (agentType === 'buffer') {
        const bufferAgentName = bufferAgents.find(a => a.id === selectedAgent)?.display_name || 'N/A';
        const todayDateString = getTodayDateEST(); // Use EST date to match database
        
        // Check if daily_deal_flow entry exists with matching submission_id and today's date
        const { data: existingDailyDealEntry } = await supabase
          .from('daily_deal_flow')
          .select('id, date, submission_id')
          .eq('submission_id', submissionId)
          .eq('date', todayDateString)
          .maybeSingle();

        if (existingDailyDealEntry) {
          // Update the buffer_agent field and retention flag if entry exists AND date matches today
          await supabase
            .from('daily_deal_flow')
            .update({ 
              buffer_agent: bufferAgentName,
              is_retention_call: isRetentionCall
            } as any)
            .eq('id', existingDailyDealEntry.id);
          
          console.log(`Updated daily_deal_flow buffer_agent to ${bufferAgentName} and is_retention_call to ${isRetentionCall} for submission ${submissionId} on ${todayDateString}`);
        } else {
          console.log(`No daily_deal_flow entry found for submission ${submissionId} on ${todayDateString}`);
        }
      }

      toast({
        title: "Success",
        description: agentType === 'buffer' 
          ? "Verification session started with buffer agent" 
          : "Verification session started with licensed agent",
      });

      setOpen(false);
      setSelectedAgent("");
      setSelectedLA("");
      onVerificationStarted?.(session.id);
    } catch (error) {
      console.error('Error starting verification:', error);
      // Log the full error object for debugging
      console.error('Error details:', JSON.stringify(error, null, 2));
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start verification session",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-green-600';
      case 'on_call': return 'text-red-600';
      case 'busy': return 'text-yellow-600';
      case 'offline': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return 'Available';
      case 'on_call': return 'On Call';
      case 'busy': return 'Busy';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <UserCheck className="h-4 w-4" />
          Start Verification
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start Verification Process</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Agent Type Selection */}
          <div className="space-y-2">
            <Label>Select Workflow Type</Label>
            <Select value={agentType} onValueChange={(value: 'buffer' | 'licensed') => {
              setAgentType(value);
              setSelectedAgent("");
              setSelectedLA("");
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buffer">Buffer Agent → LA Transfer</SelectItem>
                <SelectItem value="licensed">Direct LA Call</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Buffer Agent Selection (Traditional Workflow) */}
          {agentType === 'buffer' && (
            <div className="space-y-2">
              <Label htmlFor="buffer-agent">Select Buffer Agent</Label>
              {fetchingAgents ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading agents...</span>
                </div>
              ) : (
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a buffer agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {bufferAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{agent.display_name}</span>
                          <span className={`ml-2 text-xs ${getStatusColor(agent.status)}`}>
                            {getStatusLabel(agent.status)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {bufferAgents.length === 0 && !fetchingAgents && (
                <p className="text-sm text-muted-foreground">
                  No buffer agents available. Switch to "Direct LA Call" workflow.
                </p>
              )}
            </div>
          )}

          {/* Licensed Agent Selection (Direct Workflow) */}
          {agentType === 'licensed' && (
            <div className="space-y-2">
              <Label htmlFor="licensed-agent">Select Licensed Agent</Label>
              {fetchingAgents ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading agents...</span>
                </div>
              ) : (
                <Select value={selectedLA} onValueChange={setSelectedLA}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a licensed agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {licensedAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{agent.display_name}</span>
                          <span className={`ml-2 text-xs ${getStatusColor(agent.status)}`}>
                            {getStatusLabel(agent.status)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {licensedAgents.length === 0 && !fetchingAgents && (
                <p className="text-sm text-muted-foreground">
                  No licensed agents available. Please ensure licensed agents are registered in the system.
                </p>
              )}
            </div>
          )}

          {/* Retention Call Toggle */}
          <div className="flex items-center justify-between space-x-2 border-t pt-4">
            <div className="space-y-0.5">
              <Label htmlFor="retention-call" className="text-base">
                Mark as Retention Call
              </Label>
              <p className="text-sm text-muted-foreground">
                This call will be tracked as a retention team call
              </p>
            </div>
            <Switch
              id="retention-call"
              checked={isRetentionCall}
              onCheckedChange={setIsRetentionCall}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={startVerification} 
              disabled={
                (agentType === 'buffer' && !selectedAgent) || 
                (agentType === 'licensed' && !selectedLA) || 
                loading
              }
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Start Verification
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
