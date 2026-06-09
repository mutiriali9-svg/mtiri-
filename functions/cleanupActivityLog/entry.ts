import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Calculate cutoff date: 35 days ago
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 35);
        const cutoffStr = cutoff.toISOString();

        // Fetch all old activity logs
        const oldLogs = await base44.asServiceRole.entities.ActivityLog.filter(
            { created_date: { $lt: cutoffStr } },
            '-created_date',
            500
        );

        if (!oldLogs || oldLogs.length === 0) {
            return Response.json({ deleted: 0, message: 'No old logs to delete' });
        }

        // Delete each old log
        let deleted = 0;
        for (const log of oldLogs) {
            await base44.asServiceRole.entities.ActivityLog.delete(log.id);
            deleted++;
        }

        return Response.json({ deleted, message: `Deleted ${deleted} activity log(s) older than 35 days` });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});