import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecoveryStats {
  boleto: { sent: number; failed: number; skipped: number; duplicates: number };
  pix_card: { sent: number; failed: number; skipped: number };
  abandoned: { sent: number; failed: number; skipped: number };
}

function getBrazilDate(): Date {
  const now = new Date();
  const brazilOffset = -3 * 60;
  const utcOffset = now.getTimezoneOffset();
  return new Date(now.getTime() + (brazilOffset - utcOffset) * 60 * 1000);
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
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }
  return message;
}

// Max execution time before self-continuing (120s to stay under 150s limit)
const MAX_EXEC_MS = 120_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let forceRun = false;
    let specificType: string | null = null;
    let specificTransactionId: string | null = null;
    let specificAbandonedEventId: string | null = null;
    // Continuation support
    let continueFrom = 0; // offset for boleto batch
    let accumulatedStats: RecoveryStats | null = null;
    let isContinuation = false;
    try {
      const body = await req.json();
      forceRun = body.forceRun || false;
      specificType = body.type || null;
      specificTransactionId = body.transactionId || null;
      specificAbandonedEventId = body.abandonedEventId || null;
      continueFrom = body._continueFrom || 0;
      accumulatedStats = body._accumulatedStats || null;
      isContinuation = body._isContinuation || false;
    } catch { /* no body */ }

    console.log('Starting auto recovery process...', { specificType, specificTransactionId, specificAbandonedEventId, continueFrom, isContinuation });

    const { data: settings, error: settingsError } = await supabase
      .from('messaging_api_settings')
      .select('*')
      .limit(1)
      .single();

    if (settingsError || !settings) {
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

    // Mark status as running (only on first invocation)
    if (!isContinuation) {
      await supabase.from('messaging_api_settings').update({
        last_recovery_status: 'running',
        last_recovery_started_at: new Date().toISOString(),
        last_recovery_finished_at: null,
        last_recovery_error: null,
      }).eq('id', settings.id);
    }

    const isSingleItem = !!specificTransactionId || !!specificAbandonedEventId;
    if (!forceRun && !isSingleItem && settings.working_hours_enabled && !isWithinWorkingHours(settings.working_hours_start, settings.working_hours_end)) {
      await supabase.from('messaging_api_settings').update({
        last_recovery_status: 'completed',
        last_recovery_finished_at: new Date().toISOString(),
        last_recovery_error: null,
      }).eq('id', settings.id);
      return new Response(
        JSON.stringify({ success: true, message: 'Fora do horário de funcionamento', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check boleto send hour
    const boletoSendHour = settings.boleto_send_hour ?? 9;
    const currentBrazilHour = getBrazilDate().getHours();

    const todayBrazilForLimit = getBrazilDate();
    todayBrazilForLimit.setHours(0, 0, 0, 0);
    
    const { count: todayCount } = await supabase
      .from('message_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayBrazilForLimit.toISOString())
      .eq('status', 'sent');

    const remainingLimit = settings.daily_limit - (todayCount || 0);
    if (remainingLimit <= 0 && !forceRun && !isSingleItem) {
      await supabase.from('messaging_api_settings').update({
        last_recovery_status: 'completed',
        last_recovery_finished_at: new Date().toISOString(),
        last_recovery_error: 'Limite diário atingido',
      }).eq('id', settings.id);
      return new Response(
        JSON.stringify({ success: true, message: 'Limite diário atingido', limitReached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stats: RecoveryStats = accumulatedStats || {
      boleto: { sent: 0, failed: 0, skipped: 0, duplicates: 0 },
      pix_card: { sent: 0, failed: 0, skipped: 0 },
      abandoned: { sent: 0, failed: 0, skipped: 0 }
    };

    let messagesSent = 0;
    let batchCounter = 0;
    const batchSize = settings.batch_size ?? 10;
    const batchPauseSeconds = settings.batch_pause_seconds ?? 30;

    const instanceMap: Record<string, string | null> = {
      boleto: settings.boleto_instance_name || null,
      pix_card: settings.pix_card_instance_name || null,
      abandoned: settings.abandoned_instance_name || null,
    };

    // Fetch manual recovery messages
    const { data: pixCardSettings } = await supabase
      .from('pix_card_recovery_settings')
      .select('message')
      .limit(1)
      .maybeSingle();

    const { data: abandonedSettings } = await supabase
      .from('abandoned_recovery_settings')
      .select('message')
      .limit(1)
      .maybeSingle();

    const autoMessages = {
      pix_card: pixCardSettings?.message || settings.auto_pix_card_message || 'Olá {primeiro_nome}! Notamos que seu pagamento de {valor} está pendente. Podemos ajudar?',
      abandoned: abandonedSettings?.message || settings.auto_abandoned_message || 'Olá {primeiro_nome}! Vi que você demonstrou interesse em nossos produtos. Posso ajudar você a finalizar sua compra?',
      boleto: settings.auto_boleto_message || '{saudação}, {primeiro_nome}! Seu boleto de {valor} referente a {produto} vence em {vencimento}. Não deixe passar!',
    };

    // === Pause / Stop control ===
    let _lastControlCheck = 0;
    const CONTROL_CHECK_INTERVAL_MS = 5000;

    async function checkControlStatus(): Promise<'running' | 'stopped'> {
      const now = Date.now();
      if (now - _lastControlCheck < CONTROL_CHECK_INTERVAL_MS) return 'running';
      _lastControlCheck = now;

      while (true) {
        const { data: current } = await supabase
          .from('messaging_api_settings')
          .select('last_recovery_status')
          .eq('id', settings.id)
          .single();
        const status = current?.last_recovery_status;
        if (status === 'stopped') return 'stopped';
        if (status !== 'paused') return 'running';
        console.log('[auto-recovery] Paused, waiting...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Helper: check if we're running out of time
    function isNearTimeout(): boolean {
      return (Date.now() - startTime) >= MAX_EXEC_MS;
    }

    // Helper: self-continue by re-invoking
    async function selfContinue(offset: number, currentStats: RecoveryStats): Promise<void> {
      console.log(`[auto-recovery] Near timeout, self-continuing from offset ${offset}...`);
      // Update stats in DB for live UI
      await supabase.from('messaging_api_settings').update({
        last_recovery_stats: currentStats,
      }).eq('id', settings.id);

      // Fire-and-forget re-invocation
      fetch(`${supabaseUrl}/functions/v1/auto-recovery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          forceRun: true,
          type: specificType,
          _continueFrom: offset,
          _accumulatedStats: currentStats,
          _isContinuation: true,
        }),
      }).catch(err => console.error('[auto-recovery] Self-continue invocation error:', err));
    }

    async function sendMessage(
      phone: string,
      message: string,
      type: 'boleto' | 'pix_card' | 'abandoned',
      transactionId?: string,
      abandonedEventId?: string,
      mediaAttachments?: Array<{ media_url: string; type: 'image' | 'document'; caption?: string }>,
      ruleId?: string
    ): Promise<boolean> {
      if (messagesSent >= remainingLimit && !forceRun && !isSingleItem) return false;

      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-external-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            phone,
            message,
            messageType: type,
            transactionId,
            abandonedEventId,
            instanceName: instanceMap[type],
            mediaAttachments,
            ruleId: ruleId || null,
          })
        });

        const result = await response.json();
        
        if (result.success) {
          messagesSent++;
          batchCounter++;
          stats[type].sent++;
          if (!isSingleItem) {
            if (settings.delay_between_messages > 0) {
              await new Promise(resolve => setTimeout(resolve, settings.delay_between_messages * 1000));
            }
            if (batchSize > 0 && batchCounter >= batchSize && batchPauseSeconds > 0) {
              console.log(`[auto-recovery] Batch pause: ${batchPauseSeconds}s after ${batchCounter} messages`);
              await new Promise(resolve => setTimeout(resolve, batchPauseSeconds * 1000));
              batchCounter = 0;
            }
          }
          return true;
        } else {
          stats[type].failed++;
          return false;
        }
      } catch (error) {
        console.error(`Error sending ${type} message:`, error);
        stats[type].failed++;
        return false;
      }
    }

    // ===== SINGLE BOLETO TRANSACTION (immediate send) =====
    if (specificTransactionId && specificType === 'boleto') {
      if (!settings.boleto_recovery_enabled) {
        return new Response(
          JSON.stringify({ success: true, message: 'Boleto recovery disabled', skipped: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: tx } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', specificTransactionId)
        .single();

      if (tx && tx.customer_phone) {
        const firstName = tx.customer_name?.split(' ')[0] || 'Cliente';
        const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount);

        const message = formatMessage(autoMessages.boleto, {
          nome: tx.customer_name || 'Cliente',
          primeiro_nome: firstName,
          valor: formattedValue,
          produto: tx.description || 'Produto',
          saudação: getGreeting(),
          vencimento: '',
          codigo_barras: tx.external_id || '',
        });

        // Use boleto_immediate to bypass rule_id validation trigger
        const response = await fetch(`${supabaseUrl}/functions/v1/send-external-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            phone: tx.customer_phone,
            message,
            messageType: 'boleto_immediate',
            transactionId: tx.id,
            instanceName: instanceMap.boleto,
          })
        });
        const result = await response.json();
        if (result.success) {
          messagesSent++;
          stats.boleto.sent++;
        } else {
          stats.boleto.failed++;
        }
      }

      await supabase.from('messaging_api_settings').update({
        last_recovery_status: 'completed',
        last_recovery_finished_at: new Date().toISOString(),
        last_recovery_stats: stats,
      }).eq('id', settings.id);

      return new Response(
        JSON.stringify({ success: true, stats, totalSent: messagesSent }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== SINGLE PIX/CARD TRANSACTION =====
    if (specificTransactionId && specificType === 'pix_card') {
      if (!settings.pix_card_recovery_enabled) {
        return new Response(
          JSON.stringify({ success: true, message: 'PIX/Card recovery disabled', skipped: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: tx } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', specificTransactionId)
        .single();

      if (tx && tx.customer_phone) {
        const firstName = tx.customer_name?.split(' ')[0] || 'Cliente';
        const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount);

        const message = formatMessage(autoMessages.pix_card, {
          nome: tx.customer_name || 'Cliente',
          primeiro_nome: firstName,
          valor: formattedValue,
          produto: tx.description || 'Produto',
          saudação: getGreeting()
        });

        await sendMessage(tx.customer_phone, message, 'pix_card', tx.id);
      }

      return new Response(
        JSON.stringify({ success: true, stats, totalSent: messagesSent }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== SINGLE ABANDONED EVENT =====
    if (specificAbandonedEventId && specificType === 'abandoned') {
      if (!settings.abandoned_recovery_enabled) {
        return new Response(
          JSON.stringify({ success: true, message: 'Abandoned recovery disabled', skipped: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: event } = await supabase
        .from('abandoned_events')
        .select('*')
        .eq('id', specificAbandonedEventId)
        .single();

      if (event && event.customer_phone) {
        const firstName = event.customer_name?.split(' ')[0] || 'Cliente';
        const formattedValue = event.amount ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(event.amount) : '';

        const message = formatMessage(autoMessages.abandoned, {
          nome: event.customer_name || 'Cliente',
          primeiro_nome: firstName,
          valor: formattedValue,
          produto: event.product_name || 'Produto',
          saudação: getGreeting()
        });

        await sendMessage(event.customer_phone, message, 'abandoned', undefined, event.id);
      }

      return new Response(
        JSON.stringify({ success: true, stats, totalSent: messagesSent }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== BATCH: BOLETO recovery (drip/follow-up) =====
    const shouldRunBoleto = forceRun || currentBrazilHour === boletoSendHour;
    let boletoProcessedUpTo = 0; // track offset for continuation
    let needsContinuation = false;

    if ((specificType === null || specificType === 'boleto') && settings.boleto_recovery_enabled && shouldRunBoleto) {
      console.log(`[boleto-recovery] Starting boleto recovery batch (offset: ${continueFrom})...`);

      // 1. Load settings
      const { data: boletoSettings } = await supabase
        .from('boleto_settings')
        .select('default_expiration_days')
        .limit(1)
        .single();
      const expirationDays = boletoSettings?.default_expiration_days || 3;

      // 2. Load active rules (no immediate)
      const { data: rules } = await supabase
        .from('boleto_recovery_rules')
        .select('*')
        .eq('is_active', true)
        .neq('rule_type', 'immediate')
        .order('priority', { ascending: true });

      if (rules && rules.length > 0) {
        // 4. Load unpaid boletos with phone (paginated, ordered for stable self-continuation)
        const allBoletos: any[] = [];
        let boletoFrom = 0;
        const boletoPageSize = 1000;
        let hasMoreBoletos = true;
        while (hasMoreBoletos) {
          const { data: boletosPage } = await supabase
            .from('transactions')
            .select('*')
            .eq('type', 'boleto')
            .in('status', ['gerado', 'pendente'])
            .not('customer_phone', 'is', null)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(boletoFrom, boletoFrom + boletoPageSize - 1);
          if (boletosPage && boletosPage.length > 0) {
            allBoletos.push(...boletosPage);
            boletoFrom += boletoPageSize;
            hasMoreBoletos = boletosPage.length === boletoPageSize;
          } else {
            hasMoreBoletos = false;
          }
        }
        const boletos = allBoletos;

        if (boletos && boletos.length > 0) {
          // 5. Pre-load today's sent boleto logs
          const todayBrazil = getBrazilDate();
          todayBrazil.setHours(0, 0, 0, 0);
          const todayIso = todayBrazil.toISOString();

          const { data: todayLogs } = await supabase
            .from('message_log')
            .select('transaction_id, rule_id, phone, status')
            .eq('message_type', 'boleto')
            .in('status', ['sent', 'duplicate'])
            .not('rule_id', 'is', null)
            .gte('created_at', todayIso);

          const sentTodayKeys = new Set<string>();
          const phoneDailyCount = new Map<string, number>();

          if (todayLogs) {
            for (const log of todayLogs) {
              if (log.transaction_id && log.rule_id) {
                sentTodayKeys.add(`${log.transaction_id}:${log.rule_id}`);
              }
              const last8 = log.phone.replace(/\D/g, '').slice(-8);
              if (last8.length === 8) {
                phoneDailyCount.set(last8, (phoneDailyCount.get(last8) || 0) + 1);
              }
            }
          }

          const maxPerPersonPerDay = settings.max_messages_per_person_per_day ?? 1;
          const today = getBrazilDate();
          today.setHours(0, 0, 0, 0);

          function calcDaysSince(createdAt: string): number {
            const utc = new Date(createdAt);
            const offset = -3 * 60;
            const utcOff = utc.getTimezoneOffset();
            const inBrazil = new Date(utc.getTime() + (offset - utcOff) * 60 * 1000);
            inBrazil.setHours(0, 0, 0, 0);
            return Math.round((today.getTime() - inBrazil.getTime()) / (1000 * 60 * 60 * 24));
          }

          function calcDueDate(createdAt: string): Date {
            const utc = new Date(createdAt);
            const offset = -3 * 60;
            const utcOff = utc.getTimezoneOffset();
            const inBrazil = new Date(utc.getTime() + (offset - utcOff) * 60 * 1000);
            inBrazil.setHours(0, 0, 0, 0);
            inBrazil.setDate(inBrazil.getDate() + expirationDays);
            return inBrazil;
          }

          // 6. Process each boleto (starting from continueFrom offset)
          let userStopped = false;
          for (let i = continueFrom; i < boletos.length; i++) {
            const boleto = boletos[i];
            boletoProcessedUpTo = i + 1;

            if (messagesSent >= remainingLimit && !forceRun) break;
            if (userStopped) break;

            // Check timeout — self-continue if near limit
            if (isNearTimeout()) {
              console.log(`[boleto-recovery] Near timeout at index ${i}, will self-continue...`);
              needsContinuation = true;
              break;
            }

            // Dedup: phone daily limit
            const phoneNorm = boleto.customer_phone!.replace(/\D/g, '');
            const phone8 = phoneNorm.slice(-8);

            // Check rule match FIRST so we can log duplicate with rule_id
            const daysSinceGenEarly = calcDaysSince(boleto.created_at);
            const dueDateEarly = calcDueDate(boleto.created_at);
            const daysUntilDueEarly = Math.round((dueDateEarly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            let earlyMatchedRule: typeof rules[0] | null = null;
            for (const rule of rules) {
              if (rule.rule_type === 'days_after_generation' && daysSinceGenEarly === rule.days) { earlyMatchedRule = rule; break; }
              if (rule.rule_type === 'days_before_due' && daysUntilDueEarly === rule.days) { earlyMatchedRule = rule; break; }
              if (rule.rule_type === 'days_after_due' && daysUntilDueEarly === -rule.days) { earlyMatchedRule = rule; break; }
            }

            if (!earlyMatchedRule) continue;

            // Use already-computed values
            const daysSinceGen = daysSinceGenEarly;
            const dueDate = dueDateEarly;
            const daysUntilDue = daysUntilDueEarly;
            const matchedRule = earlyMatchedRule;

            // Dedup 1: already sent/duplicated today for this transaction + rule combo
            const dedupKey = `${boleto.id}:${matchedRule.id}`;
            if (sentTodayKeys.has(dedupKey)) {
              stats.boleto.skipped++;
              continue;
            }

            // Dedup 2: phone daily limit — mark as duplicate only if not already processed
            if (phone8.length === 8 && (phoneDailyCount.get(phone8) || 0) >= maxPerPersonPerDay) {
              const normalizedPhone = phoneNorm.startsWith('55') ? phoneNorm : `55${phoneNorm}`;
              await supabase.from('message_log').insert({
                phone: normalizedPhone,
                message: 'Duplicado - telefone já contactado hoje',
                message_type: 'boleto',
                status: 'duplicate',
                transaction_id: boleto.id,
                rule_id: matchedRule.id,
                sent_at: new Date().toISOString(),
              });
              sentTodayKeys.add(dedupKey); // prevent re-creating on next continuation
              stats.boleto.duplicates++;
              continue;
            }

            console.log(`[boleto-recovery] ${boleto.id}: daysSinceGen=${daysSinceGen}, daysUntilDue=${daysUntilDue}, rule=${matchedRule.name}`);

            // === Build message and media from RULE ===
            const firstName = boleto.customer_name?.split(' ')[0] || 'Cliente';
            const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(boleto.amount);
            const metadata = boleto.metadata as Record<string, unknown> | null;
            const boletoUrl = metadata?.boleto_url as string | undefined;
            const templateVars: Record<string, string> = {
              nome: boleto.customer_name || 'Cliente',
              primeiro_nome: firstName,
              valor: formattedValue,
              produto: boleto.description || 'Produto',
              vencimento: dueDate.toLocaleDateString('pt-BR'),
              saudação: getGreeting(),
              codigo_barras: boleto.external_id || '',
            };

            const message = formatMessage(matchedRule.message, templateVars);
            const boletoMedia: Array<{ media_url: string; type: 'image' | 'document'; caption?: string }> = [];
            const mediaBlocks = (matchedRule.media_blocks as Array<{ type: string; enabled: boolean }>) || [];
            if (boletoUrl) {
              if (mediaBlocks.find((b) => b.type === 'pdf')?.enabled) {
                boletoMedia.push({ media_url: boletoUrl, type: 'document', caption: `Boleto - ${boleto.description || 'Produto'}` });
              }
              if (mediaBlocks.find((b) => b.type === 'image')?.enabled) {
                boletoMedia.push({ media_url: boletoUrl, type: 'image', caption: `Boleto - ${boleto.description || 'Produto'}` });
              }
            }

            // Check pause/stop before sending
            if (!isSingleItem) {
              const cs = await checkControlStatus();
              if (cs === 'stopped') { userStopped = true; break; }
            }

            // Send with ruleId
            const sent = await sendMessage(boleto.customer_phone!, message, 'boleto', boleto.id, undefined, boletoMedia.length > 0 ? boletoMedia : undefined, matchedRule.id);

            if (sent) {
              sentTodayKeys.add(dedupKey);
              if (phone8.length === 8) {
                phoneDailyCount.set(phone8, (phoneDailyCount.get(phone8) || 0) + 1);
              }
            }
          }
        }
      }
    }

    // If we need to continue, fire self-invocation and return
    if (needsContinuation) {
      await selfContinue(boletoProcessedUpTo, stats);
      return new Response(
        JSON.stringify({ success: true, continuing: true, stats, processedUpTo: boletoProcessedUpTo }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== BATCH: PIX/CARD recovery =====
    if ((specificType === null || specificType === 'pix_card') && settings.pix_card_recovery_enabled && !specificTransactionId) {
      console.log('Processing PIX/Card recovery...');

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .in('type', ['pix', 'cartao'])
        .eq('status', 'pendente')
        .gte('created_at', yesterday.toISOString())
        .not('customer_phone', 'is', null);

      if (transactions) {
        const pixCardPhonesContacted = new Set<string>();
        for (const tx of transactions) {
          if (messagesSent >= remainingLimit && !forceRun) break;
          if (!isSingleItem) { const cs = await checkControlStatus(); if (cs === 'stopped') break; }

          const txPhoneNorm = tx.customer_phone!.replace(/\D/g, '');
          const txPhone8 = txPhoneNorm.slice(-8);
          if (txPhone8.length === 8 && pixCardPhonesContacted.has(txPhone8)) {
            stats.pix_card.skipped++;
            continue;
          }

          const { count: alreadyContacted } = await supabase
            .from('message_log')
            .select('*', { count: 'exact', head: true })
            .eq('transaction_id', tx.id)
            .eq('message_type', 'pix_card');

          if (alreadyContacted && alreadyContacted > 0) {
            stats.pix_card.skipped++;
            continue;
          }

          const firstName = tx.customer_name?.split(' ')[0] || 'Cliente';
          const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount);

          const message = formatMessage(autoMessages.pix_card, {
            nome: tx.customer_name || 'Cliente',
            primeiro_nome: firstName,
            valor: formattedValue,
            produto: tx.description || 'Produto',
            saudação: getGreeting()
          });

          await sendMessage(tx.customer_phone!, message, 'pix_card', tx.id);
          if (txPhone8.length === 8) pixCardPhonesContacted.add(txPhone8);
        }
      }
    }

    // ===== BATCH: ABANDONED recovery =====
    if ((specificType === null || specificType === 'abandoned') && settings.abandoned_recovery_enabled && !specificAbandonedEventId) {
      console.log('Processing abandoned cart recovery...');

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: events } = await supabase
        .from('abandoned_events')
        .select('*')
        .gte('created_at', yesterday.toISOString())
        .not('customer_phone', 'is', null);

      if (events) {
        const abandonedPhonesContacted = new Set<string>();
        for (const event of events) {
          if (messagesSent >= remainingLimit && !forceRun) break;
          if (!isSingleItem) { const cs = await checkControlStatus(); if (cs === 'stopped') break; }

          const evPhoneNorm = event.customer_phone!.replace(/\D/g, '');
          const evPhone8 = evPhoneNorm.slice(-8);
          if (evPhone8.length === 8 && abandonedPhonesContacted.has(evPhone8)) {
            stats.abandoned.skipped++;
            continue;
          }

          const { count: alreadyContacted } = await supabase
            .from('message_log')
            .select('*', { count: 'exact', head: true })
            .eq('abandoned_event_id', event.id)
            .eq('message_type', 'abandoned');

          if (alreadyContacted && alreadyContacted > 0) {
            stats.abandoned.skipped++;
            continue;
          }

          const firstName = event.customer_name?.split(' ')[0] || 'Cliente';
          const formattedValue = event.amount ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(event.amount) : '';

          const message = formatMessage(autoMessages.abandoned, {
            nome: event.customer_name || 'Cliente',
            primeiro_nome: firstName,
            valor: formattedValue,
            produto: event.product_name || 'Produto',
            saudação: getGreeting()
          });

          await sendMessage(event.customer_phone!, message, 'abandoned', undefined, event.id);
          if (evPhone8.length === 8) abandonedPhonesContacted.add(evPhone8);
        }
      }
    }

    // Check if user stopped mid-process
    const { data: finalCheck } = await supabase
      .from('messaging_api_settings')
      .select('last_recovery_status')
      .eq('id', settings.id)
      .single();
    const wasStopped = finalCheck?.last_recovery_status === 'stopped';

    console.log('Auto recovery completed:', stats, wasStopped ? '(stopped by user)' : '');

    await supabase.from('messaging_api_settings').update({
      last_recovery_status: wasStopped ? 'stopped' : 'completed',
      last_recovery_finished_at: new Date().toISOString(),
      last_recovery_stats: stats,
      last_recovery_error: wasStopped ? 'Parado pelo usuário' : null,
    }).eq('id', settings.id);

    return new Response(
      JSON.stringify({ success: true, stats, totalSent: messagesSent, remainingLimit: remainingLimit - messagesSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in auto-recovery:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const sb = createClient(supabaseUrl, supabaseServiceKey);
      await sb.from('messaging_api_settings').update({
        last_recovery_status: 'error',
        last_recovery_finished_at: new Date().toISOString(),
        last_recovery_error: errorMessage,
      }).neq('id', '');
    } catch { /* ignore */ }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
