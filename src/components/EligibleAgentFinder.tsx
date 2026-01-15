import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, CheckCircle2, XCircle, User } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EligibleAgent {
  user_id: string;
  agent_name: string;
  email: string;
  agent_code: string | null;
  carrier_licensed: boolean;
  state_licensed: boolean;
  upline_licensed: boolean;
  upline_required: boolean;
  upline_name: string | null;
}

interface Carrier {
  id: string;
  carrier_name: string;
}

interface State {
  id: string;
  state_name: string;
}

export default function EligibleAgentFinder() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [carrierName, setCarrierName] = useState('');
  const [stateName, setStateName] = useState('');
  const [eligibleAgents, setEligibleAgents] = useState<EligibleAgent[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Fetch carriers and states on component mount
  useEffect(() => {
    fetchCarriersAndStates();
  }, []);

  const fetchCarriersAndStates = async () => {
    setLoadingOptions(true);
    try {
      // Fetch carriers
      const { data: carriersData, error: carriersError } = await supabase
        .from('carriers')
        .select('id, carrier_name')
        .order('carrier_name');

      if (carriersError) throw carriersError;
      setCarriers(carriersData || []);

      // Fetch states
      const { data: statesData, error: statesError } = await supabase
        .from('states')
        .select('id, state_name')
        .order('state_name');

      if (statesError) throw statesError;
      setStates(statesData || []);
    } catch (error) {
      console.error('Error fetching carriers and states:', error);
      toast({
        title: 'Error',
        description: 'Failed to load carriers and states.',
        variant: 'destructive'
      });
    } finally {
      setLoadingOptions(false);
    }
  };

  const searchEligibleAgents = async () => {
    if (!carrierName.trim() || !stateName.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please select both carrier and state.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      // Check if the carrier is Aetna - use special function for Aetna
      const isAetna = carrierName.toLowerCase() === 'aetna';
      
      let data, error;
      
      if (isAetna) {
        // Use Aetna-specific function
        const result = await supabase
          .rpc('get_eligible_agents_for_aetna' as any, {
            p_state_name: stateName
          });
        data = result.data;
        error = result.error;
      } else {
        // Use general upline check function for all other carriers
        const result = await supabase
          .rpc('get_eligible_agents_with_upline_check' as any, {
            p_carrier_name: carrierName,
            p_state_name: stateName
          });
        data = result.data;
        error = result.error;
      }

      if (error) throw error;

      const agentsList = Array.isArray(data) ? data : [];
      setEligibleAgents(agentsList);

      if (agentsList.length === 0) {
        toast({
          title: 'No Eligible Closers Found',
          description: isAetna 
            ? `No agents are available for Aetna in ${stateName} (requires upline approval).`
            : `No agents are licensed for ${carrierName} in ${stateName}.`,
          variant: 'default'
        });
      } else {
        toast({
          title: 'Search Complete',
          description: `Found ${agentsList.length} eligible agent(s).${isAetna ? ' (Aetna requires upline licensing)' : ''}`,
        });
      }
    } catch (error) {
      console.error('Error searching for agents:', error);
      toast({
        title: 'Error',
        description: 'Failed to search for eligible agents. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Find Eligible Closers
          </CardTitle>
          <CardDescription>
            Search for agents licensed to sell a specific carrier in a specific state
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Carrier Name</label>
              <Select value={carrierName} onValueChange={setCarrierName} disabled={loadingOptions}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingOptions ? "Loading carriers..." : "Select a carrier"} />
                </SelectTrigger>
                <SelectContent>
                  {carriers.map((carrier) => (
                    <SelectItem key={carrier.id} value={carrier.carrier_name}>
                      {carrier.carrier_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">State Name</label>
              <Select value={stateName} onValueChange={setStateName} disabled={loadingOptions}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingOptions ? "Loading states..." : "Select a state"} />
                </SelectTrigger>
                <SelectContent>
                  {states.map((state) => (
                    <SelectItem key={state.id} value={state.state_name}>
                      {state.state_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Aetna Special Notice */}
          {carrierName.toLowerCase() === 'aetna' && (
            <Alert className="bg-blue-50 border-blue-200">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Aetna Special Requirements:</strong> This carrier uses a separate state availability system. All 52 US states/territories require upline license verification with custom per-agent state approvals.
              </AlertDescription>
            </Alert>
          )}
          
          <Button onClick={searchEligibleAgents} disabled={loading || loadingOptions} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search for Eligible Closers
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results Section */}
      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>
              {eligibleAgents.length > 0
                ? `${eligibleAgents.length} agent(s) found for ${carrierName} in ${stateName}`
                : `No agents found for ${carrierName} in ${stateName}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {eligibleAgents.length === 0 ? (
              <Alert>
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  No agents are currently licensed to sell <strong>{carrierName}</strong> in{' '}
                  <strong>{stateName}</strong>. Please check your spelling or try a different
                  carrier/state combination.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {eligibleAgents.map((agent) => (
                  <div
                    key={agent.user_id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{agent.agent_name || 'Unnamed Agent'}</p>
                        {agent.agent_code && (
                          <p className="text-sm text-muted-foreground">Code: {agent.agent_code}</p>
                        )}
                        {agent.upline_name && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Upline: <strong>{agent.upline_name}</strong>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {agent.carrier_licensed && (
                        <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          Carrier
                        </Badge>
                      )}
                      {agent.state_licensed && (
                        <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          State
                        </Badge>
                      )}
                      {agent.upline_required && agent.upline_licensed && (
                        <Badge variant="default" className="flex items-center gap-1 bg-blue-600">
                          <CheckCircle2 className="h-3 w-3" />
                          Upline
                        </Badge>
                      )}
                      {agent.upline_required && !agent.upline_licensed && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <XCircle className="h-3 w-3" />
                          Upline Missing
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
