import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

interface WebhookPayload {
  event: string;
  type: 'boleto' | 'pix' | 'cartao';
  external_id?: string;
  amount: number;
  status?: 'gerado' | 'pago' | 'pendente' | 'cancelado' | 'expirado';
  description?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_document?: string;
  boleto_url?: string;
  metadata?: Record<string, unknown>;
  paid_at?: string;
}

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// ========== UTILITY FUNCTIONS ==========

function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  return phone.replace(/^\+/, '').replace(/\D/g, '');
}

function normalizeExternalId(externalId?: string): string | undefined {
  if (!externalId) return undefined;
  return externalId.replace(/[\s.\-\/]/g, '');
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

// Base64 URL helpers
function base64UrlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
}

// Replace template variables for notifications
function replaceTemplateVariables(
  text: string,
  data: { customer_name?: string; amount: number; type: string }
): string {
  const firstName = data.customer_name?.split(' ')[0] || 'Cliente';
  const fullName = data.customer_name || 'Cliente';
  const formattedAmount = `R$ ${Number(data.amount).toFixed(2).replace('.', ',')}`;
  const typeLabel = data.type === 'boleto' ? 'Boleto' : data.type === 'pix' ? 'PIX' : 'Cartão';

  return text
    .replace(/{nome}/g, fullName)
    .replace(/{primeiro_nome}/g, firstName)
    .replace(/{valor}/g, formattedAmount)
    .replace(/{tipo}/g, typeLabel);
}

// ========== WIREPUSHER FUNCTIONS ==========

async function sendWirePusherNotification(
  supabase: any,
  eventType: string,
  transactionData: { customer_name?: string; amount: number; type: string }
): Promise<void> {
  try {
    const { data: settings, error: settingsError } = await supabase
      .from('wirepusher_settings')
      .select('device_id, is_enabled')
      .maybeSingle();

    if (settingsError || !settings?.is_enabled || !settings?.device_id) {
      console.log('[WirePusher] Disabled or not configured');
      return;
    }

    const { data: template, error: templateError } = await supabase
      .from('wirepusher_notification_templates')
      .select('*')
      .eq('event_type', eventType)
      .eq('is_active', true)
      .maybeSingle();

    if (templateError || !template) {
      console.log(`[WirePusher] No active template for event: ${eventType}`);
      return;
    }

    const title = replaceTemplateVariables(template.title, transactionData);
    const message = replaceTemplateVariables(template.message, transactionData);

    const url = new URL('https://wirepusher.com/send');
    url.searchParams.set('id', settings.device_id);
    url.searchParams.set('title', title);
    url.searchParams.set('message', message);
    url.searchParams.set('type', template.notification_type);

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      console.error('[WirePusher] Failed:', response.status);
      return;
    }

    console.log('[WirePusher] Notification sent successfully!');
  } catch (error) {
    console.error('[WirePusher] Error:', error);
  }
}

function getWirePusherEventType(type: string, status: string): string {
  return `${type}_${status}`;
}

// ========== PUSH NOTIFICATION FUNCTIONS ==========

async function createVapidJwt(
  audience: string,
  subject: string,
  publicKeyBase64: string,
  privateKeyBase64: string
): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: subject,
  };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKeyBytes = base64UrlDecode(privateKeyBase64);
  const publicKeyBytes = base64UrlDecode(publicKeyBase64);
  
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: base64UrlEncode(publicKeyBytes.slice(1, 33)),
    y: base64UrlEncode(publicKeyBytes.slice(33, 65)),
    d: base64UrlEncode(privateKeyBytes),
  };

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  return `${unsignedToken}.${signatureB64}`;
}

async function sendPushNotification(
  subscription: PushSubscription,
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<boolean> {
  try {
    const endpoint = new URL(subscription.endpoint);
    const audience = `${endpoint.protocol}//${endpoint.host}`;
    
    const jwt = await createVapidJwt(
      audience,
      'mailto:admin@origemviva.com',
      vapidPublicKey,
      vapidPrivateKey
    );
    
    const body = JSON.stringify(payload);
    
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
        'Content-Type': 'application/json',
        'TTL': '86400',
        'Urgency': 'high',
      },
      body: body,
    });

    if (!response.ok) {
      console.error('[Push] Failed:', response.status);
      return false;
    }

    console.log('[Push] Notification sent successfully!');
    return true;
  } catch (error) {
    console.error('[Push] Error:', error);
    return false;
  }
}

