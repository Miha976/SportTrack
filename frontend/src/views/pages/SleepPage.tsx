import { CheckCircle2, Coffee, Lightbulb, Pencil, Plus, Siren, Trash2 } from 'lucide-react'
import type { SleepInsight } from '../../models/sleepInsights'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtDate, fmtMinutes } from '../../models/dates'
import { SLEEP_TARGET_H, useSleepViewModel } from '../../viewmodels/useSleepViewModel'
import { MODULE_ICON } from '../layout/AppLayout'
import { confirmThen } from '../components/confirm'
import { axisProps, ChartTooltip, gridProps, Legend } from '../components/charts'
import { Card, cssVars, Empty, ErrorBox, Field, Modal, ModulePage, NumInput, Seg, Skeleton, Stars, Stat } from '../components/ui'

const ACCENT = '#a78bfa'
const NAP_COLOR = '#d28e05'
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
      actions={<>
        <button className="btn" onClick={() => vm.openCreate('nap')}><Coffee size={16} /> Sieste</button>
        <button className="btn primary" onClick={() => vm.openCreate('night')}><Plus size={16} /> Saisir ma nuit</button>
      </>}>
      <ErrorBox error={vm.error} />
      <div className="grid g-4">
        <Card accent><Stat label="Moyenne 7 nuits" value={f1(s.avg7)} unit="h" hint={`Moyenne 28 nuits : ${f1(s.avg28)} h`} /></Card>
        <Card><Stat label="Dette (7 nuits, cible 8 h)" value={s.avg7 === null ? '—' : s.debt7 > 0 ? f1(s.debt7) : '0'} unit="h" hint={s.avg7 === null ? 'Saisis tes nuits' : s.debt7 > 3 ? 'Vise un coucher plus tôt cette semaine' : 'Bien géré'} /></Card>
        <Card><Stat label="Régularité du coucher" value={s.bedtimeSd === null ? '—' : `± ${Math.round(s.bedtimeSd)}`} unit="min" hint="Écart-type sur 28 nuits · < 30 min = régulier" /></Card>
        <Card><Stat label="Qualité ressentie" value={f1(s.quality7)} unit="/ 5" hint={s.napCount7 ? `+ ${s.napCount7} sieste(s), ${s.napMin7} min sur 7 nuits` : s.hrv7 ? `VFC ${Math.round(s.hrv7)} ms · FC repos ${Math.round(s.rhr7 ?? 0)}` : 'Siestes : bouton « Sieste »'} /></Card>
      </div>

      {!vm.loading && <Insights items={vm.insights} nights={Math.min(vm.nights.length, 14)} />}

      {vm.loading && !vm.entries.length ? <div className="mt"><Skeleton h={260} /></div> : vm.entries.length === 0 ? (
        <Card className="mt"><Empty icon="😴" title="Aucune nuit enregistrée"><button className="btn primary" onClick={() => vm.openCreate('night')}>Saisir ma première nuit</button></Empty></Card>
      ) : (
        <>
          <div className="grid g-2 mt">
            <Card title="Durée de sommeil" sub={`28 dernières nuits · ligne = cible ${SLEEP_TARGET_H} h`}>
              <div className="chart-box">
                <ResponsiveContainer>
                  <BarChart data={vm.chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" {...axisProps} interval={6} />
                    <YAxis {...axisProps} domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
                    <ReferenceLine y={SLEEP_TARGET_H} stroke="#e8edf5" strokeOpacity={0.5} strokeDasharray="4 4" />
                    <Tooltip content={<ChartTooltip format={(v) => fmtMinutes(v * 60)} extra={(p) => p.quality ? <div className="tt-row"><span>Qualité</span><b>{String(p.quality)}/5</b></div> : null} />} cursor={{ fill: '#ffffff08' }} />
                    <Bar dataKey="hours" name="Nuit" stackId="d" fill={ACCENT} stroke="#141a24" strokeWidth={1} radius={vm.hasNaps ? 0 : [4, 4, 0, 0]} />
                    {vm.hasNaps && <Bar dataKey="nap" name="Sieste" stackId="d" fill={NAP_COLOR} stroke="#141a24" strokeWidth={1} radius={[4, 4, 0, 0]} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {vm.hasNaps && <Legend items={[{ label: 'Nuit', color: ACCENT }, { label: 'Sieste', color: NAP_COLOR }]} />}
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
                <thead><tr><th>Date</th><th>Type</th><th>Coucher</th><th>Réveil</th><th>Durée</th><th>Qualité</th><th>Réveils</th><th>VFC</th><th>FC repos</th><th>Source</th><th /></tr></thead>
                <tbody>
                  {vm.entries.slice(0, 28).map((n) => (
                    <tr key={n.id}>
                      <td style={{ textTransform: 'capitalize' }}>{fmtDate(n.date)}</td><td>{n.kind === 'nap' ? <span className="tag">☕ Sieste</span> : <span className="tag">🌙 Nuit</span>}</td><td>{n.bedtime ?? '—'}</td><td>{n.wake_time ?? '—'}</td>
                      <td><b style={{ color: n.kind === 'nap' ? undefined : n.duration_min >= SLEEP_TARGET_H * 60 ? '#4ade80' : n.duration_min < 360 ? '#f87171' : undefined }}>{fmtMinutes(n.duration_min)}</b></td>
                      <td>{n.quality ? '★'.repeat(n.quality) : '—'}</td><td>{n.awakenings ?? '—'}</td><td>{n.hrv_ms ?? '—'}</td><td>{n.resting_hr ?? '—'}</td><td><span className="tag">{n.source}</span></td>
                      <td className="row" style={{ gap: 2 }}>
                        <button className="btn ghost icon-btn" onClick={() => vm.openEdit(n)} aria-label="Modifier"><Pencil size={14} /></button>
                        <button className="btn ghost icon-btn" onClick={() => confirmThen(n.kind === 'nap' ? 'Supprimer cette sieste ?' : 'Supprimer cette nuit ?', () => vm.remove(n))} aria-label="Supprimer"><Trash2 size={14} /></button>
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
  const e = vm.editing!
  const f = e.form
  const nap = f.kind === 'nap'
  return (
    <Modal title={e.id ? (nap ? 'Modifier la sieste' : 'Modifier la nuit') : nap ? 'Ma sieste' : 'Ma nuit'} onClose={vm.close} accent={ACCENT}
      footer={<><button className="btn ghost" onClick={vm.close}>Annuler</button><button className="btn primary" disabled={vm.busy} onClick={vm.save}>Enregistrer</button></>}>
      <div className="form">
        <ErrorBox error={vm.error} />
        <Seg value={f.kind} onChange={(v) => vm.update({ kind: v })} options={[{ value: 'night', label: '🌙 Nuit' }, { value: 'nap', label: '☕ Sieste' }]} />
        <div className="three">
          <Field label={nap ? 'Jour' : 'Date du réveil'}><input className="input" type="date" value={f.date} onChange={(ev) => vm.update({ date: ev.target.value })} /></Field>
          <Field label={nap ? 'Début' : 'Coucher'}><input className="input" type="time" value={f.bedtime ?? ''} onChange={(ev) => vm.update({ bedtime: ev.target.value })} /></Field>
          <Field label={nap ? 'Fin' : 'Réveil'}><input className="input" type="time" value={f.wake_time ?? ''} onChange={(ev) => vm.update({ wake_time: ev.target.value })} /></Field>
        </div>
        <div className="two">
          <Field label={nap ? 'Durée (min)' : 'Temps de sommeil (min)'}><NumInput value={f.duration_min} onChange={(v) => vm.update({ duration_min: v ?? 0 })} /></Field>
          <Field label={nap ? 'Ressenti au réveil (optionnel)' : 'Qualité ressentie'}><Stars value={f.quality} onChange={(v) => vm.update({ quality: v })} /></Field>
        </div>
        {nap ? (
          <div className="faint">Une sieste s'ajoute à la nuit du même jour sans la remplacer. Idéal : 20-30 min, avant 15-16 h.</div>
        ) : (
          <>
            <div className="two">
              <Field label="Réveils dans la nuit (nombre)"><NumInput value={f.awakenings} min={0} onChange={(v) => vm.update({ awakenings: v })} /></Field>
              <Field label="Temps éveillé (min, estimé)"><NumInput value={f.awake_min} onChange={(v) => vm.update({ awake_min: v })} /></Field>
            </div>
            <div className="faint">Durée calculée depuis coucher/réveil, moins le temps éveillé. Ajustable.</div>
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
          </>
        )}
      </div>
    </Modal>
  )
}
