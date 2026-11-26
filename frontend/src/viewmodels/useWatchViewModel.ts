import { useState } from 'react'
import type { ImportResult } from '../models/types'
import { importRepository } from '../services/repositories'
import { saveTextFile } from '../services/local/download'
import { useCommand } from './useResource'

export const SLEEP_CSV_TEMPLATE =
  'date,kind,bedtime,wake_time,duration_min,quality,deep_min,rem_min,light_min,awake_min,awakenings,resting_hr,hrv_ms\n' +
  '2026-11-24,night,23:15,07:10,455,4,80,100,250,25,1,52,68\n' +
  '2026-11-24,nap,14:00,14:25,25,,,,,,,,\n'

export function useWatchViewModel() {
  const cmd = useCommand()
  const [activityResult, setActivityResult] = useState<ImportResult | null>(null)
  const [sleepResult, setSleepResult] = useState<ImportResult | null>(null)

  return {
    busy: cmd.busy, error: cmd.error, activityResult, sleepResult,
    importActivities: (files: File[]) =>
      cmd.run(async () => { if (files.length) setActivityResult(await importRepository.activities(files)) }),
    importSleep: (file: File) => cmd.run(async () => setSleepResult(await importRepository.sleep(file))),
    downloadTemplate: () => cmd.run(() => saveTextFile('modele_sommeil.csv', SLEEP_CSV_TEMPLATE, 'text/csv')),
  }
}
