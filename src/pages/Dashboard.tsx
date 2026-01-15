import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Dashboard = () => {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              This is a prototype dashboard. Stats will be connected here later.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Retainers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">0</div>
            <div className="text-xs text-muted-foreground">Coming soon</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Transfers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">0</div>
            <div className="text-xs text-muted-foreground">Coming soon</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Conversions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">0</div>
            <div className="text-xs text-muted-foreground">Coming soon</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">0</div>
            <div className="text-xs text-muted-foreground">Coming soon</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            We will add filters and timeframe controls, plus manager-friendly breakdowns per agent/closer.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
