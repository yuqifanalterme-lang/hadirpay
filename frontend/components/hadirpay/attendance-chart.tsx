'use client'

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { attendanceTrend } from '@/lib/mock-data'

export function AttendanceChart({
  height = 260,
  compact = false,
  className,
  data = attendanceTrend,
}: {
  height?: number | string
  compact?: boolean
  className?: string
  data?: { day: string; hadir: number; tepatWaktu: number }[]
}) {
  return (
    <div style={{ height }} className={`w-full ${className ?? ''}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: compact ? 8 : 20, left: compact ? -32 : -16, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`fill-hadir-${compact}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`fill-tepat-${compact}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#047857" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#047857" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: compact ? 7 : 12, fill: '#64748B' }}
            interval={0}
          />
          <YAxis
            domain={[30, 48]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: compact ? 7 : 12, fill: '#64748B' }}
            width={compact ? 40 : 50}
          />
          {!compact && (
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                fontSize: 13,
                boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
              }}
              formatter={(value, name) => [
                `${value} orang`,
                name === 'hadir' ? 'Hadir' : 'Tepat waktu',
              ]}
            />
          )}
          <Area
            type="monotone"
            dataKey="hadir"
            stroke="#2563EB"
            strokeWidth={compact ? 1.5 : 2.5}
            fill={`url(#fill-hadir-${compact})`}
            isAnimationActive={!compact}
          />
          <Area
            type="monotone"
            dataKey="tepatWaktu"
            stroke="#047857"
            strokeWidth={compact ? 1.5 : 2.5}
            fill={`url(#fill-tepat-${compact})`}
            isAnimationActive={!compact}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
