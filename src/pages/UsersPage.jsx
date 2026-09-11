import { RefreshCw, ShieldCheck, UserCheck, UserPlus, UsersRound, UserX } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  COMPANY_ROLES,
  inviteCompanyUser,
  listCompanyUsers,
  ROLE_LABELS,
  updateCompanyUserAccess,
} from '../services/userService'

function personName(membership) {
  return membership.user?.full_name || membership.user?.email || 'Usuario'
}

export default function UsersPage() {
  const { company, user } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteValues, setInviteValues] = useState({ fullName: '', email: '', role: 'member' })

  const activeCount = useMemo(
    () => members.filter((member) => member.is_active).length,
    [members],
  )

  async function load() {
    if (!company?.id) return
    setLoading(true)
    setError('')
    try {
      setMembers(await listCompanyUsers(company.id))
    } catch (loadError) {
      console.error(loadError)
      setError(loadError.message || 'No se pudieron cargar los usuarios.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id])

  async function handleInvite(event) {
    event.preventDefault()
    setInviting(true)
    setError('')
    setNotice('')
    try {
      await inviteCompanyUser({ companyId: company.id, ...inviteValues })
      setInviteValues({ fullName: '', email: '', role: 'member' })
      setInviteOpen(false)
      setNotice(`Invitación enviada a ${inviteValues.email.trim().toLowerCase()}.`)
      await load()
    } catch (inviteError) {
      console.error(inviteError)
      setError(inviteError.message || 'No se pudo enviar la invitación.')
    } finally {
      setInviting(false)
    }
  }

  async function saveAccess(member, changes) {
    setUpdatingId(member.user_id)
    setError('')
    setNotice('')
    try {
      const updated = await updateCompanyUserAccess({
        companyId: company.id,
        userId: member.user_id,
        role: changes.role ?? member.role,
        isActive: changes.isActive ?? member.is_active,
      })
      setMembers((current) => current.map((item) => (
        item.user_id === updated.user_id ? updated : item
      )))
      setNotice(`Acceso actualizado para ${personName(updated)}.`)
    } catch (saveError) {
      console.error(saveError)
      setError(saveError.message || 'No se pudo actualizar el acceso.')
    } finally {
      setUpdatingId('')
    }
  }

  return (
    <section className="page-stack users-page">
      <header className="page-heading users-heading">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN</p>
          <h1>Usuarios</h1>
          <p>Roles y acceso al espacio de trabajo de {company?.name || 'la empresa seleccionada'}.</p>
        </div>
        <div className="users-heading-actions">
          <button className="secondary-button" onClick={load} disabled={loading}>
            <RefreshCw size={17} /> Actualizar
          </button>
          <button className="primary-button" onClick={() => setInviteOpen((open) => !open)}>
            <UserPlus size={17} /> Invitar usuario
          </button>
        </div>
      </header>

      {inviteOpen && (
        <form className="invite-user-panel" onSubmit={handleInvite}>
          <div className="invite-user-copy">
            <strong>Invitar a {company?.name || 'esta empresa'}</strong>
            <span>La persona recibirá un correo para establecer su contraseña.</span>
          </div>
          <label className="field">
            <span>Nombre</span>
            <input
              value={inviteValues.fullName}
              onChange={(event) => setInviteValues((current) => ({ ...current, fullName: event.target.value }))}
              placeholder="Nombre y apellido"
              required
            />
          </label>
          <label className="field">
            <span>Correo</span>
            <input
              type="email"
              value={inviteValues.email}
              onChange={(event) => setInviteValues((current) => ({ ...current, email: event.target.value }))}
              placeholder="persona@empresa.com"
              required
            />
          </label>
          <label className="field">
            <span>Rol inicial</span>
            <select
              value={inviteValues.role}
              onChange={(event) => setInviteValues((current) => ({ ...current, role: event.target.value }))}
            >
              {COMPANY_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
            </select>
          </label>
          <button className="primary-button invite-submit" disabled={inviting}>
            {inviting ? 'Enviando…' : 'Enviar invitación'}
          </button>
        </form>
      )}

      <div className="users-stats">
        <div className="user-stat-card">
          <UsersRound size={20} />
          <div><strong>{members.length}</strong><span>usuarios</span></div>
        </div>
        <div className="user-stat-card">
          <UserCheck size={20} />
          <div><strong>{activeCount}</strong><span>con acceso</span></div>
        </div>
        <div className="user-stat-card">
          <ShieldCheck size={20} />
          <div><strong>{members.filter((member) => member.role === 'admin' && member.is_active).length}</strong><span>administradores</span></div>
        </div>
      </div>

      {error && <div className="page-error" role="alert">{error}</div>}
      {notice && <div className="page-success" role="status">{notice}</div>}

      <div className="users-surface">
        <div className="users-surface-heading">
          <div>
            <strong>Accesos de la empresa</strong>
            <span>Los cambios se aplican inmediatamente.</span>
          </div>
        </div>

        {loading ? (
          <div className="users-loading"><span className="loader-dot" /><p>Cargando usuarios…</p></div>
        ) : members.length === 0 ? (
          <div className="users-empty">No hay usuarios asociados a esta empresa.</div>
        ) : (
          <div className="users-list">
            {members.map((member) => {
              const isCurrentUser = member.user_id === user?.id
              const isUpdating = updatingId === member.user_id
              return (
                <article className={`user-row ${member.is_active ? '' : 'user-row-inactive'}`} key={member.user_id}>
                  <div className="user-identity">
                    <div className="user-avatar">{personName(member).slice(0, 2).toUpperCase()}</div>
                    <div>
                      <strong>{personName(member)}</strong>
                      <span>{member.user?.email}</span>
                      {isCurrentUser && <small>Tu cuenta</small>}
                    </div>
                  </div>

                  <label className="user-role-field">
                    <span>Rol</span>
                    <select
                      value={member.role}
                      disabled={isUpdating || isCurrentUser}
                      onChange={(event) => saveAccess(member, { role: event.target.value })}
                    >
                      {COMPANY_ROLES.map((role) => (
                        <option value={role} key={role}>{ROLE_LABELS[role]}</option>
                      ))}
                    </select>
                  </label>

                  <div className="user-access-control">
                    <span className={`access-badge ${member.is_active ? 'access-badge-active' : 'access-badge-inactive'}`}>
                      {member.is_active ? <UserCheck size={15} /> : <UserX size={15} />}
                      {member.is_active ? 'Activo' : 'Sin acceso'}
                    </span>
                    <button
                      className={member.is_active ? 'secondary-button' : 'primary-button'}
                      disabled={isUpdating || isCurrentUser}
                      onClick={() => saveAccess(member, { isActive: !member.is_active })}
                    >
                      {isUpdating ? 'Guardando…' : member.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
