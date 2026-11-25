// Boîte de confirmation intégrée (window.confirm est bloqué dans certains contextes, ex. artefact).
import { useEffect, useState } from 'react'
import { Modal } from './ui'

type Pending = { message: string; danger: boolean; resolve: (ok: boolean) => void }
let push: ((p: Pending) => void) | null = null

export const confirmDialog = (message: string, danger = true) =>
  new Promise<boolean>((resolve) => (push ? push({ message, danger, resolve }) : resolve(window.confirm(message))))

/** Exécute fn seulement après confirmation. */
export const confirmThen = (message: string, fn: () => unknown) => { void confirmDialog(message).then((ok) => ok && fn()) }

export function ConfirmHost() {
  const [p, setP] = useState<Pending | null>(null)
  useEffect(() => {
    push = setP
    return () => { push = null }
  }, [])
  if (!p) return null
  const close = (ok: boolean) => { p.resolve(ok); setP(null) }
  return (
    <Modal title="Confirmer" onClose={() => close(false)}
      footer={<><button className="btn ghost" onClick={() => close(false)}>Annuler</button>
        <button className={`btn ${p.danger ? 'danger' : 'primary'}`} autoFocus onClick={() => close(true)}>Confirmer</button></>}>
      <p style={{ margin: 0 }}>{p.message}</p>
    </Modal>
  )
}
