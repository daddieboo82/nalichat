import {renderMixToBuffer,audioBufferToWav,protectStudioMixPeaks} from './audioProcessing.js';
import {studioRecordedWaveform} from './studioRecordedWaveform.js';

// Render on the absolute timeline to preserve automation, then remove the
// leading session silence without applying the source trim a second time.
export async function renderStudioTrackCommit(track,options={}){
 const mix=await renderMixToBuffer([track],options);
 if(!mix)return null;
 const first=Math.min(mix.length,Math.max(0,Math.ceil(Number(track.startTime??0)*mix.sampleRate)));
 const length=mix.length-first;
 if(length<=0)return null;
 const region={length,sampleRate:mix.sampleRate,numberOfChannels:mix.numberOfChannels,duration:length/mix.sampleRate,getChannelData:c=>mix.getChannelData(c).subarray(first)};
 protectStudioMixPeaks(region);
 return {blob:audioBufferToWav(region),startTime:first/mix.sampleRate,duration:region.duration,waveform:studioRecordedWaveform(region,2048)};
}
export function committedStudioTrack(track,url,{startTime,duration,waveform}){
 return {...track,audioUrl:url,startTime,duration,fullDuration:duration,clipStart:0,waveform,splitFrom:undefined,segments:undefined,effects:{},plugins:{},autoPolish:false,clipGain:0,volume:100,pan:50,send1:0,send2:0,send3:0,automationPoints:[],muteAutomationPoints:[],panAutomationPoints:[],send1AutomationPoints:[],send2AutomationPoints:[],send3AutomationPoints:[],committed:true};
}
