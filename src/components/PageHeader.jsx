import { useLang } from '@/lib/LanguageContext';

export default function PageHeader({ titleAr, titleEn, description, actions }) {
  const { lang } = useLang();
  const title = lang === 'ar' ? titleAr : titleEn;
  return (
    <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1B2B4B' }}>{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}