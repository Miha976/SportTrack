import { X } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect } from 'react'
import { catMeta, moduleByKey, type ModuleKey } from '../../models/catalog'
import type { Category } from '../../models/types'

type CSSVars = CSSProperties & Record<`--${string}`, string>
export const cssVars = (v: Record<string, string>) => v as CSSVars

/** Enveloppe d'un écran : fixe la couleur d'accent du module. */
export function ModulePage(props: { module: ModuleKey; icon: ReactNode; title?: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  const m = moduleByKey(props.module)
  return (
    <div style={cssVars({ '--accent': m.color })}>
      <header className="module-header">
        <div>
          <span className="eyebrow">{props.icon} {m.label}</span>
          <h1>{props.title ?? m.label}</h1>
          {props.subtitle && <p>{props.subtitle}</p>}
        </div>
        {props.actions && <div className="row wrap">{props.actions}</div>}
      </header>
      <div className="module-band" />
      {props.children}
    </div>
  )
}

export function Card(props: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; accent?: boolean; className?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <section className={`card ${props.accent ? 'accent' : ''} ${props.className ?? ''}`} style={props.style}>
      {(props.title || props.action) && (
        <div className="card-head">
          <div>
            {props.title && <h3>{props.title}</h3>}
            {props.sub && <div className="sub">{props.sub}</div>}
          </div>
          {props.action}
        </div>
      )}
      {props.children}
    </section>
  )
}

export function Modal(props: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; accent?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={props.title} style={props.accent ? cssVars({ '--accent': props.accent }) : undefined}>
        <div className="modal-head">
          <h2>{props.title}</h2>
          <button className="btn ghost icon-btn" onClick={props.onClose} aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="modal-body">{props.children}</div>
        {props.footer && <div className="modal-foot">{props.footer}</div>}
      </div>
    </div>
  )
}

export function Stat(props: { label: ReactNode; value: ReactNode; unit?: string; delta?: number | null; deltaInverse?: boolean; hint?: ReactNode }) {
  const d = props.delta
  const good = d === null || d === undefined ? null : props.deltaInverse ? d < 0 : d > 0
  return (
    <div className="stat">
      <span className="label">{props.label}</span>
      <span className="value">{props.value}{props.unit && <small>{props.unit}</small>}</span>
      {d !== undefined && d !== null && (
        <span className={`delta ${d === 0 ? 'flat' : good ? 'up' : 'down'}`}>{d > 0 ? '▲' : d < 0 ? '▼' : '='} {Math.abs(d)} % vs période préc.</span>
      )}
      {props.hint && <span className="faint">{props.hint}</span>}
    </div>
  )
}

export function Progress({ pct, color }: { pct: number; color?: string }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} style={color ? cssVars({ '--c': color }) : undefined}>
      <span style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
    </div>
  )
}

export function CategoryBadge({ category }: { category: Category }) {
  const c = catMeta(category)
  return <span className="badge" style={cssVars({ '--c': c.color })}><span className="sw" />{c.label}</span>
}

export function Field(props: { label: string; children: ReactNode; className?: string }) {
  return <label className={`field ${props.className ?? ''}`}><span>{props.label}</span>{props.children}</label>
}

export function Seg<T extends string | number>(props: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {props.options.map((o) => (
        <button key={String(o.value)} type="button" role="tab" aria-selected={o.value === props.value} className={o.value === props.value ? 'on' : ''} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export const ErrorBox = ({ error }: { error: string | null }) => (error ? <div className="alert" role="alert">⚠️ {error}</div> : null)

export const Empty = (p: { icon: string; title: string; children?: ReactNode }) => (
  <div className="empty"><div className="big">{p.icon}</div><div style={{ fontWeight: 600, color: 'var(--text)' }}>{p.title}</div>{p.children && <div className="mt">{p.children}</div>}</div>
)

export const Skeleton = ({ h = 120 }: { h?: number }) => <div className="skeleton" style={{ height: h }} />

/** Saisie numérique tolérante (vide = null, virgule acceptée). */
export function NumInput(props: { value: number | null; onChange: (v: number | null) => void; step?: number; min?: number; placeholder?: string }) {
  return (
    <input
      className="input" type="number" inputMode="decimal" step={props.step ?? 1} min={props.min} placeholder={props.placeholder}
      value={props.value ?? ''}
      onChange={(e) => props.onChange(e.target.value === '' ? null : Number(e.target.value.replace(',', '.')))}
    />
  )
}

export function Stars(props: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="stars" role="radiogroup" aria-label="Qualité">
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} className={(props.value ?? 0) >= n ? 'on' : ''} onClick={() => props.onChange(n)} aria-label={`${n} sur 5`}>★</button>
      ))}
    </div>
  )
}
