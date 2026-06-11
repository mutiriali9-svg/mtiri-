import { useEffect } from "react";
import { supabase } from "@/api/base44Client";

export default function AuthCallback() {
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        window.location.href = "/Dashboard";
      } else {
        window.location.href = "/login";
      }
    };
    checkSession();
  }, []);

  return (
    <div className="flex items-center justify-center h-screen">
      <p>جاري تسجيل الدخول...</p>
    </div>
  );
}