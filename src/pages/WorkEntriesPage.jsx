import {
  Banknote,
  BriefcaseBusiness,
  Clock3,
  Download,
  History,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  calculateWorkTotals,
  createWorkEntry,
  deleteWorkEntry,
  downloadWorkEntriesExcel,
  listWorkEntries,
  listWorkEntryActivity,
  updateWorkEntry,
} from '../services/workService'

function localDateInput(date = new Date()) {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return copy.toISOString().slice(0, 10)
}

const emptyForm = () => ({
  workDate: localDateInput(),
  location: '',
  description: '',
  hours: '',
  cost: '0',
  amount: '0',
})

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function formatMoney(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 2,
  }).format(Number(value) || 0)
}

function formatHours(value) {
  const number = Number(value) || 0
  return `${number.toLocaleString('es-AR', { maximumFractionDigits: 2 })} h`
}

function activityLabel(action) {
  if (action === 'created') return 'Creó el trabajo'
  if (action === 'updated') return 'Actualizó el trabajo'
  if (action === 'deleted') return 'Eliminó el trabajo'
  return action
}

function canManageEntry({ role, userId, entry }) {
  return role === 'admin' || role === 'responsible' || entry.created_by === userId
}

export default function WorkEntriesPage() {
  const { company, user, role } = useAuth()
  const [entries, setEntries] = useState([])
  const [activity, setActivity] = useState([])
  const [filters, setFilters] = useState({ search: '', dateFrom: '', dateTo: '' })
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    if (!company?.id) return
    setLoading(true)
    setError('')
    try {
      const [nextEntries, nextActivity] = await Promise.all([
        listWorkEntries({ companyId: company.id, ...filters }),
        listWorkEntryActivity({ companyId: company.id, limit: 30 }),
      ])
      setEntries(nextEntries)
      setActivity(nextActivity)
    } catch (loadError) {
      console.error(loadError)
      setError(loadError.message || 'No se pudieron cargar los trabajos diarios.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, filters.search, filters.dateFrom, filters.dateTo])

  const totals = useMemo(() => calculateWorkTotals(entries), [entries])

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setError('')
    setNotice('')
    setFormOpen(true)
  }

  function openEdit(entry) {
    setEditingId(entry.id)
    setForm({
      workDate: entry.work_date,
      location: entry.location,
      description: entry.description || '',
      hours: String(entry.hours ?? ''),
      cost: String(entry.cost ?? 0),
      amount: String(entry.amount ?? 0),
    })
    setError('')
    setNotice('')
    setFormOpen(true)
  }

  function closeForm() {
    if (saving) return
    setFormOpen(false)
    setEditingId(null)
    setForm(emptyForm())
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!company?.id) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (editingId) {
        await updateWorkEntry({ workEntryId: editingId, values: form })
        setNotice('Trabajo actualizado correctamente.')
      } else {
        await createWorkEntry({ companyId: company.id, values: form })
        setNotice('Trabajo cargado correctamente.')
      }
      setFormOpen(false)
      setEditingId(null)
      setForm(emptyForm())
      await load()
    } catch (saveError) {
      console.error(saveError)
      setError(saveError.message || 'No se pudo guardar el trabajo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(entry) {
    const confirmed = window.confirm(`¿Eliminar el trabajo de ${entry.location} del ${formatDate(entry.work_date)}? Esta acción quedará registrada en la auditoría.`)
    if (!confirmed) return
    setError('')
    setNotice('')
    try {
      await deleteWorkEntry(entry.id)
      setNotice('Trabajo eliminado. La acción quedó registrada en el historial.')
      await load()
    } catch (deleteError) {
      console.error(deleteError)
      setError(deleteError.message || 'No se pudo eliminar el trabajo.')
    }
  }

  function handleExport() {
    setError('')
    try {
      downloadWorkEntriesExcel(entries, company?.name || 'Empresa')
    } catch (exportError) {
      setError(exportError.message)
    }
  }

  const statCards = [
    { label: 'Trabajos', value: totals.count, detail: 'registros visibles', icon: BriefcaseBusiness },
    { label: 'Horas', value: formatHours(totals.hours), detail: 'cargadas en el período', icon: Clock3 },
    { label: 'Costos', value: formatMoney(totals.cost), detail: 'costos acumulados', icon: Banknote },
    { label: 'Monto', value: formatMoney(totals.amount), detail: `resultado ${formatMoney(totals.margin)}`, icon: TrendingUp },
  ]

  return (
    <section className="page-stack work-page">
      <header className="page-heading work-heading">
        <div>
          <p className="eyebrow">OPERACIÓN DIARIA</p>
          <h1>Trabajos diarios</h1>
          <p>Registrá fecha, ubicación, horas y valores. Cada alta, cambio o eliminación queda auditada.</p>
        </div>
        <div className="work-heading-actions">
          <button className="secondary-button" onClick={handleExport} disabled={!entries.length}>
            <Download size={17} /> Exportar Excel
          </button>
          <button className="primary-button" onClick={openCreate}>
            <Plus size={18} /> Nuevo trabajo
          </button>
        </div>
      </header>

      {error && <div className="page-error" role="alert">{error}</div>}
      {notice && <div className="page-success" role="status">{notice}</div>}

      <div className="work-stats-grid">
        {statCards.map(({ label, value, detail, icon: Icon }) => (
          <article className="work-stat-card" key={label}>
            <div className="work-stat-icon"><Icon size={19} /></div>
            <div><span>{label}</span><strong>{loading ? '—' : value}</strong><small>{detail}</small></div>
          </article>
        ))}
      </div>

      <div className="work-toolbar">
        <label className="search-box work-search">
          <Search size={17} />
          <input
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Buscar por ubicación o detalle…"
          />
        </label>
        <label className="work-filter-field"><span>Desde</span><input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
        <label className="work-filter-field"><span>Hasta</span><input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} /></label>
        <button className="icon-button toolbar-refresh" onClick={load} aria-label="Actualizar trabajos" title="Actualizar"><RefreshCw size={18} /></button>
      </div>

      <div className="work-layout">
        <section className="work-surface">
          <div className="work-surface-heading">
            <div><strong>{loading ? 'Cargando…' : `${entries.length} trabajo${entries.length === 1 ? '' : 's'}`}</strong><span>Los filtros también se aplican a la exportación.</span></div>
          </div>

          {loading ? (
            <div className="documents-loading"><span className="loader-dot" /><p>Cargando trabajos…</p></div>
          ) : entries.length === 0 ? (
            <div className="documents-empty work-empty">
              <div className="empty-icon"><BriefcaseBusiness size={25} /></div>
              <strong>No hay trabajos para mostrar</strong>
              <p>{filters.search || filters.dateFrom || filters.dateTo ? 'Probá cambiando los filtros.' : 'Cargá el primer trabajo para empezar a registrar la operación.'}</p>
              {!filters.search && !filters.dateFrom && !filters.dateTo && <button className="primary-button" onClick={openCreate}>Cargar primer trabajo</button>}
            </div>
          ) : (
            <div className="work-table-wrap">
              <table className="work-table">
                <thead><tr><th>Fecha</th><th>Ubicación / detalle</th><th>Horas</th><th>Costo</th><th>Monto</th><th>Resultado</th><th>Cargado por</th><th aria-label="Acciones" /></tr></thead>
                <tbody>
                  {entries.map((entry) => {
                    const result = (Number(entry.amount) || 0) - (Number(entry.cost) || 0)
                    const canManage = canManageEntry({ role, userId: user?.id, entry })
                    return (
                      <tr key={entry.id}>
                        <td data-label="Fecha">{formatDate(entry.work_date)}</td>
                        <td data-label="Trabajo"><div className="work-main-cell"><MapPin size={16} /><div><strong>{entry.location}</strong><span>{entry.description || 'Sin detalle adicional'}</span></div></div></td>
                        <td data-label="Horas">{formatHours(entry.hours)}</td>
                        <td data-label="Costo">{formatMoney(entry.cost)}</td>
                        <td data-label="Monto">{formatMoney(entry.amount)}</td>
                        <td data-label="Resultado"><span className={result < 0 ? 'work-result negative' : 'work-result'}>{formatMoney(result)}</span></td>
                        <td data-label="Cargado por">{entry.creator?.full_name || entry.creator?.email || 'Usuario'}</td>
                        <td className="work-row-actions">
                          {canManage ? <>
                            <button className="icon-button table-action" onClick={() => openEdit(entry)} aria-label={`Editar trabajo de ${entry.location}`} title="Editar"><Pencil size={16} /></button>
                            <button className="icon-button table-action danger-action" onClick={() => handleDelete(entry)} aria-label={`Eliminar trabajo de ${entry.location}`} title="Eliminar"><Trash2 size={16} /></button>
                          </> : <span className="work-readonly">Solo lectura</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="work-audit-card">
          <div className="work-audit-heading"><div><History size={18} /><span>AUDITORÍA</span></div><strong>Actividad reciente</strong></div>
          <div className="work-audit-list">
            {activity.length === 0 ? <p className="work-audit-empty">Todavía no hay movimientos registrados.</p> : activity.map((item) => {
              const snapshot = item.entry_snapshot || {}
              return (
                <article className="work-audit-item" key={item.id}>
                  <span className={`work-audit-dot ${item.action}`} />
                  <div>
                    <strong>{activityLabel(item.action)}</strong>
                    <span>{snapshot.location || 'Trabajo'} · {snapshot.work_date ? formatDate(snapshot.work_date) : 'sin fecha'}</span>
                    <small>{item.actor?.full_name || item.actor?.email || 'Sistema'} · {formatDateTime(item.created_at)}</small>
                  </div>
                </article>
              )
            })}
          </div>
        </aside>
      </div>

      {formOpen && (
        <div className="work-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}>
          <form className="work-modal" onSubmit={handleSubmit}>
            <div className="work-modal-heading">
              <div><span>{editingId ? 'EDITAR REGISTRO' : 'NUEVO REGISTRO'}</span><h2>{editingId ? 'Actualizar trabajo' : 'Cargar trabajo diario'}</h2></div>
              <button type="button" className="icon-button" onClick={closeForm} aria-label="Cerrar formulario"><X size={19} /></button>
            </div>

            <div className="work-form-grid">
              <label className="field"><span>Fecha *</span><input type="date" required value={form.workDate} onChange={(event) => updateForm('workDate', event.target.value)} /></label>
              <label className="field"><span>Ubicación *</span><input required maxLength={160} value={form.location} onChange={(event) => updateForm('location', event.target.value)} placeholder="Ej. Planta Norte" /></label>
              <label className="field"><span>Horas *</span><input type="number" required min="0.01" max="24" step="0.01" value={form.hours} onChange={(event) => updateForm('hours', event.target.value)} placeholder="8" /></label>
              <label className="field"><span>Costo</span><input type="number" min="0" step="0.01" value={form.cost} onChange={(event) => updateForm('cost', event.target.value)} /></label>
              <label className="field"><span>Monto</span><input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => updateForm('amount', event.target.value)} /></label>
              <label className="field work-description-field"><span>Detalle</span><textarea maxLength={2000} rows={4} value={form.description} onChange={(event) => updateForm('description', event.target.value)} placeholder="Qué se realizó, observaciones, alcance…" /></label>
            </div>

            <div className="work-modal-footer">
              <button type="button" className="secondary-button" onClick={closeForm} disabled={saving}>Cancelar</button>
              <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear trabajo'}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
