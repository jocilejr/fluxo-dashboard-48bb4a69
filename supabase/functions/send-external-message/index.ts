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

    console.log(`Sending message to ${phone} via API externa`);

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

    // Determine which instance to use: explicit param > settings per type > null
    let instance = instanceName || null;
    if (!instance) {
      const instanceMap: Record<string, string | null> = {
        boleto: settings.boleto_instance_name || null,
        pix_card: settings.pix_card_instance_name || null,
        abandoned: settings.abandoned_instance_name || null,
      };
      instance = instanceMap[messageType] || null;
    }

    if (!instance) {
      console.error('No instance configured for message type:', messageType);
      return new Response(
        JSON.stringify({ success: false, error: `Nenhuma instância WhatsApp configurada para ${messageType}` }),
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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${settings.api_key}`,
    };

    // Send message via POST /api/platform/send-message
    const sendPayload = {
      phone: normalizedPhone,
      message,
      instance,
    };

    console.log(`Sending message via ${baseUrl}/api/platform/send-message with instance: ${instance}`);
    const sendResponse = await fetch(`${baseUrl}/api/platform/send-message`, {
      method: 'POST',
      headers,
      body: JSON.stringify(sendPayload),
    });

    let sendData: Record<string, unknown>;
    try {
      sendData = await sendResponse.json();
    } catch (_parseError) {
      const errorText = await sendResponse.text();
      console.error('Failed to parse JSON response from external API:', errorText.substring(0, 500));

      // Update log to failed so it never stays stuck in "pending"
      if (logEntry) {
        await supabase
          .from('message_log')
          .update({
            status: 'failed',
            error_message: `API retornou resposta inválida (HTTP ${sendResponse.status}): ${errorText.substring(0, 200)}`,
            sent_at: new Date().toISOString(),
            external_response: { raw: errorText.substring(0, 500), status: sendResponse.status } as unknown as Record<string, unknown>,
          })
          .eq('id', logEntry.id);
      }

      return new Response(
        JSON.stringify({ success: false, error: 'API externa retornou resposta não-JSON' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('Send message API response:', JSON.stringify(sendData));

    // Update log with response
    if (logEntry) {
      const updateData: Record<string, unknown> = {
        external_response: sendData,
        sent_at: new Date().toISOString(),
      };

      if (sendResponse.ok) {
        updateData.status = 'sent';
        updateData.external_message_id = sendData.id || null;
      } else {
        updateData.status = 'failed';
        updateData.error_message = sendData.error || 'Erro ao enviar mensagem';
      }

      await supabase
        .from('message_log')
        .update(updateData)
        .eq('id', logEntry.id);
    }

    if (!sendResponse.ok) {
      console.error('External API error:', sendData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: sendData.error || 'Erro ao enviar mensagem',
          details: sendData 
        }),
        { status: sendResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: sendData.id,
        response: sendData 
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
