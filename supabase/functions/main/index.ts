import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// ═══════════════════════════════════════════════════════════════════════════
//  HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  return phone.replace(/^\+/, '').replace(/\D/g, '');
}

function normalizeExternalId(externalId?: string): string | undefined {
  if (!externalId) return undefined;
  return externalId.replace(/[\s.\-\/]/g, '');
}

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
  subscription: { endpoint: string; p256dh: string; auth: string },
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
    return;
  }

  const payload = { title, body, tag };
  const invalidSubscriptions: string[] = [];

  for (const sub of subscriptions) {
    const success = await sendPushNotification(sub, payload, vapidPublicKey, vapidPrivateKey);
    if (!success) {
      invalidSubscriptions.push(sub.id);
    }
  }

  if (invalidSubscriptions.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', invalidSubscriptions);
  }
}

async function sendWirePusherNotification(
  supabase: any,
  eventType: string,
  transactionData: { customer_name?: string; amount: number; type: string }
): Promise<void> {
  try {
    const { data: settings } = await supabase
      .from('wirepusher_settings')
      .select('device_id, is_enabled')
      .maybeSingle();

    if (!settings?.is_enabled || !settings?.device_id) return;

    const { data: template } = await supabase
      .from('wirepusher_notification_templates')
      .select('*')
      .eq('event_type', eventType)
      .eq('is_active', true)
      .maybeSingle();

    if (!template) return;

    const title = replaceTemplateVariables(template.title, transactionData);
    const message = replaceTemplateVariables(template.message, transactionData);

    const url = new URL('https://wirepusher.com/send');
    url.searchParams.set('id', settings.device_id);
    url.searchParams.set('title', title);
    url.searchParams.set('message', message);
    url.searchParams.set('type', template.notification_type);

    await fetch(url.toString());
  } catch (error) {
    console.error('[WirePusher] Error:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  WEBHOOK RECEIVER HANDLER
// ═══════════════════════════════════════════════════════════════════════════

async function handleWebhookReceiver(req: Request): Promise<Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const payload = await req.json();
  console.log('Webhook received:', JSON.stringify(payload));

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
  const notificationData = { customer_name: payload.customer_name, amount: payload.amount, type: payload.type };

  if (normalizedIncomingId) {
    const { data: transactions } = await supabase
      .from('transactions')
      .select('id, external_id')
      .not('external_id', 'is', null)
      .neq('external_id', '');

    const existingTransaction = transactions?.find(t => normalizeExternalId(t.external_id) === normalizedIncomingId);

    if (existingTransaction) {
      const { data, error } = await supabase
        .from('transactions')
        .update({
          status,
          paid_at: paidAt,
          customer_name: payload.customer_name || undefined,
          customer_email: payload.customer_email || undefined,
          customer_phone: normalizePhone(payload.customer_phone) || undefined,
          metadata: payload.metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTransaction.id)
        .select()
        .single();

      if (error) throw error;

      const typeLabel = payload.type === 'boleto' ? 'Boleto' : payload.type === 'pix' ? 'PIX' : 'Cartão';
      const amount = `R$ ${Number(data.amount).toFixed(2).replace('.', ',')}`;
      
      await sendPushToAllSubscribers(supabase, `🔔 ${typeLabel} Atualizado`, `${payload.customer_name || 'Cliente'} - ${amount}`, `transaction-${data.id}`);
      await sendWirePusherNotification(supabase, `${payload.type}_${status}`, notificationData);

      return new Response(
        JSON.stringify({ success: true, action: 'updated', transaction_id: data.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

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
      customer_phone: normalizePhone(payload.customer_phone),
      customer_document: payload.customer_document,
      metadata: { ...(payload.metadata || {}), boleto_url: payload.boleto_url },
      webhook_source: req.headers.get('user-agent') || 'unknown',
      paid_at: paidAt,
    })
    .select()
    .single();

  if (error) throw error;

  const typeLabel = payload.type === 'boleto' ? 'Boleto' : payload.type === 'pix' ? 'PIX' : 'Cartão';
  const amount = `R$ ${Number(data.amount).toFixed(2).replace('.', ',')}`;
  
  await sendPushToAllSubscribers(supabase, `🔔 Nova Transação - ${typeLabel}`, `${payload.customer_name || 'Cliente'} - ${amount}`, `transaction-${data.id}`);
  await sendWirePusherNotification(supabase, `${payload.type}_${status}`, notificationData);

  return new Response(
    JSON.stringify({ success: true, action: 'created', transaction_id: data.id }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  WEBHOOK GROUPS HANDLER
// ═══════════════════════════════════════════════════════════════════════════

async function handleWebhookGroups(req: Request): Promise<Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const payload = await req.json();
  console.log('Group webhook received:', JSON.stringify(payload));

  const { group_name, event_type, current_members, entries, exits } = payload;

  if (!group_name) {
    return new Response(
      JSON.stringify({ error: 'group_name is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: existingGroup } = await supabase
    .from('groups')
    .select('*')
    .eq('name', group_name)
    .single();

  if (existingGroup) {
    const updateData: Record<string, any> = {};

    if (entries !== undefined) updateData.total_entries = entries;
    if (exits !== undefined) updateData.total_exits = exits;
    if (current_members !== undefined) updateData.current_members = current_members;

    if (event_type === 'entry') {
      updateData.total_entries = (existingGroup.total_entries || 0) + 1;
      updateData.current_members = (existingGroup.current_members || 0) + 1;
    }

    if (event_type === 'exit') {
      updateData.total_exits = (existingGroup.total_exits || 0) + 1;
      updateData.current_members = Math.max(0, (existingGroup.current_members || 0) - 1);
    }

    await supabase.from('groups').update(updateData).eq('id', existingGroup.id);

    // Use Brazil timezone (UTC-3) for date
    const now = new Date();
    const brazilOffset = -3 * 60;
    const localOffset = now.getTimezoneOffset();
    const brazilTime = new Date(now.getTime() + (localOffset - brazilOffset) * 60000);
    const today = brazilTime.toISOString().split('T')[0];
    const finalMembers = updateData.current_members ?? existingGroup.current_members;

    const { data: existingHistory } = await supabase
      .from('group_statistics_history')
      .select('*')
      .eq('group_id', existingGroup.id)
      .eq('date', today)
      .single();

    if (existingHistory) {
      await supabase
        .from('group_statistics_history')
        .update({
          entries: existingHistory.entries + (event_type === 'entry' ? 1 : 0),
          exits: existingHistory.exits + (event_type === 'exit' ? 1 : 0),
          current_members: finalMembers,
        })
        .eq('id', existingHistory.id);
    } else {
      await supabase
        .from('group_statistics_history')
        .insert({
          group_id: existingGroup.id,
          date: today,
          entries: entries !== undefined ? entries : (event_type === 'entry' ? 1 : 0),
          exits: exits !== undefined ? exits : (event_type === 'exit' ? 1 : 0),
          current_members: finalMembers,
        });
    }

    console.log('Group updated successfully:', group_name);
  } else {
    await supabase.from('groups').insert({
      name: group_name,
      current_members: current_members || 0,
      total_entries: entries || 0,
      total_exits: exits || 0,
    });

    console.log('Group created successfully:', group_name);
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Group data processed' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  WEBHOOK ABANDONED HANDLER
// ═══════════════════════════════════════════════════════════════════════════

async function handleWebhookAbandoned(req: Request): Promise<Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const payload = await req.json();
  console.log('Abandoned event webhook received:', JSON.stringify(payload));

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

  const { data, error } = await supabase
    .from('abandoned_events')
    .insert({
      event_type: payload.event_type || 'cart_abandoned',
      customer_name: payload.customer_name || null,
      customer_phone: normalizePhone(payload.customer_phone),
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

  if (error) throw error;

  console.log('Abandoned event created successfully:', data.id);

  return new Response(
    JSON.stringify({ success: true, id: data.id }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  DELIVERY ACCESS HANDLER
// ═══════════════════════════════════════════════════════════════════════════

async function handleDeliveryAccess(req: Request): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { slug, phone } = await req.json();

  if (!slug || !phone) {
    return new Response(
      JSON.stringify({ error: "slug and phone are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const normalizedPhone = phone.replace(/\D/g, "");
  console.log(`[delivery-access] Processing access for slug: ${slug}, phone: ${normalizedPhone}`);

  const { data: product, error: productError } = await supabase
    .from("delivery_products")
    .select("*, delivery_pixels(*)")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (productError || !product) {
    return new Response(
      JSON.stringify({ error: "Product not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: existingAccess } = await supabase
    .from("delivery_accesses")
    .select("*")
    .eq("product_id", product.id)
    .eq("phone", normalizedPhone)
    .maybeSingle();

  let whatsappUrl = `https://api.whatsapp.com/send?phone=${normalizedPhone}`;
  if (product.whatsapp_message) {
    whatsappUrl += `&text=${encodeURIComponent(product.whatsapp_message)}`;
  }

  if (existingAccess) {
    return new Response(
      JSON.stringify({
        already_accessed: true,
        redirect_url: whatsappUrl,
        product: {
          name: product.name,
          page_title: product.page_title,
          page_message: product.page_message,
          page_logo: product.page_logo,
          redirect_delay: product.redirect_delay,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  await supabase.from("delivery_accesses").insert({
    product_id: product.id,
    phone: normalizedPhone,
    pixel_fired: true,
    webhook_sent: !!product.delivery_webhook_url,
  });

  if (product.delivery_webhook_url) {
    try {
      await fetch(product.delivery_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefone: normalizedPhone,
          produto: product.name,
          produto_slug: product.slug,
        }),
      });
    } catch (e) {
      console.error("[delivery-access] Webhook error:", e);
    }
  }

  const activePixels = (product.delivery_pixels || []).filter((p: any) => p.is_active);

  return new Response(
    JSON.stringify({
      already_accessed: false,
      redirect_url: whatsappUrl,
      pixels: activePixels.map((p: any) => ({
        platform: p.platform,
        pixel_id: p.pixel_id,
        event_name: p.event_name,
      })),
      product: {
        name: product.name,
        page_title: product.page_title,
        page_message: product.page_message,
        page_logo: product.page_logo,
        redirect_delay: product.redirect_delay,
      },
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  PDF PROXY HANDLER
// ═══════════════════════════════════════════════════════════════════════════

async function handlePdfProxy(req: Request): Promise<Response> {
  const { url } = await req.json();

  if (!url) {
    return new Response(
      JSON.stringify({ error: "URL is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log("Fetching PDF from:", url);

  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: `Failed to fetch PDF: ${response.status}` }),
      { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

  return new Response(
    JSON.stringify({ data: base64, contentType: response.headers.get("content-type") || "application/pdf" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  ADMIN HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function verifyAdmin(req: Request): Promise<{ isAdmin: boolean; user: any; supabaseAdmin: any }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { isAdmin: false, user: null, supabaseAdmin: null };

  const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) return { isAdmin: false, user: null, supabaseAdmin: null };

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: roleData } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .single();

  return { isAdmin: !!roleData, user, supabaseAdmin };
}

async function handleAdminCreateUser(req: Request): Promise<Response> {
  const { isAdmin, supabaseAdmin } = await verifyAdmin(req);
  
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Acesso negado" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { email, password } = await req.json();

  if (!email || !password) {
    return new Response(JSON.stringify({ error: "Email e senha são obrigatórios" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
  });

  if (createError) {
    return new Response(JSON.stringify({ error: createError.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role: "user" });

  return new Response(JSON.stringify({ success: true, user: newUser.user }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleAdminDeleteUser(req: Request): Promise<Response> {
  const { isAdmin, user, supabaseAdmin } = await verifyAdmin(req);
  
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Acesso negado" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { userId } = await req.json();

  if (!userId) {
    return new Response(JSON.stringify({ error: "ID do usuário é obrigatório" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (userId === user.id) {
    return new Response(JSON.stringify({ error: "Você não pode remover a si mesmo" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: targetRole } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .single();

  if (targetRole) {
    return new Response(JSON.stringify({ error: "Não é possível remover outro administrador" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleAdminResetPassword(req: Request): Promise<Response> {
  const { isAdmin, supabaseAdmin } = await verifyAdmin(req);
  
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Acesso negado" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { userId, newPassword } = await req.json();

  if (!userId || !newPassword) {
    return new Response(JSON.stringify({ error: "ID do usuário e nova senha são obrigatórios" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (newPassword.length < 6) {
    return new Response(JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  IMPORT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleImportTransactions(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { rows } = await req.json();

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return new Response(JSON.stringify({ error: "Nenhum dado para importar" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const validTypes = ["boleto", "pix", "cartao"];
  const validStatuses = ["gerado", "pago", "pendente", "cancelado", "expirado"];

  const transactionsToInsert = rows.map((row: any) => {
    let type = (row.type || "boleto").toLowerCase().trim();
    if (!validTypes.includes(type)) type = "boleto";

    let status = (row.status || "gerado").toLowerCase().trim();
    if (!validStatuses.includes(status)) status = "gerado";

    let amount = parseFloat(String(row.amount || "0").replace(",", "."));
    if (isNaN(amount)) amount = 0;

    let metadata = {};
    if (row.metadata) {
      try {
        metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
      } catch { metadata = {}; }
    }

    return {
      type, status, amount,
      customer_name: row.customer_name || null,
      customer_email: row.customer_email || null,
      customer_phone: row.customer_phone ? String(row.customer_phone).replace(/^\+/, "") : null,
      customer_document: row.customer_document || null,
      description: row.description || null,
      external_id: row.external_id || null,
      paid_at: row.paid_at || null,
      created_at: row.created_at || new Date().toISOString(),
      webhook_source: row.webhook_source || "import",
      metadata,
    };
  });

  const batchSize = 100;
  let imported = 0;
  let errors = 0;

  for (let i = 0; i < transactionsToInsert.length; i += batchSize) {
    const batch = transactionsToInsert.slice(i, i + batchSize);
    const { data, error } = await supabase.from("transactions").insert(batch).select("id");
    if (error) errors += batch.length;
    else imported += data?.length || 0;
  }

  return new Response(
    JSON.stringify({ imported, errors, total: rows.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleImportAbandonedEvents(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { rows } = await req.json();

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return new Response(JSON.stringify({ error: "Nenhum dado para importar" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventsToInsert = rows.map((row: any) => {
    let amount = null;
    if (row.amount) {
      amount = parseFloat(String(row.amount).replace(",", "."));
      if (isNaN(amount)) amount = null;
    }

    let metadata = {};
    if (row.metadata) {
      try {
        metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
      } catch { metadata = {}; }
    }

    return {
      event_type: row.event_type || "cart_abandoned",
      customer_name: row.customer_name || null,
      customer_email: row.customer_email || null,
      customer_phone: row.customer_phone ? String(row.customer_phone).replace(/^\+/, "") : null,
      customer_document: row.customer_document || null,
      amount,
      product_name: row.product_name || null,
      funnel_stage: row.funnel_stage || null,
      error_message: row.error_message || null,
      utm_source: row.utm_source || null,
      utm_medium: row.utm_medium || null,
      utm_campaign: row.utm_campaign || null,
      utm_term: row.utm_term || null,
      utm_content: row.utm_content || null,
      created_at: row.created_at || new Date().toISOString(),
      metadata,
    };
  });

  const batchSize = 100;
  let imported = 0;
  let errors = 0;

  for (let i = 0; i < eventsToInsert.length; i += batchSize) {
    const batch = eventsToInsert.slice(i, i + batchSize);
    const { data, error } = await supabase.from("abandoned_events").insert(batch).select("id");
    if (error) errors += batch.length;
    else imported += data?.length || 0;
  }

  return new Response(
    JSON.stringify({ imported, errors, total: rows.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  TYPEBOT STATS HANDLER
// ═══════════════════════════════════════════════════════════════════════════

const TYPEBOT_BASE_URL = 'https://typebot.origemdavida.online';
const WORKSPACE_ID = 'cmghj8t790000o918ec7vgtt8';

async function handleTypebotStats(req: Request): Promise<Response> {
  const typebotToken = Deno.env.get('TYPEBOT_API_TOKEN');
  
  if (!typebotToken) {
    return new Response(
      JSON.stringify({ error: 'Typebot API token not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const body = await req.json().catch(() => ({}));
  const action = body.action || 'stats';

  async function getAllTypebots(): Promise<any[]> {
    const listUrl = `${TYPEBOT_BASE_URL}/api/v1/typebots?workspaceId=${WORKSPACE_ID}`;
    const listResponse = await fetch(listUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${typebotToken}`, 'Content-Type': 'application/json' },
    });
    if (!listResponse.ok) return [];
    const listData = await listResponse.json();
    return listData.typebots || listData || [];
  }

  async function getTypebotResults(typebotId: string, fromDate?: Date, toDate?: Date): Promise<any[]> {
    let allResults: any[] = [];
    let cursor: string | null = null;
    let hasMore = true;
    
    while (hasMore) {
      const fetchUrl: string = cursor 
        ? `${TYPEBOT_BASE_URL}/api/v1/typebots/${typebotId}/results?limit=100&cursor=${cursor}`
        : `${TYPEBOT_BASE_URL}/api/v1/typebots/${typebotId}/results?limit=100`;

      const fetchResponse: Response = await fetch(fetchUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${typebotToken}`, 'Content-Type': 'application/json' },
      });

      if (!fetchResponse.ok) return allResults;

      const fetchData: any = await fetchResponse.json();
      const results = fetchData.results || [];
      
      if (fromDate && toDate) {
        for (const result of results) {
          const createdAt = new Date(result.createdAt);
          if (createdAt >= fromDate && createdAt <= toDate) {
            allResults.push(result);
          }
        }
      } else {
        allResults = [...allResults, ...results];
      }
      
      if (fetchData.nextCursor) cursor = fetchData.nextCursor;
      else hasMore = false;
      
      if (allResults.length >= 10000) hasMore = false;
    }
    
    return allResults;
  }

  if (action === 'list') {
    const typebots = await getAllTypebots();
    return new Response(
      JSON.stringify({ typebots: typebots.map(t => ({ id: t.id, name: t.name })) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (action === 'ranking') {
    const fromDate = body.fromDate ? new Date(body.fromDate) : new Date();
    const toDate = body.toDate ? new Date(body.toDate) : new Date();

    if (body.typebotId) {
      const results = await getTypebotResults(body.typebotId, fromDate, toDate);
      return new Response(
        JSON.stringify({ ranking: [{ id: body.typebotId, name: 'Typebot', count: results.length, completed: results.filter(r => r.isCompleted).length }] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const typebots = await getAllTypebots();
    const rankingPromises = typebots.map(async (typebot: any) => {
      const results = await getTypebotResults(typebot.id, fromDate, toDate);
      return { id: typebot.id, name: typebot.name, count: results.length, completed: results.filter((r: any) => r.isCompleted).length };
    });

    const ranking = (await Promise.all(rankingPromises)).sort((a, b) => b.count - a.count);

    return new Response(
      JSON.stringify({ ranking }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (action === 'sync') {
    const targetDate = body.date ? new Date(body.date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];
    
    const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
    const endOfDay = new Date(dateStr + 'T23:59:59.999Z');

    const typebots = await getAllTypebots();
    
    for (const typebot of typebots) {
      const results = await getTypebotResults(typebot.id, startOfDay, endOfDay);
      const completedCount = results.filter(r => r.isCompleted).length;
      
      await supabase.from('typebot_daily_stats').upsert({
        typebot_id: typebot.id,
        typebot_name: typebot.name,
        date: dateStr,
        total_leads: results.length,
        completed_leads: completedCount,
        updated_at: new Date().toISOString()
      }, { onConflict: 'typebot_id,date' });
    }

    return new Response(
      JSON.stringify({ success: true, date: dateStr, typebotsProcessed: typebots.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (action === 'history') {
    const days = body.days || 30;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    
    let query = supabase.from('typebot_daily_stats').select('*').gte('date', fromDate.toISOString().split('T')[0]).order('date', { ascending: true });
    if (body.typebotId) query = query.eq('typebot_id', body.typebotId);
    
    const { data, error } = await query;
    
    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch history' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ history: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ error: 'Unknown action' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN ROUTER
// ═══════════════════════════════════════════════════════════════════════════

const functionHandlers: Record<string, (req: Request) => Promise<Response>> = {
  'webhook-receiver': handleWebhookReceiver,
  'webhook-groups': handleWebhookGroups,
  'webhook-abandoned': handleWebhookAbandoned,
  'delivery-access': handleDeliveryAccess,
  'pdf-proxy': handlePdfProxy,
  'admin-create-user': handleAdminCreateUser,
  'admin-delete-user': handleAdminDeleteUser,
  'admin-reset-password': handleAdminResetPassword,
  'import-transactions': handleImportTransactions,
  'import-abandoned-events': handleImportAbandonedEvents,
  'typebot-stats': handleTypebotStats,
};

serve(async (req: Request) => {
  console.log('[main] Request received:', req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  // Remove 'main' if it's the first part (when called as /main/webhook-receiver)
  let functionName = pathParts[0];
  if (functionName === 'main' && pathParts.length > 1) {
    functionName = pathParts[1];
  }

  console.log('[main] Function name:', functionName, 'Path parts:', pathParts);

  // Health check / root
  if (!functionName || functionName === 'main' || functionName === 'health') {
    return new Response(
      JSON.stringify({ 
        status: 'ok', 
        message: 'Supabase Edge Functions Running',
        available_functions: Object.keys(functionHandlers),
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }

  const handler = functionHandlers[functionName];
  
  if (!handler) {
    return new Response(
      JSON.stringify({ 
        error: 'Function not found',
        function: functionName,
        available: Object.keys(functionHandlers)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
    );
  }

  try {
    return await handler(req);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[main] Error in function ${functionName}:`, error);
    return new Response(
      JSON.stringify({ 
        error: 'Function error',
        function: functionName,
        message: errorMessage 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
