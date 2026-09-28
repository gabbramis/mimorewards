import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSuperadmin } from '@/lib/authz';

export async function POST(request) {
    const supabase = await createClient();
    const BUSINESS_ID = "ea6ae0d6-c8db-4b15-a09d-9726f93b7119";

    try {
        if (!await isSuperadmin()) {
            return NextResponse.json({ success: false, error: "No tenés permisos para ejecutar automatizaciones." }, { status: 403 });
        }
        // 1. Fetch active rules for the business
        const { data: rules, error: rulesErr } = await supabase
            .from('automation_rules')
            .select('*')
            .eq('business_id', BUSINESS_ID)
            .eq('is_active', true);

        if (rulesErr) throw new Error(rulesErr.message);

        if (!rules || rules.length === 0) {
            return NextResponse.json({ success: true, processed: 0, message: "No hay reglas activas configuradas." });
        }

        // 2. Fetch all customers
        const { data: customers } = await supabase
            .from('customers')
            .select('*')
            .eq('business_id', BUSINESS_ID);

        if (!customers || customers.length === 0) {
            return NextResponse.json({ success: true, processed: 0, message: "No hay clientes para evaluar." });
        }

        // 3. Fetch recent logs to prevent duplicate sends (within sensible timeframes)
        const aYearAgo = new Date();
        aYearAgo.setFullYear(aYearAgo.getFullYear() - 1);
        const { data: logs } = await supabase
            .from('automation_logs')
            .select('*')
            .eq('business_id', BUSINESS_ID)
            .gte('sent_at', aYearAgo.toISOString());

        // Map logs grouped by "rule_id_customer_id"
        const sentLogsMap = {};
        if (logs) {
            logs.forEach(l => {
                const key = `${l.rule_id}_${l.customer_id}`;
                if (!sentLogsMap[key]) sentLogsMap[key] = [];
                sentLogsMap[key].push(new Date(l.sent_at));
            });
        }

        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const newLogs = []; // queue to insert

        // 4. Evaluate each rule against each customer
        for (const rule of rules) {
            for (const customer of customers) {
                let shouldTrigger = false;
                const logKey = `${rule.id}_${customer.id}`;
                const customerLogsForRule = sentLogsMap[logKey] || [];

                if (rule.rule_type === 'BIRTHDAY') {
                    if (customer.birthdate) {
                        // Check if today matches their birthday month and day
                        const [yyyy, mm, dd] = customer.birthdate.split('-');
                        const isBirthday = parseInt(mm) === (today.getMonth() + 1) && parseInt(dd) === today.getDate();

                        if (isBirthday) {
                            // Rule: 1 birthday message per year
                            const sentThisYear = customerLogsForRule.some(d => d.getFullYear() === today.getFullYear());
                            if (!sentThisYear) shouldTrigger = true;
                        }
                    }
                }
                else if (rule.rule_type === 'INACTIVE') {
                    const lastVisitStr = customer.last_visit_at;
                    if (lastVisitStr && customer.total_visits > 0) {
                        const lastVisit = new Date(lastVisitStr);
                        if (lastVisit < thirtyDaysAgo) {
                            // Rule: 1 inactivity message every 30 days maximum
                            const sentRecently = customerLogsForRule.some(d => d > thirtyDaysAgo);
                            if (!sentRecently) shouldTrigger = true;
                        }
                    }
                }
                else if (rule.rule_type === 'REWARD') {
                    if (customer.current_stamps >= 10) {
                        // Rule: 1 reward readiness message per completion (prevent spam if they don't redeem the same day)
                        // To keep it simple, we constrain to 1 message per week if they haven't redeemed.
                        const aWeekAgo = new Date();
                        aWeekAgo.setDate(aWeekAgo.getDate() - 7);
                        const sentThisWeek = customerLogsForRule.some(d => d > aWeekAgo);

                        if (!sentThisWeek) shouldTrigger = true;
                    }
                }

                if (shouldTrigger) {
                    newLogs.push({
                        business_id: BUSINESS_ID,
                        customer_id: customer.id,
                        rule_id: rule.id,
                        status: 'GENERADO' // "Generado" instead of sent since there's no real SMS gateway connected
                    });
                }
            }
        }

        // 5. Bulk insert triggered log evaluations
        if (newLogs.length > 0) {
            const { error: insertErr } = await supabase
                .from('automation_logs')
                .insert(newLogs);

            if (insertErr) {
                throw new Error(insertErr.message);
            }
        }

        return NextResponse.json({
            success: true,
            processed: newLogs.length,
            message: `Evaluación exitosa. Se generaron ${newLogs.length} mensajes automatizados.`
        });

    } catch (error) {
        console.error("Automations Engine Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
