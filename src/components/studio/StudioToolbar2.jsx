import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Plus, Settings2, Scissors, Copy, Layers, Wand2, Undo, Redo, Edit2, Shuffle, MoveHorizontal, Grid, MousePointer2, Crosshair, Link2, Unlock, Trash2, Maximize2, Loader2, SlidersHorizontal, Search, MapPin, Gauge, Folder, Volume2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { sounds } from '@/hooks/use-sound';

export default function StudioToolbar2({
  addTrack, addVcaTrack, addFolderTrack, selectedTrackIds, tracks, handleSeparateStems, isProcessing, handleGenerateMelody, undo, redo, historyIndex, historyLength,
  bpm, setBpm, bpmInput, setBpmInput, timeSignature, setTimeSignature, songKey, setSongKey, editMode, setEditMode,
  activeTool, setActiveTool, toggleTrackProperty, splitSelectedTracks, duplicateSelectedTracks, deleteSelectedTracks, zoom, setZoom,
  gridSize, setGridSize
}) {
  const isMobile = useIsMobile();
  const gridOptions = [
    { value: 1, label: '1 bar' },
    { value: 0.5, label: '1/2' },
    { value: 0.25, label: '1/4' },
    { value: 0.125, label: '1/8' },
    { value: 0.0625, label: '1/16' },
    { value: 0.03125, label: '1/32' },
  ];

  const toolbarContent = (
    <>
        <div className="flex items-center gap-1 bg-secondary/20 border border-border/40 p-1 rounded-xl shadow-sm shrink-0">
          <TooltipProvider delayDuration={200}>
            <Tooltip><TooltipTrigger asChild>
              <Button onClick={addTrack} variant="secondary" size="sm" className="gap-1.5 sm:gap-2 h-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 shrink-0">
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Track</span>
              </Button>
            </TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Add Track <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Shift+N</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button aria-label="Add VCA Master" onClick={addVcaTrack} variant="ghost" size="sm" className="gap-1.5 h-8 rounded-lg text-accent hover:bg-accent/20 shrink-0"><Volume2 className="w-4 h-4" /> <span className="hidden lg:inline">Add VCA</span></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Add VCA Master Track</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button aria-label="Add Folder" onClick={addFolderTrack} variant="ghost" size="sm" className="gap-1.5 h-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0"><Folder className="w-4 h-4" /> <span className="hidden lg:inline">Add Folder</span></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Add Folder Track</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button aria-label="Split Stems" onClick={handleSeparateStems} disabled={isProcessing} variant="ghost" size="sm" className="gap-1.5 h-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0 disabled:opacity-50">{isProcessing === 'separate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />} <span className="hidden md:inline">Split Stems</span></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Separate Vocals & Instrumental <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Shift+E</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button aria-label="Generate Melody" onClick={handleGenerateMelody} disabled={isProcessing} variant="ghost" size="sm" className="gap-1.5 h-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0 disabled:opacity-50">{isProcessing === 'generate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} <span className="hidden lg:inline">Generate Melody</span></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Generate AI Melody <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Shift+G</kbd></TooltipContent></Tooltip>
          </TooltipProvider>
        </div>
        
        <div className="hidden sm:block w-px h-6 bg-border/50 shrink-0" />
        
        <div className="flex items-center gap-1 bg-secondary/20 border border-border/40 p-1 rounded-xl shadow-sm shrink-0">
          <TooltipProvider delayDuration={200}>
            <Tooltip><TooltipTrigger asChild><div><Button variant="ghost" size="sm" onClick={undo} className="min-w-[44px] min-h-[44px] px-2 rounded text-muted-foreground hover:text-foreground gap-1.5 relative"><Undo className="w-3.5 h-3.5" /><span className="hidden xl:inline text-xs">Undo</span>{historyIndex > 0 && <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] w-3.5 h-3.5 flex items-center justify-center rounded-full">{historyIndex}</span>}</Button></div></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Undo <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Ctrl+Z</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><div><Button variant="ghost" size="sm" onClick={redo} className="min-w-[44px] min-h-[44px] px-2 rounded text-muted-foreground hover:text-foreground gap-1.5 relative"><Redo className="w-3.5 h-3.5" /><span className="hidden xl:inline text-xs">Redo</span>{(historyLength-1-historyIndex) > 0 && <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] w-3.5 h-3.5 flex items-center justify-center rounded-full">{historyLength-1-historyIndex}</span>}</Button></div></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Redo <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Ctrl+Y</kbd></TooltipContent></Tooltip>
          </TooltipProvider>
        </div>

        <div className="hidden sm:block w-px h-6 bg-border/50 shrink-0" />

        <div className="flex items-stretch gap-px bg-background/50 rounded-xl border border-border/50 shadow-inner overflow-hidden shrink-0">
          <TooltipProvider delayDuration={200}>
            <Tooltip><TooltipTrigger asChild>
              <div className="flex flex-col items-center justify-center px-3 py-1 hover:bg-secondary/40 transition-colors">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none mb-1 flex items-center gap-1 pointer-events-none"><Edit2 className="w-2.5 h-2.5" /> BPM</span>
                <div className="flex items-center gap-1 relative">
                  <button type="button" onClick={() => { const c = Math.max(20, bpm - 1); setBpm(c); setBpmInput(String(c)); sounds.click(); }} className="w-4 h-4 shrink-0 flex items-center justify-center bg-secondary/50 hover:bg-secondary rounded border border-border text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer">-</button>
                  <input type="text" inputMode="numeric" value={bpmInput} onChange={(e) => { const val = e.target.value.replace(/[^0-9]/g, ''); setBpmInput(val); const num = Number(val); if(num >= 20 && num <= 300) setBpm(num); }} onBlur={() => { const c = Math.max(20, Math.min(300, Number(bpmInput) || 120)); setBpm(c); setBpmInput(String(c)); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} className={cn("w-10 shrink-0 bg-secondary/50 border rounded px-1 text-center font-mono text-xs font-bold text-foreground focus:outline-none focus:ring-1 py-0.5 leading-tight transition-all cursor-text", (Number(bpmInput)<20||Number(bpmInput)>300)?"border-red-500 text-red-500 focus:ring-red-500":"border-border focus:ring-primary focus:border-primary")} />
                  <button type="button" onClick={() => { const c = Math.min(300, bpm + 1); setBpm(c); setBpmInput(String(c)); sounds.click(); }} className="w-4 h-4 shrink-0 flex items-center justify-center bg-secondary/50 hover:bg-secondary rounded border border-border text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer">+</button>
                </div>
              </div>
            </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Tempo (beats per minute)</TooltipContent></Tooltip>
            
              <div className="flex flex-col items-center justify-center px-3 py-0.5 border-l border-border/60">
                <Tooltip><TooltipTrigger asChild>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none mb-0.5 cursor-help">Sig</span>
                </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Time Signature</TooltipContent></Tooltip>
                <Select value={timeSignature} onValueChange={(val) => { setTimeSignature(val); toast.success("Time signature updated"); }}>
                  <SelectTrigger className="h-4 p-0 border-none bg-transparent hover:bg-transparent focus:ring-0 focus:ring-offset-0 shadow-none font-mono text-xs font-bold text-foreground w-12 text-center flex justify-center [&>svg]:hidden">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4/4">4/4</SelectItem>
                    <SelectItem value="3/4">3/4</SelectItem>
                    <SelectItem value="2/4">2/4</SelectItem>
                    <SelectItem value="2/2">2/2</SelectItem>
                    <SelectItem value="6/8">6/8</SelectItem>
                    <SelectItem value="9/8">9/8</SelectItem>
                    <SelectItem value="12/8">12/8</SelectItem>
                    <SelectItem value="5/4">5/4</SelectItem>
                    <SelectItem value="7/8">7/8</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col items-center justify-center px-3 py-0.5 border-l border-border/60">
                <Tooltip><TooltipTrigger asChild>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none mb-0.5 cursor-help">Key</span>
                </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Project Key</TooltipContent></Tooltip>
                <Select value={songKey} onValueChange={(val) => { setSongKey(val); toast.success("Project key updated"); }}>
                  <SelectTrigger className="h-4 p-0 border-none bg-transparent hover:bg-transparent focus:ring-0 focus:ring-offset-0 shadow-none font-mono text-xs font-bold text-foreground w-[4.5rem] text-center flex justify-center [&>svg]:hidden">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {["C Maj", "C min", "Db Maj", "Db min", "D Maj", "D min", "Eb Maj", "Eb min", "E Maj", "E min", "F Maj", "F min", "Gb Maj", "Gb min", "G Maj", "G min", "Ab Maj", "Ab min", "A Maj", "A min", "Bb Maj", "Bb min", "B Maj", "B min", "C Dorian", "Db Dorian", "D Dorian", "Eb Dorian", "E Dorian", "F Dorian", "Gb Dorian", "G Dorian", "Ab Dorian", "A Dorian", "Bb Dorian", "B Dorian", "C Phrygian", "Db Phrygian", "D Phrygian", "Eb Phrygian", "E Phrygian", "F Phrygian", "Gb Phrygian", "G Phrygian", "Ab Phrygian", "A Phrygian", "Bb Phrygian", "B Phrygian", "C Lydian", "Db Lydian", "D Lydian", "Eb Lydian", "E Lydian", "F Lydian", "Gb Lydian", "G Lydian", "Ab Lydian", "A Lydian", "Bb Lydian", "B Lydian", "C Mixolydian", "Db Mixolydian", "D Mixolydian", "Eb Mixolydian", "E Mixolydian", "F Mixolydian", "Gb Mixolydian", "G Mixolydian", "Ab Mixolydian", "A Mixolydian", "Bb Mixolydian", "B Mixolydian"].map(k => <SelectItem key={k} value={k} id={`key-${k.replace(/\s+/g, '-')}`}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
          </TooltipProvider>
        </div>

        <div className="hidden md:block w-px h-6 bg-border/50 shrink-0" />

        <div className="flex items-center gap-1 bg-secondary/20 border border-border/40 p-1 rounded-xl shadow-sm shrink-0">
          <TooltipProvider delayDuration={200}>
            <Tooltip><TooltipTrigger asChild>
              <div><Button variant="ghost" size="sm" aria-label="Shuffle" onClick={() => setEditMode('shuffle')} aria-pressed={editMode === 'shuffle'} className={cn("min-w-[44px] min-h-[44px] px-2 rounded text-muted-foreground hover:text-foreground gap-1.5", editMode === 'shuffle' && "bg-primary/20 text-primary")}>
                <Shuffle className="w-3.5 h-3.5" /><span className="text-xs">Shuffle</span>
              </Button></div>
            </TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Shuffle Mode <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Shift+1</kbd></TooltipContent></Tooltip>
            
            <Tooltip><TooltipTrigger asChild>
              <div><Button variant="ghost" size="sm" aria-label="Slip" onClick={() => setEditMode('slip')} aria-pressed={editMode === 'slip'} className={cn("min-w-[44px] min-h-[44px] px-2 rounded text-muted-foreground hover:text-foreground gap-1.5", editMode === 'slip' && "bg-primary/20 text-primary")}>
                <MoveHorizontal className="w-3.5 h-3.5" /><span className="text-xs">Slip</span>
              </Button></div>
            </TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Slip Mode <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Shift+2</kbd></TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <div><Button variant="ghost" size="sm" aria-label="Grid" onClick={() => setEditMode('grid')} aria-pressed={editMode === 'grid'} className={cn("min-w-[44px] min-h-[44px] px-2 rounded text-muted-foreground hover:text-foreground gap-1.5", editMode === 'grid' && "bg-primary/20 text-primary")}>
                <Grid className="w-3.5 h-3.5" /><span className="text-xs">Grid</span>
              </Button></div>
            </TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Grid Mode <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Shift+3</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <div><Button variant="ghost" size="sm" aria-label="Spot" onClick={() => setEditMode('spot')} aria-pressed={editMode === 'spot'} className={cn("min-w-[44px] min-h-[44px] px-2 rounded text-muted-foreground hover:text-foreground gap-1.5", editMode === 'spot' && "bg-primary/20 text-primary")}>
                <MapPin className="w-3.5 h-3.5" /><span className="text-xs">Spot</span>
              </Button></div>
            </TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Spot Mode — type exact position <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Shift+4</kbd></TooltipContent></Tooltip>
          </TooltipProvider>
        </div>

        {/* Grid Value Selector — Pro Tools shows the current grid/nudge resolution */}
        {setGridSize && (
          <div className="hidden md:flex items-center gap-1 bg-secondary/20 border border-border/40 p-1 rounded-xl shadow-sm shrink-0">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 px-2 h-8">
                    <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
                    <Select value={String(gridSize)} onValueChange={(v) => setGridSize(parseFloat(v))}>
                      <SelectTrigger className="h-5 p-0 border-none bg-transparent hover:bg-transparent focus:ring-0 focus:ring-offset-0 shadow-none font-mono text-[10px] font-bold text-foreground w-14 text-center flex justify-center [&>svg]:hidden">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {gridOptions.map(opt => (
                          <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Grid / Nudge Resolution</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        <div className="flex items-center gap-1 bg-secondary/20 border border-border/40 p-1 rounded-xl shadow-sm shrink-0">
          <TooltipProvider delayDuration={200}>
            <Tooltip><TooltipTrigger asChild><div><Button variant="ghost" size="sm" title="Trim Tool (T)" onClick={() => setActiveTool('trim')} className={cn("min-w-[44px] min-h-[44px] px-2 rounded text-muted-foreground hover:text-foreground gap-1.5", activeTool === 'trim' && "bg-primary/20 text-primary")}><MoveHorizontal className="w-3.5 h-3.5" /><span className="text-xs hidden lg:inline">Trim</span></Button></div></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Trim Tool <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">T</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><div><Button variant="ghost" size="sm" title="Cut Tool (C)" onClick={() => setActiveTool('cut')} className={cn("min-w-[44px] min-h-[44px] px-2 rounded text-muted-foreground hover:text-foreground gap-1.5", activeTool === 'cut' && "bg-primary/20 text-primary")}><Scissors className="w-3.5 h-3.5" /><span className="text-xs hidden lg:inline">Cut</span></Button></div></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Cut Tool <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">C</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><div><Button variant="ghost" size="sm" title="Grabber Tool (G)" onClick={() => setActiveTool('grab')} className={cn("min-w-[44px] min-h-[44px] px-2 rounded text-muted-foreground hover:text-foreground gap-1.5", activeTool === 'grab' && "bg-primary/20 text-primary")}><MousePointer2 className="w-3.5 h-3.5" /><span className="text-xs hidden lg:inline">Grabber</span></Button></div></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Grabber Tool <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">G</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><div><Button variant="ghost" size="sm" title="Fade Tool (F)" onClick={() => setActiveTool('fade')} className={cn("min-w-[44px] min-h-[44px] px-2 rounded text-muted-foreground hover:text-foreground gap-1.5", activeTool === 'fade' && "bg-primary/20 text-primary")}><Crosshair className="w-3.5 h-3.5" /><span className="text-xs hidden lg:inline">Fade</span></Button></div></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Fade Tool <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">F</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><div><Button variant="ghost" size="sm" title="Smart Tool (E)" onClick={() => setActiveTool('smart')} className={cn("min-w-[44px] min-h-[44px] px-2 rounded text-muted-foreground border border-transparent hover:text-foreground gap-1.5", activeTool === 'smart' && "border-primary text-primary bg-primary/10")}>
               <div className="flex flex-col gap-0.5 items-center">
                  <div className="flex gap-[1px]"><MoveHorizontal className="w-2 h-2"/><MousePointer2 className="w-2 h-2"/></div>
                </div>
                <span className="text-xs hidden lg:inline">Smart</span>
             </Button></div></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex flex-col gap-1"><span>Smart Tool (Top: Edit, Bottom: Grab)</span><div className="flex items-center gap-1"><kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">E</kbd></div></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><div><Button variant="ghost" size="sm" title="Scrub Tool (S)" onClick={() => setActiveTool('scrub')} className={cn("min-w-[44px] min-h-[44px] px-2 rounded text-muted-foreground hover:text-foreground gap-1.5", activeTool === 'scrub' && "bg-primary/20 text-primary")}><Search className="w-3.5 h-3.5" /><span className="text-xs hidden lg:inline">Scrub</span></Button></div></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Scrub Tool — drag to hear audio <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">S</kbd></TooltipContent></Tooltip>
          </TooltipProvider>
        </div>

        <div className="hidden xl:block w-px h-6 bg-border/50 shrink-0" />

        <div className="flex items-center gap-1 bg-secondary/20 border border-border/40 p-1 rounded-xl shadow-sm shrink-0">
          <TooltipProvider delayDuration={200}>
            <Tooltip><TooltipTrigger asChild><div><Button variant="ghost" size="sm" title="Lock/Unlock Clip (L)" onClick={() => {
              const allLocked = selectedTrackIds.every(id => tracks.find(t => t.id === id)?.locked);
              selectedTrackIds.forEach(id => toggleTrackProperty(id, 'locked'));
            }} disabled={selectedTrackIds.length === 0} className="min-w-[44px] min-h-[44px] px-2 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50 gap-1.5">{tracks.find(t => t.id === selectedTrackIds[0])?.locked ? <Unlock className="w-3.5 h-3.5"/> : <Link2 className="w-3.5 h-3.5"/>}<span className="text-xs hidden lg:inline">Lock</span></Button></div></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Lock/Unlock Clip <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">L</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><div><Button variant="ghost" size="sm" title="Separate Clip (Ctrl+E)" onClick={splitSelectedTracks} disabled={selectedTrackIds.length === 0} className="min-w-[44px] min-h-[44px] px-2 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50 gap-1.5"><Scissors className="w-3.5 h-3.5" /><span className="text-xs hidden lg:inline">Split</span></Button></div></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Separate Clip <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Ctrl+E</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><div><Button variant="ghost" size="sm" title="Duplicate Clip (Ctrl+D)" onClick={duplicateSelectedTracks} disabled={selectedTrackIds.length === 0} className="min-w-[44px] min-h-[44px] px-2 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50 gap-1.5"><Copy className="w-3.5 h-3.5" /><span className="text-xs hidden lg:inline">Copy</span></Button></div></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Duplicate Clip <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Ctrl+D</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><div><Button variant="ghost" size="sm" title="Delete Clip (Del)" onClick={deleteSelectedTracks} disabled={selectedTrackIds.length === 0} className="min-w-[44px] min-h-[44px] px-2 rounded-md text-muted-foreground hover:text-red-400 disabled:opacity-50 gap-1.5"><Trash2 className="w-3.5 h-3.5" /><span className="text-xs hidden lg:inline">Del</span></Button></div></TooltipTrigger><TooltipContent side="bottom" className="text-xs flex items-center gap-1">Delete <kbd className="bg-secondary px-1 py-0.5 rounded text-[9px] text-muted-foreground">Del</kbd></TooltipContent></Tooltip>
          </TooltipProvider>
        </div>
        
        <div className="flex-1" />
        <div className="flex items-center gap-3 ml-auto text-sm text-muted-foreground shrink-0 pl-4">
          <TooltipProvider delayDuration={200}>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={() => { const maxD = Math.max(...tracks.map(t => (t.startTime||0)+(t.duration||40))); if (maxD>0) setZoom(Math.max(0.5, 40/maxD)); }} className="h-7 px-2 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-secondary"><Maximize2 className="w-3.5 h-3.5 mr-1.5" /> <span className="hidden lg:inline">Fit</span></Button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Zoom to fit all tracks</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><div className="flex items-center gap-1 cursor-help ml-2"><span className="hidden lg:inline">Zoom</span></div></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Adjust horizontal zoom (Ctrl+Scroll)</TooltipContent></Tooltip>
          </TooltipProvider>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(0.5, z / 1.5))} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary rounded text-xs">−</Button>
            <Slider value={[zoom]} min={0.5} max={5000} step={0.5} onValueChange={(v) => setZoom(v[0])} className="w-28" />
            <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(5000, z * 1.5))} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary rounded text-xs">+</Button>
          </div>
          <span className="w-12 text-right font-mono text-[10px] text-primary/80">{zoom >= 50 ? `${(1/(20*zoom)*1000).toFixed(1)}ms/px` : `${Math.round(zoom * 100)}%`}</span>
        </div>
    </>
  );

  if (isMobile) {
    return (
      <div className="min-h-[3.5rem] py-1.5 mx-2 mt-2 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] flex items-center justify-between px-4 gap-2 shrink-0 relative z-10">
        <Button onClick={addTrack} variant="secondary" size="sm" className="gap-2 h-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20">
          <Plus className="w-4 h-4" /> Add Track
        </Button>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-8 rounded-lg">
              <Settings2 className="w-4 h-4" /> Tools
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[75vh] bg-card border-border overflow-y-auto custom-scrollbar p-6">
            <SheetHeader className="mb-4 text-left">
              <SheetTitle>Studio Tools</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-6">
              {toolbarContent}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="min-h-[3.5rem] py-1.5 mx-2 sm:mx-3 mt-2 sm:mt-3 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_32px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] flex flex-wrap items-center px-2 sm:px-4 gap-2 sm:gap-4 shrink-0 relative z-10">
      {toolbarContent}
    </div>
  );
}