import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  action: 'sync_customers' | 'sync_transactions' | 'sync_customer' | 'sync_transaction';
  customer_phone?: string;
  transaction_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  instance_name?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SyncRequest = await req.json();
    console.log('Sync request:', JSON.stringify(body));

    // Get messaging API settings
    const { data: settings, error: settingsError } = await supabase
      .from('messaging_api_settings')
      .select('*')
      .limit(1)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ success: false, error: 'API externa não configurada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: 'API externa está desativada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = settings.server_url.replace(/\/$/, '');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.api_key}`,
    };

    let result: Record<string, unknown> = {};

    switch (body.action) {
      case 'sync_customers': {
        const queryLimit = body.limit || 100;
        let query = supabase
          .from('customers')
          .select('normalized_phone, display_phone, name, email, document, total_transactions, total_paid, total_pending, total_abandoned_events, pix_payment_count, first_seen_at, last_seen_at')
          .order('updated_at', { ascending: false })
          .limit(queryLimit);

        if (body.date_from) {
          query = query.gte('updated_at', body.date_from);
        }

        const { data: customers, error: customersError } = await query;

        if (customersError) {
          throw new Error(`Erro ao buscar clientes: ${customersError.message}`);
        }

        let synced = 0;
        let failed = 0;

        for (const customer of (customers || [])) {
          try {
            const contactPayload = {
              phone: customer.normalized_phone,
              name: customer.name || null,
              instance_name: body.instance_name || null,
            };

            const response = await fetch(`${baseUrl}/api/platform/contacts`, {
              method: 'POST',
              headers,
              body: JSON.stringify(contactPayload),
            });

            if (response.ok) {
              synced++;
            } else {
              failed++;
              const errText = await response.text();
              console.error(`Failed to sync customer ${customer.normalized_phone}: ${errText}`);
            }
          } catch (err) {
            failed++;
            console.error(`Error syncing customer ${customer.normalized_phone}:`, err);
          }
        }

        result = { action: 'sync_customers', sent: customers?.length || 0, synced, failed };
        break;
      }

      case 'sync_customer': {
        if (!body.customer_phone) {
          return new Response(
            JSON.stringify({ success: false, error: 'customer_phone é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const phone = body.customer_phone.replace(/\D/g, '');
        const phoneLast8 = phone.slice(-8);

        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('*')
          .filter('normalized_phone', 'like', `%${phoneLast8}`)
          .limit(1)
          .maybeSingle();

        if (customerError || !customer) {
          return new Response(
            JSON.stringify({ success: false, error: 'Cliente não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Sync contact
        const contactResponse = await fetch(`${baseUrl}/api/platform/contacts`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            phone: customer.normalized_phone,
            name: customer.name || null,
            instance_name: body.instance_name || null,
          }),
        });
        const contactData = await contactResponse.json();

        // Get and sync customer transactions
        const { data: transactions } = await supabase
          .from('transactions')
          .select('id, amount, status, type, description, created_at, paid_at, customer_name, customer_email, customer_phone, external_id')
          .filter('normalized_phone', 'like', `%${phoneLast8}`)
          .order('created_at', { ascending: false })
          .limit(50);

        let txSynced = 0;
        for (const tx of (transactions || [])) {
          try {
            const txPayload = {
              amount: tx.amount,
              type: tx.type,
              status: tx.status,
              customer_name: tx.customer_name || customer.name || null,
              customer_phone: customer.normalized_phone,
              customer_email: tx.customer_email || customer.email || null,
              description: tx.description || null,
              paid_at: tx.paid_at || null,
            };

            await fetch(`${baseUrl}/api/platform/transactions`, {
              method: 'POST',
              headers,
              body: JSON.stringify(txPayload),
            });
            txSynced++;
          } catch (err) {
            console.error(`Error syncing transaction ${tx.id}:`, err);
          }
        }

        result = { action: 'sync_customer', phone: customer.normalized_phone, contact: contactData, transactions_synced: txSynced };
        break;
      }

      case 'sync_transactions': {
        let query = supabase
          .from('transactions')
          .select('id, external_id, amount, status, type, description, customer_name, customer_email, customer_phone, customer_document, normalized_phone, created_at, updated_at, paid_at, webhook_source')
          .order('created_at', { ascending: false })
          .limit(body.limit || 100);

        if (body.date_from) {
          query = query.gte('created_at', body.date_from);
        }
        if (body.date_to) {
          query = query.lte('created_at', body.date_to);
        }

        const { data: transactions, error: txError } = await query;

        if (txError) {
          throw new Error(`Erro ao buscar transações: ${txError.message}`);
        }

        let synced = 0;
        let failed = 0;

        for (const tx of (transactions || [])) {
          try {
            const txPayload = {
              amount: tx.amount,
              type: tx.type,
              status: tx.status,
              customer_name: tx.customer_name || null,
              customer_phone: tx.customer_phone || null,
              customer_email: tx.customer_email || null,
              customer_document: tx.customer_document || null,
              description: tx.description || null,
              paid_at: tx.paid_at || null,
            };

            const response = await fetch(`${baseUrl}/api/platform/transactions`, {
              method: 'POST',
              headers,
              body: JSON.stringify(txPayload),
            });

            if (response.ok) {
              synced++;
            } else {
              failed++;
              const errText = await response.text();
              console.error(`Failed to sync transaction ${tx.id}: ${errText}`);
            }
          } catch (err) {
            failed++;
            console.error(`Error syncing transaction ${tx.id}:`, err);
          }
        }

        result = { action: 'sync_transactions', sent: transactions?.length || 0, synced, failed };
        break;
      }

      case 'sync_transaction': {
        if (!body.transaction_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'transaction_id é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: transaction, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', body.transaction_id)
          .single();

        if (txError || !transaction) {
          return new Response(
            JSON.stringify({ success: false, error: 'Transação não encontrada' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const txPayload = {
          amount: transaction.amount,
          type: transaction.type,
          status: transaction.status,
          customer_name: transaction.customer_name || null,
          customer_phone: transaction.customer_phone || null,
          customer_email: transaction.customer_email || null,
          customer_document: transaction.customer_document || null,
          description: transaction.description || null,
          paid_at: transaction.paid_at || null,
        };

        const response = await fetch(`${baseUrl}/api/platform/transactions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(txPayload),
        });

        const responseData = await response.json();
        result = { action: 'sync_transaction', transaction_id: body.transaction_id, response: responseData };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Ação desconhecida: ${body.action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-external-data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
