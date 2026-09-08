import { FileText, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function DashboardPage() {
  const { profile } = useAuth()

  return (
    <section className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">RESUMEN</p>
          <h1>Hola, {profile?.full_name?.split(' ')[0] || 'bienvenido'}.</h1>
          <p>La base segura del espacio de trabajo ya está conectada.</p>
        </div>
      </header>

      <div className="placeholder-grid">
        <article className="placeholder-card">
          <FileText size={24} />
          <div><strong>Gestión documental</strong><span>El tablero de documentos se incorpora en el siguiente bloque.</span></div>
        </article>
        <article className="placeholder-card">
          <ShieldCheck size={24} />
          <div><strong>Acceso protegido</strong><span>Sesión, empresa, roles y RLS forman parte de la base de Etapa 1.</span></div>
        </article>
      </div>
    </section>
  )
}
