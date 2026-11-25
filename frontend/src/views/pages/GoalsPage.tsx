import { Archive, CheckCircle2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CATEGORIES, METRIC_LABEL } from '../../models/catalog'
import { fmtDate, fmtShort, todayISO } from '../../models/dates'
import type { Category, Goal, Metric } from '../../models/types'
import { GOAL_PRESETS, useGoalsViewModel, type GoalTab } from '../../viewmodels/useGoalsViewModel'
import { MODULE_ICON } from '../layout/AppLayout'
import { confirmThen } from '../components/confirm'
import { axisProps, ChartTooltip, gridProps } from '../components/charts'
import { Card, CategoryBadge, Empty, ErrorBox, Field, Modal, ModulePage, NumInput, Progress, Seg, Skeleton } from '../components/ui'

const ACCENT = '#fbbf24'

export function GoalsPage() {
  const vm = useGoalsViewModel()
  const tabs: { value: GoalTab; label: string }[] = [
    { value: 'active', label: `En cours (${vm.counts.active})` },
    { value: 'done', label: `Atteints (${vm.counts.done})` },
    { value: 'archived', label: `Archivés (${vm.counts.archived})` },
  ]
  return (
    <ModulePage module="goals" icon={MODULE_ICON.goals(16)}
      subtitle="Fixe des objectifs mesurables : automatiques (calculés depuis tes séances et ton sommeil) ou manuels (tests : VMA, sprint, contrôles au mur…)."
      actions={<button className="btn primary" onClick={vm.openCreate}><Plus size={16} /> Nouvel objectif</button>}>
      <ErrorBox error={vm.error} />
      <Seg value={vm.tab} options={tabs} onChange={vm.setTab} />
      <div className="grid g-2 mt">
        {vm.loading && !vm.goals.length && <><Skeleton h={180} /><Skeleton h={180} /></>}
        {!vm.loading && vm.goals.length === 0 && (
          <Card className="span-2"><Empty icon="🎯" title="Aucun objectif ici">{vm.tab === 'active' && <button className="btn primary" onClick={vm.openCreate}>Créer mon premier objectif</button>}</Empty></Card>
        )}
        {vm.goals.map((g) => <GoalCard key={g.id} g={g} vm={vm} />)}
      </div>
      {vm.editing && <GoalEditor vm={vm} />}
    </ModulePage>
  )
}

type VM = ReturnType<typeof useGoalsViewModel>

