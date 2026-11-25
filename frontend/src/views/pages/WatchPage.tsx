import { Copy, Database, Download, FileUp, Moon, RotateCcw, Sparkles, Upload } from 'lucide-react'
import { useState, type DragEvent } from 'react'
import { useDataViewModel } from '../../viewmodels/useDataViewModel'
import { useWatchViewModel } from '../../viewmodels/useWatchViewModel'
import { MODULE_ICON } from '../layout/AppLayout'
import { Card, cssVars, ErrorBox, ModulePage } from '../components/ui'

function DropZone(props: { accept: string; multiple?: boolean; onFiles: (f: File[]) => void; label: string; hint: string; icon: React.ReactNode }) {
  const [over, setOver] = useState(false)
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); props.onFiles([...e.dataTransfer.files]) }
  return (
    <label className={`drop ${over ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
      <input type="file" hidden accept={props.accept} multiple={props.multiple} onChange={(e) => { props.onFiles([...(e.target.files ?? [])]); e.target.value = '' }} />
      <div style={{ fontSize: 28, marginBottom: 6 }}>{props.icon}</div>
      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{props.label}</div>
      <div className="faint">{props.hint}</div>
    </label>
  )
}

function DataCard({ data }: { data: ReturnType<typeof useDataViewModel> }) {
  const info = data.info!
  const color = info.kind === 'claude' ? '#0aac23' : info.kind === 'device' ? '#338ced' : '#dc3c3d'
  return (
    <Card title={<span className="row"><Database size={16} /> Mes données</span>} className="mt" style={{ marginBottom: 16 }}
      sub={Object.entries(info.counts).map(([k, v]) => `${v} ${k}`).join(' · ')}>
      <span className="storage-pill" style={cssVars({ '--c': color })}><i />{info.label}</span>
      {info.kind !== 'claude' && <p className="faint">Les données restent dans ce navigateur : exporte une sauvegarde de temps en temps (changement de téléphone, nettoyage du navigateur).</p>}
      <div className="row wrap mt" style={{ gap: 8 }}>
        <button className="btn" disabled={data.busy} onClick={data.exportBackup}><Download size={15} /> Exporter</button>
        <button className="btn" disabled={data.busy} onClick={data.copyBackup}><Copy size={15} /> Copier</button>
        <label className="btn" style={{ cursor: 'pointer' }}><Upload size={15} /> Restaurer
          <input type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) data.importBackup(f); e.target.value = '' }} />
        </label>
        <button className="btn ghost" disabled={data.busy} onClick={data.loadDemo}><Sparkles size={15} /> Démo</button>
        <button className="btn ghost danger" disabled={data.busy} onClick={data.reset}><RotateCcw size={15} /> Tout effacer</button>
      </div>
      {data.message && <div className="note mt">{data.message}</div>}
    </Card>
  )
}

export function WatchPage() {
  const vm = useWatchViewModel()
  const data = useDataViewModel()
  return (
    <ModulePage module="watch" icon={MODULE_ICON.watch(16)}
      subtitle="Importe les activités et le sommeil de ta montre. Fonctionne avec la plupart des marques via les formats d'export standard.">
      <ErrorBox error={vm.error ?? data.error} />
      {data.available && data.info && <DataCard data={data} />}
      <div className="grid g-2">
        <Card title="Activités" sub="GPX · TCX · FIT — plusieurs fichiers à la fois" accent>
          <DropZone accept=".gpx,.tcx,.fit" multiple onFiles={vm.importActivities} icon={<FileUp />} label="Glisse tes fichiers ici ou clique" hint="Durée, distance, FC moyenne/max, calories et tours sont extraits" />
          {vm.busy && <div className="faint mt">Import en cours…</div>}
          {vm.activityResult && (
            <div className="note mt">
              <b>{vm.activityResult.imported} importée(s)</b>, {vm.activityResult.skipped} ignorée(s)
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{vm.activityResult.items.map((i) => <li key={i}>{i}</li>)}</ul>
              <div className="faint" style={{ marginTop: 6 }}>Vérifie le type (footing, fractionné…) et ajoute le RPE dans « Séances ». Les doublons sont détectés automatiquement.</div>
            </div>
          )}
        </Card>
        <Card title="Sommeil" sub="CSV (export appli montre ou tableur)">
          <DropZone accept=".csv" onFiles={(f) => f[0] && vm.importSleep(f[0])} icon={<Moon />} label="Importer un CSV de sommeil" hint="Colonnes reconnues : date, bedtime, wake_time, duration_min, quality, deep/rem/light/awake_min, resting_hr, hrv_ms" />
          <div className="row mt between wrap">
            <span className="faint">Séparateur , ou ; · dates AAAA-MM-JJ ou JJ/MM/AAAA</span>
            <button className="btn sm" onClick={vm.downloadTemplate}><Download size={14} /> Modèle CSV</button>
          </div>
          {vm.sleepResult && <div className="note mt"><b>{vm.sleepResult.imported} nuit(s) importée(s)</b>{vm.sleepResult.skipped ? `, ${vm.sleepResult.skipped} ignorée(s)` : ''}. Une nuit existante à la même date est remplacée.</div>}
        </Card>
      </div>

      <div className="grid g-2 mt">
        <Card title="Comment exporter depuis ta montre">
          <ol className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
            <li>Ouvre l'appli ou le site web du constructeur et va dans le détail d'une activité.</li>
            <li>Cherche « Exporter » : choisis <b>FIT</b> (le plus complet), sinon <b>TCX</b> ou <b>GPX</b>.</li>
            <li>Dépose le fichier ici. Pour un historique complet, la plupart des marques proposent un export global de tes données (archive) dans les paramètres du compte.</li>
          </ol>
          <div className="note mt">Les noms exacts des menus varient selon la marque et changent avec les mises à jour des applis.</div>
        </Card>
        <Card title="Bien choisir sa montre pour cette app">
          <ul className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
            <li><b>GPS intégré</b> pour footing et fractionné (distance, allure).</li>
            <li><b>Cardio au poignet</b> + compatibilité ceinture thoracique (plus précise sur les efforts courts).</li>
            <li><b>Suivi du sommeil avec VFC</b> et FC de repos : alimentent le score de forme.</li>
            <li><b>Export FIT/TCX</b> ou API ouverte : indispensable pour récupérer tes données.</li>
            <li>Mode « intervalles » programmable : pratique pour les 30/30.</li>
          </ul>
        </Card>
      </div>
    </ModulePage>
  )
}
