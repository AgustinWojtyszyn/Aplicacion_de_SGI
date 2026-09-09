import { FileText, LayoutDashboard, LogOut, Menu, ShieldCheck, UsersRound, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const baseNavigation = [
  { to: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { to: '/documents', label: 'Documentos', icon: FileText },
]

function initials(name, email) {
  const source = name?.trim() || email?.split('@')[0] || 'SF'
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { profile, company, role, signOut } = useAuth()

  const navigation = useMemo(() => (
    role === 'admin'
      ? [...baseNavigation, { to: '/users', label: 'Usuarios', icon: UsersRound }]
      : baseNavigation
  ), [role])

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">
            <ShieldCheck size={24} />
          </div>
          <div>
            <strong>SF Higiene</strong>
            <span>Gestión documental</span>
          </div>
          <button className="icon-button sidebar-close" onClick={closeMenu} aria-label="Cerrar menú">
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          <span className="nav-section-label">PLATAFORMA</span>
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={closeMenu}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="avatar">{initials(profile?.full_name, profile?.email)}</div>
          <div className="sidebar-user-copy">
            <strong>{profile?.full_name || profile?.email || 'Usuario'}</strong>
            <span>{role === 'admin' ? 'Administrador' : role === 'responsible' ? 'Responsable' : 'Miembro'}</span>
          </div>
          <button className="icon-button" onClick={signOut} title="Cerrar sesión" aria-label="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {menuOpen && <button className="sidebar-backdrop" onClick={closeMenu} aria-label="Cerrar menú" />}

      <div className="app-main">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">
            <Menu size={22} />
          </button>
          <div>
            <span className="topbar-kicker">ESPACIO DE TRABAJO</span>
            <strong>{company?.name || 'SF Higiene'}</strong>
          </div>
          <div className="stage-pill">Etapa 1</div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
