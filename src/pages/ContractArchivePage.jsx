import { useLocation } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { ContractArchiveList } from '@/components/ContractArchive';
import { useLang } from '@/lib/LanguageContext';

export default function ContractArchivePage() {
  const { pathname } = useLocation();
  const { lang } = useLang();
  const isAr = lang === 'ar';
  const propertyType = pathname.startsWith('/re-') ? 'real_estate' : 'qarya';

  return (
    <div className="animate-fade-in-up" dir={isAr ? 'rtl' : 'ltr'}>
      <PageHeader
        titleAr="أرشيف العقود"
        titleEn="Contract Archive"
        description={isAr
          ? `كل عقد جُدِّد أو أُخلي أو انتهى يُحفظ هنا بصفحته وتفاصيله · ${propertyType === 'real_estate' ? 'العقار' : 'القرية'}`
          : `Every renewed, vacated or ended contract is kept here with its own page · ${propertyType === 'real_estate' ? 'Real Estate' : 'Qarya'}`}
      />
      <ContractArchiveList key={propertyType} propertyType={propertyType} />
    </div>
  );
}
