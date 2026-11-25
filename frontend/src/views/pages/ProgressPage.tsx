import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtMinutes, fmtPace, fmtShort } from '../../models/dates'
import { useProgressViewModel } from '../../viewmodels/useProgressViewModel'
import { MODULE_ICON } from '../layout/AppLayout'
import { axisProps, ChartTooltip, gridProps, Legend } from '../components/charts'
import { Card, Empty, ErrorBox, ModulePage, Seg, Skeleton, Stat } from '../components/ui'

const ACCENT = '#22d3ee'
const margin = { top: 8, right: 8, left: -12, bottom: 0 }

export function ProgressPage() {
  const vm = useProgressViewModel()
  const s = vm.summary
  return (
    <ModulePage module="progress" icon={MODULE_ICON.progress(16)}
      subtitle="Ta progression semaine après semaine : volume, charge, régularité, endurance et tests."
      actions={<Seg value={vm.weeks} onChange={vm.setWeeks} options={[{ value: 8, label: '8 sem.' }, { value: 12, label: '12 sem.' }, { value: 24, label: '24 sem.' }]} />}>
      <ErrorBox error={vm.error} />
      <div className="grid g-4">
        <Card accent><Stat label="Volume total" value={fmtMinutes(s.totalMinutes)} delta={s.minutesDelta} /></Card>
        <Card><Stat label="Séances" value={s.sessions} hint={`${(s.sessions / vm.weeks).toFixed(1)} par semaine`} /></Card>
        <Card><Stat label="Distance" value={s.totalKm.toFixed(1)} unit="km" delta={s.kmDelta} /></Card>
        <Card><Stat label="Respect du programme" value={s.adherence ?? '—'} unit={s.adherence !== null ? '%' : ''} hint="Séances prévues réalisées" /></Card>
      </div>

      {vm.loading && !vm.rows.length ? <div className="mt"><Skeleton h={300} /></div> : (
        <>
          <Card title="Volume par type de séance" sub="Minutes par semaine" className="mt">
            <div className="chart-box" style={{ height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={vm.rows} margin={margin}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} />
                  <Tooltip content={<ChartTooltip hideZero format={(v) => fmtMinutes(v)} />} cursor={{ fill: '#ffffff08' }} />
                  {vm.usedCategories.map((c, i) => (
                    <Bar key={c.key} dataKey={c.key} name={c.label} stackId="v" fill={c.color} stroke="#141a24" strokeWidth={1}
                      radius={i === vm.usedCategories.length - 1 ? [4, 4, 0, 0] : 0} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Legend items={vm.usedCategories.map((c) => ({ label: c.label, color: c.color }))} />
          </Card>

          <div className="grid g-2 mt">
            <Card title="Charge hebdomadaire" sub="Somme durée × RPE · éviter les hausses > 10-15 %/semaine">
              <div className="chart-box"><ResponsiveContainer><LineChart data={vm.rows} margin={margin}>
                <CartesianGrid {...gridProps} /><XAxis dataKey="label" {...axisProps} /><YAxis {...axisProps} />
                <Tooltip content={<ChartTooltip format={(v) => String(Math.round(v))} />} />
                <Line dataKey="load" name="Charge" stroke={ACCENT} strokeWidth={2} dot={{ r: 4, fill: ACCENT, stroke: '#141a24', strokeWidth: 2 }} />
              </LineChart></ResponsiveContainer></div>
            </Card>
            <Card title="Respect du programme" sub="% de séances prévues réalisées">
              <div className="chart-box"><ResponsiveContainer><BarChart data={vm.rows} margin={margin}>
                <CartesianGrid {...gridProps} /><XAxis dataKey="label" {...axisProps} /><YAxis {...axisProps} domain={[0, 100]} />
                <ReferenceLine y={80} stroke="#0aac23" strokeDasharray="4 4" />
                <Tooltip content={<ChartTooltip format={(v) => `${v} %`} extra={(p) => <div className="tt-row"><span>Faites / prévues</span><b>{String(p.done)}/{String(p.planned)}</b></div>} />} cursor={{ fill: '#ffffff08' }} />
                <Bar dataKey="adherence" name="Réalisé" fill="#60a5fa" radius={[4, 4, 0, 0]} />
              </BarChart></ResponsiveContainer></div>
            </Card>
            <Card title="Distance hebdomadaire" sub="km (footing, courses importées…)">
              <div className="chart-box"><ResponsiveContainer><BarChart data={vm.rows} margin={margin}>
                <CartesianGrid {...gridProps} /><XAxis dataKey="label" {...axisProps} /><YAxis {...axisProps} />
                <Tooltip content={<ChartTooltip format={(v) => `${v} km`} />} cursor={{ fill: '#ffffff08' }} />
                <Bar dataKey="km" name="Distance" fill="#338ced" radius={[4, 4, 0, 0]} />
              </BarChart></ResponsiveContainer></div>
            </Card>
            <Card title="Allure moyenne en footing" sub="min/km · plus bas = plus rapide">
              {vm.rows.some((r) => r.pace) ? (
                <div className="chart-box"><ResponsiveContainer><LineChart data={vm.rows} margin={margin}>
                  <CartesianGrid {...gridProps} /><XAxis dataKey="label" {...axisProps} /><YAxis {...axisProps} reversed domain={['auto', 'auto']} tickFormatter={(v: number) => fmtPace(v).replace('/km', '')} />
                  <Tooltip content={<ChartTooltip format={(v) => fmtPace(v)} />} />
                  <Line dataKey="pace" name="Allure" stroke="#338ced" strokeWidth={2} connectNulls dot={{ r: 4, fill: '#338ced', stroke: '#141a24', strokeWidth: 2 }} />
                </LineChart></ResponsiveContainer></div>
              ) : <Empty icon="🏃" title="Pas encore de footing avec distance" />}
            </Card>
            <Card title="Sommeil moyen" sub="heures par nuit, moyenne de la semaine">
              <div className="chart-box"><ResponsiveContainer><LineChart data={vm.rows} margin={margin}>
                <CartesianGrid {...gridProps} /><XAxis dataKey="label" {...axisProps} /><YAxis {...axisProps} domain={[5, 9]} />
                <ReferenceLine y={8} stroke="#a78bfa" strokeDasharray="4 4" />
                <Tooltip content={<ChartTooltip format={(v) => fmtMinutes(v * 60)} />} />
                <Line dataKey="sleep" name="Sommeil" stroke="#a78bfa" strokeWidth={2} connectNulls dot={{ r: 4, fill: '#a78bfa', stroke: '#141a24', strokeWidth: 2 }} />
              </LineChart></ResponsiveContainer></div>
            </Card>
            {vm.measuredGoals.map((g) => (
              <Card key={g.id} title={`Test : ${g.title}`} sub={`${g.unit}${g.direction === 'decrease' ? ' · plus bas = mieux' : ''} · ligne = objectif`}>
                <div className="chart-box"><ResponsiveContainer><LineChart data={g.measurements.map((m) => ({ label: fmtShort(m.date), value: m.value }))} margin={margin}>
                  <CartesianGrid {...gridProps} /><XAxis dataKey="label" {...axisProps} /><YAxis {...axisProps} domain={['auto', 'auto']} reversed={g.direction === 'decrease'} />
                  <ReferenceLine y={g.target_value} ifOverflow="extendDomain" stroke="#fbbf24" strokeDasharray="4 4" />
                  <Tooltip content={<ChartTooltip format={(v) => `${v} ${g.unit}`} />} />
                  <Line dataKey="value" name={g.title} stroke="#fbbf24" strokeWidth={2} dot={{ r: 4, fill: '#fbbf24', stroke: '#141a24', strokeWidth: 2 }} />
                </LineChart></ResponsiveContainer></div>
              </Card>
            ))}
          </div>
        </>
      )}
    </ModulePage>
  )
}
