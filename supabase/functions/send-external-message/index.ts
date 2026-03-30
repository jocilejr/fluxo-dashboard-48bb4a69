import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessageRequest {
  phone: string;
  message: string;
  transactionId?: string;
  abandonedEventId?: string;
  messageType: 'boleto' | 'pix_card' | 'abandoned';
  customerName?: string;
  amount?: number;
  instanceName?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone, message, transactionId, abandonedEventId, messageType, customerName, amount, instanceName }: SendMessageRequest = await req.json();

    console.log(`Sending message to ${phone} via Chatbot Simplificado API`);

    // Get messaging API settings
    const { data: settings, error: settingsError } = await supabase
      .from('messaging_api_settings')
      .select('*')
      .limit(1)
      .single();

    if (settingsError || !settings) {
      console.error('Messaging API settings not found:', settingsError);
      return new Response(
        JSON.stringify({ success: false, error: 'API de mensagens não configurada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: 'API de mensagens está desativada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number
    let normalizedPhone = phone.replace(/\D/g, '');
    if (!normalizedPhone.startsWith('55')) {
      normalizedPhone = '55' + normalizedPhone;
    }

    // Create log entry
    const { data: logEntry, error: logError } = await supabase
      .from('message_log')
      .insert({
        phone: normalizedPhone,
        message,
        message_type: messageType,
        transaction_id: transactionId || null,
        abandoned_event_id: abandonedEventId || null,
        status: 'pending'
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating log entry:', logError);
    }

    const baseUrl = settings.server_url.replace(/\/$/, '');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.api_key}`,
    };

    // Step 1: Create/update contact via POST /api/platform/contacts
    const contactPayload: Record<string, unknown> = {
      phone: normalizedPhone,
      name: customerName || null,
      instance_name: instanceName || null,
    };

    console.log(`Creating/updating contact: ${baseUrl}/api/platform/contacts`);
    const contactResponse = await fetch(`${baseUrl}/api/platform/contacts`, {
      method: 'POST',
      headers,
      body: JSON.stringify(contactPayload),
    });

    const contactData = await contactResponse.json();
    console.log('Contact API response:', JSON.stringify(contactData));

    // Step 2: If there's a transaction, sync it via POST /api/platform/transactions
    if (transactionId && amount) {
      const txPayload = {
        amount,
        type: messageType === 'boleto' ? 'boleto' : 'pix',
        status: 'pendente',
        customer_name: customerName || null,
        customer_phone: normalizedPhone,
      };

      console.log(`Syncing transaction: ${baseUrl}/api/platform/transactions`);
      const txResponse = await fetch(`${baseUrl}/api/platform/transactions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(txPayload),
      });
      const txData = await txResponse.json();
      console.log('Transaction API response:', JSON.stringify(txData));
    }

    // Step 3: Add recovery tag via POST /api/platform/tags
    const tagPayload = {
      phone: normalizedPhone,
      tag_name: `recuperacao_${messageType}`,
    };

    console.log(`Adding tag: ${baseUrl}/api/platform/tags`);
    try {
      await fetch(`${baseUrl}/api/platform/tags`, {
        method: 'POST',
        headers,
        body: JSON.stringify(tagPayload),
      });
    } catch (tagErr) {
      console.warn('Tag creation failed (non-critical):', tagErr);
    }

    // Update log with response
    if (logEntry) {
      const updateData: Record<string, unknown> = {
        external_response: contactData,
        sent_at: new Date().toISOString(),
      };

      if (contactResponse.ok) {
        updateData.status = 'sent';
        updateData.external_message_id = contactData.id || null;
      } else {
        updateData.status = 'failed';
        updateData.error_message = contactData.error || 'Erro ao enviar mensagem';
      }

      await supabase
        .from('message_log')
        .update(updateData)
        .eq('id', logEntry.id);
    }

    if (!contactResponse.ok) {
      console.error('External API error:', contactData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: contactData.error || 'Erro ao enviar mensagem',
          details: contactData 
        }),
        { status: contactResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: contactData.id,
        response: contactData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-external-message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
