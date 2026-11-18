// @vitest-environment jsdom
import React,{useState} from 'react';
import {act,render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,describe,it,expect} from 'vitest';
import {useStudioMobileViewport} from './useStudioMobileViewport';
afterEach(cleanup);
function OrientationHarness(){
 const {mobile,landscape}=useStudioMobileViewport();
 const [takes,setTakes]=useState(2);
 const [view,setView]=useState('record');
 return <div>
   <output data-testid="mode">{mobile?(landscape?'landscape-phone':'portrait-phone'):'desktop'}</output>
   <output data-testid="takes">{takes}</output>
   <output data-testid="view">{view}</output>
   <button onClick={()=>setTakes(n=>n+1)}>Add take</button>
   <button onClick={()=>setView('timeline')}>Timeline</button>
 </div>;
}
function resize(width,height){
 Object.defineProperty(window,'innerWidth',{configurable:true,value:width});
 Object.defineProperty(window,'innerHeight',{configurable:true,value:height});
 act(()=>window.dispatchEvent(new Event('resize')));
}
describe('rotation keeps the current Studio session and tab intact',()=>{
 it('preserves takes and timeline selection through portrait-landscape-portrait rotation',()=>{
  resize(390,844);
  render(<OrientationHarness/>);
  expect(screen.getByTestId('mode').textContent).toBe('portrait-phone');
  fireEvent.click(screen.getByText('Add take'));
  fireEvent.click(screen.getByText('Timeline'));
  resize(844,390);
  expect(screen.getByTestId('mode').textContent).toBe('landscape-phone');
  expect(screen.getByTestId('takes').textContent).toBe('3');
  expect(screen.getByTestId('view').textContent).toBe('timeline');
  resize(390,844);
  expect(screen.getByTestId('mode').textContent).toBe('portrait-phone');
  expect(screen.getByTestId('takes').textContent).toBe('3');
 });
});
