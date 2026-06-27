import { useState, useEffect, useRef } from 'react';
import { base44, uploadFile } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/lib/LanguageContext';
import {
  Plus, Trash2, ImagePlus, X, FileText, CheckCircle2,
  Loader2, StickyNote, ArrowRight, Image, User, Phone, Building2, Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { logActivity } from '@/utils/activityLogger';

const NOTE_TYPES = {
  ar: {
    early_exit: 'خروج مستأجر مبكر',
    tenant_in: 'دخول مستأجر',
    tenant_out: 'خروج مستأجر',
    other: 'أخرى',
  },
  en: {
    early_exit: 'Early Tenant Exit',
    tenant_in: 'Tenant Move-In',
    tenant_out: 'Tenant Move-Out',
    other: 'Other',
  },
};

const TYPE_STYLES = {
  early_exit: { color: '#E63946', bg: 'rgba(230,57,70,0.1)' },
  tenant_in:  { color: '#2A9D8F', bg: 'rgba(42,157,143,0.1)' },
  tenant_out: { color: '#C9A84C', bg: 'rgba(201,168,76,0.1)' },
  other:      { color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
};

const emptyNote = { note_type: 'other', tenant_name: '', unit_info: '', phone: '', description: '' };

function NoteRow({ icon, label, value, multiline }) {
  return (
    <div className={`flex ${multiline ? 'flex-col gap-1' : 'items-center justify-between gap-3'} py-2 border-b border-border/50 last:border-0`}>
      <span className="text-xs text-muted-foreground flex items-center gap-1.5">{icon} {label}</span>
      <span className={`text-sm font-medium text-foreground ${multiline ? 'leading-relaxed' : 'text-right'}`}>{value}</span>
    </div>
  );
}

export default function Notes() {
  const { user } = useAuth();
  const { lang } = useLang();
  const isAr = lang === 'ar';
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyNote);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [inlineError, setInlineError] = useState('');
  const fileRef = useRef();

  const canWrite = user?.role === 'admin' || user?.role === 'data_entry';
  const typeLabels = NOTE_TYPES[lang] || NOTE_TYPES.ar;

  const fetchNotes = async () => {
    setLoading(true);
    const data = await base44.entities.Note.list('-created_at', 200);
    setNotes(data);
    setLoading(false);
  };

  useEffect(() => { fetchNotes(); }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadFile(file);
      setImageUrl(result.file_url);
    } catch { /* silent */ }
    finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const openAdd = () => {
    setForm(emptyNote);
    setImageUrl('');
    setInlineError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.tenant_name?.trim()) {
      setInlineError(isAr ? '⚠️ يرجى إدخال اسم المستأجر' : '⚠️ Tenant name is required');
      setTimeout(() => setInlineError(''), 3000);
      return;
    }
    setSaving(true);
    const noteData = {
      ...form,
      image_url: imageUrl,
      created_by_name: user?.full_name || user?.username || '',
    };
    const created = await base44.entities.Note.create(noteData);
    await logActivity('Note', 'create', `${form.tenant_name} - ${typeLabels[form.note_type]}`, null, noteData, `إضافة ملاحظة: ${form.tenant_name}`, user);
    setSaving(false);
    setDialogOpen(false);
    fetchNotes();
  };

  const confirmDeleteNote = async () => {
    const noteToDelete = notes.find(n => n.id === confirmDelete);
    await base44.entities.Note.delete(confirmDelete);
    await logActivity('Note', 'delete', `${noteToDelete?.tenant_name || 'Unknown'}`, noteToDelete, null, `حذف ملاحظة: ${noteToDelete?.tenant_name}`, user);
    setConfirmDelete(null);
    setSelectedNote(null);
    fetchNotes();
  };

  return (
    <div className="space-y-5 animate-fade-in-up" dir={isAr ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
          <ArrowRight size={18} />
        </button>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(168,178,192,0.15)' }}>
          <StickyNote size={20} style={{ color: '#A8B2C0' }} />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ color: '#1B2B4B' }}>{isAr ? 'الملاحظات' : 'Notes'}</h1>
          <p className="text-xs text-muted-foreground">{notes.length} {isAr ? 'ملاحظة' : 'notes'}</p>
        </div>
        {canWrite && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: '#1B2B4B' }}
          >
            <Plus size={16} />{isAr ? 'إضافة ملاحظة' : 'Add Note'}
          </button>
        )}
      </div>

      {/* Summary Bar */}
      <div className="rounded-xl p-4 flex items-center justify-between" style={{ backgroundColor: '#1B2B4B' }}>
        <div>
          <p className="text-white/60 text-xs">{isAr ? 'إجمالي الملاحظات' : 'Total Notes'}</p>
          <p className="text-2xl font-bold" style={{ color: '#A8B2C0' }}>{notes.length}</p>
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(168,178,192,0.15)' }}>
          <StickyNote size={24} style={{ color: '#A8B2C0' }} />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white card-bevel rounded-xl p-4">
              <div className="h-4 bg-muted rounded animate-pulse mb-2 w-1/3" />
              <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
            </div>
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="bg-white card-bevel rounded-xl p-12 text-center">
          <StickyNote size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-muted-foreground text-sm">{isAr ? 'لا توجد ملاحظات بعد' : 'No notes yet'}</p>
          {canWrite && (
            <button onClick={openAdd} className="mt-4 px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#1B2B4B' }}>
              {isAr ? 'أضف أول ملاحظة' : 'Add First Note'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(note => {
            const ts = TYPE_STYLES[note.note_type] || TYPE_STYLES.other;
            return (
              <div
                key={note.id}
                onClick={() => setSelectedNote(note)}
                className="bg-white card-bevel rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow active:bg-muted/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: ts.bg, color: ts.color }}>
                        {typeLabels[note.note_type] || note.note_type}
                      </span>
                      {note.created_by_name && (
                        <span className="text-[11px] text-muted-foreground">{note.created_by_name}</span>
                      )}
                    </div>
                    <p className="font-bold text-sm" style={{ color: '#1B2B4B' }}>{note.tenant_name}</p>
                    {note.unit_info && <p className="text-xs text-muted-foreground mt-0.5">{note.unit_info}</p>}
                    {note.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{note.description}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {note.image_url && (
                      <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(168,178,192,0.2)' }}>
                        <Image size={12} style={{ color: '#A8B2C0' }} />
                      </span>
                    )}
                    {note.created_at && (
                      <p className="text-[11px] text-muted-foreground">{new Date(note.created_at).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedNote && (() => {
        const ts = TYPE_STYLES[selectedNote.note_type] || TYPE_STYLES.other;
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={() => setSelectedNote(null)}>
            <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-border" dir={isAr ? 'rtl' : 'ltr'}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(168,178,192,0.15)' }}>
                    <StickyNote size={18} style={{ color: '#A8B2C0' }} />
                  </div>
                  <span className="font-bold text-base" style={{ color: '#1B2B4B' }}>{isAr ? 'تفاصيل الملاحظة' : 'Note Details'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {user?.role === 'admin' && (
                    <button onClick={() => setConfirmDelete(selectedNote.id)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-red-50 text-red-400 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  )}
                  <button onClick={() => setSelectedNote(null)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
                    <X size={16} className="text-muted-foreground" />
                  </button>
                </div>
              </div>
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto" dir={isAr ? 'rtl' : 'ltr'}>
                <div className="rounded-xl p-3 text-center" style={{ backgroundColor: ts.bg }}>
                  <span className="font-bold text-sm" style={{ color: ts.color }}>
                    {typeLabels[selectedNote.note_type] || selectedNote.note_type}
                  </span>
                </div>
                <div className="space-y-1">
                  {selectedNote.tenant_name && <NoteRow icon={<User size={14}/>} label={isAr ? 'اسم المستأجر' : 'Tenant'} value={selectedNote.tenant_name} />}
                  {selectedNote.unit_info && <NoteRow icon={<Building2 size={14}/>} label={isAr ? 'الشقة / العقار' : 'Unit / Property'} value={selectedNote.unit_info} />}
                  {selectedNote.phone && <NoteRow icon={<Phone size={14}/>} label={isAr ? 'رقم الهاتف' : 'Phone'} value={selectedNote.phone} />}
                  {selectedNote.description && <NoteRow icon={<FileText size={14}/>} label={isAr ? 'الشرح' : 'Description'} value={selectedNote.description} multiline />}
                  {selectedNote.created_by_name && <NoteRow icon={<User size={14}/>} label={isAr ? 'أضافه' : 'Added by'} value={selectedNote.created_by_name} />}
                  {selectedNote.created_at && <NoteRow icon={<Calendar size={14}/>} label={isAr ? 'التاريخ' : 'Date'} value={new Date(selectedNote.created_at).toLocaleDateString()} />}
                </div>
                {selectedNote.image_url && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">{isAr ? 'الصورة المرفقة' : 'Attached Image'}</p>
                    <div className="rounded-xl overflow-hidden border border-border">
                      <img src={selectedNote.image_url} alt="note" className="w-full object-contain max-h-72" />
                    </div>
                    <a href={selectedNote.image_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold"
                      style={{ backgroundColor: 'rgba(168,178,192,0.12)', color: '#A8B2C0' }}>
                      <Image size={15} />{isAr ? 'فتح الصورة' : 'Open Image'}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center gap-5">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
              <Trash2 size={24} style={{ color: '#E63946' }} />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold" style={{ color: '#1B2B4B' }}>{isAr ? 'حذف الملاحظة' : 'Delete Note'}</h2>
              <p className="text-sm text-muted-foreground mt-1">{isAr ? 'لا يمكن التراجع عن هذا الإجراء' : 'This action cannot be undone'}</p>
            </div>
            <div className="flex gap-3 w-full">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl border font-semibold text-sm hover:bg-secondary" style={{ color: '#1B2B4B' }}>
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={confirmDeleteNote} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ backgroundColor: '#E63946' }}>
                {isAr ? 'حذف' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={() => setDialogOpen(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border" dir={isAr ? 'rtl' : 'ltr'}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(168,178,192,0.15)' }}>
                  <StickyNote size={18} style={{ color: '#A8B2C0' }} />
                </div>
                <span className="font-bold text-base" style={{ color: '#1B2B4B' }}>{isAr ? 'إضافة ملاحظة' : 'Add Note'}</span>
              </div>
              <button onClick={() => setDialogOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto" dir={isAr ? 'rtl' : 'ltr'}>
              {/* Note Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground block">{isAr ? 'نوع الملاحظة' : 'Note Type'}</label>
                <select
                  value={form.note_type}
                  onChange={e => setForm(p => ({ ...p, note_type: e.target.value }))}
                  className="w-full h-9 border border-input rounded-md text-sm px-3 focus:outline-none focus:ring-1 bg-white"
                  dir={isAr ? 'rtl' : 'ltr'}
                >
                  {Object.entries(typeLabels).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Tenant Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground block">{isAr ? 'اسم المستأجر *' : 'Tenant Name *'}</label>
                <input
                  value={form.tenant_name}
                  onChange={e => setForm(p => ({ ...p, tenant_name: e.target.value }))}
                  className="w-full h-9 border border-input rounded-md text-sm px-3 focus:outline-none focus:ring-1"
                  placeholder={isAr ? 'اسم المستأجر' : 'Tenant name'}
                />
              </div>

              {/* Unit */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground block">{isAr ? 'شقة رقم أو اسم العقار' : 'Unit / Property'}</label>
                <input
                  value={form.unit_info}
                  onChange={e => setForm(p => ({ ...p, unit_info: e.target.value }))}
                  className="w-full h-9 border border-input rounded-md text-sm px-3 focus:outline-none focus:ring-1"
                  placeholder={isAr ? 'مثال: شقة 5 — القرية' : 'e.g. Unit 5 — Qarya'}
                />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground block">{isAr ? 'رقم الهاتف' : 'Phone Number'}</label>
                <input
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full h-9 border border-input rounded-md text-sm px-3 focus:outline-none focus:ring-1"
                  placeholder="+971 5X XXX XXXX"
                  type="tel"
                  dir="ltr"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground block">{isAr ? 'شرح الملاحظة' : 'Description'}</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full border border-input rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-1 resize-none"
                  rows={4}
                  placeholder={isAr ? 'اكتب التفاصيل هنا...' : 'Write details here...'}
                />
              </div>

              {/* Image */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground block">{isAr ? 'صورة مرفقة (اختياري)' : 'Attached Image (optional)'}</label>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                {imageUrl ? (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <img src={imageUrl} alt="preview" className="w-full max-h-48 object-contain p-2 bg-muted" />
                    <div className="flex items-center justify-between px-3 py-2 bg-green-50 border-t border-green-100">
                      <span className="flex items-center gap-1.5 text-xs text-green-700"><CheckCircle2 size={13} />{isAr ? 'تم رفع الصورة' : 'Image uploaded'}</span>
                      <button onClick={() => { setImageUrl(''); if (fileRef.current) fileRef.current.value = ''; }} className="text-xs text-red-500 flex items-center gap-1">
                        <X size={12} />{isAr ? 'حذف' : 'Remove'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-5 text-sm text-muted-foreground hover:border-[#A8B2C0] hover:bg-[#A8B2C0]/5 transition-colors disabled:opacity-60"
                  >
                    {uploading
                      ? <><Loader2 size={20} className="animate-spin" style={{ color: '#A8B2C0' }} /><span>{isAr ? 'جاري الرفع...' : 'Uploading...'}</span></>
                      : <><ImagePlus size={20} style={{ color: '#A8B2C0' }} /><span>{isAr ? 'اضغط لرفع صورة' : 'Tap to upload image'}</span></>
                    }
                  </button>
                )}
              </div>

              {inlineError && (
                <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium animate-fade-in-up"
                  style={{ backgroundColor: 'rgba(230,57,70,0.08)', color: '#E63946', border: '1px solid rgba(230,57,70,0.2)' }}>
                  {inlineError}
                </div>
              )}
            </div>

            <div className="px-5 pb-6 flex gap-3" dir={isAr ? 'rtl' : 'ltr'}>
              <button onClick={() => setDialogOpen(false)} className="flex-1 py-3 rounded-xl border font-semibold text-sm hover:bg-secondary" style={{ color: '#1B2B4B' }}>
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || uploading}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-colors"
                style={{ backgroundColor: '#1B2B4B', opacity: (saving || uploading) ? 0.7 : 1 }}
              >
                {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ الملاحظة' : 'Save Note')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}