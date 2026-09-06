import AppLayout from "@/components/layout/AppLayout";
import StatsCards from "@/components/dashboard/StatsCards";
import DashboardCharts from "@/components/dashboard/DashboardCharts";
import RecentJobs from "@/components/dashboard/RecentJobs";
import ActiveEngineers from "@/components/dashboard/ActiveEngineers";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import RegionFilter from "@/components/filters/RegionFilter";
import { useRegionFilter } from "@/hooks/useRegionFilter";
import { LayoutDashboard } from "lucide-react";
// import AskAIButton from "@/components/ai/AskAIButton";

const Dashboard = () => {
  const { regions, selectedRegion, setSelectedRegion } = useRegionFilter();

  return (
    <AppLayout title="Dashboard" subtitle="Overview of your service operations">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <LayoutDashboard className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold font-display text-card-foreground">Operations Overview</h2>
              <p className="text-[10px] text-muted-foreground">Real-time metrics & insights</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* <AskAIButton prompt="Give me a full platform overview with key metrics, any concerns, and top 3 recommendations." label="AI Insights" /> */}
            <RegionFilter regions={regions} value={selectedRegion} onChange={setSelectedRegion} />
          </div>
        </div>

        <StatsCards regionId={selectedRegion} />

        <DashboardCharts regionId={selectedRegion} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <RecentJobs regionId={selectedRegion} />
          </div>
          <div className="space-y-4">
            <ActivityFeed />
            <ActiveEngineers regionId={selectedRegion} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;