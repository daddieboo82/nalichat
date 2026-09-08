import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';

export default function JamRoomOverlay({ jamRoomActive, defaultRole, setDefaultRole }) {
  return (
    <AnimatePresence>
      {jamRoomActive && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="absolute bottom-4 right-4 z-50 flex flex-col items-end gap-2"
        >
          <div className="w-64 bg-card/90 backdrop-blur border border-border rounded-xl shadow-xl overflow-hidden p-4 flex flex-col items-center text-center">
            <div className="relative mb-2">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(var(--primary),1)]" />
            </div>
            <p className="text-xs font-semibold text-foreground">Jam Room is live</p>
            
            <div className="w-full mt-3 pt-3 border-t border-border/50 text-left">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5 block">Default Role for Link</label>
              <Select value={defaultRole} onValueChange={setDefaultRole}>
                <SelectTrigger className="h-7 text-[10px] bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">Editor (Can edit tracks)</SelectItem>
                  <SelectItem value="viewer">Viewer (Listen only)</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="w-full h-7 text-[10px] mt-2" onClick={() => {
                copyToClipboard(window.location.href);
                toast.success("Invite link copied!");
              }}>
                Copy Invite Link
              </Button>
            </div>
            
            <p className="text-[9px] text-muted-foreground mt-3">Collaborators will appear here when they join.</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}