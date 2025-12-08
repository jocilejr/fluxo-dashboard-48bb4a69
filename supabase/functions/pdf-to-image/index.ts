import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const url = new URL(req.url);
    const pdfUrl = url.searchParams.get('url');
    
    if (!pdfUrl) {
      return new Response(JSON.stringify({ error: 'URL do PDF é obrigatória' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[PDF to Image] Fetching PDF from:', pdfUrl);

    // Fetch the PDF
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    console.log('[PDF to Image] PDF size:', pdfBuffer.byteLength, 'bytes');

    // Return the PDF as base64 for client-side conversion
    // The dashboard has pdfjs-dist installed and can do the conversion
    const base64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
    
    return new Response(JSON.stringify({ 
      pdfBase64: base64,
      contentType: 'application/pdf',
      size: pdfBuffer.byteLength
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[PDF to Image] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
