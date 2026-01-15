import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Users } from 'lucide-react';
import { MultiSelect } from '@/components/ui/multi-select';

interface AgentPerformanceData {
  name: string;
  totalPlacements: number;
  totalPremium: number;
  avgPremium: number;
  uniqueCarriers: number;
  statusBreakdown?: Record<string, number>;
  policyTypeBreakdown?: Record<string, number>;
}

interface AgentsPerformanceTabProps {
  agentPerformance: AgentPerformanceData[];
  uniqueStatuses: string[];
  selectedStatuses: string[];
  onStatusFilterChange: (statuses: string[]) => void;
}

export const AgentsPerformanceTab = ({ 
  agentPerformance, 
  uniqueStatuses, 
  selectedStatuses, 
  onStatusFilterChange 
}: AgentsPerformanceTabProps) => {
  // Safety check for props
  const safeUniqueStatuses = uniqueStatuses || [];
  const safeSelectedStatuses = selectedStatuses || [];
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Agent Performance Overview</span>
            <Badge variant="outline">{agentPerformance.length} Closers</Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {/* Status Filter */}
        {safeUniqueStatuses.length > 0 && (
          <div className="mb-6">
            <MultiSelect
              options={safeUniqueStatuses}
              selected={safeSelectedStatuses}
              onChange={onStatusFilterChange}
              placeholder="Filter by status (multi-select)"
              className="max-w-2xl"
            />
            {safeSelectedStatuses.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Showing placements with status: {safeSelectedStatuses.join(', ')}
              </p>
            )}
          </div>
        )}
        <div className="space-y-4">
          {agentPerformance.map((agent, index) => (
            <Card key={agent.name} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-bold">
                      #{index + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{agent.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {agent.uniqueCarriers} carriers
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{agent.totalPlacements}</p>
                      <p className="text-xs text-muted-foreground">Placements</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        ${agent.totalPremium.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Premium</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-600">
                        ${Math.round(agent.avgPremium).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Avg Premium</p>
                    </div>
                  </div>
                </div>

                {/* Status Breakdown and Policy Type Breakdown - Side by Side */}
                <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Status Breakdown */}
                  {agent.statusBreakdown && Object.keys(agent.statusBreakdown).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Status Breakdown:</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(agent.statusBreakdown).map(([status, count]) => (
                          <Badge key={status} variant="outline" className="text-xs">
                            {status}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Policy Type Breakdown */}
                  {agent.policyTypeBreakdown && Object.keys(agent.policyTypeBreakdown).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-3">Policy Type Breakdown:</p>
                      <div className="flex items-center gap-6">
                        {(() => {
                          const totalPolicies = Object.values(agent.policyTypeBreakdown).reduce((sum, count) => sum + count, 0);
                          const giCount = agent.policyTypeBreakdown['GI'] || 0;
                          const nonGiCount = agent.policyTypeBreakdown['Non GI'] || 0;
                          const giPercentage = totalPolicies > 0 ? Math.round((giCount / totalPolicies) * 100) : 0;
                          const nonGiPercentage = totalPolicies > 0 ? Math.round((nonGiCount / totalPolicies) * 100) : 0;

                          return (
                            <>
                              {nonGiCount > 0 && (
                                <div className="flex items-center space-x-2">
                                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                                  <span className="text-sm text-muted-foreground">Non GI:</span>
                                  <span className="text-xl font-bold text-orange-600">{nonGiPercentage}%</span>
                                  <span className="text-sm text-muted-foreground">({nonGiCount})</span>
                                </div>
                              )}
                              {giCount > 0 && (
                                <div className="flex items-center space-x-2">
                                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                  <span className="text-sm text-muted-foreground">GI:</span>
                                  <span className="text-xl font-bold text-blue-600">{giPercentage}%</span>
                                  <span className="text-sm text-muted-foreground">({giCount})</span>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {agentPerformance.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No agent data available for the selected filters
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
