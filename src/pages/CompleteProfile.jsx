import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function CompleteProfile() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', username: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.full_name.trim() || !form.username.trim() || !form.phone.trim()) {
      setError('يرجى تعبئة جميع الحقول');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // أضفه في registration_requests
      await supabase.from('registration_requests').insert({
        first_name: form.full_name.split(' ')[0],
        last_name: form.full_name.split(' ').slice(1).join(' ') || '-',
        username: form.username,
        email: user.email,
        phone: form.phone,
        status: 'pending',
        role: 'data_entry',
      });

      // أضفه في users بدون role
      await supabase.from('users').upsert({
        id: user.id,
        email: user.email,
        full_name: form.full_name,
        role: 'pending',
      });

      navigate('/pending-approval');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F8F9FA' }}>
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold" style={{ color: '#1B2B4B' }}>أكمل بياناتك</h1>
          <p className="text-sm text-muted-foreground">يرجى تعبئة البيانات التالية لإكمال التسجيل</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm text-center">{error}</div>
        )}

        <div className="space-y-4" dir="rtl">
          <div className="space-y-1.5">
            <Label>الاسم الكامل</Label>
            <Input placeholder="علي محمد" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>اسم المستخدم</Label>
            <Input placeholder="ali123" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>رقم الهاتف</Label>
            <Input placeholder="05xxxxxxxx" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={saving} className="w-full h-12" style={{ backgroundColor: '#1B2B4B' }}>
          {saving ? 'جاري الإرسال...' : 'إرسال الطلب'}
        </Button>
      </div>
    </div>
  );
}
