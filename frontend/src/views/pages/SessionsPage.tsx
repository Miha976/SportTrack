import { Heart, PenLine, Plus, Trash2, Watch } from 'lucide-react'
import { catMeta, CATEGORIES, RPE_LABEL } from '../../models/catalog'
import { fmtDate, fmtMinutes, fmtPace } from '../../models/dates'
import type { Category, Workout } from '../../models/types'
import { useSessionsViewModel } from '../../viewmodels/useSessionsViewModel'
import { MODULE_ICON } from '../layout/AppLayout'
import { confirmThen } from '../components/confirm'
import { Card, CategoryBadge, cssVars, Empty, ErrorBox, Field, Modal, ModulePage, NumInput, Skeleton } from '../components/ui'

const ACCENT = '#fb923c'
type VM = ReturnType<typeof useSessionsViewModel>

export function SessionsPage() {
  const vm = useSessionsViewModel()
  return (
    <ModulePage module="sessions" icon={MODULE_ICON.sessions(16)} title="Journal des séances"
      subtitle="Tout ce que tu fais : séances perso, club, matchs. Le ressenti (RPE) sert à calculer ta charge d'entraînement."
      actions={<button className="btn primary" onClick={() => vm.openCreate()}><Plus size={16} /> Nouvelle séance</button>}>
      <ErrorBox error={vm.error} />
      <div className="row wrap" style={{ gap: 6 }}>
        <button className={`chip ${vm.filter === null ? 'on' : ''}`} onClick={() => vm.setFilter(null)}>Toutes</button>
        {CATEGORIES.map((c) => (
          <button key={c.key} className={`chip ${vm.filter === c.key ? 'on' : ''}`} style={cssVars({ '--c': c.color })} onClick={() => vm.setFilter(c.key)}>{c.emoji} {c.label}</button>
        ))}
      </div>
      <div className="kpi-inline mt"><span><b>{vm.totals.count}</b> séances</span><span><b>{fmtMinutes(vm.totals.minutes)}</b> au total</span>{vm.totals.km > 0 && <span><b>{vm.totals.km.toFixed(1)}</b> km</span>}</div>

      {vm.loading && !vm.grouped.length && <div className="mt"><Skeleton h={300} /></div>}
      {!vm.loading && vm.grouped.length === 0 && <Card className="mt"><Empty icon="📒" title="Aucune séance enregistrée"><button className="btn primary" onClick={() => vm.openCreate()}>Ajouter ma première séance</button></Empty></Card>}

      {vm.grouped.map(([date, list]) => (
        <div key={date}>
          <div className="date-head">{fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <div className="stack">{list.map((w) => <WorkoutRow key={w.id} w={w} onClick={() => vm.openEdit(w)} />)}</div>
        </div>
      ))}
      {vm.editing && <WorkoutEditor vm={vm} />}
    </ModulePage>
  )
}

function WorkoutRow({ w, onClick }: { w: Workout; onClick: () => void }) {
  const c = catMeta(w.category)
  const pace = w.distance_km && w.duration_min ? w.duration_min / w.distance_km : null
  return (
    <button className="list-item" style={{ ...cssVars({ '--c': c.color }), width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={onClick}>
      <span className="cat-bar" />
      <span style={{ fontSize: 22 }}>{c.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8 }}><b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.title || c.label}</b>{w.source !== 'manuel' && <span className="tag"><Watch size={11} /> {w.source.toUpperCase()}</span>}</div>
        <div className="kpi-inline">
          <span><b>{fmtMinutes(w.duration_min)}</b></span>
          {w.distance_km ? <span><b>{w.distance_km}</b> km</span> : null}
          {pace && w.category === 'footing' ? <span>{fmtPace(pace)}</span> : null}
          {w.avg_hr ? <span><Heart size={12} /> {w.avg_hr} bpm</span> : null}
          {w.rpe ? <span>RPE <b>{w.rpe}</b></span> : null}
          {w.category === 'technique_mur' && w.details.reussis ? <span>{w.details.reussis}/{w.details.tentes ?? '?'} contrôles</span> : null}
          <span>Charge <b>{Math.round(w.load)}</b></span>
        </div>
      </div>
      <PenLine size={15} className="faint" />
    </button>
  )
}

function WorkoutEditor({ vm }: { vm: VM }) {
  const e = vm.editing!
  const f = e.form
  const rpe = f.rpe ?? 5
  const detail = (k: string) => (f.details[k] === undefined || f.details[k] === '' ? null : Number(f.details[k]))
  return (
    <Modal title={e.id ? 'Modifier la séance' : 'Nouvelle séance'} onClose={vm.close} accent={ACCENT}
      footer={<>
        {e.id && <button className="btn danger" onClick={() => confirmThen('Supprimer cette séance ?', () => vm.remove({ ...f, id: e.id!, source: 'manuel', load: 0 }))}><Trash2 size={14} /></button>}
        <span className="right" />
        <button className="btn ghost" onClick={vm.close}>Annuler</button>
        <button className="btn primary" disabled={vm.busy} onClick={vm.save}>Enregistrer</button>
      </>}>
      <div className="form">
        <Field label="Type">
          <div className="row wrap" style={{ gap: 6 }}>
            {CATEGORIES.map((c) => <button type="button" key={c.key} className={`chip ${f.category === c.key ? 'on' : ''}`} style={cssVars({ '--c': c.color })} onClick={() => vm.updateForm({ category: c.key as Category })}>{c.emoji} {c.label}</button>)}
          </div>
        </Field>
        <div className="two">
          <Field label="Date"><input className="input" type="date" value={f.date} onChange={(ev) => vm.updateForm({ date: ev.target.value })} /></Field>
          <Field label="Titre"><input className="input" value={f.title} placeholder={catMeta(f.category).label} onChange={(ev) => vm.updateForm({ title: ev.target.value })} /></Field>
        </div>
        <div className="three">
          <Field label="Durée (min)"><NumInput value={f.duration_min} onChange={(v) => vm.updateForm({ duration_min: v ?? 0 })} /></Field>
          <Field label="Distance (km)"><NumInput value={f.distance_km} step={0.01} onChange={(v) => vm.updateForm({ distance_km: v })} /></Field>
          <Field label="Calories"><NumInput value={f.calories} onChange={(v) => vm.updateForm({ calories: v })} /></Field>
        </div>
        <div className="two">
          <Field label="FC moyenne (bpm)"><NumInput value={f.avg_hr} onChange={(v) => vm.updateForm({ avg_hr: v })} /></Field>
          <Field label="FC max (bpm)"><NumInput value={f.max_hr} onChange={(v) => vm.updateForm({ max_hr: v })} /></Field>
        </div>
        <Field label={`Ressenti de l'effort (RPE) : ${rpe}/10 — ${RPE_LABEL[rpe]}`}>
          <input type="range" min={1} max={10} value={rpe} onChange={(ev) => vm.updateForm({ rpe: Number(ev.target.value) })} />
        </Field>

        {f.category === 'technique_mur' && (
          <div className="two">
            <Field label="Contrôles réussis"><NumInput value={detail('reussis')} onChange={(v) => vm.updateDetail('reussis', v ?? '')} /></Field>
            <Field label="Contrôles tentés"><NumInput value={detail('tentes')} onChange={(v) => vm.updateDetail('tentes', v ?? '')} /></Field>
          </div>
        )}
        {f.category === 'fractionne' && (
          <div className="three">
            <Field label="Répétitions"><NumInput value={detail('reps')} onChange={(v) => vm.updateDetail('reps', v ?? '')} /></Field>
            <Field label="Effort (s)"><NumInput value={detail('effort_s')} onChange={(v) => vm.updateDetail('effort_s', v ?? '')} /></Field>
            <Field label="Récup (s)"><NumInput value={detail('recup_s')} onChange={(v) => vm.updateDetail('recup_s', v ?? '')} /></Field>
          </div>
        )}
        <Field label="Notes"><textarea className="input" value={f.notes} onChange={(ev) => vm.updateForm({ notes: ev.target.value })} placeholder="Sensations, douleurs, ce qui a marché…" /></Field>
        <div className="row" style={{ gap: 8 }}><CategoryBadge category={f.category} /><span className="faint">Charge estimée : {Math.round(f.duration_min * rpe)} (durée × RPE)</span></div>
      </div>
    </Modal>
  )
}
