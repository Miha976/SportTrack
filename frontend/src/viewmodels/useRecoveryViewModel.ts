import { useMemo, useState } from 'react'
import { todayISO } from '../models/dates'
import { exerciseRepository, statsRepository, workoutRepository } from '../services/repositories'
import { useCommand, useResource } from './useResource'

const ZONE_TIPS: Record<string, string[]> = {
  'sous-charge': ['Ta charge récente est basse par rapport à ton habitude : tu peux remonter progressivement le volume (≈ +10 % / semaine).'],
  optimal: ['Charge bien dosée. Garde 1 séance de récup par semaine et 7 h 30 – 9 h de sommeil.'],
  vigilance: ['Charge en hausse rapide : privilégie technique et mobilité 1-2 jours.', 'Soigne le sommeil et l’hydratation.'],
  risque: ['Hausse de charge brutale : réduis l’intensité cette semaine (pas de fractionné), récupération active.', 'Douleur persistante → consulte un professionnel de santé.'],
  inconnu: ['Suivi de charge en rodage : le ratio s’affiche après 4 semaines de séances enregistrées (avec le RPE). En attendant, augmente ton volume progressivement.'],
}

export function useRecoveryViewModel() {
  const readiness = useResource(() => statsRepository.readiness())
  const load = useResource(() => statsRepository.load(42))
  const library = useResource(() => exerciseRepository.list('recuperation'))
  const recent = useResource(() => workoutRepository.list({ category: 'recuperation', limit: 10 }))
  const cmd = useCommand()
  const [checked, setChecked] = useState<number[]>([])

  const tips = useMemo(() => ZONE_TIPS[readiness.data?.acwr_zone ?? 'inconnu'], [readiness.data])
  const checkedMinutes = useMemo(() => {
    const ex = library.data ?? []
    const s = ex.filter((e) => checked.includes(e.id)).reduce((a, e) => a + (e.default_duration_s ?? 300) * (e.default_sets ?? 1), 0)
    return Math.max(5, Math.round(s / 60))
  }, [checked, library.data])

  return {
    readiness: readiness.data, load: load.data ?? [], library: library.data ?? [], recent: recent.data ?? [],
    tips, checked, checkedMinutes, busy: cmd.busy,
    loading: readiness.loading || load.loading,
    error: readiness.error ?? load.error ?? cmd.error,
    toggle: (id: number) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id])),
    logRecovery: () =>
      cmd.run(async () => {
        const names = (library.data ?? []).filter((e) => checked.includes(e.id)).map((e) => e.name)
        if (!names.length) throw new Error('Coche au moins un exercice')
        await workoutRepository.create({
          date: todayISO(), category: 'recuperation', title: 'Récupération', duration_min: checkedMinutes,
          distance_km: null, avg_hr: null, max_hr: null, calories: null, rpe: 2, notes: names.join(' · '),
          program_session_id: null, details: {},
        })
        setChecked([])
        await Promise.all([recent.reload(), readiness.reload(), load.reload()])
      }),
  }
}
