import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export default function GroupChatDialog({ open, onOpenChange, users, onCreate }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");

  const filtered = users.filter(u =>
    (u.display_name || u.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleCreate = () => {
    if (!name.trim() || selected.length < 1) return;
    onCreate({ name: name.trim(), participant_ids: selected });
    setName(""); setSelected([]); setSearch("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
         <DialogHeader>
           <DialogTitle className="font-heading flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> New Group</DialogTitle>
           <DialogDescription>Create a group chat and add members</DialogDescription>
         </DialogHeader>
        <div className="space-y-4">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Group name..." className="bg-secondary/50 border-0 rounded-xl" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people..." className="bg-secondary/50 border-0 rounded-xl" />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.map(u => (
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
                  <p className="text-[10px] text-muted-foreground capitalize">{u.role}</p>
                </div>
                {selected.includes(u.id) && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
          <Button onClick={handleCreate} disabled={!name.trim() || selected.length < 1} className="w-full rounded-xl bg-primary hover:bg-primary/90" aria-label="Create Group Submit" title="Create Group Submit">
            Create Group {selected.length > 0 && `(${selected.length} people)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}