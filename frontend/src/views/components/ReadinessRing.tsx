import type { Readiness } from '../../models/types'

const statusOf = (s: number) =>
  s >= 75 ? { color: '#0aac23', label: 'Prêt', icon: '✅' } : s >= 55 ? { color: '#fbb315', label: 'Modéré', icon: '⚠️' } : { color: '#dc3c3d', label: 'Récupère', icon: '🛑' }

export function ReadinessRing({ r, compact }: { r: Readiness; compact?: boolean }) {
  const st = statusOf(r.score)
  const R = 56
  const C = 2 * Math.PI * R
  return (
    <div className="ring-wrap">
      <div className="ring" aria-label={`Forme du jour ${r.score} sur 100 : ${st.label}`}>
        <svg viewBox="0 0 132 132" width="132" height="132">
          <circle cx="66" cy="66" r={R} fill="none" stroke="#222c3d" strokeWidth="12" />
          <circle cx="66" cy="66" r={R} fill="none" stroke={st.color} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${(C * r.score) / 100} ${C}`} transform="rotate(-90 66 66)" />
        </svg>
        <div className="num"><div><b>{r.score}</b><span>{st.icon} {st.label}</span></div></div>
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{r.advice}</div>
        {!compact && (
          <div>
            {r.factors.map((f) => (
              <div className="factor" key={f.label}>
                <span className="muted">{f.label}</span>
                <b style={{ color: f.delta > 0 ? '#4ade80' : f.delta < 0 ? '#f87171' : 'var(--text-3)' }}>{f.delta > 0 ? `+${f.delta}` : f.delta || '·'}</b>
              </div>
            ))}
          </div>
        )}
        <div className="faint" style={{ marginTop: 8 }}>Indicateur maison (sommeil, VFC, charge) — à croiser avec tes sensations.</div>
      </div>
    </div>
  )
}
