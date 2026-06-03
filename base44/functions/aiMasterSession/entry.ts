import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { audio_url, project_title } = await req.json();
    
    if (!audio_url) {
      return Response.json({ error: 'Missing audio_url' }, { status: 400 });
    }

    // Call LLM to analyze and provide mix/master recommendations
    const analysis = await base44.integrations.Core.InvokeLLM({
      model: "claude_opus_4_8",
      prompt: `Analyze this audio session for mixing and mastering. Project: "${project_title}". 
               Provide recommendations for:
               1. EQ adjustments (low/mid/high frequencies)
               2. Compression settings (ratio, threshold, attack, release)
               3. Reverb/delay (type, wet/dry mix)
               4. Target loudness level (-14 LUFS for streaming)
               5. Overall processing chain
               Be specific and technical.`,
      response_json_schema: {
        type: "object",
        properties: {
          eq_recommendations: { type: "string" },
          compression: { type: "string" },
          effects: { type: "string" },
          target_loudness: { type: "string" },
          mastering_chain: { type: "string" },
          confidence: { type: "string" }
        }
      }
    });

    // Generate mastered version metadata
    const masteredData = {
      title: `${project_title} - Mastered`,
      eq_recommendations: analysis.eq_recommendations || "",
      compression_settings: analysis.compression || "",
      effects_chain: analysis.effects || "",
      target_loudness: analysis.target_loudness || "-14 LUFS",
      mastering_chain: analysis.mastering_chain || "",
      recommendations: analysis.mastering_chain || "",
      processed_at: new Date().toISOString(),
      source_url: audio_url
    };

    return Response.json(masteredData);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});