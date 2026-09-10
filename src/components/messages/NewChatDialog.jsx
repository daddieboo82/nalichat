import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2 } from "lucide-react";

export default function NewChatDialog({ open, onOpenChange, users, onSelectUser, currentUserId }) {
  const [search, setSearch] = useState("");

  // Fetch contacts for the current user
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["contacts", currentUserId],
    queryFn: () => base44.entities.Contact.filter({ user_id: currentUserId }),
    enabled: open && !!currentUserId,
  });

  // Get contact users and filter
  const contactUsers = contacts
    .map(contact => users.find(u => u.id === contact.contact_user_id))
    .filter(Boolean);
  
  const filtered = users.filter(u => {
    const query = search.toLowerCase();
    return (
      (u.display_name || u.full_name || "").toLowerCase().includes(query) ||
      (u.email || "").toLowerCase().includes(query) ||
      (u.phone || "").toLowerCase().includes(query) ||
      (u.role || "").toLowerCase().includes(query)
    );
  });

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
           <DialogTitle className="font-heading">Start a Chat</DialogTitle>
           <DialogDescription>Select a user to begin a conversation</DialogDescription>
         </DialogHeader>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            title="Search by name, email, or phone"
            aria-label="Search by name, email, or phone"
            className="pl-9 bg-secondary/50 border-0 rounded-xl"
            autoFocus
          />
        </div>
        <div className="max-h-[340px] overflow-y-auto space-y-1">
          {contactsLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!search && contactUsers.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground px-3 py-2 uppercase">My Contacts</p>
              {contactUsers.map(user => (
                <button
                  key={user.id}
                  onClick={() => { onSelectUser(user); onOpenChange(false); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 transition-colors text-left"
                  title={`Start chat with ${user.display_name || user.full_name}`}
                  aria-label={`Start chat with ${user.display_name || user.full_name}`}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
                      {(user.display_name || user.full_name || "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{user.display_name || user.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.bio || user.email || "No bio"}</p>
                  </div>
                  <Badge className={`text-[10px] ${roleColors[user.role] || "bg-secondary text-secondary-foreground"} border-0`}>
                    {user.role?.toUpperCase()}
                  </Badge>
                </button>
              ))}
              {filtered.length > 0 && <p className="text-xs font-semibold text-muted-foreground px-3 py-2 mt-3 uppercase">Other Users</p>}
            </>
          )}

          {filtered.map(user => (
            <button
              key={user.id}
              onClick={() => { onSelectUser(user); onOpenChange(false); }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors text-left"
              title={`Start chat with ${user.display_name || user.full_name}`}
              aria-label={`Start chat with ${user.display_name || user.full_name}`}
            >
              <Avatar className="w-10 h-10">
                <AvatarImage src={user.avatar_url} />
                <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
                  {(user.display_name || user.full_name || "?")[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{user.display_name || user.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.bio || user.email || "No bio"}</p>
              </div>
              <Badge className={`text-[10px] ${roleColors[user.role] || "bg-secondary text-secondary-foreground"} border-0`}>
                {user.role?.toUpperCase()}
              </Badge>
            </button>
          ))}

          {filtered.length === 0 && search && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-3">No users found matching "{search}"</p>
              <p className="text-xs text-muted-foreground/60">Try searching by username, email, or phone number</p>
            </div>
          )}
          {!search && users.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No users available</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}