import { createClient } from '@supabase/supabase-js';

const APP_URL = 'https://www.mteiri-bm.com';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;


export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'madari-session',
  }
});

const makeEntity = (tableName) => ({
  list: async (sortOrFilters = {}, limit = 1000) => {
    let query = supabase.from(tableName).select('*');
    if (typeof sortOrFilters === 'string') {
      const ascending = !sortOrFilters.startsWith('-');
      const column = sortOrFilters.replace(/^-/, '');
      query = query.order(column, { ascending });
    } else if (typeof sortOrFilters === 'object') {
      Object.entries(sortOrFilters).forEach(([k, v]) => {
        if (v != null) query = query.eq(k, v);
      });
      query = query.order('created_at', { ascending: false });
    }
    query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  get: async (id) => {
    const { data, error } = await supabase.from(tableName).select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },
  create: async (record) => {
    const { data, error } = await supabase.from(tableName).insert(record).select().single();
    if (error) throw error;
    return data;
  },
  update: async (id, record) => {
    const { data, error } = await supabase.from(tableName).update(record).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  delete: async (id) => {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },
  filter: async (filters) => {
    let query = supabase.from(tableName).select('*');
    Object.entries(filters).forEach(([k, v]) => {
      if (v != null) query = query.eq(k, v);
    });
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const uploadFile = async (file) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const { error } = await supabase.storage.from('mtiri').upload(fileName, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('mtiri').getPublicUrl(fileName);
  return { file_url: publicUrl };
};
export const base44 = {
  auth: {
    me: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) throw { status: 401, message: 'Not authenticated' };
      const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();
      return profile || { id: user.id, email: user.email };
    },
    loginViaEmailPassword: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },
    logout: async () => {
  await supabase.auth.signOut();
  window.location.reload();
  setTimeout(() => {
    window.location.href = '/login';
  }, 500);
},
    redirectToLogin: () => {
      window.location.href = '/login';
    },
  },
  entities: {
    User: makeEntity('users'),
    Unit: makeEntity('units_masked'),
    Payment: makeEntity('payments'),
    Investor: makeEntity('investors'),
    Expense: makeEntity('expenses'),
    Saving: makeEntity('savings'),
    ActivityLog: makeEntity('activity_log'),
    PaymentAlert: makeEntity('payment_alerts'),
    PendingEntry: makeEntity('pending_entries'),
    RegistrationRequest: makeEntity('registration_requests'),
    ReUnit: makeEntity('re_units'),
    RePayment: makeEntity('re_payments'),
    ReInvestor: makeEntity('re_investors'),
    ReExpense: makeEntity('re_expenses'),
    Notification: makeEntity('notifications'),
  },
  functions: {
    invoke: async (name, data) => {
      const { data: result, error } = await supabase.functions.invoke(name, { body: data });
      if (error) throw error;
      return result;
    },
  },
  integrations: {
    Core: {
      UploadFile: async ({ file }) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error } = await supabase.storage.from('mtiri').upload(fileName, file, { cacheControl: '3600', upsert: false });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('mtiri').getPublicUrl(fileName);
        return { file_url: publicUrl };
      }
    }
  },
};

export default base44;