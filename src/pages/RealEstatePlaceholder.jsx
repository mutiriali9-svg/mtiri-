import { Home } from 'lucide-react';
import { useLang } from '@/lib/LanguageContext';

export default function RealEstatePlaceholder({ title }) {
  const { lang } = useLang();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)' }}>
        <Home size={32} style={{ color: '#C9A84C' }} />
      </div>
      <h2 className="text-2xl font-bold" style={{ color: '#1B2B4B' }}>{title}</h2>
      <p className="text-muted-foreground text-sm max-w-xs">
        {lang === 'ar' ? 'هذا القسم فارغ حالياً، سيتم إضافة البيانات لاحقاً.' : 'This section is empty. Data will be added soon.'}
      </p>
    </div>
  );
}