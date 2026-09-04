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
    <div className="flex-1 flex flex-col h-screen items-center justify-center p-8 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(var(--primary),0.15)_0%,transparent_70%)] pointer-events-none" />
      <div className="z-10 bg-card/80 backdrop-blur-xl border border-border p-8 rounded-2xl shadow-2xl max-w-md w-full flex flex-col items-center">
        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-6">
          <Mic className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-heading font-bold mb-2">Welcome to Studio</h1>
        <p className="text-muted-foreground text-center mb-8">Choose how you'd like to start your session.</p>
        
        <div className="flex flex-col gap-3 w-full">
          <Button onClick={handleStartBlank} className="w-full justify-start h-12 text-base font-medium" variant="default">
            <Plus className="w-5 h-5 mr-3" /> Create New Project
          </Button>
          
          <Button onClick={handleLoadAutosave} disabled={!hasAutosave} className="w-full justify-start h-12 text-base font-medium" variant="outline">
            <Undo className="w-5 h-5 mr-3" /> Pick Up Where I Left Off {hasAutosave ? "" : "(No autosave)"}
          </Button>
          
          <Button onClick={handleLoadDemo} className="w-full justify-start h-12 text-base font-medium" variant="secondary">
            <Layers className="w-5 h-5 mr-3" /> Load Demo Project
          </Button>
          
          <div className="mt-4 pt-4 border-t border-border w-full flex justify-center">
             <Button variant="ghost" onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground">
               <ChevronLeft className="w-4 h-4 mr-2" /> Back to Dashboard
             </Button>
          </div>
        </div>
      </div>
    </div>
  );
}