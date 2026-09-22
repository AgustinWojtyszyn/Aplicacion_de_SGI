import {
  BellRing,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  UsersRound,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canManageCompanies, canManageUsers, roleLabel } from '../lib/permissions'
import BrandLogo from './BrandLogo'

function initials(name, email) {
  const source = name?.trim() || email?.split('@')[0] || 'EP'
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

function NavigationGroup({ label, icon: Icon, items, onNavigate }) {
  const location = useLocation()
  const isActive = items.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))
  const [open, setOpen] = useState(isActive)

  useEffect(() => {
    if (isActive) setOpen(true)
  }, [isActive])

  return (
    <div className={`nav-group ${isActive ? 'nav-group-active' : ''}`}>
      <button
        type="button"
        className="nav-group-button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <Icon size={19} />
        <span>{label}</span>
        <ChevronDown size={16} className={`nav-group-chevron ${open ? 'open' : ''}`} />
      </button>
      {open && (
        <div className="nav-group-links">
          {items.map(({ to, label: itemLabel, icon: ItemIcon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={({ isActive: linkActive }) => `nav-link nav-sub-link ${linkActive ? 'nav-link-active' : ''}`}
            >
              <ItemIcon size={17} />
              <span>{itemLabel}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [switchingCompany, setSwitchingCompany] = useState(false)
  const { profile, company, companies, role, isPlatformAdmin, switchCompany, signOut } = useAuth()

  const navigationGroups = useMemo(() => {
    const groups = [
      {
        label: 'Operación',
        icon: BriefcaseBusiness,
        items: [
          { to: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
          { to: '/work', label: 'Trabajos', icon: BriefcaseBusiness },
        ],
      },
      {
        label: 'Gestión SGI',
        icon: ShieldCheck,
        items: [
          { to: '/sgi', label: 'SGI / ISO', icon: ShieldCheck },
          { to: '/documents', label: 'Documentos', icon: FileText },
          { to: '/notifications', label: 'Alertas', icon: BellRing },
        ],
      },
    ]

    const adminItems = []
    if (canManageUsers(role)) {
      adminItems.push({ to: '/users', label: 'Usuarios', icon: UsersRound })
      adminItems.push({ to: '/history', label: 'Historial', icon: History })
    }
    if (canManageCompanies({ role, isPlatformAdmin })) adminItems.push({ to: '/companies', label: 'Empresas', icon: Building2 })
    if (adminItems.length) groups.push({ label: 'Administración', icon: Settings2, items: adminItems })

    return groups
  }, [role, isPlatformAdmin])

  const closeMenu = () => setMenuOpen(false)

  async function handleCompanyChange(event) {
    const companyId = event.target.value
    if (!companyId || companyId === company?.id) return
    setSwitchingCompany(true)
    try {
      await switchCompany(companyId)
    } catch (error) {
      console.error(error)
    } finally {
      setSwitchingCompany(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <BrandLogo light className="sidebar-logo" />
          <button className="icon-button sidebar-close" onClick={closeMenu} aria-label="Cerrar menú"><X size={20} /></button>
        </div>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          <span className="nav-section-label">PLATAFORMA</span>
          {navigationGroups.map((group) => (
            <NavigationGroup key={group.label} {...group} onNavigate={closeMenu} />
          ))}
        </nav>

        <div className="sidebar-user">
          <NavLink to="/profile" onClick={closeMenu} className={({ isActive }) => `sidebar-profile-link ${isActive ? 'sidebar-profile-link-active' : ''}`}>
            <div className="avatar">{initials(profile?.full_name, profile?.email)}</div>
            <div className="sidebar-user-copy">
              <strong>{profile?.full_name || profile?.email || 'Usuario'}</strong>
              <span>{isPlatformAdmin ? 'Administrador global' : roleLabel(role)} · Mi perfil</span>
            </div>
          </NavLink>
          <button className="icon-button" onClick={signOut} aria-label="Cerrar sesión"><LogOut size={18} /></button>
        </div>
      </aside>

      {menuOpen && <button className="sidebar-backdrop" onClick={closeMenu} aria-label="Cerrar menú" />}

      <div className="app-main">
        <header className="topbar tenant-topbar">
          <button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu size={22} /></button>
          <div className="workspace-title">
            <span className="topbar-kicker">ESPACIO DE TRABAJO</span>
            <strong>{company?.name || 'Gestión integrada'}</strong>
          </div>

          {isPlatformAdmin && companies.length > 0 ? (
            <label className="company-switcher">
              <Building2 size={16} />
              <span>{switchingCompany ? 'Cambiando…' : 'Empresa'}</span>
              <select value={company?.id || ''} onChange={handleCompanyChange} disabled={switchingCompany} aria-label="Cambiar empresa activa">
                {companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          ) : (
            <div className="stage-pill">ISO 9001 · 14001 · 45001</div>
          )}
        </header>
        <main className="page-content"><Outlet /></main>
      </div>
    </div>
  )
}
