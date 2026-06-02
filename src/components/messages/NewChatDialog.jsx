import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

export default function NewChatDialog({ open, onOpenChange, users, onSelectUser }) {
  const [search, setSearch] = useState("");
  
  const filtered = users.filter(u =>
    (u.display_name || u.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.role || "").toLowerCase().includes(search.toLowerCase())
  );

  const roleColors = {
    artist: "bg-primary/20 text-primary",
    producer: "bg-accent/20 text-accent",
    engineer: "bg-chart-4/20 text-chart-4",
    ar: "bg-chart-3/20 text-chart-3",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">New Conversation</DialogTitle>
        </DialogHeader>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50 border-0 rounded-xl"
          />
        </div>
        <div className="max-h-[340px] overflow-y-auto space-y-1">
          {filtered.map(user => (
            <button
              key={user.id}
              onClick={() => { onSelectUser(user); onOpenChange(false); }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors text-left"
            >
              <Avatar className="w-10 h-10">
                <AvatarImage src={user.avatar_url} />
                <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
                  {(user.display_name || user.full_name || "?")[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{user.display_name || user.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.bio || "No bio"}</p>
              </div>
              <Badge className={`text-[10px] ${roleColors[user.role] || "bg-secondary text-secondary-foreground"} border-0`}>
                {user.role?.toUpperCase()}
              </Badge>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No users found</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}