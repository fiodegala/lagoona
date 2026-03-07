import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }), {
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

    // Build the detailed try-on prompt
    const prompt = `Use the first image as the person reference and the second image as the clothing reference.

Create a highly realistic fashion try-on preview.

The person in the first image must remain the same person:
- preserve the exact face
- preserve the skin tone
- preserve the body proportions
- preserve the pose and camera angle as much as possible

Apply the clothing "${productName}"${colorInfo}${sizeInfo} from the second image naturally onto the person's body.

The garment must remain visually identical to the original product:
- same color
- same fabric texture
- same collar
- same sleeves
- same fit and structure
- same details and stitching if visible

The result must look like a real photograph from a professional fashion photoshoot.

Lighting:
Use natural studio lighting consistent with the original image.

Fabric behavior:
Create realistic fabric folds, shadows and natural draping of the garment on the body.

Style rules:
- photorealistic
- realistic skin
- realistic fabric texture
- no artistic style
- no illustration
- no CGI look
- no cartoon style
- no stylization

Do not change:
- gender
- body shape
- ethnicity
- facial features
- background drastically

The final result should look like a real e-commerce fashion photo of the person wearing the garment.

Avoid: cartoon, illustration, cgi, 3d render, unrealistic skin, deformed body, extra arms, extra fingers, wrong clothing, incorrect fabric, wrong color, blurry face, low resolution, distorted clothing, incorrect proportions, fashion fantasy, artistic style, anime, painting.`;

    // Build content array with both images
    const content: any[] = [
      { type: "text", text: prompt },
      {
        type: "image_url",
        image_url: { url: userPhoto },
      },
    ];

    if (productImage) {
      let fullProductImage = productImage;
      if (productImage.startsWith("/")) {
        fullProductImage = `https://fiodegalafdg.lovable.app${productImage}`;
      }
      content.push({
        type: "image_url",
        image_url: { url: fullProductImage },
      });
    }

    console.log("Calling Lovable AI Gateway for try-on generation...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          {
            role: "user",
            content,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes no Lovable AI. Adicione créditos para continuar." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Não foi possível gerar a imagem. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("AI Gateway response received");

    // Extract the generated image from the response
    const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImage) {
      console.error("No image in AI Gateway response:", JSON.stringify(data).substring(0, 500));
      return new Response(JSON.stringify({ error: "A IA não retornou uma imagem. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ image: generatedImage }), {
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
