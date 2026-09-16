import { CalendarDays, KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { roleLabel } from '../lib/permissions'
import { changePasswordWithCurrent, updateOwnProfile } from '../services/profileService'

function formatDate(value) {
  if (!value) return 'Sin dato'
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function ProfilePage() {
  const { user, profile, role, isPlatformAdmin, company, refreshWorkspace } = useAuth()
  const [name, setName] = useState(profile?.full_name || '')
  const [savingName, setSavingName] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const createdAt = useMemo(
    () => profile?.created_at || user?.created_at,
    [profile?.created_at, user?.created_at],
  )

  async function handleNameSubmit(event) {
    event.preventDefault()
    setSavingName(true)
    setError('')
    setNotice('')
    try {
      await updateOwnProfile({ userId: user.id, fullName: name })
      await refreshWorkspace()
      setNotice('Nombre actualizado correctamente.')
    } catch (saveError) {
      console.error(saveError)
      setError(saveError.message || 'No se pudo actualizar el perfil.')
    } finally {
      setSavingName(false)
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault()
    setChangingPassword(true)
    setError('')
    setNotice('')

    try {
      if (newPassword !== confirmPassword) throw new Error('Las contraseñas nuevas no coinciden.')
      await changePasswordWithCurrent({
        email: profile?.email || user?.email,
        currentPassword,
        newPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setNotice('Contraseña actualizada correctamente.')
    } catch (passwordError) {
      console.error(passwordError)
      setError(passwordError.message || 'No se pudo actualizar la contraseña.')
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <section className="page-stack profile-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">CUENTA PERSONAL</p>
          <h1>Mi perfil</h1>
          <p>Consultá los datos de tu cuenta y administrá tu acceso.</p>
        </div>
      </header>

      {error && <div className="page-error" role="alert">{error}</div>}
      {notice && <div className="page-success" role="status">{notice}</div>}

      <section className="profile-section" aria-labelledby="profile-overview-title">
        <div className="section-heading">
          <div>
            <span className="section-kicker">INFORMACIÓN</span>
            <h2 id="profile-overview-title">Datos de la cuenta</h2>
          </div>
          <p>Información básica asociada a tu usuario.</p>
        </div>

        <div className="profile-info-grid">
          <article className="profile-info-card">
            <UserRound size={20} />
            <div><span>Nombre</span><strong>{profile?.full_name || 'Sin nombre'}</strong></div>
          </article>
          <article className="profile-info-card">
            <Mail size={20} />
            <div><span>Correo</span><strong>{profile?.email || user?.email || 'Sin correo'}</strong></div>
          </article>
          <article className="profile-info-card">
            <ShieldCheck size={20} />
            <div><span>Rol</span><strong>{isPlatformAdmin ? 'Administrador global' : roleLabel(role)}</strong></div>
          </article>
          <article className="profile-info-card">
            <CalendarDays size={20} />
            <div><span>Cuenta creada</span><strong>{formatDate(createdAt)}</strong></div>
          </article>
        </div>

        <div className="profile-meta-line">
          <span>Empresa activa</span>
          <strong>{company?.name || 'Sin empresa seleccionada'}</strong>
          {profile?.updated_at && <small>Perfil actualizado: {formatDate(profile.updated_at)}</small>}
        </div>
      </section>

      <section className="profile-section" aria-labelledby="profile-edit-title">
        <div className="section-heading">
          <div>
            <span className="section-kicker">PERFIL</span>
            <h2 id="profile-edit-title">Editar nombre</h2>
          </div>
          <p>Este nombre se muestra dentro de la plataforma.</p>
        </div>

        <form className="profile-form" onSubmit={handleNameSubmit}>
          <label className="field">
            <span>Nombre y apellido</span>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
          </label>
          <button className="primary-button" disabled={savingName}>
            {savingName ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      </section>

      <section className="profile-section" aria-labelledby="profile-security-title">
        <div className="section-heading">
          <div>
            <span className="section-kicker">SEGURIDAD</span>
            <h2 id="profile-security-title">Cambiar contraseña</h2>
          </div>
          <p>Por seguridad, primero verificamos tu contraseña actual.</p>
        </div>

        <form className="profile-form profile-password-form" onSubmit={handlePasswordSubmit}>
          <label className="field">
            <span>Contraseña actual</span>
            <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required />
          </label>
          <label className="field">
            <span>Nueva contraseña</span>
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
          </label>
          <label className="field">
            <span>Repetir nueva contraseña</span>
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
          </label>
          <button className="primary-button" disabled={changingPassword}>
            <KeyRound size={17} /> {changingPassword ? 'Actualizando…' : 'Actualizar contraseña'}
          </button>
        </form>
      </section>
    </section>
  )
}
