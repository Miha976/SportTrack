// Éléments partagés pour les graphiques Recharts (tooltip, légende, axes sobres).
import type { ReactNode } from 'react'

export const axisProps = { tickLine: false, axisLine: false, tick: { fill: '#6b778c', fontSize: 11.5 } } as const
export const gridProps = { stroke: '#253043', strokeDasharray: '0', vertical: false } as const

interface TTPayload { name?: string; value?: number | string | null; color?: string; dataKey?: string | number; payload?: Record<string, unknown> }

export function ChartTooltip(props: {
  active?: boolean; payload?: TTPayload[]; label?: string | number
  format?: (v: number, key: string) => string; hideZero?: boolean; extra?: (p: Record<string, unknown>) => ReactNode
}) {
  if (!props.active || !props.payload?.length) return null
  const rows = props.payload.filter((p) => p.value !== null && p.value !== undefined && !(props.hideZero && p.value === 0))
  return (
    <div className="tt">
      <div className="tt-title">{props.label}</div>
      {rows.map((p) => (
        <div className="tt-row" key={String(p.dataKey)}>
          <span><i style={{ background: p.color }} />{p.name}</span>
          <b>{props.format ? props.format(Number(p.value), String(p.dataKey)) : p.value}</b>
        </div>
      ))}
      {props.extra && props.payload[0]?.payload && props.extra(props.payload[0].payload)}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  if (items.length < 2) return null
  return (
    <div className="legend">
      {items.map((i) => <span key={i.label}><i style={{ background: i.color }} />{i.label}</span>)}
    </div>
  )
}
