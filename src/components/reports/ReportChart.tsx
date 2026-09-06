import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { ChartType } from "@/lib/reportUtils";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--secondary))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--destructive))",
  "hsl(var(--ring))",
];

interface ReportChartProps {
  type: ChartType;
  data: Record<string, unknown>[];
  xKey?: string;
  yKey?: string;
}

export const ReportChart = ({ type, data, xKey, yKey }: ReportChartProps) => {
  if (type === "none" || !data.length || !xKey || !yKey) return null;

  const numeric = data
    .map((d) => ({ ...d, [yKey]: Number(d[yKey]) }))
    .filter((d) => !Number.isNaN(d[yKey] as number));

  return (
    <div className="w-full h-72">
      <ResponsiveContainer>
        {type === "bar" ? (
          <BarChart data={numeric}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey={xKey} stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
            <Bar dataKey={yKey} fill={COLORS[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : type === "line" ? (
          <LineChart data={numeric}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey={xKey} stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
            <Line type="monotone" dataKey={yKey} stroke={COLORS[0]} strokeWidth={2} dot />
          </LineChart>
        ) : (
          <PieChart>
            <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
            <Legend />
            <Pie
              data={numeric}
              dataKey={yKey}
              nameKey={xKey}
              outerRadius={100}
              label
            >
              {numeric.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

export default ReportChart;
