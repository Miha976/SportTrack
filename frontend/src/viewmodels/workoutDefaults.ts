import { todayISO } from '../models/dates'
import type { Category, Intensity, WorkoutInput } from '../models/types'

export const defaultRpe = (i: Intensity) => ({ faible: 3, moderee: 6, elevee: 8 })[i]

export const emptyWorkout = (category: Category = 'footing'): WorkoutInput => ({
  date: todayISO(), category, title: '', duration_min: 30, distance_km: null, avg_hr: null, max_hr: null,
  calories: null, rpe: 5, notes: '', program_session_id: null, details: {},
})
