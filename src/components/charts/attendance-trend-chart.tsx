import { useId } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface TrendPoint {
  label: string
  rate: number
  hadir: number
  topic?: string
}

interface AttendanceTrendChartProps {
  data: TrendPoint[]
  height?: number
}

export function AttendanceTrendChart({ data, height = 230 }: AttendanceTrendChartProps) {
  const gradientId = `attendance-${useId().replaceAll(':', '')}`

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.32} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="4 6" stroke="var(--border)" opacity={0.7} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          dy={6}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip
          cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
          contentStyle={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            fontSize: '12px',
            boxShadow: '0 12px 30px -12px rgba(15, 23, 42, 0.25)',
          }}
          labelStyle={{ color: 'var(--foreground)', fontWeight: 700, marginBottom: 2 }}
          formatter={(value) => [`${value}%`, 'Kehadiran']}
        />
        <Area
          type="monotone"
          dataKey="rate"
          stroke="var(--chart-1)"
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          activeDot={{ r: 5, strokeWidth: 3, stroke: 'var(--card)', fill: 'var(--chart-1)' }}
          dot={{ r: 3, strokeWidth: 2, stroke: 'var(--card)', fill: 'var(--chart-1)' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
