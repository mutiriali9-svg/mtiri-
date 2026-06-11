import { ArrowUp, ArrowDown } from 'lucide-react';
import { useLang } from '@/lib/LanguageContext';
import { Link } from 'react-router-dom';

const accentMap = {
  navy:    { cardBg: 'bg-navy-deep', text: 'text-white', subText: 'text-white/60', valueText: 'text-white', iconBg: 'bg-gold/15', iconColor: 'text-gold', border: 'border-gold' },
  gold:    { cardBg: 'bg-card', text: 'text-foreground', subText: 'text-muted-foreground', valueText: 'text-foreground', iconBg: 'bg-gold/10', iconColor: 'text-gold', border: 'border-gold/60' },
  success: { cardBg: 'bg-card', text: 'text-foreground', subText: 'text-muted-foreground', valueText: 'text-foreground', iconBg: 'bg-success/10', iconColor: 'text-success', border: 'border-success/60' },
  urgent:  { cardBg: 'bg-card', text: 'text-foreground', subText: 'text-muted-foreground', valueText: 'text-foreground', iconBg: 'bg-destructive/10', iconColor: 'text-destructive', border: 'border-destructive/40' },
};

export default function StatCard({ title, titleEn, value, subtitle, icon: Icon, trend, trendValue, accentColor = 'navy', delay = 0, href, extra }) {
  const { lang } = useLang();
  const displayTitle = lang === 'en' && titleEn ? titleEn : title;
  const c = accentMap[accentColor] || accentMap.navy;

  const inner = (
    <>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`text-sm font-medium mb-1 ${c.subText}`}>{displayTitle}</p>
          <p className={`text-2xl font-bold tracking-tight ${c.valueText}`}>{value}</p>
          {subtitle && <p className={`text-xs mt-1 ${c.subText}`}>{subtitle}</p>}
          {extra && extra}
          {trendValue !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {trend === 'up'
                ? <ArrowUp size={12} className="text-success" />
                : <ArrowDown size={12} className="text-destructive" />}
              <span className={`text-xs font-medium ${trend === 'up' ? 'text-success' : 'text-destructive'}`}>
                {trendValue}
              </span>
            </div>
          )}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${c.iconBg}`}>
          <Icon size={22} className={c.iconColor} />
        </div>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        to={href}
        className={`card-bevel rounded-xl p-5 animate-fade-in-up border-r-4 ${c.cardBg} ${c.border} select-none block hover:opacity-90 transition-opacity cursor-pointer`}
        style={{ animationDelay: `${delay}ms` }}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div
      className={`card-bevel rounded-xl p-5 animate-fade-in-up border-r-4 ${c.cardBg} ${c.border} select-none`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {inner}
    </div>
  );
}