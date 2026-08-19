async function protectPage(requiredRole) {
    if (typeof supabaseClient === "undefined") {
      window.location.href = "../index.html";
      return null;
    }
  
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
  
    if (sessionError || !sessionData.session) {
      window.location.href = "../index.html";
      return null;
    }
  
    const user = sessionData.session.user;
  
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role, account_status")
      .eq("id", user.id)
      .single();
  
    if (profileError || !profile) {
      await supabaseClient.auth.signOut();
      window.location.href = "../index.html";
      return null;
    }
  
    if (profile.role !== requiredRole) {
      window.location.href = "../index.html";
      return null;
    }
  
    if (requiredRole === "company" && profile.account_status !== "approved") {
      await supabaseClient.auth.signOut();
      window.location.href = "../index.html";
      return null;
    }
  
    return profile;
  }