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
  
  return digits;
}

// Gera TODAS as variações possíveis de um telefone brasileiro
function generateAllPhoneVariations(phone: string): string[] {
  if (!phone) return [];
  
  let digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return [];
  
  const variations = new Set<string>();
  
  // Add original
  variations.add(digits);
  
  // Start by removing country code if present
  let withoutCountry = digits;
  if (digits.startsWith('55') && digits.length >= 12) {
    withoutCountry = digits.slice(2);
    variations.add(withoutCountry);
  }
  
  // Now we should have 10 or 11 digits (DDD + number)
  let ddd = '';
  let number8 = '';
  
  if (withoutCountry.length === 10) {
    // DDD (2) + number (8)
    ddd = withoutCountry.slice(0, 2);
    number8 = withoutCountry.slice(2);
  } else if (withoutCountry.length === 11) {
    // DDD (2) + 9 + number (7) OR DDD (2) + number starting with 9 (8)
    ddd = withoutCountry.slice(0, 2);
    // Check if it's 9 prefix or number starting with 9
    if (withoutCountry[2] === '9') {
      // Could be 9 prefix - try both interpretations
      number8 = withoutCountry.slice(3); // Remove the 9
      // Also keep the full 9-digit version
      const number9 = withoutCountry.slice(2);
      variations.add(ddd + number9); // DDD + 9 digits
    } else {
      // Number doesn't start with 9, something is off
      number8 = withoutCountry.slice(2, 10);
    }
  } else if (withoutCountry.length === 8 || withoutCountry.length === 9) {
    // Just the number without DDD - can't generate proper variations
    variations.add(withoutCountry);
    if (withoutCountry.length === 9 && withoutCountry[0] === '9') {
      variations.add(withoutCountry.slice(1));
    }
    return Array.from(variations);
  } else {
    return Array.from(variations);
  }
  
  if (!ddd || number8.length < 7) {
    return Array.from(variations);
  }
  
  // Ensure number8 is exactly 8 digits
  if (number8.length === 7) {
    // Number was 11 digits with 9 removed, number8 is now 7 digits
    // This is the core number
  } else if (number8.length > 8) {
    number8 = number8.slice(0, 8);
  }
  
  // Generate all variations:
  // Format: DDD + 8 dígitos (sem 9 extra)
  const base8 = ddd + (number8.length === 8 ? number8 : '9' + number8);
  if (number8.length === 8) {
    variations.add(ddd + number8);
    variations.add('55' + ddd + number8);
  }
  
  // Format: DDD + 9 + 8 dígitos
  const with9 = ddd + '9' + (number8.length === 7 ? number8 : number8.slice(number8.length - 7));
  variations.add(with9);
  variations.add('55' + with9);
  
  // Also add without 9 if applicable
  if (number8.length === 8 && number8[0] === '9') {
    const without9 = ddd + number8.slice(1);
    variations.add(without9);
    variations.add('55' + without9);
    variations.add(ddd + number8);
    variations.add('55' + ddd + number8);
  }
  
  // If number is 7 digits, add with 9 prefix
  if (number8.length === 7) {
    variations.add(ddd + number8);
    variations.add('55' + ddd + number8);
    variations.add(ddd + '9' + number8);
    variations.add('55' + ddd + '9' + number8);
  }
  
  console.log('[WhatsApp Dashboard] Generated variations for', phone, ':', Array.from(variations));
  
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
          usefulLinks: []
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

      // Busca delivery link generations (PIX links gerados)
      const { data: deliveryLinks, error: dlError } = await supabase
        .from('delivery_link_generations')
        .select('*, delivery_products(name, value)')
        .or(phoneVariations.map(p => `normalized_phone.eq.${p},phone.eq.${p}`).join(','))
        .order('created_at', { ascending: false });

      if (dlError) {
        console.error('[WhatsApp Dashboard] Delivery links error:', dlError);
      }

      // Converte delivery_link_generations para formato de transação para exibir junto
      const deliveryAsTransactions = (deliveryLinks || []).map(dl => ({
        id: dl.id,
        type: dl.payment_method as 'pix' | 'boleto' | 'cartao',
        status: 'pago' as const, // PIX links são considerados pagos
        amount: dl.delivery_products?.value || 0,
        customer_phone: dl.phone,
        normalized_phone: dl.normalized_phone,
        description: dl.delivery_products?.name || 'Link de entrega',
        created_at: dl.created_at,
        is_delivery_link: true
      }));

      // Merge transactions: DB transactions + delivery links (sem duplicatas)
      const txIds = new Set((transactions || []).map(t => t.id));
      const allTransactions = [
        ...(transactions || []),
        ...deliveryAsTransactions.filter(dt => !txIds.has(dt.id))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Busca abandonos
      const { data: abandoned, error: abError } = await supabase
        .from('abandoned_events')
        .select('*')
        .or(phoneVariations.map(p => `normalized_phone.eq.${p},customer_phone.eq.${p}`).join(','))
        .order('created_at', { ascending: false });

      if (abError) {
        console.error('[WhatsApp Dashboard] Abandoned error:', abError);
      }

      // Busca customer por todas as variações
      let customer = null;
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

      // Busca links úteis ativos
      const { data: usefulLinks } = await supabase
        .from('useful_links')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      console.log('[WhatsApp Dashboard] Found:', {
        transactions: allTransactions.length,
        deliveryLinks: deliveryLinks?.length || 0,
        abandoned: abandoned?.length || 0,
        customer: customer ? 'yes' : 'no',
        usefulLinks: usefulLinks?.length || 0
      });

      return new Response(JSON.stringify({ 
        transactions: allTransactions,
        abandoned: abandoned || [],
        customer,
        usefulLinks: usefulLinks || []
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
