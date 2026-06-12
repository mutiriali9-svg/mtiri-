const checkUserAuth = async () => {
  try {
    setIsLoadingAuth(true);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw { status: 401 };
    
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();
    
    if (profile) {
      setUser(profile);
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(true);
      setUser({ id: authUser.id, email: authUser.email, role: null });
    }
    setAuthChecked(true);
  } catch (error) {
    setIsAuthenticated(false);
    setAuthChecked(true);
    if (error.status === 401 || error.status === 403) {
      setAuthError({ type: 'auth_required', message: 'Authentication required' });
    }
  } finally {
    setIsLoadingAuth(false);
  }
};