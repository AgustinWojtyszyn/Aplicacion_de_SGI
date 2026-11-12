import { useEffect, useRef, useState } from 'react'
import { FileText, FolderOpen } from 'lucide-react'
import {
  entriesFromDirectoryInput, hysFolderUploadError, planHysFolderUpload, readHysDirectory, runHysFolderUpload,
} from '../lib/hysFolderUpload'
import { checkHysFolderUpload, saveHysFolder, uploadHysFolderFile } from '../services/hysService'

const number = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })
const sizeLabel = bytes => bytes >= 1048576 ? number.format(bytes / 1048576) + ' MB'
  : bytes >= 1024 ? number.format(bytes / 1024) + ' KB' : number.format(bytes) + ' bytes'
const statusLabel = { pending: 'Pendiente', working: 'En curso', done: 'Guardado', failed: 'Falló', invalid: 'Omitido' }

export default function HysFolderUpload({ destination, onClose }) {
  const dialog = useRef(null)
  const input = useRef(null)
  const stop = useRef(false)
  const active = useRef(false)
  const changed = useRef(false)
  const [plan, setPlan] = useState(null)
  const [phase, setPhase] = useState('select')
  const [error, setError] = useState('')
  const [visible, setVisible] = useState(100)
  const [, redraw] = useState(0)
  const busy = phase === 'reading' || phase === 'uploading' || phase === 'pausing'
  const nativePicker = typeof window.showDirectoryPicker === 'function'
  const [inputSupported, setInputSupported] = useState(false)

  useEffect(() => {
    dialog.current.showModal?.()
    setInputSupported('webkitdirectory' in input.current)
    return () => { stop.current = true }
  }, [])

  function preview(entries) {
    try {
      setPlan(planHysFolderUpload(entries, destination.category))
      setPhase('preview')
      setError('')
    } catch (problem) {
      setPhase('select')
      setError(problem.message)
    }
  }

  async function selectFolder() {
    if (!nativePicker) {
      input.current.click()
      return
    }
    setPhase('reading')
    setError('')
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' })
      preview(await readHysDirectory(handle))
    } catch (problem) {
      setPhase('select')
      if (problem?.name === 'AbortError') return
      if (inputSupported) {
        setError('Usá el selector alternativo para elegir la carpeta.')
        return
      }
      setError('No se pudo leer la carpeta. Probá con otra carpeta o usá «Subir documento».')
    }
  }

  async function upload() {
    if (active.current) return
    active.current = true
    stop.current = false
    setPhase('uploading')
    setError('')
    try {
      await checkHysFolderUpload()
      await runHysFolderUpload(plan, {
        stopped: () => stop.current,
        onChange: () => redraw(value => value + 1),
        createFolder: async folder => {
          const saved = await saveHysFolder({
            companyId: destination.companyId, unitId: destination.unitId, section: destination.section,
            name: folder.name, parentCategory: folder.parentCategory,
          })
          changed.current = true
          return saved
        },
        uploadFile: item => uploadHysFolderFile({
          companyId: destination.companyId, folder: item.parent.saved, id: item.id, file: item.file,
        }),
      })
      setPhase('summary')
    } catch (problem) {
      setError(hysFolderUploadError(problem))
      setPhase('summary')
    } finally {
      active.current = false
    }
  }

  const files = plan?.files ?? []
  const folders = plan?.folders ?? []
  const completed = files.filter(file => file.status === 'done').length
  const failed = files.filter(file => file.status === 'failed').length
  const skipped = files.filter(file => file.status === 'invalid').length
  const pending = files.filter(file => file.status === 'pending').length
  const failedFolders = folders.filter(folder => folder.status === 'failed').length
  const invalidFolders = folders.filter(folder => folder.status === 'invalid').length
  const canStart = Boolean(plan?.count || (!files.length && folders.some(folder => folder.status === 'pending')))
  const entries = [...folders, ...files]

  return <dialog ref={dialog} className="hys-dialog hys-folder-upload-dialog" aria-labelledby="hys-folder-upload-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(changed.current) }}>
    <div className="hys-modal-title"><h2 id="hys-folder-upload-title">Subir carpeta completa</h2></div>
    <p>Destino: <strong>{destination.label}</strong></p>
    <input ref={input} type="file" webkitdirectory="" multiple hidden aria-label="Seleccionar carpeta"
      onChange={event => {
        const entries = entriesFromDirectoryInput(event.target.files)
        event.target.value = ''
        if (entries.length) preview(entries)
      }}/>
    {phase === 'select' && <>
      <p>Elegí la carpeta de tu computadora. Vas a poder revisar su contenido antes de subirla.</p>
      {!nativePicker && !inputSupported && <p>Este navegador no permite elegir carpetas. Abrí GESTIQA en un navegador actualizado o usá «Subir documento».</p>}
      {!nativePicker && inputSupported && <p className="hys-note">Este selector incluye las subcarpetas que contienen archivos.</p>}
    </>}
    {phase === 'reading' && <p role="status">Leyendo la carpeta…</p>}
    {plan && <>
      <div className="hys-folder-upload-heading"><FolderOpen size={20}/><strong>{plan.root}</strong>
        <span>{plan.count} archivo(s) para subir · {sizeLabel(plan.bytes)}</span></div>
      {phase !== 'preview' && <div aria-live="polite">
        {plan.count > 0 && <progress aria-label="Progreso de carga" value={completed + failed} max={plan.count}/>}
        <p>{completed} guardado(s) · {failed} fallido(s) · {pending} pendiente(s) · {skipped} omitido(s)</p>
        {(failedFolders > 0 || invalidFolders > 0) && <p>{failedFolders} carpeta(s) con error · {invalidFolders} omitida(s)</p>}
        {phase === 'summary' && !error && <strong>
          {failed || pending || skipped || failedFolders || invalidFolders || folders.some(folder => folder.status === 'pending')
            ? 'Revisá el resultado de la carga.' : 'Carga completada.'}
        </strong>}
      </div>}
      <ul className="hys-folder-upload-list" aria-label="Estructura de la carpeta">
        {entries.slice(0, visible).map((item, index) => <li key={index}>
          {files.includes(item) ? <FileText size={16}/> : <FolderOpen size={16}/>}
          <div><strong>{item.key}</strong>
            {(phase !== 'preview' || item.error) && <small>{statusLabel[item.status]}{item.error ? ' · ' + item.error : ''}</small>}
          </div>
        </li>)}
      </ul>
      {entries.length > visible && <button className="secondary-button" onClick={() => setVisible(visible + 100)}>Mostrar más archivos y carpetas</button>}
      {phase === 'preview' && skipped > 0 && <p className="hys-note">{skipped} archivo(s) se omitirán. Revisá el motivo junto a cada uno.</p>}
    </>}
    {error && <p className="hys-inline-error" role="alert">{error}</p>}
    <div className="hys-item-actions">
      {phase === 'select' && (nativePicker || inputSupported) && <button className="primary-button" onClick={selectFolder}>Elegir carpeta</button>}
      {phase === 'select' && nativePicker && inputSupported && error && <button className="secondary-button" onClick={() => input.current.click()}>Usar selector alternativo</button>}
      {phase === 'preview' && <button className="primary-button" disabled={!canStart} onClick={upload}>Confirmar carga</button>}
      {phase === 'uploading' && <button className="secondary-button" onClick={() => {
        stop.current = true
        setPhase('pausing')
      }}>Pausar carga</button>}
      {phase === 'pausing' && <span role="status">Terminando las cargas en curso…</span>}
      {phase === 'summary' && (failed || failedFolders || pending || folders.some(folder => folder.status === 'pending')) > 0 &&
        <button className="primary-button" onClick={upload}>{pending ? 'Continuar carga' : 'Reintentar fallidos'}</button>}
      {!busy && <button className="secondary-button" onClick={() => onClose(changed.current)}>{phase === 'summary' ? 'Cerrar' : 'Cancelar'}</button>}
    </div>
  </dialog>
}
