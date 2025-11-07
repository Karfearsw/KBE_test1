import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  Activity, 
  Users, 
  TrendingUp,
  RefreshCw,
  Settings,
  Download
} from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import {
  RealTimeAnalyticsLazy,
  TeamActivityFeedLazy,
  PerformanceAnalyticsLazy
} from "@/components/analytics/lazy-analytics";
import { useChartPrefetch } from "@/hooks/use-chart-prefetch";

export function AnalyticsDashboard() {
  const { connected, error, isReconnecting } = useWebSocket();
  const [activeTab, setActiveTab] = useState("overview");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const handleRefresh = () => {
    setIsRefreshing(true);
    setLastUpdated(new Date());
    
    // Simulate refresh delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const handleExportData = () => {
    // Simulate data export
    const data = {
      timestamp: new Date().toISOString(),
      connectionStatus: connected ? 'connected' : 'disconnected',
      exportDate: new Date().toLocaleDateString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getConnectionStatus = () => {
    if (error) return { text: "Error", color: "text-red-600", bgColor: "bg-red-100" };
    if (isReconnecting) return { text: "Reconnecting", color: "text-yellow-600", bgColor: "bg-yellow-100" };
    if (connected) return { text: "Connected", color: "text-green-600", bgColor: "bg-green-100" };
    return { text: "Disconnected", color: "text-neutral-600", bgColor: "bg-neutral-100" };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Analytics Dashboard</h1>
          <p className="text-neutral-600 mt-1">Real-time insights and performance monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={connectionStatus.bgColor}>
            <div className={`w-2 h-2 rounded-full mr-2 ${connectionStatus.color.replace('text-', 'bg-')}`} />
            {connectionStatus.text}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={isRefreshing ? "animate-pulse" : ""}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Connection Error Alert */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <Activity className="h-4 w-4" />
              <span className="font-medium">Connection Error:</span>
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dashboard Status</CardTitle>
            <BarChart3 className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connected ? 'Live' : 'Offline'}</div>
            <p className="text-xs text-neutral-600">
              {connected ? 'Real-time updates active' : 'Connection lost'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
            <RefreshCw className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lastUpdated.toLocaleTimeString()}</div>
            <p className="text-xs text-neutral-600">
              {new Date().toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Quality</CardTitle>
            <TrendingUp className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98.5%</div>
            <p className="text-xs text-neutral-600">
              Accuracy rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Users className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connected ? '12' : '0'}</div>
            <p className="text-xs text-neutral-600">
              Current users
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity Feed
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div
              {...useChartPrefetch(() => {
                // Prefetch will happen automatically via viewport/hover
              })}
            >
              <RealTimeAnalyticsLazy />
            </div>
            <div
              {...useChartPrefetch(() => {
                // Prefetch will happen automatically via viewport/hover
              })}
            >
              <TeamActivityFeedLazy />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <div
            {...useChartPrefetch(() => {
              // Prefetch will happen automatically via viewport/hover
            })}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Team Activity Feed</CardTitle>
                <p className="text-neutral-600">Detailed activity monitoring and notifications</p>
              </CardHeader>
              <CardContent>
                <TeamActivityFeedLazy />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div
            {...useChartPrefetch(() => {
              // Prefetch will happen automatically via viewport/hover
            })}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Performance Analytics</CardTitle>
                <p className="text-neutral-600">System performance metrics and monitoring</p>
              </CardHeader>
              <CardContent>
                <PerformanceAnalyticsLazy />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Analytics Settings</CardTitle>
              <p className="text-neutral-600">Configure your analytics dashboard preferences</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Real-Time Updates</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-700">Enable live updates</span>
                      <Badge variant={connected ? "default" : "secondary"}>
                        {connected ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-700">Update frequency</span>
                      <span className="text-sm text-neutral-500">2-3 seconds</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-700">Connection timeout</span>
                      <span className="text-sm text-neutral-500">30 seconds</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Data Retention</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-700">Activity history</span>
                      <span className="text-sm text-neutral-500">30 days</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-700">Performance metrics</span>
                      <span className="text-sm text-neutral-500">7 days</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-700">Export format</span>
                      <span className="text-sm text-neutral-500">JSON/CSV</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Notifications</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-700">Connection alerts</span>
                      <Badge variant="default">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-700">Performance alerts</span>
                      <Badge variant="default">Enabled</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-700">Activity notifications</span>
                      <Badge variant="secondary">Disabled</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}