async function sendPushToAllSubscribers(
  supabase: any,
  title: string,
  body: string,
  tag: string
): Promise<void> {
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');

  if (!vapidPrivateKey || !vapidPublicKey) {
    console.log('[Push] VAPID keys not configured');
    return;
  }

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth');

  if (error || !subscriptions || subscriptions.length === 0) {
    console.log('[Push] No subscriptions found');
    return;
  }

  console.log(`[Push] Sending to ${subscriptions.length} subscriber(s)`);

  const payload = { title, body, tag };
  const invalidSubscriptions: string[] = [];

  for (const sub of subscriptions) {
    const success = await sendPushNotification(sub, payload, vapidPublicKey, vapidPrivateKey);
    if (!success) {
      invalidSubscriptions.push(sub.id);
    }
  }

  if (invalidSubscriptions.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', invalidSubscriptions);
  }
}

// ========== INSTANT PIX/CARD RECOVERY ==========

async function sendInstantPixCardRecovery(
  supabase: any,
  transaction: {
    id: string;
    customer_name?: string;
    customer_phone?: string;
    amount: number;
    description?: string;
    type: string;
  }
): Promise<void> {
  try {
    console.log('[InstantRecovery] Checking if should send PIX/Card recovery...');
    
    if (!transaction.customer_phone) {
      console.log('[InstantRecovery] No customer phone, skipping');
      return;
    }

    // Get messaging API settings
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

    if (!messagingSettings.pix_card_recovery_enabled) {
      console.log('[InstantRecovery] PIX/Card recovery not enabled');
      return;
    }

    // Check working hours
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

    // Check if already sent
    const { data: existingLog } = await supabase
      .from('message_log')
      .select('id')
      .eq('transaction_id', transaction.id)
      .eq('message_type', 'pix_card')
      .limit(1)
      .maybeSingle();

    if (existingLog) {
      console.log('[InstantRecovery] Message already sent for this transaction');
      return;
    }

    // Use Auto Rec message from messaging_api_settings
    const recoveryMessage = messagingSettings.auto_pix_card_message;
    if (!recoveryMessage || recoveryMessage.trim() === '') {
      console.log('[InstantRecovery] No auto_pix_card_message configured in Auto Rec');
      return;
    }

    const firstName = transaction.customer_name?.split(' ')[0] || 'Cliente';
    const formattedValue = `R$ ${Number(transaction.amount).toFixed(2).replace('.', ',')}`;
    
    const message = formatMessage(recoveryMessage, {
      nome: transaction.customer_name || 'Cliente',
      primeiro_nome: firstName,
      valor: formattedValue,
      produto: transaction.description || 'Produto',
      saudação: getGreeting(),
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    console.log(`[InstantRecovery] Sending recovery message to ${transaction.customer_phone}`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/send-external-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        phone: transaction.customer_phone,
        message: message,
        messageType: 'pix_card',
        transactionId: transaction.id,
        customerName: transaction.customer_name,
        amount: transaction.amount,
      }),
    });

    const sendResult = await response.json();

    if (sendResult.success) {
      console.log('[InstantRecovery] Recovery message sent successfully!', sendResult);
    } else {
      console.error('[InstantRecovery] Error sending message:', sendResult);
    }
  } catch (error) {
    console.error('[InstantRecovery] Unexpected error:', error);
  }
}

// ========== MAIN HANDLER ==========

