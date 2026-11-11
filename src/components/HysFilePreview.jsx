import { lazy, Suspense, useEffect, useState } from 'react'
import { requireSupabase } from '../lib/supabase'

const PdfPreview = lazy(() => import('./HysPdfPreview'))

async function readPreview(record) {
  const { data, error } = await requireSupabase().storage.from('hys-files').download(record.file_path)
  if (error) throw error
  if (/\.(?:png|jpe?g|webp)$/i.test(record.file_name)) return { image: URL.createObjectURL(data) }
  if (/\.(?:mp4|webm|mov|m4v)$/i.test(record.file_name)) return { video: URL.createObjectURL(data) }
  const buffer = await data.arrayBuffer()
  if (/\.pdf$/i.test(record.file_name)) return { pdf: buffer }
  if (/\.docx?$/i.test(record.file_name)) {
    let html, css
    if (/\.docx$/i.test(record.file_name)) {
      const { default: mammoth } = await import('mammoth/mammoth.browser')
      const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
      html = result.value
      css = 'body{font:16px system-ui} img{max-width:100%} table,td{border:1px solid #ddd}'
    } else {
      const { parseMsDocToHtml } = await import('@file-viewer/doc')
      const result = await parseMsDocToHtml(buffer)
      html = result.html
      css = result.css
    }
    const { default: purifier } = await import('dompurify')
    const safe = purifier.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ['form','style'], FORBID_ATTR: ['href','srcset'] })
    return { markup: `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'none'"><style>${css}</style><div class="msdoc-root">${safe}</div>` }
  }
  const { read, utils } = await import('xlsx')
  const book = read(buffer, { sheetRows: 201 })
  return { sheets: book.SheetNames.map(name => {
    const sheet = book.Sheets[name]
    const range = utils.decode_range(sheet['!ref'] || 'A1')
    range.e.c = Math.min(range.e.c, range.s.c + 39)
    return { name, rows: utils.sheet_to_json(sheet, { range, header: 1, raw: false, defval: '' }) }
  }) }
}

export default function HysFilePreview({ record, onClose }) {
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState(0)
  const [videoError, setVideoError] = useState(false)
  useEffect(() => {
    let active = true
    let mediaUrl
    setPreview(null)
    setError('')
    setVideoError(false)
    readPreview(record).then(result => {
      mediaUrl = result.image || result.video
      if (active) setPreview(result)
      else if (mediaUrl) URL.revokeObjectURL(mediaUrl)
    })
      .catch(() => { if (active) setError('No se pudo leer este archivo. Podés descargar el original desde el legajo.') })
    return () => { active = false; if (mediaUrl) URL.revokeObjectURL(mediaUrl) }
  }, [record])
  return <div className="hys-overlay"><div className="hys-dialog hys-office" role="dialog" aria-modal="true" aria-label="Vista previa">
    <div className="hys-modal-title"><h2>{record.file_name}</h2><button type="button" onClick={onClose} autoFocus>Cerrar</button></div>
    {error && <p role="alert">{error}</p>}
    {!preview && !error && <p role="status">Abriendo archivo…</p>}
    {preview?.image && <img src={preview.image} alt={record.file_name}/>}
    {preview?.video && <>
      <video src={preview.video} controls playsInline preload="metadata" onError={() => setVideoError(true)} style={{ width: '100%', maxHeight: '70vh' }}>
        Tu navegador no puede reproducir este video.
      </video>
      {videoError && <p role="alert">Este video no se puede reproducir en tu navegador. Descargalo desde el legajo para verlo en un reproductor compatible.</p>}
    </>}
    {preview?.pdf && <Suspense fallback={<p>Abriendo PDF…</p>}><PdfPreview bytes={preview.pdf}/></Suspense>}
    {preview?.markup && <iframe sandbox="" title={record.file_name} srcDoc={preview.markup}/>}
    {preview?.sheets && <>
      <label>Hoja<select value={sheet} onChange={e => setSheet(Number(e.target.value))}>
        {preview.sheets.map((item, i) => <option key={item.name} value={i}>{item.name}</option>)}
      </select></label>
      <small>Vista previa de hasta 200 filas y 40 columnas por hoja.</small>
      <div className="hys-table-wrap"><table><tbody>{preview.sheets[sheet]?.rows.slice(0, 200).map((row, i) =>
        <tr key={i}>{row.map((value, j) => <td key={j}>{String(value)}</td>)}</tr>)}</tbody></table></div>
    </>}
  </div></div>
}
