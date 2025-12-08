import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const phone = url.searchParams.get('phone');

    console.log('[WhatsApp Dashboard] Action:', action, 'Phone:', phone);

    // Busca transações recentes
    if (action === 'recent') {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return new Response(JSON.stringify({ transactions }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Busca dados de um lead específico por telefone
    if (action === 'lead' && phone) {
      // Normaliza o telefone para busca
      const cleanPhone = phone.replace(/\D/g, '');
      
      // Busca todas as variações possíveis do telefone
      const phoneVariations = [
        cleanPhone,
        cleanPhone.startsWith('55') ? cleanPhone.slice(2) : `55${cleanPhone}`,
      ];

      // Busca transações
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .or(phoneVariations.map(p => `normalized_phone.ilike.%${p}%`).join(','))
        .order('created_at', { ascending: false });

      if (txError) throw txError;

      // Busca abandonos
      const { data: abandoned, error: abError } = await supabase
        .from('abandoned_events')
        .select('*')
        .or(phoneVariations.map(p => `normalized_phone.ilike.%${p}%`).join(','))
        .order('created_at', { ascending: false });

      if (abError) throw abError;

      // Busca customer
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .or(phoneVariations.map(p => `normalized_phone.ilike.%${p}%`).join(','))
        .maybeSingle();

      // Busca templates de recuperação de boleto
      const { data: recoveryTemplates } = await supabase
        .from('boleto_recovery_templates')
        .select('*')
        .eq('is_default', true)
        .maybeSingle();

      // Busca configurações de recuperação PIX/Cartão
      const { data: pixCardSettings } = await supabase
        .from('pix_card_recovery_settings')
        .select('*')
        .maybeSingle();

      // Busca configurações de recuperação de abandono
      const { data: abandonedSettings } = await supabase
        .from('abandoned_recovery_settings')
        .select('*')
        .maybeSingle();

      return new Response(JSON.stringify({ 
        transactions: transactions || [],
        abandoned: abandoned || [],
        customer,
        recoveryTemplates,
        pixCardSettings,
        abandonedSettings
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[WhatsApp Dashboard] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
