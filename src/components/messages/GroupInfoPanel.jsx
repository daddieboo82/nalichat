import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Users, Pencil, Check, LogOut } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { MessageSquare } from "lucide-react";

export default function GroupInfoPanel({ conversation, users, currentUser, onClose, onStartDM }) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(conversation?.name || "");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [pendingDmUserId, setPendingDmUserId] = useState(null);
  const queryClient = useQueryClient();

  const members = users.filter(u => conversation?.participant_ids?.includes(u.id));

  const saveName = async () => {
    if (!nameValue.trim() || isSavingName) return;
    setIsSavingName(true);
    try {
      const res = await base44.functions.invoke("manageConversation", {
        action: "rename",
        conversationId: conversation.id,
        name: nameValue.trim(),
      });
      if (res?.data?.error) throw new Error(res.data.error);
      const updated = res?.data?.conversation;
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "rename" ||
        res?.data?.userId !== currentUser?.id ||
        res?.data?.conversationId !== conversation.id ||
        res?.data?.name !== nameValue.trim() ||
        updated?.id !== conversation.id ||
        updated?.name !== nameValue.trim()
      ) {
        throw new Error("Group rename was not confirmed.");
      }
      await queryClient.invalidateQueries({ queryKey: ["conversations", currentUser?.id] });
      setEditingName(false);
    } catch {
      toast.error("Couldn't rename the group. Please try again.");
    } finally {
      setIsSavingName(false);
    }
  };

  const leaveGroup = async () => {
    if (!currentUser || isLeaving) return;
    setIsLeaving(true);
    try {
      const res = await base44.functions.invoke("manageConversation", {
        action: "leave",
        conversationId: conversation.id,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      const updated = res?.data?.conversation;
      const leaveConfirmed =
        res?.data?.success === true &&
        res?.data?.action === "leave" &&
        res?.data?.userId === currentUser.id &&
        res?.data?.conversationId === conversation.id && (
        res?.data?.deleted === true ||
        (updated?.id === conversation.id && Array.isArray(updated?.participant_ids) && !updated.participant_ids.includes(currentUser.id))
      );
      if (!leaveConfirmed) throw new Error("Leaving the group was not confirmed.");
      await queryClient.invalidateQueries({ queryKey: ["conversations", currentUser?.id] });
      onClose();
    } catch {
      toast.error("Couldn't leave the group. Please try again.");
    } finally {
      setIsLeaving(false);
    }
  };

  const messageMember = async (user) => {
    if (!onStartDM || !user?.id || pendingDmUserId) return;
    setPendingDmUserId(user.id);
    try {
      await onStartDM(user);
      onClose();
    } catch {
      // Parent startDM already shows the user-facing error toast.
    } finally {
      setPendingDmUserId(null);
    }
  };

  return (
    <div className="w-72 border-l border-border bg-card/60 backdrop-blur-sm flex flex-col shrink-0">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border/50 shrink-0">
        <span className="font-heading font-semibold text-sm">Group Info</span>
        <button onClick={onClose} title="Close Group Info" aria-label="Close Group Info" className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Group identity */}
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center border border-primary/20">
            <Users className="w-8 h-8 text-primary" />
          </div>
          {editingName ? (
            <div className="flex items-center gap-2 w-full">
              <Input
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                className="bg-secondary/50 border-0 rounded-xl h-8 text-sm text-center font-semibold"
                autoFocus
              />
              <button onClick={saveName} disabled={isSavingName} title="Save Group Name" aria-label="Save Group Name" className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors shrink-0 disabled:opacity-60">
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="font-heading font-bold text-base">{conversation?.name}</p>
              <button
                onClick={() => { setNameValue(conversation?.name || ""); setEditingName(true); }}
                title="Edit Group Name"
                aria-label="Edit Group Name"
                className="w-6 h-6 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{members.length} members</p>
        </div>

        {/* Members list */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 px-1">Members</p>
          <div className="space-y-1">
            {members.map(u => (
              <div key={u.id} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-secondary/50 transition-colors">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={u.avatar_url} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                    {(u.display_name || u.full_name)?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.display_name || u.full_name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{u.artist_role || "artist"}</p>
                </div>
                {u.id !== currentUser?.id && onStartDM && (
                  <button
                    onClick={() => messageMember(u)}
                    disabled={!!pendingDmUserId}
                    className="w-11 h-11 rounded-full bg-secondary hover:bg-primary/20 hover:text-primary flex items-center justify-center transition-colors shrink-0"
                    title="Message privately"
                    aria-label="Message privately"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="p-4 border-t border-border/50 shrink-0">
        <Button 
          variant="outline" 
          className="w-full text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20"
          onClick={leaveGroup}
          disabled={isLeaving}
        >
          <LogOut className="w-4 h-4 mr-2" />
          {isLeaving ? "Leaving..." : "Leave Group"}
        </Button>
      </div>
    </div>
  );
}