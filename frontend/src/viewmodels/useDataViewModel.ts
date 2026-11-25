import { useState } from 'react'
import { todayISO } from '../models/dates'
import { dataRepository } from '../services/repositories'
import { saveTextFile } from '../services/local/download'
import { confirmDialog } from '../views/components/confirm'
import { useCommand } from './useResource'

/** Sauvegarde / restauration / démo — disponible seulement en mode sans serveur. */
export function useDataViewModel(onChanged?: () => void) {
  const cmd = useCommand()
  const [info, setInfo] = useState(() => dataRepository?.info() ?? null)
  const [message, setMessage] = useState<string | null>(null)
  const refresh = () => { setInfo(dataRepository?.info() ?? null); onChanged?.() }

  const replace = (question: string, fn: () => Promise<void>, done: string) =>
    cmd.run(async () => {
      if (!(await confirmDialog(question))) return
      await fn()
      refresh()
      setMessage(done)
    })

  return {
    available: dataRepository !== null, info, message, busy: cmd.busy, error: cmd.error,
    isEmpty: () => dataRepository?.isEmpty() ?? false,
    exportBackup: () =>
      cmd.run(async () => {
        const r = await saveTextFile(`footprog-sauvegarde-${todayISO()}.json`, dataRepository!.exportJson())
        setMessage(r === 'saved' ? 'Sauvegarde enregistrée.' : r === 'declined' ? 'Téléchargement annulé.' : 'Téléchargement indisponible ici : utilise « Copier ».')
      }),
    copyBackup: () =>
      cmd.run(async () => {
        await navigator.clipboard.writeText(dataRepository!.exportJson())
        setMessage('Sauvegarde copiée dans le presse-papiers (colle-la dans une note ou un mail).')
      }),
    importBackup: (file: File) =>
      replace('Restaurer cette sauvegarde ? Toutes les données actuelles seront remplacées.',
        async () => dataRepository!.importJson(await file.text()), 'Sauvegarde restaurée.'),
    loadDemo: () =>
      replace('Charger les données de démo ? Tes données actuelles seront remplacées.', () => dataRepository!.loadDemo(), 'Données de démo chargées.'),
    loadDemoNow: () => cmd.run(async () => { await dataRepository!.loadDemo(); refresh() }),
    reset: () => replace('Tout effacer ? Cette action est définitive (pense à exporter avant).', () => dataRepository!.reset(), 'Données effacées.'),
  }
}
