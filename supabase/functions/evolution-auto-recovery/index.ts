import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

// Helper to get Brazil timezone date
function getBrazilDate(): Date {
  const now = new Date();
  const brazilOffset = -3 * 60; // UTC-3
  const utcOffset = now.getTimezoneOffset();
  return new Date(now.getTime() + (brazilOffset - utcOffset) * 60 * 1000);
}

function isWithinWorkingHours(startHour: number, endHour: number): boolean {
  const brazilDate = getBrazilDate();
  const currentHour = brazilDate.getHours();
  return currentHour >= startHour && currentHour < endHour;
}

// Get greeting based on Brazil timezone
function getGreeting(): string {
  const brazilDate = getBrazilDate();
  const hour = brazilDate.getHours();
  
  if (hour >= 6 && hour < 12) {
    return "Bom dia";
  } else if (hour >= 12 && hour < 18) {
    return "Boa tarde";
  } else {
    return "Boa noite";
  }
}

// Replace template variables
function formatMessage(template: string, data: Record<string, string>): string {
  let message = template;
  for (const [key, value] of Object.entries(data)) {
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }
  return message;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for manual trigger options
    let forceRun = false;
    let specificType: string | null = null;
    try {
      const body = await req.json();
      forceRun = body.forceRun || false;
      specificType = body.type || null;
    } catch {
      // No body or invalid JSON, use defaults
    }

    console.log('Starting auto recovery process...');

    // Get Evolution API settings
    const { data: settings, error: settingsError } = await supabase
      .from('evolution_api_settings')
      .select('*')
      .limit(1)
      .single();

    if (settingsError || !settings) {
      console.error('Evolution API settings not found');
      return new Response(
        JSON.stringify({ success: false, error: 'Evolution API não configurada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: 'Evolution API está desativada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check working hours (unless force run or working_hours_enabled is false)
    if (!forceRun && settings.working_hours_enabled && !isWithinWorkingHours(settings.working_hours_start, settings.working_hours_end)) {
      console.log('Outside working hours, skipping...');
      return new Response(
        JSON.stringify({ success: true, message: 'Fora do horário de funcionamento', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check daily limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { count: todayCount } = await supabase
      .from('evolution_message_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString())
      .eq('status', 'sent');

    const remainingLimit = settings.daily_limit - (todayCount || 0);
    if (remainingLimit <= 0 && !forceRun) {
      console.log('Daily limit reached');
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

    // Helper to send message with delay
    async function sendWithDelay(
      phone: string,
      message: string,
      type: 'boleto' | 'pix_card' | 'abandoned',
      transactionId?: string,
      abandonedEventId?: string
    ): Promise<boolean> {
      if (messagesSent >= remainingLimit && !forceRun) {
        return false;
      }

      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/evolution-send-message`, {
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
            abandonedEventId
          })
        });

        const result = await response.json();
        
        if (result.success) {
          messagesSent++;
          stats[type].sent++;
          
          // Add delay between messages
          if (settings.delay_between_messages > 0) {
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

    // Process BOLETO recovery
    if ((specificType === null || specificType === 'boleto') && settings.boleto_recovery_enabled) {
      console.log('Processing boleto recovery...');
      
      // Get boleto settings for expiration days
      const { data: boletoSettings } = await supabase
        .from('boleto_settings')
        .select('default_expiration_days')
        .limit(1)
        .single();
      
      const expirationDays = boletoSettings?.default_expiration_days || 3;

      // Get active recovery rules
      const { data: rules } = await supabase
        .from('boleto_recovery_rules')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: true });

      if (rules && rules.length > 0) {
        // Get pending boletos
        const { data: boletos } = await supabase
          .from('transactions')
          .select('*')
          .eq('type', 'boleto')
          .eq('status', 'gerado')
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

            // Find matching rule
            for (const rule of rules) {
              let shouldSend = false;
              
              if (rule.rule_type === 'days_after_generation' && daysSinceCreation === rule.days) {
                shouldSend = true;
              } else if (rule.rule_type === 'days_before_due' && daysUntilDue === rule.days) {
                shouldSend = true;
              } else if (rule.rule_type === 'days_after_due' && daysUntilDue === -rule.days) {
                shouldSend = true;
              }

              if (shouldSend) {
                // Check if already contacted today with this rule
                const { count: alreadyContacted } = await supabase
                  .from('evolution_message_log')
                  .select('*', { count: 'exact', head: true })
                  .eq('transaction_id', boleto.id)
                  .eq('message_type', 'boleto')
                  .gte('created_at', today.toISOString());

                if (alreadyContacted && alreadyContacted > 0) {
                  stats.boleto.skipped++;
                  break;
                }

                // Format message with variables
                const firstName = boleto.customer_name?.split(' ')[0] || 'Cliente';
                const formattedValue = new Intl.NumberFormat('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                }).format(boleto.amount);
                
                const message = formatMessage(rule.message, {
                  nome: boleto.customer_name || 'Cliente',
                  primeiro_nome: firstName,
                  valor: formattedValue,
                  produto: boleto.description || 'Produto',
                  vencimento: dueDate.toLocaleDateString('pt-BR'),
                  saudação: getGreeting()
                });

                await sendWithDelay(boleto.customer_phone!, message, 'boleto', boleto.id);

                // Also register in boleto_recovery_contacts
                await supabase.from('boleto_recovery_contacts').insert({
                  transaction_id: boleto.id,
                  rule_id: rule.id,
                  user_id: '00000000-0000-0000-0000-000000000000', // System user
                  contact_method: 'whatsapp_auto',
                  notes: 'Enviado automaticamente via Evolution API'
                });

                break; // Only send one message per boleto
              }
            }
          }
        }
      }
    }

    // Process PIX/CARD recovery
    if ((specificType === null || specificType === 'pix_card') && settings.pix_card_recovery_enabled) {
      console.log('Processing PIX/Card recovery...');

      // Get recovery message template
      const { data: pixSettings } = await supabase
        .from('pix_card_recovery_settings')
        .select('message')
        .limit(1)
        .single();

      const messageTemplate = pixSettings?.message || 'Olá {nome}! Notamos que seu pagamento de {valor} está pendente. Podemos ajudar?';

      // Get pending PIX/Card transactions from last 24 hours
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

          // Check if already contacted
          const { count: alreadyContacted } = await supabase
            .from('evolution_message_log')
            .select('*', { count: 'exact', head: true })
            .eq('transaction_id', tx.id)
            .eq('message_type', 'pix_card');

          if (alreadyContacted && alreadyContacted > 0) {
            stats.pix_card.skipped++;
            continue;
          }

          const firstName = tx.customer_name?.split(' ')[0] || 'Cliente';
          const formattedValue = new Intl.NumberFormat('pt-BR', { 
            style: 'currency', 
            currency: 'BRL' 
          }).format(tx.amount);

          const message = formatMessage(messageTemplate, {
            nome: tx.customer_name || 'Cliente',
            primeiro_nome: firstName,
            valor: formattedValue,
            produto: tx.description || 'Produto',
            saudação: getGreeting()
          });

          await sendWithDelay(tx.customer_phone!, message, 'pix_card', tx.id);
        }
      }
    }

    // Process ABANDONED CART recovery
    if ((specificType === null || specificType === 'abandoned') && settings.abandoned_recovery_enabled) {
      console.log('Processing abandoned cart recovery...');

      // Get recovery message template
      const { data: abandonedSettings } = await supabase
        .from('abandoned_recovery_settings')
        .select('message')
        .limit(1)
        .single();

      const messageTemplate = abandonedSettings?.message || 'Olá {primeiro_nome}! Vi que você demonstrou interesse em nossos produtos. Posso ajudar você a finalizar sua compra?';

      // Get abandoned events from last 24 hours
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

          // Check if already contacted
          const { count: alreadyContacted } = await supabase
            .from('evolution_message_log')
            .select('*', { count: 'exact', head: true })
            .eq('abandoned_event_id', event.id)
            .eq('message_type', 'abandoned');

          if (alreadyContacted && alreadyContacted > 0) {
            stats.abandoned.skipped++;
            continue;
          }

          const firstName = event.customer_name?.split(' ')[0] || 'Cliente';
          const formattedValue = event.amount ? new Intl.NumberFormat('pt-BR', { 
            style: 'currency', 
            currency: 'BRL' 
          }).format(event.amount) : '';

          const message = formatMessage(messageTemplate, {
            nome: event.customer_name || 'Cliente',
            primeiro_nome: firstName,
            valor: formattedValue,
            produto: event.product_name || 'Produto',
            saudação: getGreeting()
          });

          await sendWithDelay(event.customer_phone!, message, 'abandoned', undefined, event.id);
        }
      }
    }

    console.log('Auto recovery completed:', stats);

    return new Response(
      JSON.stringify({ 
        success: true, 
        stats,
        totalSent: messagesSent,
        remainingLimit: remainingLimit - messagesSent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in evolution-auto-recovery:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
