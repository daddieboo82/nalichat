import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClientMessageKey } from "@/lib/messageCache";

export default function GroupChatDialog({ open, onOpenChange, users, onCreate }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const retryKeyRef = useRef(null);
  const retrySignatureRef = useRef("");
  const operationGenerationRef = useRef(0);

  useEffect(() => {
    if (open) return;
    operationGenerationRef.current += 1;
    setName("");
    setSelected([]);
    setSearch("");
    setIsCreating(false);
    retryKeyRef.current = null;
    retrySignatureRef.current = "";
  }, [open]);

  const filtered = users.filter(u =>
    (u.display_name || u.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || selected.length < 1 || isCreating) return;
    const participantIds = [...selected].sort();
    const signature = `${trimmedName}:${participantIds.join(",")}`;
    const clientRequestKey = retryKeyRef.current && retrySignatureRef.current === signature
      ? retryKeyRef.current
      : createClientMessageKey();
    retryKeyRef.current = clientRequestKey;
    retrySignatureRef.current = signature;

    const generation = operationGenerationRef.current;
    setIsCreating(true);
    try {
      await onCreate({
        name: trimmedName,
        participant_ids: participantIds,
        client_request_key: clientRequestKey,
      });
      if (generation !== operationGenerationRef.current) return;
      retryKeyRef.current = null;
      retrySignatureRef.current = "";
      setName("");
      setSelected([]);
      setSearch("");
      onOpenChange(false);
    } catch {
      // Parent surfaces the user-facing error. Keep the dialog state intact.
    } finally {
      if (generation === operationGenerationRef.current) setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
         <DialogHeader>
           <DialogTitle className="font-heading flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> New Group</DialogTitle>
           <DialogDescription>Create a group chat and add members</DialogDescription>
         </DialogHeader>
        <div className="space-y-4">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Group name..." className="bg-secondary/50 border-0 rounded-xl" title="Group name" aria-label="Group name" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people..." className="bg-secondary/50 border-0 rounded-xl" title="Search people" aria-label="Search people" />
          <div className="max-h-64 overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] space-y-1">
            {users.length === 0 ? (
              <div className="rounded-xl border border-border/50 bg-secondary/30 px-4 py-5 text-center">
                <p className="text-sm font-semibold text-foreground">No group members available yet</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Add someone as a contact and have them add you back before creating a private group.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No people match your search.
              </div>
            ) : filtered.map(u => (
              <button key={u.id} onClick={() => toggle(u.id)}
                className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left", selected.includes(u.id) ? "bg-primary/10 border border-primary/20" : "hover:bg-secondary")}
                title={`Toggle ${u.display_name || u.full_name}`}
                aria-label={`Toggle ${u.display_name || u.full_name}`}
              >
                <Avatar className="w-9 h-9 shrink-0">
                  <AvatarImage src={u.avatar_url} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">{(u.display_name || u.full_name)?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.display_name || u.full_name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{u.artist_role || "artist"}</p>
                </div>
                {selected.includes(u.id) && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
          <Button onClick={handleCreate} disabled={!name.trim() || selected.length < 1 || isCreating} className="w-full rounded-xl bg-primary hover:bg-primary/90" aria-label="Create Group Submit" title="Create Group Submit">
            {isCreating ? "Creating..." : <>Create Group {selected.length > 0 && `(${selected.length} people)`}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}