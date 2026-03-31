import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecoveryStats {
  boleto: { sent: number; failed: number; skipped: number };
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let forceRun = false;
    let specificType: string | null = null;
    let specificTransactionId: string | null = null;
    let specificAbandonedEventId: string | null = null;
    try {
      const body = await req.json();
      forceRun = body.forceRun || false;
      specificType = body.type || null;
      specificTransactionId = body.transactionId || null;
      specificAbandonedEventId = body.abandonedEventId || null;
    } catch { /* no body */ }

    console.log('Starting auto recovery process...', { specificType, specificTransactionId, specificAbandonedEventId });

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

    const isSingleItem = !!specificTransactionId || !!specificAbandonedEventId;
    if (!forceRun && !isSingleItem && settings.working_hours_enabled && !isWithinWorkingHours(settings.working_hours_start, settings.working_hours_end)) {
      return new Response(
        JSON.stringify({ success: true, message: 'Fora do horário de funcionamento', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check boleto send hour — only run boleto batch if current hour matches configured hour
    const boletoSendHour = settings.boleto_send_hour ?? 9;
    const currentBrazilHour = getBrazilDate().getHours();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { count: todayCount } = await supabase
      .from('message_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString())
      .eq('status', 'sent');

    const remainingLimit = settings.daily_limit - (todayCount || 0);
    if (remainingLimit <= 0 && !forceRun && !isSingleItem) {
      return new Response(
        JSON.stringify({ success: true, message: 'Limite diário atingido', limitReached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stats: RecoveryStats = {
      boleto: { sent: 0, failed: 0, skipped: 0 },
      pix_card: { sent: 0, failed: 0, skipped: 0 },
      abandoned: { sent: 0, failed: 0, skipped: 0 }
    };

    let messagesSent = 0;

    const instanceMap: Record<string, string | null> = {
      boleto: settings.boleto_instance_name || null,
      pix_card: settings.pix_card_instance_name || null,
      abandoned: settings.abandoned_instance_name || null,
    };

    // Use dedicated auto-recovery messages from messaging_api_settings
    const autoMessages = {
      pix_card: settings.auto_pix_card_message || 'Olá {primeiro_nome}! Notamos que seu pagamento de {valor} está pendente. Podemos ajudar?',
      abandoned: settings.auto_abandoned_message || 'Olá {primeiro_nome}! Vi que você demonstrou interesse em nossos produtos. Posso ajudar você a finalizar sua compra?',
      boleto: settings.auto_boleto_message || '{saudação}, {primeiro_nome}! Seu boleto de {valor} referente a {produto} vence em {vencimento}. Não deixe passar!',
    };

    async function sendMessage(
      phone: string,
      message: string,
      type: 'boleto' | 'pix_card' | 'abandoned',
      transactionId?: string,
      abandonedEventId?: string,
      mediaAttachments?: Array<{ media_url: string; type: 'image' | 'document'; caption?: string }>
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
          })
        });

        const result = await response.json();
        
        if (result.success) {
          messagesSent++;
          stats[type].sent++;
          if (settings.delay_between_messages > 0 && !isSingleItem) {
            await new Promise(resolve => setTimeout(resolve, settings.delay_between_messages * 1000));
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

    // ===== BATCH: BOLETO recovery =====
    const shouldRunBoleto = forceRun || currentBrazilHour === boletoSendHour;
    if ((specificType === null || specificType === 'boleto') && settings.boleto_recovery_enabled && shouldRunBoleto) {
      console.log('Processing boleto recovery...');
      
      const { data: boletoSettings } = await supabase
        .from('boleto_settings')
        .select('default_expiration_days')
        .limit(1)
        .single();
      
      const expirationDays = boletoSettings?.default_expiration_days || 3;

      const { data: rules } = await supabase
        .from('boleto_recovery_rules')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: true });

      if (rules && rules.length > 0) {
        const { data: boletos } = await supabase
          .from('transactions')
          .select('*')
          .eq('type', 'boleto')
          .in('status', ['gerado', 'pendente'])
          .not('customer_phone', 'is', null);

        if (boletos) {
          for (const boleto of boletos) {
            if (messagesSent >= remainingLimit && !forceRun) break;

            const createdAt = new Date(boleto.created_at);
            const dueDate = new Date(createdAt);
            dueDate.setDate(dueDate.getDate() + expirationDays);
            
            const today = getBrazilDate();
            today.setHours(0, 0, 0, 0);
            
            const daysSinceCreation = Math.floor((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
            const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            for (const rule of rules) {
              let shouldSend = false;
              
              if (rule.rule_type === 'days_after_generation' && daysSinceCreation === rule.days) shouldSend = true;
              else if (rule.rule_type === 'days_before_due' && daysUntilDue === rule.days) shouldSend = true;
              else if (rule.rule_type === 'days_after_due' && daysUntilDue === -rule.days) shouldSend = true;

              if (shouldSend) {
                const { count: alreadyContacted } = await supabase
                  .from('message_log')
                  .select('*', { count: 'exact', head: true })
                  .eq('transaction_id', boleto.id)
                  .eq('message_type', 'boleto')
                  .gte('created_at', today.toISOString());

                if (alreadyContacted && alreadyContacted > 0) {
                  stats.boleto.skipped++;
                  break;
                }

                const firstName = boleto.customer_name?.split(' ')[0] || 'Cliente';
                const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(boleto.amount);
                
                // Use rule-specific message for boleto (régua de cobrança)
                const message = formatMessage(rule.message, {
                  nome: boleto.customer_name || 'Cliente',
                  primeiro_nome: firstName,
                  valor: formattedValue,
                  produto: boleto.description || 'Produto',
                  vencimento: dueDate.toLocaleDateString('pt-BR'),
                  saudação: getGreeting()
                });

                await sendMessage(boleto.customer_phone!, message, 'boleto', boleto.id);

                await supabase.from('boleto_recovery_contacts').insert({
                  transaction_id: boleto.id,
                  rule_id: rule.id,
                  user_id: '00000000-0000-0000-0000-000000000000',
                  contact_method: 'whatsapp_auto',
                  notes: 'Enviado automaticamente via API externa'
                });

                break;
              }
            }
          }
        }
      }
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
        for (const tx of transactions) {
          if (messagesSent >= remainingLimit && !forceRun) break;

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
        for (const event of events) {
          if (messagesSent >= remainingLimit && !forceRun) break;

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
        }
      }
    }

    console.log('Auto recovery completed:', stats);

    return new Response(
      JSON.stringify({ success: true, stats, totalSent: messagesSent, remainingLimit: remainingLimit - messagesSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in auto-recovery:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
