// Téléchargement d'un fichier généré : capacité « downloads » dans l'artefact claude.ai,
// lien <a download> ailleurs (PWA, navigateur).
type Downloads = { save(r: { filename: string; data: string }): Promise<{ status: string }> }
type ClaudeGlobal = { use(name: string): Promise<unknown> }

export async function saveTextFile(filename: string, data: string, mime = 'application/json'): Promise<'saved' | 'declined' | 'unavailable'> {
  const c = (window as unknown as { claude?: ClaudeGlobal }).claude
  if (c?.use) {
    const dl = (await c.use('downloads')) as Downloads | null
    if (!dl) return 'unavailable'
    try {
      await dl.save({ filename, data })
      return 'saved'
    } catch (e) {
      return (e as { code?: string })?.code === 'declined' ? 'declined' : 'unavailable'
    }
  }
  const url = URL.createObjectURL(new Blob([data], { type: mime }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'saved'
}
