import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

export default function HysPdfPreview({ bytes }) {
  const canvas = useRef(null)
  const [pdf, setPdf] = useState(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const task = getDocument({ data: bytes.slice(0), isEvalSupported: false })
    task.promise.then(doc => { if (active) setPdf(doc) })
      .catch(() => { if (active) setError('No se pudo abrir el PDF. Podés descargar el original.') })
    return () => { active = false; task.destroy() }
  }, [bytes])
  useEffect(() => {
    if (!pdf) return
    let active = true
    let drawing
    async function draw() {
      const pdfPage = await pdf.getPage(page)
      if (!active) return
      const base = pdfPage.getViewport({ scale: 1 })
      const viewport = pdfPage.getViewport({ scale: Math.min(2, 1600 / Math.max(base.width, base.height)) })
      const target = canvas.current
      target.width = Math.ceil(viewport.width)
      target.height = Math.ceil(viewport.height)
      drawing = pdfPage.render({ canvas: target, viewport })
      await drawing.promise
    }
    draw().catch(() => { if (active) setError('No se pudo mostrar la página. Podés descargar el PDF original.') })
    return () => { active = false; drawing?.cancel() }
  }, [pdf, page])
  return <>
    {error && <p role="alert">{error}</p>}
    {pdf && <div className="hys-actions-row">
      <button disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button>
      <span>Página {page} de {pdf.numPages}</span>
      <button disabled={page === pdf.numPages} onClick={() => setPage(page + 1)}>Siguiente</button>
    </div>}
    <canvas ref={canvas} aria-label={`Página ${page} del PDF`}/>
  </>
}
