import { Check } from 'lucide-react'
import { Bar, CartesianGrid, ComposedChart, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtDate, fmtMinutes, fmtShort } from '../../models/dates'
import { useRecoveryViewModel } from '../../viewmodels/useRecoveryViewModel'
import { MODULE_ICON } from '../layout/AppLayout'
import { axisProps, ChartTooltip, gridProps, Legend } from '../components/charts'
import { ReadinessRing } from '../components/ReadinessRing'
import { Card, cssVars, Empty, ErrorBox, ModulePage, Skeleton } from '../components/ui'

const C_ACUTE = '#338ced'
const C_CHRONIC = '#e76624'
const C_DAILY = '#33415a'

export function RecoveryPage() {
  const vm = useRecoveryViewModel()
  const data = vm.load.map((p) => ({ ...p, label: fmtShort(p.date) }))

  return (
    <ModulePage module="recovery" icon={MODULE_ICON.recovery(16)}
      subtitle="Forme du jour, équilibre de charge et routine de récupération. L'objectif : progresser sans se blesser.">
      <ErrorBox error={vm.error} />
      <div className="grid g-2">
        <Card title="Forme du jour" accent>
          {vm.readiness ? <ReadinessRing r={vm.readiness} /> : <Skeleton h={160} />}
        </Card>
        <Card title="Conseils du moment">
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }} className="muted">{vm.tips.map((t) => <li key={t}>{t}</li>)}</ul>
          <div className="note mt">
            <b>Ratio de charge (7 j / 28 j)</b> : compare ta charge de la semaine à ta moyenne du mois. Zone repère 0,8 – 1,3.
            C'est un indicateur discuté en science du sport : utile pour repérer les hausses brutales, pas pour prédire une blessure.
          </div>
        </Card>
      </div>

      <div className="grid g-2 mt">
        <Card title="Charge d'entraînement" sub="Charge = durée × RPE · 6 dernières semaines">
          {vm.loading ? <Skeleton h={260} /> : (
            <>
              <div className="chart-box">
                <ResponsiveContainer>
                  <ComposedChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" {...axisProps} interval={6} />
                    <YAxis {...axisProps} />
                    <Tooltip content={<ChartTooltip format={(v) => String(Math.round(v))} />} cursor={{ fill: '#ffffff08' }} />
                    <Bar dataKey="load" name="Charge du jour" fill={C_DAILY} radius={[4, 4, 0, 0]} />
                    <Line dataKey="acute" name="Aiguë (7 j)" stroke={C_ACUTE} strokeWidth={2} dot={false} />
                    <Line dataKey="chronic" name="Chronique (moy. hebdo 28 j)" stroke={C_CHRONIC} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <Legend items={[{ label: 'Charge du jour', color: C_DAILY }, { label: 'Aiguë (7 j)', color: C_ACUTE }, { label: 'Chronique (moy. hebdo 28 j)', color: C_CHRONIC }]} />
            </>
          )}
        </Card>
        <Card title="Ratio aiguë / chronique" sub="Bande verte = zone repère 0,8 – 1,3">
          {vm.loading ? <Skeleton h={260} /> : (
            <div className="chart-box">
              <ResponsiveContainer>
                <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} interval={6} />
                  <YAxis {...axisProps} domain={[0, 2]} />
                  <ReferenceArea y1={0.8} y2={1.3} fill="#0aac23" fillOpacity={0.1} />
                  <ReferenceArea y1={1.5} y2={2} fill="#dc3c3d" fillOpacity={0.08} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line dataKey="acwr" name="Ratio" stroke="#34d399" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid g-2 mt">
        <Card title="Ma routine de récup" sub="Coche ce que tu as fait puis enregistre"
          action={<button className="btn primary sm" disabled={!vm.checked.length || vm.busy} onClick={vm.logRecovery}><Check size={14} /> Enregistrer ({fmtMinutes(vm.checkedMinutes)})</button>}>
          <div className="stack">
            {vm.library.map((e) => {
              const on = vm.checked.includes(e.id)
              return (
                <button key={e.id} className="list-item" style={{ ...cssVars({ '--c': '#34d399' }), cursor: 'pointer', textAlign: 'left', borderColor: on ? '#34d399' : undefined }} onClick={() => vm.toggle(e.id)} aria-pressed={on}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, border: '2px solid #34d399', display: 'grid', placeItems: 'center', background: on ? '#34d399' : 'transparent', color: '#0b0f17', flexShrink: 0 }}>{on && <Check size={14} />}</span>
                  <div style={{ flex: 1 }}><b>{e.name}</b>{e.description && <div className="faint">{e.description}</div>}</div>
                  {e.default_duration_s && <span className="tag">{Math.round((e.default_duration_s * (e.default_sets ?? 1)) / 60)} min</span>}
                </button>
              )
            })}
          </div>
        </Card>
        <Card title="Dernières récupérations">
          {vm.recent.length === 0 ? <Empty icon="🧘" title="Aucune séance de récup enregistrée" /> : (
            <div className="stack">
              {vm.recent.map((w) => (
                <div key={w.id} className="list-item" style={cssVars({ '--c': '#eb6263' })}>
                  <span className="cat-bar" />
                  <div style={{ flex: 1 }}><b>{w.title}</b><div className="faint">{fmtDate(w.date)} · {fmtMinutes(w.duration_min)}{w.notes && ` · ${w.notes}`}</div></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </ModulePage>
  )
}
