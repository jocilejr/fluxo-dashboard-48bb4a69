import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pdfUrl = url.searchParams.get('url');
    const outputFormat = url.searchParams.get('format') || 'jpg';
    
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

    // Convert PDF buffer to base64
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    if (outputFormat === 'pdf') {
      // Return PDF directly as binary
      return new Response(pdfBuffer, {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="boleto.pdf"'
        },
      });
    }

    // For JPG conversion, we'll use a different approach:
    // Since Deno doesn't have native canvas, we'll use pdf.js with a workaround
    // Return the PDF as base64 and let the client render it if possible,
    // but also provide a direct download option
    
    return new Response(JSON.stringify({ 
      pdfBase64: pdfBase64,
      pdfUrl: pdfUrl,
      contentType: 'application/pdf',
      size: pdfBuffer.byteLength,
      // Indicate that client should render this
      requiresClientRender: true
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
