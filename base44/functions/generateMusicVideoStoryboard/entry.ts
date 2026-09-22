import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const cleanJson = (value: unknown) => {
  const raw = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI storyboard was not valid JSON');
  return JSON.parse(match[0]);
};
function isSafeHttpsMediaUrl(value: unknown){
  try { const u=new URL(String(value||'')); if(u.protocol!=='https:'||u.username||u.password)return false; const h=u.hostname.toLowerCase(); if(h==='localhost'||h==='127.0.0.1'||h==='0.0.0.0'||h==='::1'||h.endsWith('.local'))return false; return true; } catch { return false; }
}
async function storedMediaSize(url:string){
  try { const r=await fetch(url,{method:'HEAD',redirect:'follow'}); const n=Number(r.headers.get('content-length')); return r.ok&&Number.isFinite(n)&&n>0?n:null; } catch { return null; }
}
Deno.serve(async (req) => {
 try {
  if(req.method!=='POST') return Response.json({error:'Method not allowed'},{status:405});
  const base44=createClientFromRequest(req), user=await base44.auth.me();
  if(!user) return Response.json({error:'Unauthorized'},{status:401});
  const {audio_url,title,concept,style='Cinematic animation',duration=0}=await readJsonBodyLimited(req,16*1024);
  if(typeof audio_url!=='string'||!isSafeHttpsMediaUrl(audio_url)) return Response.json({error:'A valid uploaded song is required'},{status:400});
  const size=await storedMediaSize(audio_url); if(size!==null&&size>MAX_AUDIO_BYTES) return Response.json({error:'Song must be 50MB or less'},{status:413});
  let transcript='Instrumental or lyrics unavailable.';
  try { const t=await base44.asServiceRole.integrations.Core.TranscribeAudio({audio_url}); transcript=(typeof t==='string'?t:t?.text||transcript).slice(0,12000); } catch {}
  const seconds=Math.max(30,Math.min(900,Number(duration)||180)), count=Math.max(6,Math.min(14,Math.ceil(seconds/18)));
  const prompt=`Create a coherent animated music-video storyboard as strict JSON for an original song.
Title: ${String(title||'Untitled').slice(0,120)}
Requested concept: ${String(concept||'').slice(0,2000)}
Visual style: ${String(style).slice(0,120)}
Song length: ${seconds} seconds
Lyrics/transcript: ${transcript}
Return ONLY JSON: {"summary":"...","scenes":[{"title":"...","prompt":"...","motion":"..."}]}.
Exactly ${count} scenes. Every prompt must describe an original, copyright-safe, high-detail 16:9 animation frame with consistent characters/world, cinematic lighting, no text/logos/celebrity likeness. Motion describes camera/parallax/particle movement. Make scenes progress as one continuous video and reflect the lyrics/mood.`;
  const plan=cleanJson(await base44.asServiceRole.integrations.Core.InvokeLLM({prompt}));
  const scenes=Array.isArray(plan.scenes)?plan.scenes.slice(0,count):[];
  if(!scenes.length) return Response.json({error:'AI could not create a storyboard for this song. Please try again.'},{status:502});
  const generated=[];
  for(let i=0;i<scenes.length;i++){
    const s=scenes[i]||{}, scenePrompt=String(s.prompt||'cinematic original animated music video scene');
    let imageUrl='';
    try { const image=await base44.asServiceRole.integrations.Core.GenerateImage({prompt:scenePrompt}); imageUrl=String(image?.url||''); }
    catch(e){ console.error(`Music video scene ${i+1} image failed`,e instanceof Error?e.message:e); }
    generated.push({id:i+1,title:String(s.title||`Scene ${i+1}`),prompt:scenePrompt,motion:String(s.motion||'slow cinematic push-in'),image_url:imageUrl});
  }
  return Response.json({summary:String(plan.summary||''),transcript,scenes:generated});
 } catch(error) {
  const bodyError=requestBodyErrorResponse(error); if(bodyError) return bodyError;
  console.error('generateMusicVideoStoryboard error',error); return Response.json({error:'AI music video storyboard generation failed'},{status:500});
 }
});