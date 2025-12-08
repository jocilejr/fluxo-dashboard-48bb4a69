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

// Gera todas as variações possíveis de um telefone
function generatePhoneVariations(phone: string): string[] {
  if (!phone) return [];
  
  const normalized = normalizePhoneForMatching(phone);
  if (!normalized || normalized.length < 8) return [];
  
  const variations = new Set<string>();
  const originalDigits = phone.replace(/\D/g, '');
  variations.add(originalDigits);
  variations.add(normalized);
  
  // If we have DDD + 8 digits, also generate with the 9th digit
  if (normalized.length === 10) {
    const ddd = normalized.slice(0, 2);
    const number = normalized.slice(2);
    const with9 = ddd + '9' + number;
    variations.add(with9);
    variations.add('55' + normalized);
    variations.add('55' + with9);
  }
  
  // If 11 digits (with 9th digit), also generate without
  if (normalized.length === 11 && normalized[2] === '9') {
    const without9 = normalized.slice(0, 2) + normalized.slice(3);
    variations.add(without9);
    variations.add('55' + without9);
    variations.add('55' + normalized);
  }
  
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
        const variations = generatePhoneVariations(phone);
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

      // Cria filtros OR para todas as variações
      const phoneFilters = phoneVariations.map(p => {
        // Busca exata e parcial (para cobrir casos com/sem código de país)
        return `normalized_phone.eq.${p},normalized_phone.ilike.%${p}%,customer_phone.ilike.%${p}%`;
      }).join(',');

      // Busca transações
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .or(phoneFilters)
        .order('created_at', { ascending: false });

      if (txError) {
        console.error('[WhatsApp Dashboard] Transactions error:', txError);
        throw txError;
      }

      // Busca abandonos
      const { data: abandoned, error: abError } = await supabase
        .from('abandoned_events')
        .select('*')
        .or(phoneFilters)
        .order('created_at', { ascending: false });

      if (abError) {
        console.error('[WhatsApp Dashboard] Abandoned error:', abError);
        throw abError;
      }

      // Busca customer - tenta todas as variações
      let customer = null;
      for (const variation of phoneVariations) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('*')
          .or(`normalized_phone.eq.${variation},normalized_phone.ilike.%${variation}%`)
          .maybeSingle();
        
        if (customerData) {
          customer = customerData;
          break;
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
        customer: customer ? 'yes' : 'no'
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
