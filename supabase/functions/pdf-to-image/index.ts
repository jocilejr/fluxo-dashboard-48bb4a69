import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as pdfjs from "https://esm.sh/pdfjs-dist@3.11.174/build/pdf.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple canvas implementation for Deno
class SimpleCanvas {
  width: number;
  height: number;
  private pixels: Uint8ClampedArray;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8ClampedArray(width * height * 4);
    // Initialize with white background
    for (let i = 0; i < this.pixels.length; i += 4) {
      this.pixels[i] = 255;     // R
      this.pixels[i + 1] = 255; // G
      this.pixels[i + 2] = 255; // B
      this.pixels[i + 3] = 255; // A
    }
  }

  getContext() {
    return new SimpleContext2D(this);
  }

  getPixels() {
    return this.pixels;
  }
}

class SimpleContext2D {
  canvas: SimpleCanvas;
  fillStyle: string = '#ffffff';
  strokeStyle: string = '#000000';
  lineWidth: number = 1;
  font: string = '10px sans-serif';
  textAlign: string = 'left';
  textBaseline: string = 'alphabetic';
  globalAlpha: number = 1;
  globalCompositeOperation: string = 'source-over';

  constructor(canvas: SimpleCanvas) {
    this.canvas = canvas;
  }

  save() {}
  restore() {}
  scale() {}
  rotate() {}
  translate() {}
  transform() {}
  setTransform() {}
  resetTransform() {}
  clip() {}
  
  fillRect(x: number, y: number, w: number, h: number) {
    const color = this.parseColor(this.fillStyle);
    const pixels = this.canvas.getPixels();
    const width = this.canvas.width;
    
    for (let py = Math.max(0, Math.floor(y)); py < Math.min(this.canvas.height, Math.floor(y + h)); py++) {
      for (let px = Math.max(0, Math.floor(x)); px < Math.min(width, Math.floor(x + w)); px++) {
        const idx = (py * width + px) * 4;
        pixels[idx] = color.r;
        pixels[idx + 1] = color.g;
        pixels[idx + 2] = color.b;
        pixels[idx + 3] = Math.floor(color.a * 255);
      }
    }
  }
  
  strokeRect() {}
  clearRect(x: number, y: number, w: number, h: number) {
    this.fillStyle = '#ffffff';
    this.fillRect(x, y, w, h);
  }
  
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  arc() {}
  arcTo() {}
  ellipse() {}
  rect() {}
  fill() {}
  stroke() {}
  
  drawImage() {}
  
  createLinearGradient() {
    return { addColorStop: () => {} };
  }
  createRadialGradient() {
    return { addColorStop: () => {} };
  }
  createPattern() {
    return null;
  }
  
  measureText(text: string) {
    return { width: text.length * 6 };
  }
  
  fillText() {}
  strokeText() {}
  
  getImageData(x: number, y: number, w: number, h: number) {
    return {
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h
    };
  }
  
  putImageData() {}
  
  createImageData(w: number, h: number) {
    return {
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h
    };
  }

  private parseColor(color: string): { r: number, g: number, b: number, a: number } {
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
          a: 1
        };
      } else if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: 1
        };
      }
    }
    if (color.startsWith('rgb')) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (match) {
        return {
          r: parseInt(match[1]),
          g: parseInt(match[2]),
          b: parseInt(match[3]),
          a: match[4] ? parseFloat(match[4]) : 1
        };
      }
    }
    return { r: 0, g: 0, b: 0, a: 1 };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pdfUrl = url.searchParams.get('url');
    const format = url.searchParams.get('format') || 'base64'; // 'base64' or 'json'
    
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

    // Return PDF as base64 for client-side processing
    // Since server-side canvas rendering is complex in Deno without native dependencies,
    // we return the PDF and let the client handle conversion when possible
    const base64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
    
    return new Response(JSON.stringify({ 
      pdfBase64: base64,
      contentType: 'application/pdf',
      size: pdfBuffer.byteLength,
      message: 'PDF fetched successfully. Convert on client-side or use dashboard.'
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
