import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normaliza telefone para formato mínimo (DDD + 8 dígitos)
function normalizePhoneForMatching(phone: string): string | null {
  if (!phone) return null;
  
  let digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  
  // Remove country code 55 if present
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  
  // Remove 9th digit if present (11 digits with 9 as 3rd digit)
  if (digits.length === 11 && digits[2] === '9') {
    digits = digits.slice(0, 2) + digits.slice(3);
  }
  
  // If still 11 digits, remove the 9
  if (digits.length === 11) {
    digits = digits.slice(0, 2) + digits.slice(3);
  }
  
  return digits;
}

// Gera TODAS as variações possíveis de um telefone brasileiro
function generateAllPhoneVariations(phone: string): string[] {
  if (!phone) return [];
  
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return [];
  
  const variations = new Set<string>();
  
  // Add original
  variations.add(digits);
  
  // Normalize to base form (DDD + 8 digits without 9)
  let baseDigits = digits;
  
  // Remove 55 if present
  if (baseDigits.startsWith('55') && baseDigits.length >= 12) {
    baseDigits = baseDigits.slice(2);
  }
  
  // Remove the 9th digit if present
  if (baseDigits.length === 11 && baseDigits[2] === '9') {
    baseDigits = baseDigits.slice(0, 2) + baseDigits.slice(3);
  }
  
  if (baseDigits.length < 10) return Array.from(variations);
  
  const ddd = baseDigits.slice(0, 2);
  const number8 = baseDigits.slice(baseDigits.length - 8); // últimos 8 dígitos
  
  // Base: DDD + 8 dígitos (sem 9)
  const base = ddd + number8;
  variations.add(base);
  
  // Com 9: DDD + 9 + 8 dígitos
  const with9 = ddd + '9' + number8;
  variations.add(with9);
  
  // Com 55 + DDD + 8 dígitos
  variations.add('55' + base);
  
  // Com 55 + DDD + 9 + 8 dígitos
  variations.add('55' + with9);
  
  return Array.from(variations);
}

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
    const phoneParam = url.searchParams.get('phone');

    console.log('[WhatsApp Dashboard] Action:', action, 'Phone:', phoneParam);

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
    if (action === 'lead' && phoneParam) {
      // Pode receber múltiplos telefones separados por vírgula
      const phones = phoneParam.split(',').map(p => p.trim()).filter(Boolean);
      
      // Gera todas as variações possíveis de todos os telefones
      const allVariations = new Set<string>();
      for (const phone of phones) {
        const variations = generateAllPhoneVariations(phone);
        variations.forEach(v => allVariations.add(v));
      }
      
      const phoneVariations = Array.from(allVariations);
      console.log('[WhatsApp Dashboard] Phone variations:', phoneVariations);

      if (phoneVariations.length === 0) {
        return new Response(JSON.stringify({ 
          transactions: [],
          abandoned: [],
          customer: null,
          recoveryTemplates: null,
          pixCardSettings: null,
          abandonedSettings: null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Busca transações - usando IN para busca exata em todas as variações
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .or(phoneVariations.map(p => `normalized_phone.eq.${p},customer_phone.eq.${p}`).join(','))
        .order('created_at', { ascending: false });

      if (txError) {
        console.error('[WhatsApp Dashboard] Transactions error:', txError);
      }

      // Busca abandonos
      const { data: abandoned, error: abError } = await supabase
        .from('abandoned_events')
        .select('*')
        .or(phoneVariations.map(p => `normalized_phone.eq.${p},customer_phone.eq.${p}`).join(','))
        .order('created_at', { ascending: false });

      if (abError) {
        console.error('[WhatsApp Dashboard] Abandoned error:', abError);
      }

      // Busca customer por normalized_phone
      const normalizedBase = normalizePhoneForMatching(phones[0]);
      let customer = null;
      
      if (normalizedBase) {
        // Busca na tabela customers usando o telefone normalizado
        const { data: customerData } = await supabase
          .from('customers')
          .select('*')
          .eq('normalized_phone', normalizedBase)
          .maybeSingle();
        
        customer = customerData;
        
        // Se não encontrou, tenta com outras variações
        if (!customer) {
          for (const variation of phoneVariations) {
            const { data: cd } = await supabase
              .from('customers')
              .select('*')
              .eq('normalized_phone', variation)
              .maybeSingle();
            
            if (cd) {
              customer = cd;
              break;
            }
          }
        }
      }

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

      console.log('[WhatsApp Dashboard] Found:', {
        transactions: transactions?.length || 0,
        abandoned: abandoned?.length || 0,
        customer: customer ? 'yes' : 'no',
        normalizedBase
      });

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
