import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type DashboardStats = {
  retainers: number;
  transfers: number;
  conversions: number;
  agents: number;
};

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    retainers: 0,
    transfers: 0,
    conversions: 0,
    agents: 0,
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const pendingApprovalStatus = 'Pending Approval';

      const [leadsRes, dailyTotalRes, dailyPendingRes, agentsRes] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true }),
        supabase.from('daily_deal_flow').select('*', { count: 'exact', head: true }),
        supabase
          .from('daily_deal_flow')
          .select('*', { count: 'exact', head: true })
          .eq('status', pendingApprovalStatus),
        supabase.from('agents').select('*', { count: 'exact', head: true }),
      ]);

      if (cancelled) return;

      const retainers = dailyPendingRes.count ?? 0;
      const dailyTotal = dailyTotalRes.count ?? 0;
      const conversions = dailyPendingRes.count ?? 0;
      const transfers = dailyTotal;
      const agents = agentsRes.count ?? 0;

      setStats({ retainers, transfers, conversions, agents });
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Retainers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.retainers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Transfers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.transfers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Conversions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.conversions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Closers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.agents}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