Deno.serve(async (req) => {
  console.log('[webhook-receiver] Request received');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: WebhookPayload = await req.json();
    console.log('Webhook received:', JSON.stringify(payload, null, 2));

    if (!payload.type || !payload.amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: type, amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let status = payload.status || 'gerado';
    let paidAt = payload.paid_at ? new Date(payload.paid_at).toISOString() : null;

    if (payload.event?.includes('paid') || payload.event?.includes('pago')) {
      status = 'pago';
      paidAt = paidAt || new Date().toISOString();
    } else if (payload.event?.includes('cancel')) {
      status = 'cancelado';
    } else if (payload.event?.includes('expir')) {
      status = 'expirado';
    }

    const normalizedIncomingId = normalizeExternalId(payload.external_id);
    const normalizedPhone = normalizePhone(payload.customer_phone);

    // Prepare data for notifications
    const notificationData = {
      customer_name: payload.customer_name,
      amount: payload.amount,
      type: payload.type,
    };

    // Check for existing transaction
    if (normalizedIncomingId) {
      // Search directly by exact external_id match first, then try normalized
      const { data: exactMatch, error: exactError } = await supabase
        .from('transactions')
        .select('id, external_id')
        .eq('external_id', normalizedIncomingId)
        .limit(1)
        .maybeSingle();

      let existingTransaction = exactMatch;

      // If no exact match, try original format
      if (!existingTransaction && payload.external_id && payload.external_id !== normalizedIncomingId) {
        const { data: originalMatch } = await supabase
          .from('transactions')
          .select('id, external_id')
          .eq('external_id', payload.external_id)
          .limit(1)
          .maybeSingle();
        existingTransaction = originalMatch;
      }

      // Fallback: search with ilike for partial matches (handles formatting differences)
      if (!existingTransaction) {
        const { data: fallbackMatches } = await supabase
          .from('transactions')
          .select('id, external_id')
          .not('external_id', 'is', null)
          .neq('external_id', '')
          .limit(5000);

        if (fallbackMatches) {
          existingTransaction = fallbackMatches.find(t => {
            const normalizedDbId = normalizeExternalId(t.external_id);
            return normalizedDbId === normalizedIncomingId;
          }) || null;
        }
      }

      if (existingTransaction) {
        const { data, error } = await supabase
          .from('transactions')
          .update({
            status,
            paid_at: paidAt,
            customer_name: payload.customer_name || undefined,
            customer_email: payload.customer_email || undefined,
            customer_phone: normalizedPhone || undefined,
            customer_document: payload.customer_document || undefined,
            metadata: payload.metadata,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingTransaction.id)
          .select()
          .single();

        if (error) throw error;

        const typeLabel = payload.type === 'boleto' ? 'Boleto' : payload.type === 'pix' ? 'PIX' : 'Cartão';
        const amount = `R$ ${Number(data.amount).toFixed(2).replace('.', ',')}`;
        
        // Send browser push notification
        await sendPushToAllSubscribers(
          supabase,
          `🔔 ${typeLabel} Atualizado`,
          `${payload.customer_name || 'Cliente'} - ${amount}`,
          `transaction-${data.id}`
        );

        // Send WirePusher notification (mobile)
        const wirePusherEventType = getWirePusherEventType(payload.type, status);
        await sendWirePusherNotification(supabase, wirePusherEventType, notificationData);

        return new Response(
          JSON.stringify({ success: true, action: 'updated', transaction_id: data.id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Insert new transaction
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        external_id: normalizedIncomingId || payload.external_id,
        type: payload.type,
        status,
        amount: payload.amount,
        description: payload.description,
        customer_name: payload.customer_name,
        customer_email: payload.customer_email,
        customer_phone: normalizedPhone,
        customer_document: payload.customer_document,
        metadata: { ...(payload.metadata || {}), boleto_url: payload.boleto_url },
        webhook_source: req.headers.get('user-agent') || 'unknown',
        paid_at: paidAt,
      })
      .select()
      .single();

    if (error) throw error;

    console.log('Transaction created:', data.id);

    const typeLabel = payload.type === 'boleto' ? 'Boleto' : payload.type === 'pix' ? 'PIX' : 'Cartão';
    const amount = `R$ ${Number(data.amount).toFixed(2).replace('.', ',')}`;
    
    // Send browser push notification
    await sendPushToAllSubscribers(
      supabase,
      `🔔 Nova Transação - ${typeLabel}`,
      `${payload.customer_name || 'Cliente'} - ${amount}`,
      `transaction-${data.id}`
    );

    // Send WirePusher notification (mobile)
    const wirePusherEventType = getWirePusherEventType(payload.type, status);
    await sendWirePusherNotification(supabase, wirePusherEventType, notificationData);

    // ===== INSTANT RECOVERY FOR PIX/CARD =====
    // Only for new transactions with pending status (not pago)
    if ((payload.type === 'pix' || payload.type === 'cartao') && status !== 'pago') {
      console.log('[webhook-receiver] PIX/Card pending transaction, triggering instant recovery...');
      
      // Run recovery in background (don't await to not delay webhook response)
      sendInstantPixCardRecovery(supabase, {
        id: data.id,
        customer_name: payload.customer_name,
        customer_phone: normalizedPhone,
        amount: payload.amount,
        description: payload.description,
        type: payload.type,
      }).catch(err => console.error('[InstantRecovery] Background error:', err));
    }

    // ===== INSTANT RECOVERY FOR BOLETO =====
    // Only for new boleto transactions with pending/gerado status (not pago)
    if (payload.type === 'boleto' && status !== 'pago') {
      console.log('[webhook-receiver] Boleto pending transaction, triggering instant boleto recovery...');
      
      // Fire-and-forget call to auto-recovery
      fetch(`${supabaseUrl}/functions/v1/auto-recovery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          type: 'boleto',
          transactionId: data.id,
        }),
      }).catch(err => console.error('[BoletoInstantRecovery] Background error:', err));
    }

    return new Response(
      JSON.stringify({ success: true, action: 'created', transaction_id: data.id }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});