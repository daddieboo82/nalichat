import {measureVoxDeviceCosts} from './voxDeviceCalibration.js';
self.onmessage=({data})=>{try{self.postMessage({profile:measureVoxDeviceCosts({sampleRate:data.sampleRate})});}catch(error){self.postMessage({error:error.message});}};
