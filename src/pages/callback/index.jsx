import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/api/base44Client';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/login'); return; }

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (!profile) {
        navigate('/complete-profile');
      } else if (profile.role === 'pending') {
        navigate('/pending-approval');
      } else {
        navigate('/');
      }
    };
    handleCallback();
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: '#0E1A30' }}>
      <div className="flex flex-col items-center gap-4">
        <span className="text-4xl font-bold" style={{ color: '#C9A84C', fontFamily: 'Cairo' }}>المطيري</span>
        <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'rgba(201,168,76,0.3)', borderTopColor: '#C9A84C' }} />
      </div>
    </div>
  );
}
