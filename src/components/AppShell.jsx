import { BellRing, FileText, LayoutDashboard, LogOut, Menu, ShieldCheck, UsersRound, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canManageUsers, roleLabel } from '../lib/permissions'

const baseNavigation = [
  { to: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { to: '/sgi', label: 'SGI / ISO', icon: ShieldCheck },
  { to: '/documents', label: 'Documentos', icon: FileText },
  { to: '/notifications', label: 'Alertas', icon: BellRing },
]
function initials(name, email) { const source = name?.trim() || email?.split('@')[0] || 'SF'; return source.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') }

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { profile, company, role, signOut } = useAuth()
  const navigation = useMemo(() => canManageUsers(role) ? [...baseNavigation, { to: '/users', label: 'Usuarios', icon: UsersRound }] : baseNavigation, [role])
  const closeMenu = () => setMenuOpen(false)
  return <div className="app-shell"><aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}><div className="sidebar-brand"><div className="sidebar-brand-mark"><ShieldCheck size={24} /></div><div><strong>SF Higiene</strong><span>Sistema de Gestión Integrado</span></div><button className="icon-button sidebar-close" onClick={closeMenu}><X size={20} /></button></div><nav className="sidebar-nav"><span className="nav-section-label">PLATAFORMA</span>{navigation.map(({to,label,icon:Icon}) => <NavLink key={to} to={to} onClick={closeMenu} className={({isActive}) => `nav-link ${isActive ? 'nav-link-active' : ''}`}><Icon size={19} /><span>{label}</span></NavLink>)}</nav><div className="sidebar-user"><div className="avatar">{initials(profile?.full_name, profile?.email)}</div><div className="sidebar-user-copy"><strong>{profile?.full_name || profile?.email || 'Usuario'}</strong><span>{roleLabel(role)}</span></div><button className="icon-button" onClick={signOut}><LogOut size={18} /></button></div></aside>{menuOpen && <button className="sidebar-backdrop" onClick={closeMenu} />}<div className="app-main"><header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)}><Menu size={22} /></button><div><span className="topbar-kicker">ESPACIO DE TRABAJO</span><strong>{company?.name || 'SF Higiene'}</strong></div><div className="stage-pill">Etapa 2</div></header><main className="page-content"><Outlet /></main></div></div>
}
