import { LogOut } from 'lucide-react'
import BrandLogo from '../components/BrandLogo'
import { useAuth } from '../context/AuthContext'

export default function AccessPendingPage({ error = '' }) {
  const { profile, signOut, refreshWorkspace } = useAuth()

  return (
    <main className="access-screen">
      <section className="access-card">
        <BrandLogo className="access-brand-logo" />
        <p className="eyebrow">ACCESO PENDIENTE</p>
        <h1>Tu cuenta está creada, pero todavía no tiene acceso a un espacio de trabajo.</h1>
        <p>
          Sesión iniciada como <strong>{profile?.email || 'usuario autenticado'}</strong>. Un administrador debe habilitar tu cuenta antes de que puedas acceder a documentación interna.
        </p>
        {error && <div className="form-error">{error}</div>}
        <div className="access-actions">
          <button className="primary-button" onClick={refreshWorkspace}>Volver a comprobar</button>
          <button className="secondary-button" onClick={signOut}><LogOut size={17} /> Cerrar sesión</button>
        </div>
      </section>
    </main>
  )
}
