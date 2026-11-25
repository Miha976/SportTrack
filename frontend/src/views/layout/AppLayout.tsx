import { Activity, BedDouble, CalendarDays, Dumbbell, Goal, HeartPulse, LayoutDashboard, LineChart, Watch } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { MODULES, type ModuleKey } from '../../models/catalog'
import { dataRepository, IS_LOCAL } from '../../services/repositories'
import { cssVars } from '../components/ui'

export const MODULE_ICON: Record<ModuleKey, (size?: number) => ReactNode> = {
  dashboard: (s = 18) => <LayoutDashboard size={s} />,
  goals: (s = 18) => <Goal size={s} />,
  program: (s = 18) => <CalendarDays size={s} />,
  sessions: (s = 18) => <Dumbbell size={s} />,
  recovery: (s = 18) => <HeartPulse size={s} />,
  sleep: (s = 18) => <BedDouble size={s} />,
  progress: (s = 18) => <LineChart size={s} />,
  watch: (s = 18) => <Watch size={s} />,
}

export function AppLayout() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><span className="brand-logo"><Activity size={20} /></span>FootProg</div>
        {MODULES.map((m) => (
          <NavLink key={m.key} to={m.path} end={m.path === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={cssVars({ '--c': m.color })}>
            <span className="dot">{MODULE_ICON[m.key]()}</span>{m.label}
          </NavLink>
        ))}
        <div className="sidebar-foot">{IS_LOCAL ? dataRepository?.info().label : 'Serveur local (FastAPI + SQLite)'}</div>
      </aside>
      <main className="main"><Outlet /></main>
      <nav className="bottom-nav" aria-label="Navigation">
        {MODULES.map((m) => (
          <NavLink key={m.key} to={m.path} end={m.path === '/'} className={({ isActive }) => (isActive ? 'active' : '')} style={cssVars({ '--c': m.color })}>
            {MODULE_ICON[m.key](20)}{m.short}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
