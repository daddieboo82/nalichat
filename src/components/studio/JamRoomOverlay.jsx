import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';
import { base44 } from '@/api/base44Client';

export default function JamRoomOverlay({ jamRoomActive, defaultRole, setDefaultRole, roomId }) {
  const [creatingLink, setCreatingLink] = useState(false);
  const [revokingLinks, setRevokingLinks] = useState(false);

  const revokeInvites = async () => {
    if (!roomId) return;
    setRevokingLinks(true);
    try {
      const res = await base44.functions.invoke("revokeProjectInvites", {
        projectId: roomId,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      if (res?.data?.success !== true || !Number.isInteger(res?.data?.revoked) || res.data.revoked < 0) {
        throw new Error("Invite revocation was not confirmed.");
      }
      toast.success(`Revoked ${res.data.revoked} active invite link(s).`);
    } catch (error) {
      toast.error(error?.message || "Couldn't revoke invite links.");
    } finally {
      setRevokingLinks(false);
    }
  };

  const copyInvite = async () => {
    if (!roomId) {
      toast.error("Open a saved project before creating a Jam Room invite.");
      return;
    }
    setCreatingLink(true);
    try {
      const res = await base44.functions.invoke("createProjectInvite", {
        projectId: roomId,
        role: defaultRole,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      if (res?.data?.success !== true || !/^[0-9a-f]{64}$/i.test(String(res?.data?.token || ""))) {
        throw new Error("Invite creation was not confirmed.");
      }
      const url = new URL("/studio", window.location.origin);
      url.searchParams.set("room", roomId);
      url.searchParams.set("invite", res.data.token);
      const copied = await copyToClipboard(url.toString());
      if (!copied) throw new Error("Couldn't copy the invite link. Please copy it manually.");
      toast.success(`${defaultRole === "editor" ? "Editor" : "Viewer"} invite link copied!`);
    } catch (error) {
      toast.error(error?.message || "Couldn't create an invite link.");
    } finally {
      setCreatingLink(false);
    }
  };

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
              <Button variant="outline" size="sm" className="w-full h-7 text-[10px] mt-2" onClick={copyInvite} disabled={creatingLink || revokingLinks}>
                {creatingLink ? "Creating link…" : "Copy Invite Link"}
              </Button>
              <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] mt-1 text-destructive" onClick={revokeInvites} disabled={creatingLink || revokingLinks}>
                {revokingLinks ? "Revoking links…" : "Revoke All Invite Links"}
              </Button>
            </div>
            
            <p className="text-[9px] text-muted-foreground mt-3">Collaborators will appear here when they join.</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}