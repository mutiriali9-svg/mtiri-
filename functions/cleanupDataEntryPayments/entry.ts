import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Calculate cutoff: 35 days ago
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 35);
        const cutoffStr = cutoff.toISOString().split('T')[0];

        // Get all users with data_entry role
        const allUsers = await base44.asServiceRole.entities.User.list();
        const dataEntryUsers = allUsers.filter(u => u.role === 'data_entry').map(u => u.id);

        if (dataEntryUsers.length === 0) {
            return Response.json({ deleted: 0, message: 'No data entry users found' });
        }

        // Get all payments
        const allPayments = await base44.asServiceRole.entities.Payment.list('-payment_date', 500);

        // Filter: created by data_entry user AND payment_date older than 35 days
        const toDelete = allPayments.filter(p =>
            dataEntryUsers.includes(p.created_by_id) &&
            p.payment_date &&
            p.payment_date < cutoffStr
        );

        let deleted = 0;
        for (const p of toDelete) {
            await base44.asServiceRole.entities.Payment.delete(p.id);
            deleted++;
        }

        return Response.json({ deleted, message: `Deleted ${deleted} old data-entry payment(s)` });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});