function GoalCard({ g, vm }: { g: Goal; vm: VM }) {
  const [value, setValue] = useState<number | null>(null)
  const [date, setDate] = useState(todayISO())
  const data = g.measurements.map((m) => ({ label: fmtShort(m.date), value: m.value }))
  const fmt = (v: number | null) => (v === null ? '—' : Number.isInteger(v) ? v : v.toFixed(2))

  return (
    <Card accent={g.status === 'active'}
      title={<span className="row">{g.status === 'done' && <CheckCircle2 size={17} color="#4ade80" />}{g.title}</span>}
      sub={<>{METRIC_LABEL[g.metric]}{g.metric !== 'manual' && ` · ${g.period === 'week' ? 'cette semaine' : 'depuis le début'}`}{g.deadline && ` · échéance ${fmtDate(g.deadline)}`}</>}
      action={
        <div className="row" style={{ gap: 2 }}>
          <button className="btn ghost icon-btn" title="Modifier" onClick={() => vm.openEdit(g)}><Pencil size={15} /></button>
          {g.status === 'active'
            ? <button className="btn ghost icon-btn" title="Archiver" onClick={() => vm.setStatus(g, 'archived')}><Archive size={15} /></button>
            : <button className="btn ghost icon-btn" title="Réactiver" onClick={() => vm.setStatus(g, 'active')}><RotateCcw size={15} /></button>}
          <button className="btn ghost icon-btn" title="Supprimer" onClick={() => confirmThen('Supprimer cet objectif ?', () => vm.remove(g))}><Trash2 size={15} /></button>
        </div>
      }>
      <div className="row between" style={{ marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700 }}>
          {fmt(g.current_value)} <span className="faint" style={{ fontSize: 14 }}>/ {g.target_value} {g.unit}</span>
        </span>
        <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{Math.round(g.progress_pct)} %</span>
      </div>
      <Progress pct={g.progress_pct} color={ACCENT} />
      <div className="row wrap" style={{ marginTop: 10, gap: 6 }}>
        {g.category && <CategoryBadge category={g.category} />}
        {g.direction === 'decrease' && <span className="tag">plus bas = mieux</span>}
        {g.baseline_value !== null && <span className="tag">départ : {g.baseline_value} {g.unit}</span>}
      </div>

      {g.metric === 'manual' && (
        <>
          {data.length > 1 && (
            <div className="chart-box sm mt">
              <ResponsiveContainer>
                <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} domain={['auto', 'auto']} reversed={g.direction === 'decrease'} />
                  <ReferenceLine y={g.target_value} ifOverflow="extendDomain" stroke={ACCENT} strokeDasharray="4 4" label={{ value: 'objectif', fill: '#9aa7bd', fontSize: 11, position: 'insideTopRight' }} />
                  <Tooltip content={<ChartTooltip format={(v) => `${v} ${g.unit}`} />} />
                  <Line type="monotone" dataKey="value" name={g.title} stroke={ACCENT} strokeWidth={2} dot={{ r: 4, fill: ACCENT, stroke: '#141a24', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="row mt" style={{ gap: 8 }}>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 160 }} />
            <NumInput value={value} onChange={setValue} step={0.01} placeholder={`Nouvelle mesure (${g.unit})`} />
            <button className="btn primary" disabled={value === null || vm.busy} onClick={async () => { if (value !== null) { await vm.addMeasurement(g, value, date); setValue(null) } }}>Ajouter</button>
          </div>
        </>
      )}
    </Card>
  )
}

function GoalEditor({ vm }: { vm: VM }) {
  const e = vm.editing!
  const f = e.form
  const auto = f.metric !== 'manual'
  return (
    <Modal title={e.id ? 'Modifier l’objectif' : 'Nouvel objectif'} onClose={vm.closeEditor} accent={ACCENT}
      footer={<><button className="btn ghost" onClick={vm.closeEditor}>Annuler</button><button className="btn primary" disabled={vm.busy} onClick={vm.save}>Enregistrer</button></>}>
      <div className="form">
        {!e.id && (
          <div>
            <div className="faint" style={{ marginBottom: 8 }}>Partir d’un modèle :</div>
            <div className="row wrap" style={{ gap: 6 }}>
              {GOAL_PRESETS.map((p) => <button key={p.label} type="button" className="chip" onClick={() => vm.applyPreset(p.goal)}>{p.label}</button>)}
            </div>
          </div>
        )}
        <Field label="Titre"><input className="input" value={f.title} onChange={(ev) => vm.updateForm({ title: ev.target.value })} placeholder="Ex. : VMA à 17 km/h" /></Field>
        <div className="two">
          <Field label="Mesure">
            <select className="input" value={f.metric} onChange={(ev) => vm.updateForm({ metric: ev.target.value as Metric })}>
              {Object.entries(METRIC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Catégorie (optionnel)">
            <select className="input" value={f.category ?? ''} onChange={(ev) => vm.updateForm({ category: (ev.target.value || null) as Category | null })}>
              <option value="">Toutes</option>
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </Field>
        </div>
        {auto && (
          <Field label="Période de calcul">
            <Seg value={f.period} onChange={(v) => vm.updateForm({ period: v })} options={[{ value: 'week', label: 'Chaque semaine' }, { value: 'total', label: 'Cumul depuis le début' }]} />
          </Field>
        )}
        <div className="three">
          <Field label="Valeur de départ"><NumInput value={f.baseline_value} step={0.01} onChange={(v) => vm.updateForm({ baseline_value: v })} /></Field>
          <Field label="Cible"><NumInput value={f.target_value} step={0.01} onChange={(v) => vm.updateForm({ target_value: v ?? 0 })} /></Field>
          <Field label="Unité"><input className="input" value={f.unit} onChange={(ev) => vm.updateForm({ unit: ev.target.value })} placeholder="km/h, s, km…" /></Field>
        </div>
        <Field label="Sens de progression">
          <Seg value={f.direction} onChange={(v) => vm.updateForm({ direction: v })} options={[{ value: 'increase', label: '↑ Augmenter' }, { value: 'decrease', label: '↓ Diminuer (chrono)' }]} />
        </Field>
        <div className="two">
          <Field label="Début"><input className="input" type="date" value={f.start_date} onChange={(ev) => vm.updateForm({ start_date: ev.target.value })} /></Field>
          <Field label="Échéance (optionnel)"><input className="input" type="date" value={f.deadline ?? ''} onChange={(ev) => vm.updateForm({ deadline: ev.target.value || null })} /></Field>
        </div>
        {auto && <div className="note">Calcul automatique à partir de tes séances {f.category ? 'de cette catégorie' : ''} et de ton sommeil — rien à saisir.</div>}
      </div>
    </Modal>
  )
}
