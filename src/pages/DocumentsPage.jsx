import { FileText } from 'lucide-react'

export default function DocumentsPage() {
  return (
    <section className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">GESTIÓN DOCUMENTAL</p>
          <h1>Documentos</h1>
          <p>Repositorio interno de documentos controlados.</p>
        </div>
      </header>
      <div className="empty-state">
        <FileText size={28} />
        <strong>Módulo preparado</strong>
        <p>La carga, los filtros y el seguimiento documental se implementan a continuación.</p>
      </div>
    </section>
  )
}
