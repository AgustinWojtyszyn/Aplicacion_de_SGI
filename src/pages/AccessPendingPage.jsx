import { LogOut, UserRoundCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function AccessPendingPage({ error = '' }) {
  const { profile, signOut, refreshWorkspace } = useAuth()

  return (
    <main className="access-screen">
      <section className="access-card">
        <div className="brand-mark"><UserRoundCheck size={28} /></div>
        <p className="eyebrow">ACCESO INTERNO</p>
        <h1>Tu cuenta todavía no tiene acceso al espacio de SF Higiene.</h1>
        <p>
          Sesión iniciada como <strong>{profile?.email || 'usuario autenticado'}</strong>. Un administrador debe asociar la cuenta a la empresa.
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
