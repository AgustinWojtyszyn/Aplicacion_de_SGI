import { FileCheck2, ShieldCheck } from 'lucide-react'

export default function App() {
  return (
    <main className="bootstrap-screen">
      <section className="bootstrap-card">
        <div className="brand-mark" aria-hidden="true">
          <FileCheck2 size={30} />
        </div>
        <p className="eyebrow">SF HIGIENE · SISTEMA DE GESTIÓN</p>
        <h1>Gestión documental clara, segura y trazable.</h1>
        <p className="bootstrap-copy">
          Estamos construyendo la base operativa de la plataforma SGI para centralizar
          documentación, responsables y seguimiento.
        </p>
        <div className="bootstrap-status">
          <ShieldCheck size={18} />
          <span>Etapa 1 · Base de plataforma + Gestión Documental</span>
        </div>
      </section>
    </main>
  )
}
