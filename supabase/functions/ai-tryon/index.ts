import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userPhoto, productImage, productName, selectedColor, selectedSize } = await req.json();

    if (!userPhoto) {
      return new Response(JSON.stringify({ error: "User photo is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const colorInfo = selectedColor ? `, na cor ${selectedColor}` : "";
    const sizeInfo = selectedSize ? `, tamanho ${selectedSize}` : "";

    const prompt = `You are a virtual fitting room. Generate a realistic image of the person in the first photo wearing the clothing item "${productName}"${colorInfo}${sizeInfo} shown in the second photo. Keep the person's face, body type, pose and background exactly the same. Only change their clothing to match the product shown. Make it photorealistic and natural.`;

    // Build content array with images
    const content: any[] = [
      { type: "text", text: prompt },
      {
        type: "image_url",
        image_url: { url: userPhoto, detail: "high" },
      },
    ];

    if (productImage) {
      // If productImage is a relative path, make it absolute
      let fullProductImage = productImage;
      if (productImage.startsWith("/")) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        // Use the project's published URL or a placeholder
        fullProductImage = `https://fiodegalafdg.lovable.app${productImage}`;
      }
      content.push({
        type: "image_url",
        image_url: { url: fullProductImage, detail: "high" },
      });
    }

    console.log("Calling OpenAI API for try-on generation...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content,
          },
        ],
        modalities: ["text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402 || response.status === 401) {
        return new Response(JSON.stringify({ error: "Erro de autenticação ou créditos insuficientes na OpenAI." }), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Não foi possível gerar a imagem. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GPT-4o can analyze images but cannot generate them directly
    // We need to use DALL-E 3 for image generation
    // First, get GPT-4o to create a detailed description, then generate with DALL-E
    const analysisData = await response.json();
    const description = analysisData.choices?.[0]?.message?.content;

    console.log("GPT-4o analysis complete, generating image with DALL-E 3...");

    // Now generate with DALL-E 3
    const dallePrompt = `Photorealistic image of a person wearing ${productName}${colorInfo}${sizeInfo}. ${description ? `Details: ${description.substring(0, 500)}` : ""}. The image should look like a real photo from an online clothing store. Professional lighting, clean background.`;

    const dalleResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: dallePrompt.substring(0, 4000),
        n: 1,
        size: "1024x1792",
        quality: "hd",
        response_format: "b64_json",
      }),
    });

    if (!dalleResponse.ok) {
      const dalleError = await dalleResponse.text();
      console.error("DALL-E error:", dalleResponse.status, dalleError);
      return new Response(JSON.stringify({ error: "Não foi possível gerar a imagem. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dalleData = await dalleResponse.json();
    const b64Image = dalleData.data?.[0]?.b64_json;

    if (!b64Image) {
      console.error("No image in DALL-E response");
      return new Response(JSON.stringify({ error: "A IA não retornou uma imagem. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageDataUrl = `data:image/png;base64,${b64Image}`;

    return new Response(JSON.stringify({ image: imageDataUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-tryon error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
