import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Users, Phone, Clock, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ColoredProgress } from "@/components/ui/colored-progress";

interface AgentStatus {
  user_id: string;
  agent_type: 'buffer' | 'licensed';
  status: 'available' | 'busy' | 'on_call' | 'offline';
  display_name: string;
  current_session_id?: string;
  last_activity: string;
}

interface ActiveSession {
  id: string;
  submission_id: string;
  buffer_agent_id?: string;
  licensed_agent_id?: string;
  status: string;
  progress_percentage: number;
  started_at: string;
  claimed_at?: string;
  buffer_agent_name?: string;
  licensed_agent_name?: string;
  client_name?: string;
}

export const AnalyticsDashboard = () => {
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const { toast } = useToast();

  // Fetch agent statuses
  const fetchAgentStatuses = async () => {
    try {
      const { data: statuses, error } = await supabase
        .from('agent_status')
        .select(`
          user_id,
          agent_type,
          status,
          current_session_id,
          last_activity
        `);

      if (error) throw error;

      // Get profile names for all agents
      const userIds = statuses?.map(s => s.user_id) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      if (profilesError) {
        console.warn('Could not fetch profiles:', profilesError);
      }

      const enrichedStatuses = statuses?.map(status => {
        const profile = profiles?.find(p => p.user_id === status.user_id);
        return {
          ...status,
          display_name: profile?.display_name || 'Unknown'
        } as AgentStatus;
      }) || [];

      setAgentStatuses(enrichedStatuses);
    } catch (error) {
      console.error('Error fetching agent statuses:', error);
      toast({
        title: "Error",
        description: "Failed to load agent statuses",
        variant: "destructive",
      });
    }
  };

  // Fetch active sessions
  const fetchActiveSessions = async () => {
    try {
      const { data: sessions, error } = await supabase
        .from('verification_sessions')
        .select(`
          id,
          submission_id,
          buffer_agent_id,
          licensed_agent_id,
          status,
          progress_percentage,
          started_at,
          claimed_at
        `)
        .in('status', ['in_progress', 'claimed', 'transferred']);

      if (error) throw error;

      // Get agent names for sessions
      const bufferAgentIds = sessions?.map(s => s.buffer_agent_id).filter(Boolean) || [];
      const licensedAgentIds = sessions?.map(s => s.licensed_agent_id).filter(Boolean) || [];
      const allAgentIds = [...bufferAgentIds, ...licensedAgentIds];

      let profiles: any[] = [];
      if (allAgentIds.length > 0) {
        const { data: profileData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', allAgentIds);

        if (profilesError) {
          console.warn('Could not fetch agent profiles:', profilesError);
        } else {
          profiles = profileData || [];
        }
      }

      // Get submission data for client names
      const submissionIds = sessions?.map(s => s.submission_id) || [];
      let submissions: any[] = [];
      if (submissionIds.length > 0) {
        const { data: submissionData, error: submissionsError } = await supabase
          .from('submissions')
          .select('id, client_name')
          .in('id', submissionIds);

        if (submissionsError) {
          console.warn('Could not fetch submissions:', submissionsError);
        } else {
          submissions = submissionData || [];
        }
      }

      const enrichedSessions = sessions?.map(session => {
        const bufferAgent = profiles.find(p => p.user_id === session.buffer_agent_id);
        const licensedAgent = profiles.find(p => p.user_id === session.licensed_agent_id);
        const submission = submissions.find(s => s.id === session.submission_id);
        
        return {
          ...session,
          buffer_agent_name: bufferAgent?.display_name,
          licensed_agent_name: licensedAgent?.display_name,
          client_name: submission?.client_name || 'Unknown Client'
        } as ActiveSession;
      }) || [];

      setActiveSessions(enrichedSessions);
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      toast({
        title: "Error",
        description: "Failed to load active sessions",
        variant: "destructive",
      });
    }
  };

  // Refresh all data
  const handleRefresh = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchAgentStatuses(),
        fetchActiveSessions()
      ]);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 10 seconds
  useEffect(() => {
    handleRefresh();
    const interval = setInterval(handleRefresh, 10000);
    return () => clearInterval(interval);
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    const agentStatusChannel = supabase
      .channel('agent_status_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'agent_status' },
        () => {
          fetchAgentStatuses();
        }
      )
      .subscribe();

    const sessionChannel = supabase
      .channel('verification_session_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'verification_sessions' },
        () => {
          fetchActiveSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(agentStatusChannel);
      supabase.removeChannel(sessionChannel);
    };
  }, []);

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'on_call': return 'bg-red-100 text-red-800';
      case 'busy': return 'bg-yellow-100 text-yellow-800';
      case 'offline': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSessionStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'claimed': return 'bg-purple-100 text-purple-800';
      case 'transferred': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Filter agents by type and status
  const bufferAgents = agentStatuses.filter(agent => agent.agent_type === 'buffer');
  const licensedAgents = agentStatuses.filter(agent => agent.agent_type === 'licensed');
  const onlineAgents = agentStatuses.filter(agent => agent.status !== 'offline');
  const agentsOnCall = agentStatuses.filter(agent => agent.status === 'on_call');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Closers Online</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onlineAgents.length}</div>
            <p className="text-xs text-muted-foreground">
              {bufferAgents.filter(a => a.status !== 'offline').length} Buffer, {' '}
              {licensedAgents.filter(a => a.status !== 'offline').length} Licensed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agentsOnCall.length}</div>
            <p className="text-xs text-muted-foreground">
              Closers currently on calls
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSessions.length}</div>
            <p className="text-xs text-muted-foreground">
              Verification sessions in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Claimed Sessions</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeSessions.filter(s => s.status === 'claimed').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Sessions claimed by LA
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Buffer Closers Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Buffer Closers ({bufferAgents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bufferAgents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No buffer agents registered</p>
              ) : (
                bufferAgents.map((agent) => (
                  <div key={agent.user_id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{agent.display_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Last active: {new Date(agent.last_activity).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(agent.status)}>
                      {agent.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Closers Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Closers ({licensedAgents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {licensedAgents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No licensed agents registered</p>
              ) : (
                licensedAgents.map((agent) => (
                  <div key={agent.user_id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium">{agent.display_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Last active: {new Date(agent.last_activity).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(agent.status)}>
                      {agent.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Active Verification Sessions ({activeSessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active verification sessions</p>
            ) : (
              activeSessions.map((session) => (
                <div key={session.id} className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Phone className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">{session.client_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Started: {new Date(session.started_at).toLocaleTimeString()}
                          {session.claimed_at && (
                            <> • Claimed: {new Date(session.claimed_at).toLocaleTimeString()}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <Badge className={getSessionStatusColor(session.status)}>
                      {session.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {session.buffer_agent_name && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Buffer Agent:</span>
                        <span className="font-medium">{session.buffer_agent_name}</span>
                      </div>
                    )}
                    {session.licensed_agent_name && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Licensed Agent:</span>
                        <span className="font-medium">{session.licensed_agent_name}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{session.progress_percentage}%</span>
                    </div>
                    <ColoredProgress value={session.progress_percentage} />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
