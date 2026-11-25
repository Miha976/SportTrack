import { CheckCircle2, Lightbulb, Pencil, Plus, Siren, Trash2 } from 'lucide-react'
import type { SleepInsight } from '../../models/sleepInsights'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtDate, fmtMinutes } from '../../models/dates'
import { SLEEP_TARGET_H, useSleepViewModel } from '../../viewmodels/useSleepViewModel'
import { MODULE_ICON } from '../layout/AppLayout'
import { confirmThen } from '../components/confirm'
import { axisProps, ChartTooltip, gridProps, Legend } from '../components/charts'
import { Card, cssVars, Empty, ErrorBox, Field, Modal, ModulePage, NumInput, Skeleton, Stars, Stat } from '../components/ui'

const ACCENT = '#a78bfa'
const STAGES = [
  { key: 'deep', label: 'Profond', color: '#338ced' },
  { key: 'rem', label: 'Paradoxal (REM)', color: '#e76624' },
  { key: 'light', label: 'Léger', color: '#00a888' },
  { key: 'awake', label: 'Éveil', color: '#d28e05' },
]

export function SleepPage() {
  const vm = useSleepViewModel()
  const s = vm.stats
  const f1 = (v: number | null) => (v === null ? '—' : v.toFixed(1))

  return (
    <ModulePage module="sleep" icon={MODULE_ICON.sleep(16)}
      subtitle="Le sommeil est ton premier outil de récupération. Saisie manuelle ou import depuis ta montre."
      actions={<button className="btn primary" onClick={vm.openCreate}><Plus size={16} /> Saisir ma nuit</button>}>
      <ErrorBox error={vm.error} />
      <div className="grid g-4">
        <Card accent><Stat label="Moyenne 7 nuits" value={f1(s.avg7)} unit="h" hint={`Moyenne 28 nuits : ${f1(s.avg28)} h`} /></Card>
        <Card><Stat label="Dette (7 nuits, cible 8 h)" value={s.avg7 === null ? '—' : s.debt7 > 0 ? f1(s.debt7) : '0'} unit="h" hint={s.avg7 === null ? 'Saisis tes nuits' : s.debt7 > 3 ? 'Vise un coucher plus tôt cette semaine' : 'Bien géré'} /></Card>
        <Card><Stat label="Régularité du coucher" value={s.bedtimeSd === null ? '—' : `± ${Math.round(s.bedtimeSd)}`} unit="min" hint="Écart-type sur 28 nuits · < 30 min = régulier" /></Card>
        <Card><Stat label="Qualité ressentie" value={f1(s.quality7)} unit="/ 5" hint={s.hrv7 ? `VFC ${Math.round(s.hrv7)} ms · FC repos ${Math.round(s.rhr7 ?? 0)}` : 'VFC et FC repos : avec une montre'} /></Card>
      </div>

      {!vm.loading && <Insights items={vm.insights} nights={Math.min(vm.nights.length, 14)} />}

      {vm.loading && !vm.nights.length ? <div className="mt"><Skeleton h={260} /></div> : vm.nights.length === 0 ? (
        <Card className="mt"><Empty icon="😴" title="Aucune nuit enregistrée"><button className="btn primary" onClick={vm.openCreate}>Saisir ma première nuit</button></Empty></Card>
      ) : (
        <>
          <div className="grid g-2 mt">
            <Card title="Durée de sommeil" sub={`28 dernières nuits · ligne = cible ${SLEEP_TARGET_H} h`}>
              <div className="chart-box">
                <ResponsiveContainer>
                  <BarChart data={vm.chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" {...axisProps} interval={6} />
                    <YAxis {...axisProps} domain={[0, 10]} />
                    <ReferenceLine y={SLEEP_TARGET_H} stroke={ACCENT} strokeDasharray="4 4" />
                    <Tooltip content={<ChartTooltip format={(v) => fmtMinutes(v * 60)} extra={(p) => p.quality ? <div className="tt-row"><span>Qualité</span><b>{String(p.quality)}/5</b></div> : null} />} cursor={{ fill: '#ffffff08' }} />
                    <Bar dataKey="hours" name="Sommeil" fill={ACCENT} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            {vm.hasStages ? (
              <Card title="Phases de sommeil" sub="Minutes par phase (données montre)">
                <div className="chart-box">
                  <ResponsiveContainer>
                    <BarChart data={vm.chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="label" {...axisProps} interval={6} />
                      <YAxis {...axisProps} />
                      <Tooltip content={<ChartTooltip format={(v) => `${v} min`} />} cursor={{ fill: '#ffffff08' }} />
                      {STAGES.map((st, i) => <Bar key={st.key} dataKey={st.key} name={st.label} stackId="s" fill={st.color} stroke="#141a24" strokeWidth={1} radius={i === STAGES.length - 1 ? [4, 4, 0, 0] : 0} />)}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Legend items={STAGES.map((s) => ({ label: s.label, color: s.color }))} />
              </Card>
            ) : (
              <Card title="Phases de sommeil"><Empty icon="⌚" title="Disponible avec une montre">Profond, paradoxal, léger et éveil s'afficheront après un import ou une saisie détaillée.</Empty></Card>
            )}
          </div>

          {vm.hasHrv && (
            <div className="grid g-2 mt">
              <Card title="Variabilité cardiaque (VFC)" sub="ms · plus haut = généralement mieux récupéré">
                <div className="chart-box sm"><ResponsiveContainer><LineChart data={vm.chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid {...gridProps} /><XAxis dataKey="label" {...axisProps} interval={6} /><YAxis {...axisProps} domain={['auto', 'auto']} />
                  <Tooltip content={<ChartTooltip format={(v) => `${v} ms`} />} />
                  <Line dataKey="hrv" name="VFC" stroke="#338ced" strokeWidth={2} dot={false} connectNulls />
                </LineChart></ResponsiveContainer></div>
              </Card>
              <Card title="FC de repos" sub="bpm · une hausse durable peut signaler fatigue ou maladie">
                <div className="chart-box sm"><ResponsiveContainer><LineChart data={vm.chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid {...gridProps} /><XAxis dataKey="label" {...axisProps} interval={6} /><YAxis {...axisProps} domain={['auto', 'auto']} />
                  <Tooltip content={<ChartTooltip format={(v) => `${v} bpm`} />} />
                  <Line dataKey="rhr" name="FC repos" stroke="#e76624" strokeWidth={2} dot={false} connectNulls />
                </LineChart></ResponsiveContainer></div>
              </Card>
            </div>
          )}

          <Card title="Historique" className="mt">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Nuit du</th><th>Coucher</th><th>Réveil</th><th>Durée</th><th>Qualité</th><th>Réveils</th><th>VFC</th><th>FC repos</th><th>Source</th><th /></tr></thead>
                <tbody>
                  {vm.nights.slice(0, 21).map((n) => (
                    <tr key={n.id}>
                      <td style={{ textTransform: 'capitalize' }}>{fmtDate(n.date)}</td><td>{n.bedtime ?? '—'}</td><td>{n.wake_time ?? '—'}</td>
                      <td><b style={{ color: n.duration_min >= SLEEP_TARGET_H * 60 ? '#4ade80' : n.duration_min < 360 ? '#f87171' : undefined }}>{fmtMinutes(n.duration_min)}</b></td>
                      <td>{n.quality ? '★'.repeat(n.quality) : '—'}</td><td>{n.awakenings ?? '—'}</td><td>{n.hrv_ms ?? '—'}</td><td>{n.resting_hr ?? '—'}</td><td><span className="tag">{n.source}</span></td>
                      <td className="row" style={{ gap: 2 }}>
                        <button className="btn ghost icon-btn" onClick={() => vm.openEdit(n)} aria-label="Modifier"><Pencil size={14} /></button>
                        <button className="btn ghost icon-btn" onClick={() => confirmThen('Supprimer cette nuit ?', () => vm.remove(n))} aria-label="Supprimer"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      {vm.editing && <SleepEditor vm={vm} />}
    </ModulePage>
  )
}

const LEVEL: Record<SleepInsight['level'], { label: string; color: string; icon: React.ReactNode }> = {
  alert: { label: 'Priorité', color: '#dc3c3d', icon: <Siren size={16} /> },
  tip: { label: 'Conseil', color: '#fbb315', icon: <Lightbulb size={16} /> },
  good: { label: 'Ça va', color: '#0aac23', icon: <CheckCircle2 size={16} /> },
}

function Insights({ items, nights }: { items: SleepInsight[]; nights: number }) {
  return (
    <Card title="Mes conseils sommeil" sub={nights ? `D'après tes ${nights} dernières nuits et tes séances` : undefined} className="mt">
      <div className="stack">
        {items.map((i) => {
          const l = LEVEL[i.level]
          return (
            <div key={i.id} className="insight" style={cssVars({ '--c': l.color })}>
              <div className="row" style={{ gap: 8 }}>
                <span className="insight-icon">{l.icon}</span>
                <b style={{ flex: 1 }}>{i.title}</b>
                <span className="tag">{l.label}</span>
              </div>
              <div className="faint" style={{ margin: '6px 0' }}>{i.evidence}</div>
              <ul>{i.actions.map((a) => <li key={a}>{a}</li>)}</ul>
            </div>
          )
        })}
      </div>
      <div className="faint mt">Repères généraux d'hygiène du sommeil, pas un avis médical. Insomnie qui dure, ronflements avec pauses respiratoires ou somnolence en journée : consulte un médecin.</div>
    </Card>
  )
}

function SleepEditor({ vm }: { vm: ReturnType<typeof useSleepViewModel> }) {
  const f = vm.editing!
  return (
    <Modal title="Ma nuit" onClose={vm.close} accent={ACCENT}
      footer={<><button className="btn ghost" onClick={vm.close}>Annuler</button><button className="btn primary" disabled={vm.busy} onClick={vm.save}>Enregistrer</button></>}>
      <div className="form">
        <div className="three">
          <Field label="Date du réveil"><input className="input" type="date" value={f.date} onChange={(e) => vm.update({ date: e.target.value })} /></Field>
          <Field label="Coucher"><input className="input" type="time" value={f.bedtime ?? ''} onChange={(e) => vm.update({ bedtime: e.target.value })} /></Field>
          <Field label="Réveil"><input className="input" type="time" value={f.wake_time ?? ''} onChange={(e) => vm.update({ wake_time: e.target.value })} /></Field>
        </div>
        <div className="two">
          <Field label="Temps de sommeil (min)"><NumInput value={f.duration_min} onChange={(v) => vm.update({ duration_min: v ?? 0 })} /></Field>
          <Field label="Qualité ressentie"><Stars value={f.quality} onChange={(v) => vm.update({ quality: v })} /></Field>
        </div>
        <div className="two">
          <Field label="Réveils dans la nuit (nombre)"><NumInput value={f.awakenings} min={0} onChange={(v) => vm.update({ awakenings: v })} /></Field>
          <Field label="Temps éveillé (min, estimé)"><NumInput value={f.awake_min} onChange={(v) => vm.update({ awake_min: v })} /></Field>
        </div>
        <div className="faint">Calculé depuis coucher/réveil (moins les éveils). Ajustable.</div>
        <details>
          <summary className="muted" style={{ cursor: 'pointer' }}>Données détaillées (montre)</summary>
          <div className="form mt">
            <div className="two">
              <Field label="Profond (min)"><NumInput value={f.deep_min} onChange={(v) => vm.update({ deep_min: v })} /></Field>
              <Field label="Paradoxal / REM (min)"><NumInput value={f.rem_min} onChange={(v) => vm.update({ rem_min: v })} /></Field>
              <Field label="Léger (min)"><NumInput value={f.light_min} onChange={(v) => vm.update({ light_min: v })} /></Field>
              <Field label="FC de repos (bpm)"><NumInput value={f.resting_hr} onChange={(v) => vm.update({ resting_hr: v })} /></Field>
              <Field label="VFC (ms)"><NumInput value={f.hrv_ms} onChange={(v) => vm.update({ hrv_ms: v })} /></Field>
            </div>
          </div>
        </details>
      </div>
    </Modal>
  )
}
