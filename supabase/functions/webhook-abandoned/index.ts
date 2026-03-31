import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AbandonedEventPayload {
  event_type?: 'cart_abandoned' | 'boleto_failed';
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_document?: string;
  amount?: number | string;
  product_name?: string;
  funnel_stage?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  error_message?: string;
  metadata?: Record<string, any>;
}

// ========== UTILITY FUNCTIONS ==========

function normalizePhone(phone: string | undefined): string | null {
  if (!phone) return null;
  return phone.replace(/^\+/, '').replace(/\D/g, '');
}

function getBrazilDate(): Date {
  const now = new Date();
  const utcOffset = now.getTimezoneOffset() * 60000;
  const brazilOffset = -3 * 60 * 60 * 1000;
  return new Date(now.getTime() + utcOffset + brazilOffset);
}

function isWithinWorkingHours(startHour: number, endHour: number): boolean {
  const brazilDate = getBrazilDate();
  const currentHour = brazilDate.getHours();
  return currentHour >= startHour && currentHour < endHour;
}

function getGreeting(): string {
  const brazilDate = getBrazilDate();
  const hour = brazilDate.getHours();
  
  if (hour >= 6 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

function formatMessage(template: string, data: Record<string, string>): string {
  let message = template;
  for (const [key, value] of Object.entries(data)) {
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return message;
}

// ========== INSTANT ABANDONED RECOVERY ==========

async function sendInstantAbandonedRecovery(
  supabase: any,
  event: {
    id: string;
    customer_name?: string;
    customer_phone?: string;
    amount?: number;
    product_name?: string;
  }
): Promise<void> {
  try {
    console.log('[InstantRecovery] Checking if should send abandoned recovery...');
    
    if (!event.customer_phone) {
      console.log('[InstantRecovery] No customer phone, skipping');
      return;
    }

    // Get messaging API settings (Auto Rec)
    const { data: messagingSettings, error: settingsError } = await supabase
      .from('messaging_api_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (settingsError || !messagingSettings) {
      console.log('[InstantRecovery] No messaging settings found');
      return;
    }

    if (!messagingSettings.is_active) {
      console.log('[InstantRecovery] Messaging API not active');
      return;
    }

    if (!messagingSettings.abandoned_recovery_enabled) {
      console.log('[InstantRecovery] Abandoned recovery not enabled');
      return;
    }

    // Check working hours only if enabled
    if (messagingSettings.working_hours_enabled) {
      if (!isWithinWorkingHours(messagingSettings.working_hours_start, messagingSettings.working_hours_end)) {
        console.log('[InstantRecovery] Outside working hours');
        return;
      }
    }

    // Check daily limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { data: todayMessages, error: countError } = await supabase
      .from('message_log')
      .select('id')
      .gte('created_at', todayStart.toISOString())
      .eq('status', 'sent');

    if (countError) {
      console.error('[InstantRecovery] Error counting messages:', countError);
      return;
    }

    const sentToday = todayMessages?.length || 0;
    if (sentToday >= messagingSettings.daily_limit) {
      console.log(`[InstantRecovery] Daily limit reached (${sentToday}/${messagingSettings.daily_limit})`);
      return;
    }

    // Check if already sent for this event
    const { data: existingLog } = await supabase
      .from('message_log')
      .select('id')
      .eq('abandoned_event_id', event.id)
      .eq('message_type', 'abandoned')
      .limit(1)
      .maybeSingle();

    if (existingLog) {
      console.log('[InstantRecovery] Message already sent for this event');
      return;
    }

    // Use Auto Rec message
    const recoveryMessage = messagingSettings.auto_abandoned_message;
    if (!recoveryMessage || recoveryMessage.trim() === '') {
      console.log('[InstantRecovery] No auto_abandoned_message configured in Auto Rec');
      return;
    }

    // Format message
    const firstName = event.customer_name?.split(' ')[0] || 'Cliente';
    const formattedValue = event.amount 
      ? `R$ ${Number(event.amount).toFixed(2).replace('.', ',')}` 
      : 'R$ 0,00';
    
    const message = formatMessage(recoveryMessage, {
      nome: event.customer_name || 'Cliente',
      primeiro_nome: firstName,
      valor: formattedValue,
      produto: event.product_name || 'Produto',
      saudação: getGreeting(),
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    console.log(`[InstantRecovery] Sending abandoned recovery message to ${event.customer_phone}`);

    const response = await fetch(`${supabaseUrl}/functions/v1/send-external-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        phone: event.customer_phone,
        message: message,
        messageType: 'abandoned',
        abandonedEventId: event.id,
      }),
    });

    const sendResult = await response.json();

    if (sendResult.success) {
      console.log('[InstantRecovery] Abandoned recovery message sent successfully!', sendResult);
    } else {
      console.error('[InstantRecovery] Error sending message:', sendResult);
    }
  } catch (error) {
    console.error('[InstantRecovery] Unexpected error:', error);
  }
}

// ========== MAIN HANDLER ==========

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: AbandonedEventPayload = await req.json();
    console.log('Abandoned event webhook received:', JSON.stringify(payload));

    // Parse amount
    let amount: number | null = null;
    if (payload.amount !== undefined && payload.amount !== null) {
      if (typeof payload.amount === 'string') {
        const cleanAmount = payload.amount.replace(/[^\d.,]/g, '').replace(',', '.');
        amount = parseFloat(cleanAmount);
      } else {
        amount = Number(payload.amount);
      }
      if (isNaN(amount)) amount = null;
    }

    const normalizedPhone = normalizePhone(payload.customer_phone);

    // Insert the abandoned event
    const { data, error } = await supabase
      .from('abandoned_events')
      .insert({
        event_type: payload.event_type || 'cart_abandoned',
        customer_name: payload.customer_name || null,
        customer_phone: normalizedPhone,
        customer_email: payload.customer_email || null,
        customer_document: payload.customer_document || null,
        amount: amount,
        product_name: payload.product_name || null,
        funnel_stage: payload.funnel_stage || null,
        utm_source: payload.utm_source || null,
        utm_medium: payload.utm_medium || null,
        utm_campaign: payload.utm_campaign || null,
        utm_term: payload.utm_term || null,
        utm_content: payload.utm_content || null,
        error_message: payload.error_message || null,
        metadata: payload.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting abandoned event:', error);
      throw error;
    }

    console.log('Abandoned event created successfully:', data.id);

    // ===== INSTANT RECOVERY FOR ABANDONED =====
    console.log('[webhook-abandoned] Triggering instant abandoned recovery...');
    
    sendInstantAbandonedRecovery(supabase, {
      id: data.id,
      customer_name: payload.customer_name,
      customer_phone: normalizedPhone || undefined,
      amount: amount || undefined,
      product_name: payload.product_name,
    }).catch(err => console.error('[InstantRecovery] Background error:', err));

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error processing abandoned event webhook:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
