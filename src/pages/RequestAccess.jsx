import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Phone, AtSign, CheckCircle2, Loader2, ChevronRight } from "lucide-react";

export default function RequestAccess() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ first_name: "", last_name: "", username: "", email: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const { first_name, last_name, username, email, phone } = form;
    if (!first_name.trim() || !last_name.trim() || !username.trim() || !email.trim() || !phone.trim()) {
      setError("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    setLoading(true);
    try {
      const existing = await base44.entities.RegistrationRequest.list();
      if (existing.find(r => r.email?.toLowerCase() === email.trim().toLowerCase())) {
        setError("هذا البريد الإلكتروني مسجّل بالفعل"); setLoading(false); return;
      }
      if (existing.find(r => r.username?.toLowerCase() === username.trim().toLowerCase())) {
        setError("اسم المستخدم مستخدم بالفعل، يرجى اختيار اسم آخر"); setLoading(false); return;
      }
      await base44.entities.RegistrationRequest.create({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        username: username.trim(),
        email: email.trim(),
        phone: phone.trim(),
        status: "pending",
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || "حدث خطأ، يرجى المحاولة مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]" dir="rtl">
        <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-sm w-full mx-4">
          <button onClick={() => navigate(-1)} className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-lg transition">
            <ChevronRight className="w-5 h-5 text-foreground" />
          </button>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgba(42,157,143,0.12)' }}>
            <CheckCircle2 className="w-8 h-8" style={{ color: '#2A9D8F' }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#1B2B4B' }}>تم إرسال طلبك!</h2>
          <p className="text-muted-foreground text-sm">سيتم مراجعة طلبك من قِبل المسؤول وستُرسل لك دعوة على بريدك الإلكتروني عند القبول.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] py-10" dir="rtl">
      <button onClick={() => navigate(-1)} className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-lg transition">
        <ChevronRight className="w-5 h-5 text-foreground" />
      </button>
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md mx-4">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-3xl font-bold block mb-1" style={{ color: '#C9A84C' }}>المطيري</span>
          <h1 className="text-xl font-bold" style={{ color: '#1B2B4B' }}>طلب الوصول للنظام</h1>
          <p className="text-sm text-muted-foreground mt-1">أدخل بياناتك وسيتواصل معك المسؤول</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first_name">الاسم الأول *</Label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="first_name" placeholder="محمد" value={form.first_name} onChange={set("first_name")} className="pr-10 h-11" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">اسم العائلة *</Label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="last_name" placeholder="المطيري" value={form.last_name} onChange={set("last_name")} className="pr-10 h-11" required />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">اسم المستخدم *</Label>
            <div className="relative">
              <AtSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="username" placeholder="m.almutairi" value={form.username} onChange={set("username")} className="pr-10 h-11" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">البريد الإلكتروني *</Label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="email" type="email" placeholder="you@example.com" value={form.email} onChange={set("email")} className="pr-10 h-11" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">رقم الهاتف *</Label>
            <div className="relative">
              <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="phone" type="tel" placeholder="+971 50 000 0000" value={form.phone} onChange={set("phone")} className="pr-10 h-11" required />
            </div>
          </div>

          <Button type="submit" className="w-full h-12 font-medium mt-2" disabled={loading}
            style={{ backgroundColor: '#1B2B4B' }}>
            {loading ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />جاري الإرسال...</> : "إرسال طلب الوصول"}
          </Button>
        </form>
      </div>
    </div>
  );
}