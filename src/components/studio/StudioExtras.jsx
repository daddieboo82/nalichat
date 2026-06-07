import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import MilestonesPanel from '@/components/studio/MilestonesPanel';
import Record from '@/pages/Record';

export default function StudioExtras({ 
  showQuickMemo, setShowQuickMemo, 
  showImportDialog, setShowImportDialog, fileInputRef,
  showMilestones, setShowMilestones 
}) {
  return (
    <>
      <Dialog open={showQuickMemo} onOpenChange={setShowQuickMemo}>
        <DialogContent className="max-w-4xl bg-background border-border overflow-y-auto h-[650px] p-0">
          <Record />
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="bg-card border-border shadow-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">Import Audio Tracks</DialogTitle>
          </DialogHeader>
          <div className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors border-border/50 hover:border-primary/40 bg-secondary/20"
               onClick={() => {
                 if (fileInputRef?.current) {
                   fileInputRef.current.click();
                   setShowImportDialog(false);
                 }
               }}
          >
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
              <Upload className="w-7 h-7 text-primary/70" />
            </div>
            <p className="font-medium mb-1">Click to browse your device</p>
            <p className="text-xs text-muted-foreground mb-3">
              Supports: MP3, WAV, FLAC, OGG, AAC, M4A, WebM
            </p>
            <Button variant="outline" size="sm" onClick={(e) => {
                 e.stopPropagation();
                 if (fileInputRef?.current) {
                   fileInputRef.current.click();
                   setShowImportDialog(false);
                 }
               }}>Select Files</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMilestones} onOpenChange={setShowMilestones}>
        <DialogContent className="max-w-xl h-[600px] p-0 border-border bg-background flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <MilestonesPanel projectId="local_studio" canEdit={true} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}