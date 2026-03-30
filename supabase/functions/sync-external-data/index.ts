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

        const response = await fetch(`${baseUrl}/api/sync-customers`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ customers }),
        });

        const responseData = await response.json();
        result = { action: 'sync_customers', sent: customers?.length || 0, response: responseData };
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

        // Get customer transactions
        const { data: transactions } = await supabase
          .from('transactions')
          .select('id, amount, status, type, description, created_at, paid_at, customer_name, customer_email')
          .filter('normalized_phone', 'like', `%${phoneLast8}`)
          .order('created_at', { ascending: false })
          .limit(50);

        // Get abandoned events
        const { data: abandonedEvents } = await supabase
          .from('abandoned_events')
          .select('id, event_type, product_name, amount, created_at, customer_name, customer_email')
          .filter('normalized_phone', 'like', `%${phoneLast8}`)
          .order('created_at', { ascending: false })
          .limit(50);

        const response = await fetch(`${baseUrl}/api/sync-customer`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            customer,
            transactions: transactions || [],
            abandoned_events: abandonedEvents || [],
          }),
        });

        const responseData = await response.json();
        result = { action: 'sync_customer', phone: customer.normalized_phone, response: responseData };
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

        const response = await fetch(`${baseUrl}/api/sync-transactions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ transactions }),
        });

        const responseData = await response.json();
        result = { action: 'sync_transactions', sent: transactions?.length || 0, response: responseData };
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

        const response = await fetch(`${baseUrl}/api/sync-transaction`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ transaction }),
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
