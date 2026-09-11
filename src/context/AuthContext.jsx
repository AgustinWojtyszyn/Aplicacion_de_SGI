import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { requireSupabase, supabaseConfigured } from '../lib/supabase'
import { readSelectedCompany, rememberSelectedCompany } from '../services/tenantService'

const AuthContext = createContext(null)

async function loadModules(companyId) {
  if (!companyId) return []
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('modules')
    .select('id, name, code, description')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return data ?? []
}

async function loadWorkspace(user) {
  const supabase = requireSupabase()
  const preferredCompany = readSelectedCompany()

  const [profileResult, membershipsResult, adminResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('company_members')
      .select('role, is_active, company:companies(id, name, slug, is_active)')
      .eq('user_id', user.id)
      .eq('is_active', true),
    supabase.rpc('is_platform_admin'),
  ])

  if (profileResult.error) throw profileResult.error
  if (membershipsResult.error) throw membershipsResult.error
  if (adminResult.error) throw adminResult.error

  const isPlatformAdmin = Boolean(adminResult.data)
  const memberships = (membershipsResult.data ?? []).filter((item) => item.company?.is_active !== false)

  let companies = memberships.map((item) => item.company).filter(Boolean)
  if (isPlatformAdmin) {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, slug, is_active')
      .eq('is_active', true)
      .order('name')
    if (error) throw error
    companies = data ?? []
  }

  const preferredMatch = preferredCompany?.slug
    ? companies.find((item) => item.slug === preferredCompany.slug)
    : null
  const selectedCompany = preferredMatch ?? companies[0] ?? null
  const selectedMembership = selectedCompany
    ? memberships.find((item) => item.company?.id === selectedCompany.id)
    : null

  let workspaceError = ''
  if (!isPlatformAdmin && preferredCompany?.slug && !preferredMatch) {
    workspaceError = `Tu cuenta no está habilitada para ${preferredCompany.name || 'la empresa seleccionada'}. Volvé al acceso inicial y elegí tu empresa.`
  }

  const membership = selectedCompany
    ? isPlatformAdmin
      ? { role: 'admin', isActive: true, company: selectedCompany }
      : selectedMembership
        ? { role: selectedMembership.role, isActive: selectedMembership.is_active, company: selectedCompany }
        : null
    : null

  const modules = selectedCompany ? await loadModules(selectedCompany.id) : []

  return {
    profile: profileResult.data,
    membership,
    company: selectedCompany,
    companies,
    modules,
    isPlatformAdmin,
    workspaceError,
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [membership, setMembership] = useState(null)
  const [company, setCompany] = useState(null)
  const [companies, setCompanies] = useState([])
  const [modules, setModules] = useState([])
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [preferredCompany, setPreferredCompany] = useState(() => readSelectedCompany())
  const [loading, setLoading] = useState(true)
  const [workspaceError, setWorkspaceError] = useState('')

  const hydrate = useCallback(async (nextSession) => {
    setSession(nextSession)
    setWorkspaceError('')

    if (!nextSession?.user) {
      setProfile(null)
      setMembership(null)
      setCompany(null)
      setCompanies([])
      setModules([])
      setIsPlatformAdmin(false)
      setLoading(false)
      return
    }

    try {
      const workspace = await loadWorkspace(nextSession.user)
      setProfile(workspace.profile)
      setMembership(workspace.membership)
      setCompany(workspace.company)
      setCompanies(workspace.companies)
      setModules(workspace.modules)
      setIsPlatformAdmin(workspace.isPlatformAdmin)
      setWorkspaceError(workspace.workspaceError)
      setPreferredCompany(readSelectedCompany())
    } catch (error) {
      console.error('Failed to load EP Consultora workspace', error)
      setWorkspaceError(error.message || 'No se pudo cargar el espacio de trabajo.')
      setProfile(null)
      setMembership(null)
      setCompany(null)
      setCompanies([])
      setModules([])
      setIsPlatformAdmin(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false)
      return undefined
    }

    const supabase = requireSupabase()
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) hydrate(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setLoading(true)
        hydrate(nextSession)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [hydrate])

  const signIn = useCallback(async ({ email, password, company: selectedCompany }) => {
    if (!selectedCompany?.slug) throw new Error('Seleccioná una empresa antes de ingresar.')
    rememberSelectedCompany(selectedCompany)
    setPreferredCompany(selectedCompany)

    const supabase = requireSupabase()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }, [])

  const signUp = useCallback(async ({ fullName, email, password, company: selectedCompany }) => {
    const cleanName = fullName.trim()
    const cleanEmail = email.trim().toLowerCase()

    if (!selectedCompany?.slug) throw new Error('Seleccioná una empresa antes de registrarte.')
    if (cleanName.length < 2) throw new Error('Ingresá tu nombre completo.')
    if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.')

    rememberSelectedCompany(selectedCompany)
    setPreferredCompany(selectedCompany)

    const supabase = requireSupabase()
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanName,
          company_slug: selectedCompany.slug,
        },
        emailRedirectTo: `${window.location.origin}/login/${selectedCompany.slug}`,
      },
    })

    if (error) throw error
    return data
  }, [])

  const signOut = useCallback(async () => {
    const supabase = requireSupabase()
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const requestPasswordReset = useCallback(async (email) => {
    const supabase = requireSupabase()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/set-password`,
    })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password) => {
    const supabase = requireSupabase()
    const { data, error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    return data
  }, [])

  const switchCompany = useCallback(async (companyId) => {
    if (!isPlatformAdmin) throw new Error('Solo un administrador global puede cambiar de empresa.')
    const nextCompany = companies.find((item) => item.id === companyId)
    if (!nextCompany) throw new Error('Empresa no disponible.')

    setLoading(true)
    setWorkspaceError('')
    try {
      const nextModules = await loadModules(nextCompany.id)
      rememberSelectedCompany(nextCompany)
      setPreferredCompany(nextCompany)
      setCompany(nextCompany)
      setMembership({ role: 'admin', isActive: true, company: nextCompany })
      setModules(nextModules)
    } finally {
      setLoading(false)
    }
  }, [companies, isPlatformAdmin])

  const refreshWorkspace = useCallback(async () => {
    if (!session?.user) return
    setLoading(true)
    await hydrate(session)
  }, [hydrate, session])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      membership,
      company,
      companies,
      modules,
      role: membership?.role ?? null,
      isPlatformAdmin,
      preferredCompany,
      configured: supabaseConfigured,
      loading,
      workspaceError,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      switchCompany,
      refreshWorkspace,
    }),
    [
      session,
      profile,
      membership,
      company,
      companies,
      modules,
      isPlatformAdmin,
      preferredCompany,
      loading,
      workspaceError,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      switchCompany,
      refreshWorkspace,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider.')
  return context
}
