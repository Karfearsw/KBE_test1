import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWebSocket } from '@/hooks/use-websocket';
import { AlertTriangle, RefreshCw, Users, TrendingUp, Phone, BarChart3, Zap, Clock } from 'lucide-react';

interface MetricData {
  activeUsers: number;
  totalLeads: number;
  activeCalls: number;
  conversionRate: number;
  avgResponseTime: number;
  errorRate: number;
  messagesPerSecond: number;
  cpuUsage: number;
  memoryUsage: number;
}

interface PerformanceData {
  timestamp: Date;
  cpu: number;
  memory: number;
  responseTime: number;
  activeConnections: number;
}

export function RealTimeAnalytics() {
  const { connected, error, isReconnecting } = useWebSocket() ?? { connected: false, error: null, isReconnecting: false };
  const [metrics, setMetrics] = useState<MetricData>({
    activeUsers: 0,
    totalLeads: 0,
    activeCalls: 0,
    conversionRate: 0,
    avgResponseTime: 0,
    errorRate: 0,
    messagesPerSecond: 0,
    cpuUsage: 0,
    memoryUsage: 0,
  });
  
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Simulate real-time data updates
  useEffect(() => {
    if (!isAutoRefresh) return;

    const interval = setInterval(() => {
      setMetrics(prev => ({
        activeUsers: Math.max(0, prev.activeUsers + Math.floor(Math.random() * 6) - 2),
        totalLeads: Math.max(0, prev.totalLeads + Math.floor(Math.random() * 4) - 1),
        activeCalls: Math.max(0, prev.activeCalls + Math.floor(Math.random() * 4) - 1),
        conversionRate: Math.max(0, Math.min(100, prev.conversionRate + (Math.random() * 2 - 1))),
        avgResponseTime: Math.max(10, Math.min(500, prev.avgResponseTime + (Math.random() * 20 - 10))),
        errorRate: Math.max(0, Math.min(10, prev.errorRate + (Math.random() * 0.4 - 0.2))),
        messagesPerSecond: Math.max(0, prev.messagesPerSecond + (Math.random() * 10 - 5)),
        cpuUsage: Math.max(0, Math.min(100, prev.cpuUsage + (Math.random() * 10 - 5))),
        memoryUsage: Math.max(0, Math.min(100, prev.memoryUsage + (Math.random() * 5 - 2.5))),
      }));

      setPerformanceData(prev => {
        const newData = {
          timestamp: new Date(),
          cpu: Math.random() * 80,
          memory: Math.random() * 70,
          responseTime: Math.random() * 200 + 50,
          activeConnections: Math.floor(Math.random() * 50) + 10,
        };
        return [...prev.slice(-29), newData];
      });

      setLastUpdated(new Date());
    }, 2000);

    return () => clearInterval(interval);
  }, [isAutoRefresh]);

  const getStatusColor = (value: number, threshold: number, inverse = false) => {
    if (inverse) {
      return value < threshold ? "text-green-600" : "text-red-600";
    }
    return value > threshold ? "text-green-600" : "text-red-600";
  };

  const getConnectionStatus = () => {
    if (error) return { text: "Error", color: "text-red-600", bgColor: "bg-red-100" };
    if (isReconnecting) return { text: "Reconnecting", color: "text-yellow-600", bgColor: "bg-yellow-100" };
    if (connected) return { text: "Connected", color: "text-green-600", bgColor: "bg-green-100" };
    return { text: "Disconnected", color: "text-neutral-600", bgColor: "bg-neutral-100" };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Real-Time Analytics</h2>
          <p className="text-neutral-600">Live performance metrics and system monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={connectionStatus.bgColor}>
            <div className={`w-2 h-2 rounded-full mr-2 ${connectionStatus.color.replace('text-', 'bg-')}`} />
            {connectionStatus.text}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className={isAutoRefresh ? "bg-green-50 border-green-200" : ""}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isAutoRefresh ? "animate-spin" : ""}`} />
            Auto Refresh
          </Button>
        </div>
      </div>

      {/* Connection Status Alert */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Connection Error:</span>
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeUsers}</div>
            <p className="text-xs text-neutral-600">
              <span className={getStatusColor(metrics.activeUsers, 10)}>
                {metrics.activeUsers > 10 ? "↗" : "↘"} {Math.abs(metrics.activeUsers - 10)}
              </span>
              {" "}vs average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <TrendingUp className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalLeads}</div>
            <p className="text-xs text-neutral-600">
              <span className="text-green-600">+{Math.floor(Math.random() * 10)}</span>
              {" "}this hour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Calls</CardTitle>
            <Phone className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeCalls}</div>
            <p className="text-xs text-neutral-600">
              <span className={getStatusColor(metrics.activeCalls, 5)}>
                {metrics.activeCalls > 5 ? "High" : "Low"} activity
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-neutral-600">
              <span className={getStatusColor(metrics.conversionRate, 15)}>
                {metrics.conversionRate > 15 ? "↗" : "↘"} {Math.abs(metrics.conversionRate - 15).toFixed(1)}%
              </span>
              {" "}vs target
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Performance</CardTitle>
            <Zap className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Response Time</span>
                <span className={`text-sm font-medium ${getStatusColor(metrics.avgResponseTime, 100, true)}`}>
                  {metrics.avgResponseTime.toFixed(0)}ms
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Error Rate</span>
                <span className={`text-sm font-medium ${getStatusColor(metrics.errorRate, 5, true)}`}>
                  {metrics.errorRate.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Messages/Second</span>
                <span className="text-sm font-medium text-neutral-900">
                  {metrics.messagesPerSecond.toFixed(1)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection Health</CardTitle>
            <Clock className="h-4 w-4 text-neutral-500" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Last Updated</span>
                <span className="text-sm font-medium text-neutral-900">
                  {lastUpdated.toLocaleTimeString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Data Points</span>
                <span className="text-sm font-medium text-neutral-900">
                  {performanceData.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Auto Refresh</span>
                <Badge variant={isAutoRefresh ? "default" : "secondary"}>
                  {isAutoRefresh ? "ON" : "OFF"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-neutral-50 rounded-lg flex items-center justify-center border-2 border-dashed border-neutral-200">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-neutral-400 mx-auto mb-2" />
              <p className="text-neutral-600">Performance chart will be displayed here</p>
              <p className="text-sm text-neutral-500">Data points: {performanceData.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}