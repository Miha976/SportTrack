import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { catMeta, CATEGORIES, DAYS, DAYS_SHORT, INTENSITY_LABEL, PERSONAL_CATEGORIES, RPE_LABEL } from '../../models/catalog'
import { fmtDate, fmtMinutes, fromISO } from '../../models/dates'
import type { Category, Intensity, Level, PlannedSession, ProgramExercise } from '../../models/types'
import { useProgramViewModel } from '../../viewmodels/useProgramViewModel'
import { defaultRpe } from '../../viewmodels/workoutDefaults'
import { MODULE_ICON } from '../layout/AppLayout'
import { confirmThen } from '../components/confirm'
import { Card, CategoryBadge, cssVars, Empty, ErrorBox, Field, Modal, ModulePage, NumInput, Progress, Seg, Skeleton } from '../components/ui'

const ACCENT = '#60a5fa'
type VM = ReturnType<typeof useProgramViewModel>

const exLine = (e: ProgramExercise) =>
  [e.sets && `${e.sets} séries`, e.reps && `${e.reps} rép.`, e.duration_s && (e.duration_s >= 120 ? `${Math.round(e.duration_s / 60)} min` : `${e.duration_s} s`), e.note].filter(Boolean).join(' · ')

export function ProgramPage() {
  const vm = useProgramViewModel()
  const p = vm.active

  return (
    <ModulePage module="program" icon={MODULE_ICON.program(16)}
      subtitle="Une semaine type construite autour de tes entraînements club et de ton match, avec progression du volume et semaine allégée."
      actions={<button className="btn primary" onClick={vm.openGenerator}><Wand2 size={16} /> Générer un programme</button>}>
      <ErrorBox error={vm.error} />
      {vm.loading && !p && <Skeleton h={260} />}
      {!vm.loading && !p && (
        <Card accent><Empty icon="🗓️" title="Pas encore de programme actif">
          <p className="muted">Indique tes jours dispo, tes entraînements club et ton jour de match : l'app place les séances intelligemment.</p>
          <button className="btn primary" onClick={vm.openGenerator}><Sparkles size={16} /> Créer mon programme sur mesure</button>
        </Empty></Card>
      )}

      {p && (
        <>
          <Card accent title={p.name} sub={p.description}
            action={<button className="btn sm ghost danger" onClick={() => confirmThen('Supprimer ce programme ?', () => vm.removeProgram(p))}><Trash2 size={14} /></button>}>
            <div className="grid g-4">
              <div className="stat"><span className="label">Semaine</span><span className="value">{Math.min(Math.max(vm.currentWeek ?? 1, 1), p.weeks)}<small>/ {p.weeks}</small></span></div>
              <div className="stat"><span className="label">Progression</span><span className="value">+{p.progression_pct}<small>% / sem.</small></span></div>
              <div className="stat"><span className="label">Semaine allégée</span><span className="value">{p.deload_every ? `1/${p.deload_every}` : '—'}</span></div>
              <div className="stat"><span className="label">Réalisé (semaine affichée)</span><span className="value">{vm.adherence.done}<small>/ {vm.adherence.due} dues</small></span>
                <Progress pct={vm.adherence.due ? (vm.adherence.done / vm.adherence.due) * 100 : 0} color={ACCENT} /></div>
            </div>
            <ProgramSettings vm={vm} />
          </Card>

          <Card className="mt" title={`Semaine du ${fmtDate(vm.weekStart, { day: 'numeric', month: 'long' })}`}
            sub="Clique une séance pour voir le détail et la valider · « + » pour ajouter une séance au modèle"
            action={<div className="row" style={{ gap: 4 }}>
              <button className="btn sm ghost" onClick={vm.prevWeek} aria-label="Semaine précédente"><ChevronLeft size={16} /></button>
              <button className="btn sm" onClick={vm.thisWeek}>Aujourd'hui</button>
              <button className="btn sm ghost" onClick={vm.nextWeek} aria-label="Semaine suivante"><ChevronRight size={16} /></button>
            </div>}>
            <div className="board">
              {vm.days.map((d, i) => (
                <div key={d.date} className={`board-col ${d.isToday ? 'today' : ''}`}>
                  <h4><span>{DAYS_SHORT[i]} {fromISO(d.date).getDate()}</span>{d.items[0]?.deload && <span className="tag">allégée</span>}</h4>
                  {d.items.map((it) => {
                    const c = catMeta(it.program_session.category)
                    return (
                      <button key={it.program_session.id} className={`s-card ${it.done_session_id ? 'done' : ''}`} style={cssVars({ '--c': c.color })} onClick={() => vm.select(it)}>
                        <span className="faint" style={{ fontSize: 11.5 }}>{c.emoji} {c.label}</span>
                        <span className="t">{it.program_session.title}</span>
                        <span className="row between faint" style={{ fontSize: 12 }}>
                          {fmtMinutes(it.scaled_duration_min)}
                          {it.done_session_id ? <Check size={14} color="#4ade80" /> : <span>{INTENSITY_LABEL[it.program_session.intensity]}</span>}
                        </span>
                      </button>
                    )
                  })}
                  <button className="add-slot" onClick={() => vm.openNewSession(i)}><Plus size={13} /> Ajouter</button>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {vm.others.length > 0 && (
        <Card className="mt" title="Autres programmes">
          <div className="stack">
            {vm.others.map((o) => (
              <div key={o.id} className="list-item">
                <div style={{ flex: 1 }}><b>{o.name}</b><div className="faint">{o.weeks} sem. · début {fmtDate(o.start_date)} · {o.sessions.length} séances/sem.</div></div>
                <button className="btn sm" onClick={() => vm.activate(o)}>Activer</button>
                <button className="btn sm ghost" onClick={() => confirmThen('Supprimer ?', () => vm.removeProgram(o))}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {vm.selected && <PlannedDetail vm={vm} p={vm.selected} />}
      {vm.sessionEditor && <SessionEditor vm={vm} />}
      {vm.generator && <Generator vm={vm} />}
    </ModulePage>
  )
}

function ProgramSettings({ vm }: { vm: VM }) {
  const p = vm.active!
  const [f, setF] = useState({ progression_pct: p.progression_pct, deload_every: p.deload_every, weeks: p.weeks })
  const dirty = f.progression_pct !== p.progression_pct || f.deload_every !== p.deload_every || f.weeks !== p.weeks
  return (
    <div className="row wrap mt" style={{ gap: 12, alignItems: 'flex-end' }}>
      <Field label="Progression hebdo (%)"><NumInput value={f.progression_pct} onChange={(v) => setF({ ...f, progression_pct: v ?? 0 })} /></Field>
      <Field label="Allègement toutes les… sem. (0 = jamais)"><NumInput value={f.deload_every} min={0} onChange={(v) => setF({ ...f, deload_every: v ?? 0 })} /></Field>
      <Field label="Durée (semaines)"><NumInput value={f.weeks} min={1} onChange={(v) => setF({ ...f, weeks: v ?? 1 })} /></Field>
      {dirty && <button className="btn primary" disabled={vm.busy} onClick={() => vm.updateProgram(p, f)}>Appliquer</button>}
    </div>
  )
}

function PlannedDetail({ vm, p }: { vm: VM; p: PlannedSession }) {
  const s = p.program_session
  const [rpe, setRpe] = useState(defaultRpe(s.intensity))
  const [duration, setDuration] = useState<number | null>(p.scaled_duration_min)
  const [notes, setNotes] = useState('')
  return (
    <Modal title={s.title} onClose={() => vm.select(null)} accent={ACCENT}
      footer={p.done_session_id ? <span className="badge" style={cssVars({ '--c': '#0aac23' })}><Check size={13} /> Séance déjà enregistrée</span> : (
        <>
          <button className="btn ghost" onClick={() => { vm.select(null); vm.openEditSession(s) }}><Pencil size={14} /> Modifier le modèle</button>
          <button className="btn primary" disabled={vm.busy} onClick={() => vm.logPlanned(p, { rpe, duration_min: duration ?? p.scaled_duration_min, notes })}><Check size={16} /> J'ai fait cette séance</button>
        </>
      )}>
      <div className="row wrap" style={{ gap: 8, marginBottom: 14 }}>
        <CategoryBadge category={s.category} />
        <span className="tag">{fmtDate(p.date, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <span className="tag">Semaine {p.week_index}{p.deload ? ' · allégée' : ''}</span>
        <span className="tag">{fmtMinutes(p.scaled_duration_min)} · intensité {INTENSITY_LABEL[s.intensity].toLowerCase()}</span>
      </div>
      {s.content && <p className="muted" style={{ marginTop: 0 }}>{s.content}</p>}
      {s.exercises.length > 0 && (
        <table className="table">
          <thead><tr><th>Exercice</th><th>Volume</th></tr></thead>
          <tbody>{s.exercises.map((e, i) => <tr key={i}><td>{e.name}</td><td className="muted">{exLine(e) || '—'}</td></tr>)}</tbody>
        </table>
      )}
      {!p.done_session_id && (
        <div className="form mt">
          <div className="two">
            <Field label="Durée réelle (min)"><NumInput value={duration} onChange={setDuration} /></Field>
            <Field label={`Ressenti (RPE) : ${rpe} — ${RPE_LABEL[rpe]}`}><input type="range" min={1} max={10} value={rpe} onChange={(e) => setRpe(Number(e.target.value))} /></Field>
          </div>
          <Field label="Notes"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sensations, contrôles réussis…" /></Field>
        </div>
      )}
    </Modal>
  )
}

function SessionEditor({ vm }: { vm: VM }) {
  const e = vm.sessionEditor!
  const f = e.form
  const lib = vm.exercises.filter((x) => x.category === f.category)
  const setEx = (exs: ProgramExercise[]) => vm.updateSessionForm({ exercises: exs })
  return (
    <Modal title={e.id ? 'Modifier la séance type' : 'Nouvelle séance type'} onClose={vm.closeSessionEditor} accent={ACCENT}
      footer={<>
        {e.id && <button className="btn danger" onClick={() => vm.removeSession(e.id!)}><Trash2 size={14} /> Supprimer</button>}
        <span className="right" />
        <button className="btn ghost" onClick={vm.closeSessionEditor}>Annuler</button>
        <button className="btn primary" disabled={vm.busy} onClick={vm.saveSession}>Enregistrer</button>
      </>}>
      <div className="form">
        <div className="two">
          <Field label="Jour"><select className="input" value={f.day_of_week} onChange={(ev) => vm.updateSessionForm({ day_of_week: Number(ev.target.value) })}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></Field>
          <Field label="Catégorie"><select className="input" value={f.category} onChange={(ev) => vm.updateSessionForm({ category: ev.target.value as Category })}>{CATEGORIES.filter((c) => PERSONAL_CATEGORIES.includes(c.key)).map((c) => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}</select></Field>
        </div>
        <Field label="Titre"><input className="input" value={f.title} onChange={(ev) => vm.updateSessionForm({ title: ev.target.value })} placeholder="Ex. : Contrôle orienté sous pression" /></Field>
        <div className="two">
          <Field label="Durée de base (min, semaine 1)"><NumInput value={f.duration_min} onChange={(v) => vm.updateSessionForm({ duration_min: v ?? 0 })} /></Field>
          <Field label="Intensité"><Seg value={f.intensity} onChange={(v: Intensity) => vm.updateSessionForm({ intensity: v })} options={(['faible', 'moderee', 'elevee'] as Intensity[]).map((i) => ({ value: i, label: INTENSITY_LABEL[i] }))} /></Field>
        </div>
        <Field label="Consignes"><textarea className="input" value={f.content} onChange={(ev) => vm.updateSessionForm({ content: ev.target.value })} /></Field>
        <div>
          <div className="faint" style={{ marginBottom: 8 }}>Exercices</div>
          <div className="stack">
            {f.exercises.map((x, i) => (
              <div key={i} className="row" style={{ gap: 6 }}>
                <input className="input" value={x.name} onChange={(ev) => setEx(f.exercises.map((y, j) => (j === i ? { ...y, name: ev.target.value } : y)))} />
                <div style={{ width: 70 }}><NumInput value={x.sets ?? null} placeholder="séries" onChange={(v) => setEx(f.exercises.map((y, j) => (j === i ? { ...y, sets: v } : y)))} /></div>
                <div style={{ width: 70 }}><NumInput value={x.reps ?? null} placeholder="rép." onChange={(v) => setEx(f.exercises.map((y, j) => (j === i ? { ...y, reps: v } : y)))} /></div>
                <div style={{ width: 76 }}><NumInput value={x.duration_s ?? null} placeholder="sec" onChange={(v) => setEx(f.exercises.map((y, j) => (j === i ? { ...y, duration_s: v } : y)))} /></div>
                <button className="btn ghost icon-btn" onClick={() => setEx(f.exercises.filter((_, j) => j !== i))} aria-label="Retirer"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <div className="row wrap mt" style={{ gap: 6 }}>
            {lib.map((x) => (
              <button key={x.id} type="button" className="chip" title={x.description} onClick={() => setEx([...f.exercises, { name: x.name, sets: x.default_sets, reps: x.default_reps, duration_s: x.default_duration_s }])}>+ {x.name}</button>
            ))}
            <button type="button" className="chip" onClick={() => setEx([...f.exercises, { name: 'Exercice perso' }])}>+ Personnalisé</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function Generator({ vm }: { vm: VM }) {
  const g = vm.generator!
  const levels: { value: Level; label: string }[] = [{ value: 'debutant', label: 'Débutant' }, { value: 'intermediaire', label: 'Intermédiaire' }, { value: 'avance', label: 'Avancé' }]
  const done = vm.genNotes.length > 0
  return (
    <Modal title="Programme sur mesure" onClose={vm.closeGenerator} accent={ACCENT}
      footer={done
        ? <button className="btn primary" onClick={vm.closeGenerator}>Voir mon programme</button>
        : <><button className="btn ghost" onClick={vm.closeGenerator}>Annuler</button><button className="btn primary" disabled={vm.busy || !g.available_days.length} onClick={vm.generate}><Wand2 size={16} /> Générer</button></>}>
      {done ? (
        <div className="stack">
          <div className="note">✅ Programme créé et activé. Ajustements appliqués :</div>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>{vm.genNotes.map((n) => <li key={n}>{n}</li>)}</ul>
          <div className="faint">Tu peux ensuite modifier chaque séance (jour, durée, exercices).</div>
        </div>
      ) : (
        <div className="form">
          <div className="two">
            <Field label="Nom"><input className="input" value={g.name} onChange={(e) => vm.updateGenerator({ name: e.target.value })} /></Field>
            <Field label="Début (lundi conseillé)"><input className="input" type="date" value={g.start_date} onChange={(e) => vm.updateGenerator({ start_date: e.target.value })} /></Field>
          </div>
          <Field label="Jours où je peux m'entraîner seul">
            <div className="row wrap" style={{ gap: 6 }}>{DAYS_SHORT.map((d, i) => <button type="button" key={d} className={`chip ${g.available_days.includes(i) ? 'on' : ''}`} onClick={() => vm.toggleDay('available_days', i)}>{d}</button>)}</div>
          </Field>
          <Field label="Entraînements en club">
            <div className="row wrap" style={{ gap: 6 }}>{DAYS_SHORT.map((d, i) => <button type="button" key={d} className={`chip ${g.collective_days.includes(i) ? 'on' : ''}`} style={cssVars({ '--c': catMeta('collectif').color })} onClick={() => vm.toggleDay('collective_days', i)}>{d}</button>)}</div>
          </Field>
          <Field label="Jour de match">
            <div className="row wrap" style={{ gap: 6 }}>
              <button type="button" className={`chip ${g.match_day === null ? 'on' : ''}`} onClick={() => vm.updateGenerator({ match_day: null })}>Aucun</button>
              {DAYS_SHORT.map((d, i) => <button type="button" key={d} className={`chip ${g.match_day === i ? 'on' : ''}`} style={cssVars({ '--c': catMeta('match').color })} onClick={() => vm.updateGenerator({ match_day: i })}>{d}</button>)}
            </div>
          </Field>
          <Field label="Priorités (clique dans l'ordre d'importance)">
            <div className="row wrap" style={{ gap: 6 }}>
              {PERSONAL_CATEGORIES.filter((c) => c !== 'recuperation').map((c) => {
                const idx = g.focus.indexOf(c)
                const m = catMeta(c)
                return <button type="button" key={c} className={`chip ${idx >= 0 ? 'on' : ''}`} style={cssVars({ '--c': m.color })} onClick={() => vm.toggleFocus(c)}>{idx >= 0 && <span className="order">{idx + 1}</span>}{m.emoji} {m.label}</button>
              })}
            </div>
          </Field>
          <Field label="Niveau"><Seg value={g.level} onChange={(v) => vm.updateGenerator({ level: v })} options={levels} /></Field>
          <div className="two">
            <Field label="Durée du cycle (semaines)"><NumInput value={g.weeks} min={1} onChange={(v) => vm.updateGenerator({ weeks: v ?? 6 })} /></Field>
            <Field label="Durée max d'une séance (min)"><NumInput value={g.max_session_min} onChange={(v) => vm.updateGenerator({ max_session_min: v ?? 60 })} /></Field>
          </div>
          <div className="note">Règles : récup le lendemain du match, activation légère la veille, jamais deux séances intenses d'affilée ni collées à un entraînement club, volume +5 %/semaine et semaine allégée toutes les 4 semaines.</div>
        </div>
      )}
    </Modal>
  )
}
