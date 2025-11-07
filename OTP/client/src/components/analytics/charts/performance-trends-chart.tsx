import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface PerformanceTrendsChartProps {
  data: Array<{ timestamp: Date; cpu: number; memory: number; responseTime: number; activeConnections: number }>;
}

export function PerformanceTrendsChart({ data }: PerformanceTrendsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={data}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="timestamp" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="cpu" stroke="#FF533E" strokeWidth={2} />
        <Line type="monotone" dataKey="memory" stroke="#10B981" strokeWidth={2} />
        <Line type="monotone" dataKey="responseTime" stroke="#3B82F6" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}