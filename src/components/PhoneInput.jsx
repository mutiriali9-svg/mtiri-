import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useLang } from '@/lib/LanguageContext';
import { normalizeE164, isValidE164, phoneExampleFor, phoneInvalidText } from '@/utils/phone';

export default function PhoneInput({ value, onChange, className = '', placeholder, disabled, id }) {
  const { lang } = useLang();
  const isAr = lang === 'ar';
  const [touched, setTouched] = useState(false);

  const raw = value || '';
  const invalid = touched && raw.trim() !== '' && !isValidE164(raw);

  const handleBlur = () => {
    setTouched(true);
    const e164 = normalizeE164(raw);
    if (e164 && e164 !== raw) onChange(e164);
  };

  return (
    <>
      <Input
        id={id}
        type="tel"
        dir="ltr"
        inputMode="tel"
        autoComplete="tel"
        disabled={disabled}
        value={raw}
        onChange={e => onChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder || phoneExampleFor()}
        className={`text-base sm:text-sm ${invalid ? 'border-destructive' : ''} ${className}`}
      />
      {invalid && (
        <p className="text-[11px] text-destructive">{phoneInvalidText(isAr)}</p>
      )}
    </>
  );
}
