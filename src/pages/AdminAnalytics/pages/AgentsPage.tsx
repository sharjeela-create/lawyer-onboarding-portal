import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Users, RefreshCw, Filter, X, DollarSign, Award, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAdminAnalyticsData } from '@/hooks/useAdminAnalyticsData';
import { ParsedPolicyItem } from '@/lib/mondayApi';
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

export const AgentsPage = () => {
  const { toast } = useToast();

  // Filters state
  const [dateFilter, setDateFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string[]>(['Issued Paid', 'Pending', 'Issued Not Paid']);
  const [agentStatusFilter, setAgentStatusFilter] = useState<string[]>([]);

  // Use React Query for data fetching
  const { 
    data: placements = [], 
    isLoading, 
    isError, 
    error,
    refetch,
    isFetching
  } = useAdminAnalyticsData(true);

  // Agent mapping
  const agentEmailMap: Record<string, string> = {
    'isaac.r@heritageinsurance.io': 'Isaac Reed',
    'benjamin.w@unlimitedinsurance.io': 'Benjamin Wunder',
    'lydia.s@unlimitedinsurance.io': 'Lydia Sutton',
    'noah@unlimitedinsurance.io': 'Noah Brock',
    'tatumn.s@heritageinsurance.io': 'Trinity Queen'
  };

  const agentNames = Object.values(agentEmailMap);

  // Helper functions
  const getColumnValue = (item: ParsedPolicyItem, columnId: string): string => {
    const column = item.column_values?.find(col => col.id === columnId);
    return column?.text || '';
  };

  const getPremium = (item: ParsedPolicyItem): number => {
    const premiumText = getColumnValue(item, 'numbers');
    return premiumText ? parseFloat(premiumText.replace(/[^0-9.-]+/g, '')) || 0 : 0;
  };

  const getPolicyType = (item: ParsedPolicyItem): string => {
    return getColumnValue(item, 'text_mkxdrsg2');
  };

  useEffect(() => {
    if (isError) {
      toast({
        title: "Error fetching data",
        description: error?.message || "Unable to load analytics data. Please try again.",
        variant: "destructive",
      });
    }
  }, [isError, error, toast]);

  // Filter placements based on current filters
  const getFilteredPlacements = () => {
    let filtered = placements;

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter(p => {
        const dateStr = getColumnValue(p, 'date_mkq1d86z');
        if (!dateStr) return false;
        const placementDate = new Date(dateStr);

        switch (dateFilter) {
          case '24hours': {
            const dayAgo = new Date(now);
            dayAgo.setHours(now.getHours() - 24);
            return placementDate >= dayAgo && placementDate <= now;
          }
          case '7days': {
            const weekAgo = new Date(now);
            weekAgo.setDate(now.getDate() - 7);
            return placementDate >= weekAgo && placementDate <= now;
          }
          case '30days': {
            const monthAgo = new Date(now);
            monthAgo.setDate(now.getDate() - 30);
            return placementDate >= monthAgo && placementDate <= now;
          }
          case '6months': {
            const sixMonthsAgo = new Date(now);
            sixMonthsAgo.setMonth(now.getMonth() - 6);
            return placementDate >= sixMonthsAgo && placementDate <= now;
          }
          case 'custom': {
            if (startDate && endDate) {
              const start = new Date(startDate);
              const end = new Date(endDate);
              end.setHours(23, 59, 59, 999);
              return placementDate >= start && placementDate <= end;
            }
            return true;
          }
          default:
            return true;
        }
      });
    }

    // Carrier filter
    if (carrierFilter !== 'all') {
      filtered = filtered.filter(p => getColumnValue(p, 'color_mknkq2qd') === carrierFilter);
    }

    // Status filter
    if (statusFilter.length > 0) {
      filtered = filtered.filter(p => {
        const status = getColumnValue(p, 'status');
        return statusFilter.includes(status);
      });
    }

    return filtered;
  };

  const filteredPlacements = getFilteredPlacements();

  // Get unique carriers and statuses
  const uniqueCarriers = Array.from(
    new Set(placements.map(p => getColumnValue(p, 'color_mknkq2qd')).filter(Boolean))
  ).sort();

  const uniqueStatuses = Array.from(
    new Set(placements.map(p => getColumnValue(p, 'status')).filter(Boolean))
  ).sort();

  // Calculate agent performance data
  const getAgentPerformance = (): AgentPerformanceData[] => {
    return agentNames.map(agentName => {
      let agentPlacements = filteredPlacements.filter(
        p => getColumnValue(p, 'color_mkq0rkaw') === agentName
      );
      
      if (agentStatusFilter.length > 0) {
        agentPlacements = agentPlacements.filter(
          p => agentStatusFilter.includes(getColumnValue(p, 'status'))
        );
      }
      
      const totalPlacements = agentPlacements.length;
      const totalPremium = agentPlacements.reduce((sum, p) => sum + getPremium(p), 0);
      const avgPremium = totalPlacements > 0 ? totalPremium / totalPlacements : 0;
      
      const uniqueCarriersCount = new Set(
        agentPlacements.map(p => getColumnValue(p, 'color_mknkq2qd')).filter(Boolean)
      ).size;

      const statusBreakdown: Record<string, number> = {};
      agentPlacements.forEach(p => {
        const status = getColumnValue(p, 'status');
        if (status) {
          statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
        }
      });

      const policyTypeBreakdown: Record<string, number> = {};
      agentPlacements.forEach(p => {
        const policyType = getPolicyType(p);
        if (policyType) {
          policyTypeBreakdown[policyType] = (policyTypeBreakdown[policyType] || 0) + 1;
        }
      });

      return {
        name: agentName,
        totalPlacements,
        totalPremium,
        avgPremium,
        uniqueCarriers: uniqueCarriersCount,
        statusBreakdown,
        policyTypeBreakdown
      };
    }).sort((a, b) => b.totalPlacements - a.totalPlacements);
  };

  const agentPerformance = isLoading ? [] : getAgentPerformance();

  // Summary stats
  const totalPlacements = filteredPlacements.length;
  const totalPremium = filteredPlacements.reduce((sum, p) => sum + getPremium(p), 0);
  const avgPremium = totalPlacements > 0 ? totalPremium / totalPlacements : 0;
  const activeAgents = agentPerformance.filter(a => a.totalPlacements > 0).length;

  const handleClearFilters = () => {
    setDateFilter('all');
    setCarrierFilter('all');
    setStatusFilter(['Issued Paid', 'Pending', 'Issued Not Paid']);
    setAgentStatusFilter([]);
    setStartDate('');
    setEndDate('');
  };

  const handleRefresh = async () => {
    toast({
      title: "Refreshing data...",
      description: "Fetching latest policy placements from Monday.com",
    });
    
    await refetch();
    
    toast({
      title: "Data refreshed",
      description: `Updated with ${placements.length} policy placements`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-700 font-medium">Active Closers</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">{activeAgents}</p>
            <p className="text-xs text-blue-600 mt-1">With placements</p>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-100">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Award className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700 font-medium">Total Placements</span>
            </div>
            <p className="text-2xl font-bold text-green-900">{totalPlacements.toLocaleString()}</p>
            <p className="text-xs text-green-600 mt-1">In selected period</p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-100">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-purple-600" />
              <span className="text-sm text-purple-700 font-medium">Total Premium</span>
            </div>
            <p className="text-2xl font-bold text-purple-900">${totalPremium.toLocaleString()}</p>
            <p className="text-xs text-purple-600 mt-1">Combined premium</p>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 border-orange-100">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-orange-600" />
              <span className="text-sm text-orange-700 font-medium">Avg Premium</span>
            </div>
            <p className="text-2xl font-bold text-orange-900">${Math.round(avgPremium).toLocaleString()}</p>
            <p className="text-xs text-orange-600 mt-1">Per placement</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filters</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
              <Button variant="default" size="sm" onClick={handleRefresh} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Time Period Filter */}
            <div className="space-y-2">
              <Label htmlFor="date-filter">Time Period</Label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger id="date-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="24hours">Last 24 Hours</SelectItem>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="6months">Last 6 Months</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Carrier Filter */}
            <div className="space-y-2">
              <Label htmlFor="carrier-filter">Carrier</Label>
              <Select value={carrierFilter} onValueChange={setCarrierFilter}>
                <SelectTrigger id="carrier-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Carriers</SelectItem>
                  {uniqueCarriers.map(carrier => (
                    <SelectItem key={carrier} value={carrier}>{carrier}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Issue Status</Label>
              <div className="flex flex-wrap gap-2">
                {uniqueStatuses.map(status => (
                  <Badge
                    key={status}
                    variant={statusFilter.includes(status) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      setStatusFilter(prev =>
                        prev.includes(status)
                          ? prev.filter(s => s !== status)
                          : [...prev, status]
                      );
                    }}
                  >
                    {status}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Custom Date Range */}
          {dateFilter === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Performance Cards */}
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
          {/* Agent Status Filter */}
          {uniqueStatuses.length > 0 && (
            <div className="mb-6">
              <MultiSelect
                options={uniqueStatuses}
                selected={agentStatusFilter}
                onChange={setAgentStatusFilter}
                placeholder="Filter by status (multi-select)"
                className="max-w-2xl"
              />
              {agentStatusFilter.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Showing placements with status: {agentStatusFilter.join(', ')}
                </p>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading agent performance data...</p>
            </div>
          ) : (
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

                    {/* Status Breakdown and Policy Type Breakdown */}
                    <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-6">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentsPage;
