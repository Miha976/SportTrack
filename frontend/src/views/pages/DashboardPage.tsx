import { Check, Flame, Moon, Timer, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { catMeta, DAYS_SHORT, INTENSITY_LABEL, moduleByKey } from '../../models/catalog'
import { fmtDate, fmtMinutes, fromISO } from '../../models/dates'
import { useDashboardViewModel } from '../../viewmodels/useDashboardViewModel'
import { useDataViewModel } from '../../viewmodels/useDataViewModel'
import { MODULE_ICON } from '../layout/AppLayout'
import { ReadinessRing } from '../components/ReadinessRing'
import { Card, CategoryBadge, cssVars, Empty, ErrorBox, ModulePage, Progress, Skeleton, Stat } from '../components/ui'

const ZONE_LABEL: Record<string, string> = {
  inconnu: '—', 'sous-charge': 'Sous-charge', optimal: 'Optimale', vigilance: 'Vigilance', risque: 'Risque',
}

export function DashboardPage() {
  const vm = useDashboardViewModel()
  const data = useDataViewModel(vm.reload)
  const d = vm.data
  const hello = new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir'

  return (
    <ModulePage module="dashboard" icon={MODULE_ICON.dashboard(16)} title={`${hello} 👋`}
      subtitle={`${fmtDate(new Date().toISOString().slice(0, 10), { weekday: 'long', day: 'numeric', month: 'long' })} — voici où tu en es.`}>
      <ErrorBox error={vm.error} />
      {data.available && data.isEmpty() && (
        <Card accent title="Bienvenue sur FootProg 👋" className="mt" style={{ marginBottom: 16 }}>
          <p className="muted" style={{ marginTop: 0 }}>Tout fonctionne sur ton téléphone, sans serveur. Pour démarrer :</p>
          <div className="row wrap" style={{ gap: 8 }}>
            <Link to="/programme" className="btn primary">Créer mon programme</Link>
            <Link to="/objectifs" className="btn">Fixer un objectif</Link>
            <button className="btn ghost" disabled={data.busy} onClick={data.loadDemoNow}>Explorer avec des données de démo</button>
          </div>
        </Card>
      )}
      {vm.loading && !d ? <div className="grid g-2"><Skeleton h={200} /><Skeleton h={200} /></div> : d && (
        <>
          <div className="grid g-2">
            <Card title="Forme du jour" accent style={cssVars({ '--accent': moduleByKey('recovery').color })}
              action={<Link to="/recuperation" className="btn sm ghost">Détails →</Link>}>
              <ReadinessRing r={d.readiness} compact />
            </Card>

            <Card title="Au programme aujourd'hui" style={cssVars({ '--accent': moduleByKey('program').color })}
              action={<Link to="/programme" className="btn sm ghost">Programme →</Link>}>
              {d.today_plan.length === 0 ? (
                <Empty icon="🛋️" title="Rien de prévu aujourd'hui">
                  <span className="faint">Jour de repos, entraînement club ou match.</span>
                </Empty>
              ) : (
                <div className="stack">
                  {d.today_plan.map((p) => (
                    <div key={p.program_session.id} className="list-item" style={cssVars({ '--c': catMeta(p.program_session.category).color })}>
                      <span className="cat-bar" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{p.program_session.title}</div>
                        <div className="kpi-inline"><span>{fmtMinutes(p.scaled_duration_min)}</span><span>Intensité {INTENSITY_LABEL[p.program_session.intensity].toLowerCase()}</span>{p.deload && <span className="tag">semaine allégée</span>}</div>
                      </div>
                      {p.done_session_id
                        ? <span className="badge" style={cssVars({ '--c': '#0aac23' })}><Check size={13} /> Faite</span>
                        : <button className="btn sm primary" style={{ background: 'var(--accent)' }} disabled={vm.busy} onClick={() => vm.markDone(p)}><Check size={14} /> Valider</button>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="grid g-4 mt">
            <Card><Stat label={<><Timer size={14} /> Volume semaine</>} value={fmtMinutes(d.this_week.total_minutes)} hint={`Semaine dernière : ${fmtMinutes(d.last_week.total_minutes)}`} /></Card>
            <Card><Stat label={<><TrendingUp size={14} /> Charge (ratio 7j/28j)</>} value={d.readiness.acwr ?? '—'} hint={`Zone : ${ZONE_LABEL[d.readiness.acwr_zone]}`} /></Card>
            <Card><Stat label={<><Moon size={14} /> Sommeil moyen 7 j</>} value={d.sleep_avg_h_7d ? d.sleep_avg_h_7d.toFixed(1) : '—'} unit="h" hint="Cible : 8 h" /></Card>
            <Card><Stat label={<><Flame size={14} /> Série en cours</>} value={d.streak_days} unit={d.streak_days > 1 ? 'jours' : 'jour'} hint={`${d.this_week.planned_done}/${d.this_week.planned} séances du programme faites`} /></Card>
          </div>

          <Card title="Ma semaine" sub="Séances du programme · barrées = faites" className="mt">
            <div className="week">
              {vm.weekDays.map((day, i) => (
                <div key={day.date} className={`day ${day.isToday ? 'today' : ''}`}>
                  <span className="dname">{DAYS_SHORT[i]}</span>
                  <span className="dnum">{fromISO(day.date).getDate()}</span>
                  {day.planned.map((p) => (
                    <span key={p.program_session.id} className={`pill ${p.done_session_id ? 'done' : ''}`} style={cssVars({ '--c': catMeta(p.program_session.category).color })} title={p.program_session.title}>
                      {catMeta(p.program_session.category).emoji} <span className="pill-label">{catMeta(p.program_session.category).label}</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Objectifs en cours" className="mt" style={cssVars({ '--accent': moduleByKey('goals').color })}
            action={<Link to="/objectifs" className="btn sm ghost">Tout voir →</Link>}>
            {d.goals.length === 0 ? (
              <Empty icon="🎯" title="Aucun objectif actif"><Link to="/objectifs" className="btn primary" style={{ background: 'var(--accent)' }}>Créer un objectif</Link></Empty>
            ) : (
              <div className="grid g-2">
                {d.goals.slice(0, 6).map((g) => (
                  <div key={g.id} className="stack" style={{ gap: 6 }}>
                    <div className="row between"><span style={{ fontWeight: 600 }}>{g.title}</span><span className="faint">{g.current_value ?? '—'} / {g.target_value} {g.unit}</span></div>
                    <Progress pct={g.progress_pct} color="var(--accent)" />
                    {g.category && <div><CategoryBadge category={g.category} /></div>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </ModulePage>
  )
}
