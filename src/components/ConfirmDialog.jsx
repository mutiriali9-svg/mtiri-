import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { useLang } from '@/lib/LanguageContext';

/**
 * مربع حوار تأكيد الحذف الموحد
 * الاستخدام:
 *   const [confirm, setConfirm] = useState(null);
 *   <ConfirmDialog open={!!confirm} message={confirm?.message} onConfirm={() => { confirm?.onConfirm(); setConfirm(null); }} onCancel={() => setConfirm(null)} />
 *   setConfirm({ message: 'هل تريد حذف...؟', onConfirm: () => doDelete() });
 */
export default function ConfirmDialog({ open, message, onConfirm, onCancel }) {
  const { lang } = useLang();
  const isAr = lang === 'ar';
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="flex flex-col items-center gap-5 p-6">
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(230,57,70,0.1)' }}>
            <AlertTriangle size={26} style={{ color: '#E63946' }} />
          </div>
          <div className="text-center space-y-1.5">
            <h3 className="text-lg font-bold" style={{ color: '#1B2B4B' }}>{isAr ? 'تأكيد الحذف' : 'Confirm Deletion'}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {message || (isAr ? 'هل أنت متأكد من الحذف؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this? This action cannot be undone.')}
            </p>
          </div>
          <div className="flex gap-3 w-full">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              {isAr ? 'لا، تراجع' : 'No, Cancel'}
            </Button>
            <Button onClick={onConfirm} className="flex-1 bg-red-500 hover:bg-red-600 text-white">
              {isAr ? 'نعم، احذف' : 'Yes, Delete'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}