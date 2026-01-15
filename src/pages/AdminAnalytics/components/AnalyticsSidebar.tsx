import { Button } from '@/components/ui/button';
import { Users, Building2, Calendar, Award } from 'lucide-react';

interface AnalyticsSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const AnalyticsSidebar = ({ activeTab, onTabChange }: AnalyticsSidebarProps) => {
  return (
    <div className="w-64 min-h-screen bg-card border-r p-4 space-y-2">
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-1">Analytics Dashboard</h2>
        <p className="text-sm text-muted-foreground">Team Performance Overview</p>
      </div>

      <Button
        variant={activeTab === 'agents' ? 'default' : 'ghost'}
        className="w-full justify-start"
        onClick={() => onTabChange('agents')}
      >
        <Users className="h-4 w-4 mr-2" />
        Closers Performance
      </Button>

      <Button
        variant={activeTab === 'vendors' ? 'default' : 'ghost'}
        className="w-full justify-start"
        onClick={() => onTabChange('vendors')}
      >
        <Building2 className="h-4 w-4 mr-2" />
        Lead Vendors Performance
      </Button>

      <Button
        variant={activeTab === 'daily' ? 'default' : 'ghost'}
        className="w-full justify-start"
        onClick={() => onTabChange('daily')}
      >
        <Calendar className="h-4 w-4 mr-2" />
        Daily Sales Stats
      </Button>

      <Button
        variant={activeTab === 'carriers' ? 'default' : 'ghost'}
        className="w-full justify-start"
        onClick={() => onTabChange('carriers')}
      >
        <Award className="h-4 w-4 mr-2" />
        Carrier Stats
      </Button>
    </div>
  );
};
