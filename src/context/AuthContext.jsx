import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { requireSupabase, supabaseConfigured } from '../lib/supabase'

const AuthContext = createContext(null)

async function loadWorkspace(user) {
  const supabase = requireSupabase()

  // The very first authenticated user can safely bootstrap the initial SF Higiene admin.
  // Once a member exists, the RPC returns false and never grants access automatically.
  await supabase.rpc('bootstrap_sf_higiene_admin')

  const [{ data: profile, error: profileError }, { data: membership, error: membershipError }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('company_members')
        .select('role, is_active, company:companies(id, name, slug)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle(),
    ])

  if (profileError) throw profileError
  if (membershipError) throw membershipError

  let modules = []
  if (membership?.company?.id) {
    const { data, error } = await supabase
      .from('modules')
      .select('id, name, code, description')
      .eq('company_id', membership.company.id)
      .eq('is_active', true)
      .order('name')

    if (error) throw error
    modules = data ?? []
  }

  return {
    profile,
    membership: membership
      ? {
          role: membership.role,
          isActive: membership.is_active,
          company: membership.company,
        }
      : null,
    modules,
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [membership, setMembership] = useState(null)
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [workspaceError, setWorkspaceError] = useState('')

  const hydrate = useCallback(async (nextSession) => {
    setSession(nextSession)
    setWorkspaceError('')

    if (!nextSession?.user) {
      setProfile(null)
      setMembership(null)
      setModules([])
      setLoading(false)
      return
    }

    try {
      const workspace = await loadWorkspace(nextSession.user)
      setProfile(workspace.profile)
      setMembership(workspace.membership)
      setModules(workspace.modules)
    } catch (error) {
      console.error('Failed to load SGI workspace', error)
      setWorkspaceError(error.message || 'No se pudo cargar el espacio de trabajo.')
      setProfile(null)
      setMembership(null)
      setModules([])
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

  const signIn = useCallback(async ({ email, password }) => {
    const supabase = requireSupabase()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
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
      company: membership?.company ?? null,
      role: membership?.role ?? null,
      modules,
      loading,
      workspaceError,
      configured: supabaseConfigured,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      refreshWorkspace,
    }),
    [
      session,
      profile,
      membership,
      modules,
      loading,
      workspaceError,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      refreshWorkspace,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
