import { AlertTriangle, RefreshCw, Search, ShieldCheck, Trash2, UserCheck, UserPlus, UsersRound, UserX } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  COMPANY_ROLES,
  deleteUserCompletely,
  inviteCompanyUser,
  listAllCompanyUsers,
  listCompanyUsers,
  ROLE_LABELS,
  updateCompanyUserAccess,
} from '../services/userService'

function personName(membership) {
  return membership.user?.full_name || membership.user?.email || 'Usuario'
}

function formatDate(value) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(value))
}

function membershipKey(member) {
  return `${member.company_id}:${member.user_id}`
}

export default function UsersPage() {
  const { company, user, isPlatformAdmin } = useAuth()
  const [members, setMembers] = useState([])
  const [scope, setScope] = useState('company')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState('')
  const [deletingUserId, setDeletingUserId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteValues, setInviteValues] = useState({ fullName: '', email: '', role: 'member' })

  const visibleMembers = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return members
    return members.filter((member) => [
      member.user?.full_name,
      member.user?.email,
      member.company?.name,
      ROLE_LABELS[member.role],
    ].some((value) => value?.toLowerCase().includes(term)))
  }, [members, search])

  const uniqueUsers = useMemo(() => new Set(members.map((member) => member.user_id)).size, [members])
  const activeCount = useMemo(() => members.filter((member) => member.is_active).length, [members])
  const adminCount = useMemo(
    () => members.filter((member) => member.role === 'admin' && member.is_active).length,
    [members],
  )

  async function load() {
    if (!company?.id) return
    setLoading(true)
    setError('')
    try {
      if (scope === 'all' && isPlatformAdmin) {
        setMembers(await listAllCompanyUsers())
      } else {
        setMembers(await listCompanyUsers(company.id))
      }
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
  }, [company?.id, scope, isPlatformAdmin])

  useEffect(() => {
    if (!isPlatformAdmin && scope !== 'company') setScope('company')
  }, [isPlatformAdmin, scope])

  async function handleInvite(event) {
    event.preventDefault()
    setInviting(true)
    setError('')
    setNotice('')
    try {
      const invitedEmail = inviteValues.email.trim().toLowerCase()
      await inviteCompanyUser({ companyId: company.id, ...inviteValues })
      setInviteValues({ fullName: '', email: '', role: 'member' })
      setInviteOpen(false)
      setNotice(`Invitación enviada a ${invitedEmail} para ${company.name}.`)
      await load()
    } catch (inviteError) {
      console.error(inviteError)
      setError(inviteError.message || 'No se pudo enviar la invitación.')
    } finally {
      setInviting(false)
    }
  }

  async function saveAccess(member, changes) {
    const targetCompanyId = member.company_id || company.id
    const key = membershipKey({ ...member, company_id: targetCompanyId })
    setUpdatingId(key)
    setError('')
    setNotice('')
    try {
      const updated = await updateCompanyUserAccess({
        companyId: targetCompanyId,
        userId: member.user_id,
        role: changes.role ?? member.role,
        isActive: changes.isActive ?? member.is_active,
      })
      setMembers((current) => current.map((item) => (
        membershipKey(item) === membershipKey(updated) ? updated : item
      )))
      setNotice(`Acceso actualizado para ${personName(updated)} en ${updated.company?.name || company.name}.`)
    } catch (saveError) {
      console.error(saveError)
      setError(saveError.message || 'No se pudo actualizar el acceso.')
    } finally {
      setUpdatingId('')
    }
  }

  async function confirmDeleteUser() {
    if (!deleteTarget) return

    const targetId = deleteTarget.user_id
    const targetCompanyId = deleteTarget.company_id || company.id
    const targetEmail = deleteTarget.user?.email || personName(deleteTarget)

    setDeletingUserId(targetId)
    setError('')
    setNotice('')

    try {
      await deleteUserCompletely({ userId: targetId, companyId: targetCompanyId })
      setMembers((current) => current.filter((member) => member.user_id !== targetId))
      setDeleteTarget(null)
      setNotice(`Cuenta eliminada por completo: ${targetEmail}. Ese correo puede volver a utilizarse para una cuenta nueva.`)
    } catch (deleteError) {
      console.error(deleteError)
      setError(deleteError.message || 'No se pudo eliminar la cuenta.')
    } finally {
      setDeletingUserId('')
    }
  }

  return (
    <section className="page-stack users-page">
      <header className="page-heading users-heading">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN</p>
          <h1>Gestión de usuarios</h1>
          <p>
            {scope === 'all'
              ? 'Administración global de usuarios y accesos por empresa.'
              : `Roles y acceso al espacio de trabajo de ${company?.name || 'la empresa seleccionada'}.`}
          </p>
        </div>
        <div className="users-heading-actions">
          <button className="secondary-button" onClick={load} disabled={loading}>
            <RefreshCw size={17} /> Actualizar
          </button>
          <button className="primary-button" onClick={() => setInviteOpen((open) => !open)}>
            <UserPlus size={17} /> Invitar a {company?.name || 'empresa'}
          </button>
        </div>
      </header>

      <section className="users-control-section" aria-labelledby="users-scope-title">
        <div className="users-section-title">
          <div>
            <span>ALCANCE</span>
            <h2 id="users-scope-title">Qué usuarios querés administrar</h2>
          </div>
          {isPlatformAdmin && (
            <div className="users-scope-switch" role="group" aria-label="Alcance de usuarios">
              <button type="button" className={scope === 'company' ? 'active' : ''} onClick={() => setScope('company')}>Empresa actual</button>
              <button type="button" className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>Todas las empresas</button>
            </div>
          )}
        </div>
        <label className="users-search">
          <Search size={17} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, correo, empresa o rol"
          />
        </label>
      </section>

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
              {COMPANY_ROLES.map((itemRole) => <option key={itemRole} value={itemRole}>{ROLE_LABELS[itemRole]}</option>)}
            </select>
          </label>
          <button className="primary-button invite-submit" disabled={inviting}>
            {inviting ? 'Enviando…' : 'Enviar invitación'}
          </button>
        </form>
      )}

      <section aria-labelledby="users-summary-title">
        <div className="users-section-title users-summary-heading">
          <div><span>RESUMEN</span><h2 id="users-summary-title">Estado de accesos</h2></div>
        </div>
        <div className="users-stats">
          <div className="user-stat-card">
            <UsersRound size={20} />
            <div><strong>{uniqueUsers}</strong><span>usuarios</span></div>
          </div>
          <div className="user-stat-card">
            <UserCheck size={20} />
            <div><strong>{activeCount}</strong><span>accesos activos</span></div>
          </div>
          <div className="user-stat-card">
            <ShieldCheck size={20} />
            <div><strong>{adminCount}</strong><span>accesos administradores</span></div>
          </div>
        </div>
      </section>

      {error && <div className="page-error" role="alert">{error}</div>}
      {notice && <div className="page-success" role="status">{notice}</div>}

      <section className="users-surface" aria-labelledby="users-list-title">
        <div className="users-surface-heading">
          <div>
            <strong id="users-list-title">{scope === 'all' ? 'Todos los accesos de la plataforma' : 'Accesos de la empresa'}</strong>
            <span>{visibleMembers.length} resultado{visibleMembers.length === 1 ? '' : 's'}. Los cambios se aplican inmediatamente.</span>
          </div>
        </div>

        {loading ? (
          <div className="users-loading"><span className="loader-dot" /><p>Cargando usuarios…</p></div>
        ) : visibleMembers.length === 0 ? (
          <div className="users-empty">No hay usuarios que coincidan con la búsqueda.</div>
        ) : (
          <div className="users-list">
            {visibleMembers.map((member) => {
              const isCurrentUser = member.user_id === user?.id
              const isUpdating = updatingId === membershipKey(member)
              const isDeleting = deletingUserId === member.user_id
              return (
                <article className={`user-row ${member.is_active ? '' : 'user-row-inactive'}`} key={membershipKey(member)}>
                  <div className="user-identity">
                    <div className="user-avatar">{personName(member).slice(0, 2).toUpperCase()}</div>
                    <div>
                      <strong>{personName(member)}</strong>
                      <span>{member.user?.email}</span>
                      <small>
                        {scope === 'all' && member.company?.name ? `${member.company.name} · ` : ''}
                        Alta: {formatDate(member.user?.created_at)}
                        {isCurrentUser ? ' · Tu cuenta' : ''}
                      </small>
                    </div>
                  </div>

                  <label className="user-role-field">
                    <span>Rol</span>
                    <select
                      value={member.role}
                      disabled={isUpdating || isDeleting || isCurrentUser}
                      onChange={(event) => saveAccess(member, { role: event.target.value })}
                    >
                      {COMPANY_ROLES.map((itemRole) => (
                        <option value={itemRole} key={itemRole}>{ROLE_LABELS[itemRole]}</option>
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
                      disabled={isUpdating || isDeleting || isCurrentUser}
                      onClick={() => saveAccess(member, { isActive: !member.is_active })}
                    >
                      {isUpdating ? 'Guardando…' : member.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    {!isCurrentUser && (
                      <button
                        type="button"
                        className="danger-button user-delete-button"
                        disabled={isUpdating || isDeleting}
                        onClick={() => {
                          setError('')
                          setNotice('')
                          setDeleteTarget(member)
                        }}
                      >
                        <Trash2 size={16} /> {isDeleting ? 'Eliminando…' : 'Eliminar'}
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {deleteTarget && (
        <div className="delete-user-backdrop" role="presentation" onMouseDown={() => !deletingUserId && setDeleteTarget(null)}>
          <div
            className="delete-user-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="delete-user-icon"><AlertTriangle size={24} /></div>
            <div className="delete-user-copy">
              <p className="eyebrow">ACCIÓN IRREVERSIBLE</p>
              <h2 id="delete-user-title">Eliminar cuenta por completo</h2>
              <p>
                Vas a eliminar a <strong>{personName(deleteTarget)}</strong>
                {deleteTarget.user?.email ? <> ({deleteTarget.user.email})</> : null}.
              </p>
              <p>
                La cuenta dejará de existir y, una vez completada la eliminación, ese mismo correo podrá volver a utilizarse para crear o invitar una cuenta nueva.
              </p>
            </div>
            <div className="delete-user-actions">
              <button type="button" className="secondary-button" disabled={Boolean(deletingUserId)} onClick={() => setDeleteTarget(null)}>
                Cancelar
              </button>
              <button type="button" className="danger-button" disabled={Boolean(deletingUserId)} onClick={confirmDeleteUser}>
                <Trash2 size={17} /> {deletingUserId ? 'Eliminando…' : 'Eliminar por completo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
