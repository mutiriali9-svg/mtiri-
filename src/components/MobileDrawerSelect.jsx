import { useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import { Check, ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Detect mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

/**
 * Drop-in replacement for shadcn Select that renders as a bottom-sheet Drawer on mobile.
 *
 * Props:
 *   value, onValueChange, placeholder, className, triggerClassName
 *   options: [{ value: string, label: string }]
 *   children: (optional) SelectItem elements — if provided, parsed for options display
 */
export default function MobileDrawerSelect({
  value,
  onValueChange,
  placeholder,
  options = [],
  triggerClassName = '',
  disabled = false,
  dir = 'rtl',
  children,
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  // If children passed (SelectItem), build options list from them
  const items = options.length > 0 ? options : [];

  const selectedLabel = items.find(o => o.value === value)?.label || placeholder || '';

  if (!isMobile) {
    // Desktop: render standard shadcn Select
    return (
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Mobile: vaul Drawer bottom sheet
  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <button
          disabled={disabled}
          className={`flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${triggerClassName}`}
          dir={dir}
        >
          <span className={value ? '' : 'text-muted-foreground'}>
            {selectedLabel || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        </button>
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/40" />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-[61] flex flex-col rounded-t-2xl bg-card font-cairo"
          dir={dir}
          style={{ maxHeight: '70vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Drag handle */}
          <div className="mx-auto mt-3 mb-2 h-1.5 w-10 rounded-full bg-muted-foreground/30 flex-shrink-0" />

          {/* Options list */}
          <div className="overflow-y-auto flex-1 px-4 pb-4">
            {items.map(o => {
              const isSelected = o.value === value;
              return (
                <button
                  key={o.value}
                  onClick={() => { onValueChange(o.value); setOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium transition-colors my-1 ${
                    isSelected
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <span>{o.label}</span>
                  {isSelected && <Check size={16} className="text-primary flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}