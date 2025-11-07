import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface LeadStatusChartProps {
  data: Array<{ name: string; value: number }>;
}

const COLORS = ['#FF533E', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EF4444'];

export function LeadStatusChart({ data }: LeadStatusChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [`${value} leads`, ""]} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}