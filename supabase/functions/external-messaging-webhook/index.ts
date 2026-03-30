import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log('External webhook received:', JSON.stringify(payload));

    const { event } = payload;

    // ===== MESSAGE STATUS UPDATE =====
    if (event === 'message_status') {
      const { message_id, reference_id, status, error: errorMsg } = payload;

      if (!message_id && !reference_id) {
        return new Response(
          JSON.stringify({ error: 'message_id or reference_id required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updateData: Record<string, unknown> = { status };
      if (errorMsg) updateData.error_message = errorMsg;
      if (status === 'sent' || status === 'delivered') updateData.sent_at = new Date().toISOString();

      let query = supabase.from('message_log').update(updateData);
      if (message_id) {
        query = query.eq('external_message_id', message_id);
      } else if (reference_id) {
        query = query.eq('id', reference_id);
      }

      const { error } = await query;
      if (error) console.error('Error updating message log:', error);

      return new Response(
        JSON.stringify({ success: true, action: 'status_updated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== CUSTOMER REPLY =====
    if (event === 'customer_reply') {
      const { phone, message, timestamp } = payload;
      console.log(`Customer reply from ${phone}: ${message}`);
      return new Response(
        JSON.stringify({ success: true, action: 'reply_received' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== SYNC CUSTOMER DATA (external → dashboard) =====
    if (event === 'sync_customer') {
      const { phone, name, email, document } = payload;

      if (!phone) {
        return new Response(
          JSON.stringify({ error: 'phone is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const normPhone = phone.replace(/\D/g, '');
      const phoneLast8 = normPhone.slice(-8);

      const { data: existing } = await supabase
        .from('customers')
        .select('id, normalized_phone')
        .filter('normalized_phone', 'like', `%${phoneLast8}`)
        .limit(1)
        .maybeSingle();

      if (existing) {
        const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (name) updateFields.name = name;
        if (email) updateFields.email = email;
        if (document) updateFields.document = document;

        await supabase.from('customers').update(updateFields).eq('id', existing.id);
      } else {
        await supabase.from('customers').insert({
          normalized_phone: normPhone,
          display_phone: phone,
          name: name || null,
          email: email || null,
          document: document || null,
        });
      }

      return new Response(
        JSON.stringify({ success: true, action: 'customer_synced' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== SYNC TRANSACTION DATA (external → dashboard) =====
    if (event === 'sync_transaction') {
      const { external_id, amount, type, status: txStatus, customer_name, customer_email, customer_phone, customer_document, description, paid_at, metadata } = payload;

      if (!amount || !type) {
        return new Response(
          JSON.stringify({ error: 'amount and type are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const normPhone = customer_phone ? customer_phone.replace(/\D/g, '') : null;

      if (external_id) {
        const { data: existing } = await supabase
          .from('transactions')
          .select('id')
          .eq('external_id', external_id)
          .maybeSingle();

        if (existing) {
          const updateFields: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };
          if (txStatus) updateFields.status = txStatus;
          if (customer_name) updateFields.customer_name = customer_name;
          if (customer_email) updateFields.customer_email = customer_email;
          if (customer_phone) updateFields.customer_phone = customer_phone;
          if (normPhone) updateFields.normalized_phone = normPhone;
          if (paid_at) updateFields.paid_at = paid_at;
          if (metadata) updateFields.metadata = metadata;

          await supabase.from('transactions').update(updateFields).eq('id', existing.id);

          return new Response(
            JSON.stringify({ success: true, action: 'transaction_updated', id: existing.id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const { data: newTx, error: insertError } = await supabase
        .from('transactions')
        .insert({
          external_id: external_id || null,
          amount,
          type,
          status: txStatus || 'pendente',
          customer_name: customer_name || null,
          customer_email: customer_email || null,
          customer_phone: customer_phone || null,
          customer_document: customer_document || null,
          normalized_phone: normPhone,
          description: description || null,
          paid_at: paid_at || null,
          metadata: metadata || null,
          webhook_source: 'external_api',
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error inserting transaction:', insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Trigger auto-recovery for PIX/Card pending transactions
      if (newTx?.id && (type === 'pix' || type === 'cartao') && (txStatus === 'pendente' || !txStatus)) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/auto-recovery`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ type: 'pix_card', transactionId: newTx.id })
          });
          console.log('Auto-recovery triggered for PIX/Card transaction:', newTx.id);
        } catch (e) {
          console.error('Failed to trigger auto-recovery:', e);
        }
      }

      return new Response(
        JSON.stringify({ success: true, action: 'transaction_created', id: newTx?.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== TRANSACTION WEBHOOK (from POST /api/platform/transactions/webhook) =====
    if (event === 'transaction_webhook') {
      const { external_id, status: txStatus, paid_at } = payload;

      if (!external_id) {
        return new Response(
          JSON.stringify({ error: 'external_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (txStatus) updateFields.status = txStatus;
      if (paid_at) updateFields.paid_at = paid_at;

      const { error } = await supabase
        .from('transactions')
        .update(updateFields)
        .eq('external_id', external_id);

      if (error) {
        console.error('Error updating transaction:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: 'transaction_webhook_processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== SYNC ABANDONED EVENT (external → dashboard) =====
    if (event === 'sync_abandoned_event') {
      const { customer_name, customer_email, customer_phone, product_name, amount, event_type: evtType, metadata } = payload;

      const normPhone = customer_phone ? customer_phone.replace(/\D/g, '') : null;

      const { data: newEvent, error: insertError } = await supabase
        .from('abandoned_events')
        .insert({
          customer_name: customer_name || null,
          customer_email: customer_email || null,
          customer_phone: customer_phone || null,
          normalized_phone: normPhone,
          product_name: product_name || null,
          amount: amount || null,
          event_type: evtType || 'checkout',
          metadata: metadata || null,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error inserting abandoned event:', insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: 'abandoned_event_created', id: newEvent?.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== SYNC REMINDER (external → dashboard) =====
    if (event === 'sync_reminder' || event === 'reminder_updated') {
      const externalId = payload.external_id || payload.id || payload._id;
      const phone = payload.phone || payload.phone_number || payload.remote_jid;
      const dueDate = payload.due_date || payload.dueDate;
      const { title, description, completed } = payload;

      console.log('Reminder webhook received:', { externalId, phone, title, completed });

      if (!externalId) {
        return new Response(
          JSON.stringify({ error: 'external_id (or id/_id) is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if reminder already exists by external_id
      const { data: existing } = await supabase
        .from('reminders')
        .select('id')
        .eq('external_id', String(externalId))
        .maybeSingle();

      if (existing) {
        // Update existing reminder
        const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (title !== undefined) updateFields.title = title;
        if (description !== undefined) updateFields.description = description;
        if (phone) updateFields.phone = phone;
        if (dueDate) updateFields.due_date = dueDate;
        if (completed !== undefined) updateFields.completed = completed;

        const { error } = await supabase.from('reminders').update(updateFields).eq('id', existing.id);
        if (error) {
          console.error('Error updating reminder:', error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, action: 'reminder_updated', id: existing.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Create new reminder
        if (!phone || !title) {
          return new Response(
            JSON.stringify({ error: 'phone and title are required for new reminders' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: newReminder, error: insertError } = await supabase
          .from('reminders')
          .insert({
            external_id: String(externalId),
            title,
            description: description || null,
            phone,
            due_date: dueDate || new Date().toISOString(),
            completed: completed || false,
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Error inserting reminder:', insertError);
          return new Response(
            JSON.stringify({ error: insertError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, action: 'reminder_created', id: newReminder?.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ===== REMINDER DELETED (external → dashboard) =====
    if (event === 'reminder_deleted') {
      const externalId = payload.external_id || payload.id || payload._id;

      if (!externalId) {
        return new Response(
          JSON.stringify({ error: 'external_id (or id/_id) is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('external_id', String(externalId));

      if (error) {
        console.error('Error deleting reminder:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: 'reminder_deleted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== PAYMENT CONFIRMED (external → dashboard) =====
    if (event === 'payment_confirmed') {
      const refId = payload.reference_id || payload.external_id;

      if (!refId) {
        return new Response(
          JSON.stringify({ error: 'reference_id or external_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: tx } = await supabase
        .from('transactions')
        .select('id')
        .eq('external_id', String(refId))
        .maybeSingle();

      if (!tx) {
        console.warn('payment_confirmed: transaction not found for', refId);
        return new Response(
          JSON.stringify({ error: 'Transaction not found', reference_id: refId }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updateFields: Record<string, unknown> = {
        status: 'pago',
        paid_at: payload.paid_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (payload.amount) updateFields.amount = payload.amount;
      if (payload.customer_name) updateFields.customer_name = payload.customer_name;
      if (payload.customer_email) updateFields.customer_email = payload.customer_email;
      if (payload.customer_document) updateFields.customer_document = payload.customer_document;
      if (payload.phone) {
        updateFields.customer_phone = payload.phone;
        updateFields.normalized_phone = payload.phone.replace(/\D/g, '');
      }
      if (payload.metadata) updateFields.metadata = payload.metadata;

      const { error } = await supabase.from('transactions').update(updateFields).eq('id', tx.id);
      if (error) {
        console.error('Error confirming payment:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log tags if present (no tags table yet)
      if (payload.tags_add) console.log('tags_add requested (not implemented):', payload.tags_add);
      if (payload.tags_remove) console.log('tags_remove requested (not implemented):', payload.tags_remove);
      if (payload.message) console.log('message field received (not auto-sent):', payload.message);

      return new Response(
        JSON.stringify({ success: true, action: 'payment_confirmed', id: tx.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== PAYMENT FAILED (external → dashboard) =====
    if (event === 'payment_failed') {
      const refId = payload.reference_id || payload.external_id;

      if (!refId) {
        return new Response(
          JSON.stringify({ error: 'reference_id or external_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: tx } = await supabase
        .from('transactions')
        .select('id')
        .eq('external_id', String(refId))
        .maybeSingle();

      if (!tx) {
        return new Response(
          JSON.stringify({ error: 'Transaction not found', reference_id: refId }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updateFields: Record<string, unknown> = {
        status: payload.status || 'recusado',
        updated_at: new Date().toISOString(),
      };
      if (payload.metadata) updateFields.metadata = payload.metadata;

      const { error } = await supabase.from('transactions').update(updateFields).eq('id', tx.id);
      if (error) {
        console.error('Error updating failed payment:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: 'payment_failed', id: tx.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== PAYMENT REFUNDED (external → dashboard) =====
    if (event === 'payment_refunded') {
      const refId = payload.reference_id || payload.external_id;

      if (!refId) {
        return new Response(
          JSON.stringify({ error: 'reference_id or external_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: tx } = await supabase
        .from('transactions')
        .select('id')
        .eq('external_id', String(refId))
        .maybeSingle();

      if (!tx) {
        return new Response(
          JSON.stringify({ error: 'Transaction not found', reference_id: refId }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updateFields: Record<string, unknown> = {
        status: payload.status || 'estornado',
        updated_at: new Date().toISOString(),
      };
      if (payload.metadata) updateFields.metadata = payload.metadata;

      const { error } = await supabase.from('transactions').update(updateFields).eq('id', tx.id);
      if (error) {
        console.error('Error refunding payment:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: 'payment_refunded', id: tx.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== CUSTOMER UPDATED (external → dashboard) =====
    if (event === 'customer_updated') {
      const phone = payload.phone || payload.phone_number;
      const { customer_name, tags_add, tags_remove, message } = payload;

      if (!phone) {
        return new Response(
          JSON.stringify({ error: 'phone is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const normPhone = phone.replace(/\D/g, '');
      const phoneLast8 = normPhone.slice(-8);

      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .filter('normalized_phone', 'like', `%${phoneLast8}`)
        .limit(1)
        .maybeSingle();

      if (existing) {
        const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (customer_name) updateFields.name = customer_name;
        await supabase.from('customers').update(updateFields).eq('id', existing.id);
      } else {
        await supabase.from('customers').insert({
          normalized_phone: normPhone,
          display_phone: phone,
          name: customer_name || null,
        });
      }

      if (tags_add) console.log('tags_add requested (not implemented):', tags_add);
      if (tags_remove) console.log('tags_remove requested (not implemented):', tags_remove);
      if (message) console.log('message field received (not auto-sent):', message);

      return new Response(
        JSON.stringify({ success: true, action: 'customer_updated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== INVOICE CREATED (external → dashboard) =====
    if (event === 'invoice_created') {
      const refId = payload.reference_id;
      const phone = payload.phone || payload.phone_number;

      if (!refId) {
        return new Response(
          JSON.stringify({ error: 'reference_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const normPhone = phone ? phone.replace(/\D/g, '') : null;

      const { data: newTx, error: insertError } = await supabase
        .from('transactions')
        .insert({
          external_id: String(refId),
          amount: payload.amount || 0,
          type: 'boleto',
          status: 'pendente',
          customer_name: payload.customer_name || null,
          customer_phone: phone || null,
          normalized_phone: normPhone,
          metadata: payload.metadata || null,
          webhook_source: 'external_api',
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating invoice transaction:', insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: 'invoice_created', id: newTx?.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== BULK SYNC (external → dashboard) =====
    if (event === 'bulk_sync') {
      const { customers, transactions, abandoned_events } = payload;
      const results: Record<string, unknown> = {};

      if (customers && Array.isArray(customers)) {
        let synced = 0;
        for (const c of customers) {
          const normPhone = c.phone?.replace(/\D/g, '');
          if (!normPhone) continue;
          
          const { data: existing } = await supabase
            .from('customers')
            .select('id')
            .filter('normalized_phone', 'like', `%${normPhone.slice(-8)}`)
            .limit(1)
            .maybeSingle();

          if (existing) {
            const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (c.name) updateFields.name = c.name;
            if (c.email) updateFields.email = c.email;
            if (c.document) updateFields.document = c.document;
            await supabase.from('customers').update(updateFields).eq('id', existing.id);
          } else {
            await supabase.from('customers').insert({
              normalized_phone: normPhone,
              display_phone: c.phone,
              name: c.name || null,
              email: c.email || null,
              document: c.document || null,
            });
          }
          synced++;
        }
        results.customers_synced = synced;
      }

      if (transactions && Array.isArray(transactions)) {
        let created = 0;
        let updated = 0;
        for (const tx of transactions) {
          if (!tx.amount || !tx.type) continue;
          
          const normPhone = tx.customer_phone?.replace(/\D/g, '') || null;

          if (tx.external_id) {
            const { data: existing } = await supabase
              .from('transactions')
              .select('id')
              .eq('external_id', tx.external_id)
              .maybeSingle();

            if (existing) {
              await supabase.from('transactions').update({
                status: tx.status || 'pendente',
                customer_name: tx.customer_name,
                paid_at: tx.paid_at,
                updated_at: new Date().toISOString(),
              }).eq('id', existing.id);
              updated++;
              continue;
            }
          }

          await supabase.from('transactions').insert({
            external_id: tx.external_id || null,
            amount: tx.amount,
            type: tx.type,
            status: tx.status || 'pendente',
            customer_name: tx.customer_name || null,
            customer_email: tx.customer_email || null,
            customer_phone: tx.customer_phone || null,
            normalized_phone: normPhone,
            description: tx.description || null,
            paid_at: tx.paid_at || null,
            webhook_source: 'external_api',
          });
          created++;
        }
        results.transactions_created = created;
        results.transactions_updated = updated;
      }

      if (abandoned_events && Array.isArray(abandoned_events)) {
        let created = 0;
        for (const evt of abandoned_events) {
          const normPhone = evt.customer_phone?.replace(/\D/g, '') || null;
          await supabase.from('abandoned_events').insert({
            customer_name: evt.customer_name || null,
            customer_email: evt.customer_email || null,
            customer_phone: evt.customer_phone || null,
            normalized_phone: normPhone,
            product_name: evt.product_name || null,
            amount: evt.amount || null,
            event_type: evt.event_type || 'checkout',
          });
          created++;
        }
        results.abandoned_events_created = created;
      }

      return new Response(
        JSON.stringify({ success: true, action: 'bulk_sync', ...results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== USEFUL LINK CREATE/UPDATE =====
    if (event === 'useful_link_created' || event === 'useful_link_updated') {
      const { title, url, description, icon, is_active } = payload;

      if (!title || !url) {
        return new Response(
          JSON.stringify({ error: 'title and url are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if link with same URL already exists
      const { data: existing } = await supabase
        .from('useful_links')
        .select('id')
        .eq('url', url)
        .maybeSingle();

      if (existing) {
        const updateData: Record<string, unknown> = { title, url, updated_at: new Date().toISOString() };
        if (description !== undefined) updateData.description = description;
        if (icon !== undefined) updateData.icon = icon;
        if (is_active !== undefined) updateData.is_active = is_active;

        const { error } = await supabase.from('useful_links').update(updateData).eq('id', existing.id);
        if (error) console.error('Error updating useful link:', error);

        return new Response(
          JSON.stringify({ success: true, action: 'useful_link_updated', id: existing.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        const insertData: Record<string, unknown> = { title, url };
        if (description) insertData.description = description;
        if (icon) insertData.icon = icon;
        if (is_active !== undefined) insertData.is_active = is_active;

        const { data: newLink, error } = await supabase.from('useful_links').insert(insertData).select('id').single();
        if (error) console.error('Error creating useful link:', error);

        return new Response(
          JSON.stringify({ success: true, action: 'useful_link_created', id: newLink?.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ===== USEFUL LINK DELETE =====
    if (event === 'useful_link_deleted') {
      const { id, url } = payload;

      if (!id && !url) {
        return new Response(
          JSON.stringify({ error: 'id or url required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let query = supabase.from('useful_links').delete();
      if (id) {
        query = query.eq('id', id);
      } else {
        query = query.eq('url', url);
      }

      const { error } = await query;
      if (error) console.error('Error deleting useful link:', error);

      return new Response(
        JSON.stringify({ success: true, action: 'useful_link_deleted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown event type', received: event }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in external-messaging-webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
