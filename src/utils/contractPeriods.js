const NAIVE_TS = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

const toDate = (ts) => {
  const s = String(ts || '').trim();
  return new Date(NAIVE_TS.test(s) ? `${s.replace(' ', 'T')}Z` : s);
};

const timeOf = (ts) => toDate(ts).getTime();

const pad2 = (n) => String(n).padStart(2, '0');

export const localDay = (ts) => {
  const d = toDate(ts);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const happenedBy = (day, createdAt, archivedAt) => {
  const end = localDay(archivedAt);
  if (day !== end) return day < end;
  const t = timeOf(createdAt);
  return Number.isNaN(t) || t <= timeOf(archivedAt);
};

const dayFor = (item, dayOf, createdOf) => String(dayOf(item) || '').slice(0, 10) || localDay(createdOf(item));

const oldestFirst = (archives) => [...archives].sort((a, b) => timeOf(a.created_at) - timeOf(b.created_at));

export const contractPeriods = (archives) => {
  const order = oldestFirst(archives);
  return Object.fromEntries(order.map((a, i) => [a.id, {
    from: i > 0 ? localDay(order[i - 1].created_at) : null,
    to: localDay(a.created_at),
  }]));
};

export const splitByContract = (archives, items, dayOf, createdOf) => {
  const order = oldestFirst(archives);
  const out = Object.fromEntries(order.map(a => [a.id, []]));
  for (const item of items) {
    const day = dayFor(item, dayOf, createdOf);
    if (!day) continue;
    const hit = order.find(a => happenedBy(day, createdOf(item), a.created_at));
    if (hit) out[hit.id].push(item);
  }
  return out;
};

export const currentContractItems = (archives, items, dayOf, createdOf) => {
  const last = archives.reduce((best, a) => (!best || timeOf(a.created_at) > timeOf(best.created_at) ? a : best), null);
  if (!last) return items;
  return items.filter(item => {
    const day = dayFor(item, dayOf, createdOf);
    return !day || !happenedBy(day, createdOf(item), last.created_at);
  });
};

const EXIT_REASONS = new Set(['vacate', 'tenant_change', 'expiry']);
const nameKey = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

export const ARREARS_NOTE = 'سداد متأخرات عقد مؤرشف';
const EXIT_PAYMENT_NOTES = ['محسوم من التأمين', ARREARS_NOTE];
const noteOf = (p) => String(p?.notes || '').trim();

export const isArrearsPayment = (p) => noteOf(p).startsWith(ARREARS_NOTE);
export const exitPaymentName = (p) => (EXIT_PAYMENT_NOTES.some(n => noteOf(p).startsWith(n)) ? p.tenant_name : '');
export const isOtherTenantsExitPayment = (p, tenant) => !!exitPaymentName(p) && nameKey(p.tenant_name) !== nameKey(tenant);

export const splitWithCarryOver = (archives, items, dayOf, createdOf, nameOf, currentTenant) => {
  const byArchive = splitByContract(archives, items, dayOf, createdOf);
  let current = currentContractItems(archives, items, dayOf, createdOf);
  const carried = Object.fromEntries(archives.map(a => [a.id, []]));
  if (!nameOf) return { byArchive, current, carried };
  const order = oldestFirst(archives);
  const tenantAt = (k) => nameKey(k < order.length ? order[k].tenant_name : currentTenant);
  const keep = (k, list) => list.filter(x => {
    const who = nameKey(nameOf(x));
    if (!who || who === tenantAt(k)) return true;
    for (let j = k - 1; j >= 0; j -= 1) {
      if (EXIT_REASONS.has(order[j].reason) && nameKey(order[j].tenant_name) === who) {
        carried[order[j].id].push(x);
        return false;
      }
    }
    return true;
  });
  order.forEach((a, k) => { if (k > 0) byArchive[a.id] = keep(k, byArchive[a.id]); });
  current = keep(order.length, current);
  order.forEach(a => { byArchive[a.id] = [...byArchive[a.id], ...carried[a.id]]; });
  return { byArchive, current, carried };
};
