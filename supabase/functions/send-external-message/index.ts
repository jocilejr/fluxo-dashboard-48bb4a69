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

function getErrorMessage(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let logEntryId: string | null = null;
  let supabase: ReturnType<typeof createClient> | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone, message, transactionId, abandonedEventId, messageType, instanceName }: SendMessageRequest = await req.json();

    console.log(`Sending message to ${phone} via API externa`);

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

    let normalizedPhone = phone.replace(/\D/g, '');
    if (!normalizedPhone.startsWith('55')) {
      normalizedPhone = '55' + normalizedPhone;
    }

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
      .select('id')
      .single();

    if (logError) {
      console.error('Error creating log entry:', logError);
    }

    logEntryId = logEntry?.id ?? null;

    const baseUrl = settings.server_url.replace(/\/$/, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${settings.api_key}`,
    };

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

    const rawResponse = await sendResponse.text();
    let sendData: Record<string, unknown> = {};

    if (rawResponse) {
      try {
        const parsed = JSON.parse(rawResponse);
        sendData = typeof parsed === 'object' && parsed !== null
          ? parsed as Record<string, unknown>
          : { value: parsed };
      } catch {
        console.error('Failed to parse JSON response from external API:', rawResponse.substring(0, 500));

        if (logEntryId) {
          await supabase
            .from('message_log')
            .update({
              status: 'failed',
              error_message: `API retornou resposta inválida (HTTP ${sendResponse.status}): ${rawResponse.substring(0, 200)}`,
              sent_at: new Date().toISOString(),
              external_response: { raw: rawResponse.substring(0, 500), status: sendResponse.status },
            })
            .eq('id', logEntryId);
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: 'API externa retornou resposta não-JSON',
            details: rawResponse.substring(0, 200),
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Send message API response:', JSON.stringify(sendData));

    if (logEntryId) {
      const attemptedAt = new Date().toISOString();
      const externalMessageId = sendData.id == null ? null : String(sendData.id);
      const externalErrorMessage = getErrorMessage(
        sendData.error,
        `Erro ao enviar mensagem (HTTP ${sendResponse.status})`
      );

      const updateData: Record<string, unknown> = sendResponse.ok
        ? {
            status: 'sent',
            external_response: sendData,
            sent_at: attemptedAt,
            external_message_id: externalMessageId,
          }
        : {
            status: 'failed',
            external_response: sendData,
            sent_at: attemptedAt,
            error_message: externalErrorMessage,
          };

      await supabase
        .from('message_log')
        .update(updateData)
        .eq('id', logEntryId);
    }

    if (!sendResponse.ok) {
      console.error('External API error:', sendData);
      return new Response(
        JSON.stringify({
          success: false,
          error: getErrorMessage(sendData.error, 'Erro ao enviar mensagem'),
          details: sendData,
        }),
        { status: sendResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: sendData.id ?? null,
        response: sendData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-external-message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (supabase && logEntryId) {
      try {
        await supabase
          .from('message_log')
          .update({
            status: 'failed',
            error_message: errorMessage,
            sent_at: new Date().toISOString(),
          })
          .eq('id', logEntryId);
      } catch (updateError) {
        console.error('Error updating log entry after failure:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});