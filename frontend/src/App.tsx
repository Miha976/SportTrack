import { useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { initData, IS_LOCAL } from './services/repositories'
import { ConfirmHost } from './views/components/confirm'
import { AppLayout } from './views/layout/AppLayout'
import { DashboardPage } from './views/pages/DashboardPage'
import { GoalsPage } from './views/pages/GoalsPage'
import { ProgramPage } from './views/pages/ProgramPage'
import { ProgressPage } from './views/pages/ProgressPage'
import { RecoveryPage } from './views/pages/RecoveryPage'
import { SessionsPage } from './views/pages/SessionsPage'
import { SleepPage } from './views/pages/SleepPage'
import { WatchPage } from './views/pages/WatchPage'

// En mode local, l'URL porte un simple #nom (#objectifs, #sommeil…) : compatible fichiers statiques et artefacts.
const hashToPath = () => '/' + window.location.hash.replace(/^#\/?/, '')

function HashSync() {
  const loc = useLocation()
  const nav = useNavigate()
  useEffect(() => {
    const name = loc.pathname.replace(/^\//, '')
    if (window.location.hash.replace(/^#\/?/, '') !== name) window.location.hash = name
  }, [loc.pathname])
  useEffect(() => {
    const on = () => { const p = hashToPath(); if (p !== loc.pathname) nav(p) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [loc.pathname, nav])
  return null
}

function Router({ children }: { children: ReactNode }) {
  return IS_LOCAL
    ? <MemoryRouter initialEntries={[hashToPath()]}><HashSync />{children}</MemoryRouter>
    : <BrowserRouter>{children}</BrowserRouter>
}

function DataGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | { error: string }>('loading')
  const load = () => {
    setState('loading')
    initData().then(() => setState('ready'), (e) => setState({ error: e instanceof Error ? e.message : String(e) }))
  }
  useEffect(load, [])
  if (state === 'ready') return <>{children}</>
  return (
    <div className="boot">
      <div className="brand-logo big">⚽</div>
      {state === 'loading' ? <p className="muted">Chargement de tes données…</p> : (
        <>
          <p className="alert">Impossible de charger les données : {state.error}</p>
          <button className="btn primary" onClick={load}>Réessayer</button>
        </>
      )}
    </div>
  )
}

export function App() {
  return (
    <DataGate>
      <Router>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="objectifs" element={<GoalsPage />} />
            <Route path="programme" element={<ProgramPage />} />
            <Route path="seances" element={<SessionsPage />} />
            <Route path="recuperation" element={<RecoveryPage />} />
            <Route path="sommeil" element={<SleepPage />} />
            <Route path="progression" element={<ProgressPage />} />
            <Route path="montre" element={<WatchPage />} />
            <Route path="*" element={<DashboardPage />} />
          </Route>
        </Routes>
      </Router>
      <ConfirmHost />
    </DataGate>
  )
}
