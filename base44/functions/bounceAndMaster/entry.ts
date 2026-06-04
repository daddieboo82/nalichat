import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { audioUrl, loudnessTarget, format, bitDepth, sampleRate } = await req.json();

    if (!audioUrl) {
      return Response.json({ error: 'Audio URL required' }, { status: 400 });
    }

    // Fetch audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return Response.json({ error: 'Failed to fetch audio' }, { status: 400 });
    }

    const arrayBuffer = await audioResponse.arrayBuffer();
    
    // Analyze audio - calculate loudness metrics
    const analysis = analyzeAudio(new Float32Array(arrayBuffer));
    
    // Normalize to target loudness standard
    const targetLufs = getLufsTarget(loudnessTarget);
    const gainAdjustment = calculateGainAdjustment(analysis.integrativeLouds, targetLufs);
    
    // Process audio with gain and limiting
    const processedBuffer = processAudioBuffer(new Float32Array(arrayBuffer), gainAdjustment);
    
    // Apply mastering chain
    const masteredBuffer = applyMasteringChain(processedBuffer, loudnessTarget);
    
    // Get final analysis
    const finalAnalysis = analyzeAudio(masteredBuffer);

    return Response.json({
      success: true,
      analysis: {
        before: analysis,
        after: finalAnalysis,
        gainApplied: gainAdjustment,
        format,
        bitDepth,
        sampleRate,
      },
      processedAudio: Array.from(masteredBuffer), // Convert Float32Array to regular array for JSON
    });
  } catch (error) {
    console.error('Bounce and master error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function analyzeAudio(audioBuffer) {
  let sum = 0;
  let peakLevel = 0;
  let rmsSum = 0;

  for (let i = 0; i < audioBuffer.length; i++) {
    const sample = audioBuffer[i];
    
    // Peak detection
    peakLevel = Math.max(peakLevel, Math.abs(sample));
    
    // RMS calculation
    rmsSum += sample * sample;
  }

  const rms = Math.sqrt(rmsSum / audioBuffer.length);
  const peakDb = 20 * Math.log10(Math.max(peakLevel, 1e-10));
  const rmsDb = 20 * Math.log10(Math.max(rms, 1e-10));
  const lufs = rmsDb - 0.691; // Simplified LUFS approximation
  
  // Dynamic range estimate
  const minNonZero = Math.min(...Array.from(audioBuffer).filter(s => Math.abs(s) > 1e-6).map(Math.abs));
  const minDb = 20 * Math.log10(Math.max(minNonZero, 1e-10));
  const dynamicRange = peakDb - minDb;

  return {
    peakDb: Math.round(peakDb * 100) / 100,
    rmsDb: Math.round(rmsDb * 100) / 100,
    integrativeLouds: Math.round(lufs * 100) / 100,
    dynamicRange: Math.round(dynamicRange * 100) / 100,
    clippingRisk: peakDb > -0.5 ? 'High' : peakDb > -3 ? 'Medium' : 'Low',
  };
}

function getLufsTarget(standard) {
  const targets = {
    spotify: -14,
    apple: -16,
    youtube: -13,
    tidal: -14,
    streaming: -14,
  };
  return targets[standard] || -14;
}

function calculateGainAdjustment(currentLufs, targetLufs) {
  const gainDb = targetLufs - currentLufs;
  return Math.pow(10, gainDb / 20); // Convert dB to linear gain
}

function processAudioBuffer(buffer, gainMultiplier) {
  const processed = new Float32Array(buffer.length);
  const limiterThreshold = 0.99;
  
  for (let i = 0; i < buffer.length; i++) {
    let sample = buffer[i] * gainMultiplier;
    
    // Soft clipping limiter
    if (Math.abs(sample) > limiterThreshold) {
      sample = Math.sign(sample) * (limiterThreshold + 0.01 * Math.tanh(Math.abs(sample) - limiterThreshold));
    }
    
    processed[i] = sample;
  }
  
  return processed;
}

function applyMasteringChain(buffer, standard) {
  // Apply subtle EQ boost for common streaming issues
  const eqFiltered = new Float32Array(buffer.length);
  const filterCoeff = 0.15; // Very subtle filter
  
  for (let i = 0; i < buffer.length; i++) {
    if (i === 0) {
      eqFiltered[i] = buffer[i];
    } else {
      eqFiltered[i] = buffer[i] * (1 - filterCoeff) + eqFiltered[i - 1] * filterCoeff;
    }
  }
  
  return eqFiltered;
}