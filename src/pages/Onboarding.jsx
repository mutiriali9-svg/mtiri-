import { useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '../lib/supabase'; // المسار الصحيح للملف الذي أنشأته

export default function Onboarding() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    
    // الحصول على البيانات من الفورم
    const formData = new FormData(e.target);
    
    // جلب بيانات المستخدم الحالي من سوبابيس
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // تحديث بيانات البروفايل في قاعدة البيانات
      const { error } = await supabase.from('profiles').update({
        first_name: formData.get('first_name'),
        last_name: formData.get('last_name'),
        nickname: formData.get('nickname'),
        city: formData.get('city'),
        country: formData.get('country'),
        is_onboarded: true, // تغيير الحالة ليتمكن من الدخول للموقع
      }).eq('id', user.id);

      if (!error) {
        // التوجيه إلى لوحة التحكم بعد الحفظ
        router.push('/Dashboard'); 
      } else {
        alert('حدث خطأ أثناء الحفظ، حاول مرة أخرى');
      }
    }
    setLoading(false);
  }

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">أكمل بياناتك الشخصية</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm mt-4">
        <input name="first_name" placeholder="الاسم الأول" required className="border p-2" />
        <input name="last_name" placeholder="الاسم الأخير" required className="border p-2" />
        <input name="nickname" placeholder="الاسم المستعار" required className="border p-2" />
        <input name="city" placeholder="المدينة" required className="border p-2" />
        <input name="country" placeholder="الدولة" required className="border p-2" />
        <button 
          type="submit" 
          disabled={loading} 
          className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition"
        >
          {loading ? 'جاري الحفظ...' : 'حفظ البيانات'}
        </button>
      </form>
    </div>
  );
}