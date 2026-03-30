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
      const { phone, name, email, document, metadata } = payload;

      if (!phone) {
        return new Response(
          JSON.stringify({ error: 'phone is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const normPhone = phone.replace(/\D/g, '');
      const phoneLast8 = normPhone.slice(-8);

      // Find existing customer
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

      // Check for existing transaction by external_id
      if (external_id) {
        const { data: existing } = await supabase
          .from('transactions')
          .select('id')
          .eq('external_id', external_id)
          .maybeSingle();

        if (existing) {
          // Update existing
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

      // Insert new transaction
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

      return new Response(
        JSON.stringify({ success: true, action: 'transaction_created', id: newTx?.id }),
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
