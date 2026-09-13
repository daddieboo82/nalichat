import React from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Plus, Undo, Layers, ChevronLeft } from 'lucide-react';

export default function StudioWelcome({
  hasAutosave,
  handleStartBlank,
  handleLoadAutosave,
  handleLoadDemo,
  navigate
}) {
  return (
    <div className="relative flex min-h-screen min-h-[100dvh] flex-1 flex-col items-center justify-center overflow-y-auto bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(var(--primary),0.15)_0%,transparent_70%)] pointer-events-none" />
      <div className="ui-surface z-10 flex w-full max-w-lg flex-col items-center rounded-3xl border border-border/80 bg-card/80 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/20 shadow-lg shadow-primary/10 sm:mb-6">
          <Mic className="w-8 h-8 text-primary" />
        </div>
        <h1 className="mb-2 text-center text-2xl font-heading font-bold tracking-tight sm:text-3xl">Welcome to Studio</h1>
        <p className="mb-7 max-w-sm text-center text-sm leading-relaxed text-muted-foreground sm:mb-8">Choose how you'd like to start your session.</p>
        
        <div className="flex flex-col gap-3 w-full">
          <Button onClick={handleStartBlank} className="ui-hover min-h-14 w-full justify-start rounded-xl text-base font-semibold shadow-lg shadow-primary/15" variant="default">
            <Plus className="w-5 h-5 mr-3" /> Create New Project
          </Button>
          
          <Button onClick={handleLoadAutosave} disabled={!hasAutosave} className="ui-hover min-h-14 w-full justify-start rounded-xl text-base font-medium disabled:opacity-50" variant="outline">
            <Undo className="w-5 h-5 mr-3" /> Pick Up Where I Left Off
          </Button>
          
          <Button onClick={handleLoadDemo} className="ui-hover min-h-14 w-full justify-start rounded-xl text-base font-medium" variant="secondary">
            <Layers className="w-5 h-5 mr-3" /> Load Demo Project
          </Button>
          
          <div className="mt-4 pt-4 border-t border-border w-full flex justify-center">
             <Button variant="ghost" onClick={() => navigate('/')} className="ui-hover min-h-11 rounded-xl text-muted-foreground hover:text-foreground">
               <ChevronLeft className="w-4 h-4 mr-2" /> Back to Dashboard
             </Button>
          </div>
        </div>
      </div>
    </div>
  );
}