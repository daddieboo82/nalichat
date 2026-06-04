import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Plus, Trash2, MessageSquare, Loader2 } from "lucide-react";

export default function ContactsTab({ currentUserId, onMessageContact }) {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts", currentUserId],
    queryFn: () => currentUserId ? base44.entities.Contact.filter({ user_id: currentUserId }) : [],
    enabled: !!currentUserId,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users-for-contacts"],
    queryFn: () => base44.entities.User.list(),
    enabled: showAdd,
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId) => base44.entities.Contact.delete(contactId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contacts", currentUserId] }),
  });

  const addContactMutation = useMutation({
    mutationFn: (userId) =>
      base44.entities.Contact.create({
        user_id: currentUserId,
        contact_user_id: userId,
        contact_name: allUsers.find(u => u.id === userId)?.display_name || allUsers.find(u => u.id === userId)?.full_name,
        contact_avatar: allUsers.find(u => u.id === userId)?.avatar_url,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", currentUserId] });
      setShowAdd(false);
    },
  });

  const contactUsers = contacts.map(c => ({
    ...c,
    displayName: c.contact_name,
    avatarUrl: c.contact_avatar,
  }));

  const filtered = contactUsers.filter(c =>
    (c.displayName || "").toLowerCase().includes(search.toLowerCase())
  );

  const availableUsers = allUsers.filter(u =>
    u.id !== currentUserId && !contacts.some(c => c.contact_user_id === u.id)
  );

  const roleColors = {
    artist: "bg-primary/20 text-primary",
    producer: "bg-accent/20 text-accent",
    engineer: "bg-chart-4/20 text-chart-4",
    ar: "bg-chart-3/20 text-chart-3",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-border/40 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Address Book</h3>
          <Button
            size="icon"
            variant="ghost"
            className="w-7 h-7 rounded-lg hover:bg-primary/10"
            onClick={() => setShowAdd(true)}
            title="Add Contact"
          >
            <Plus className="w-4 h-4 text-primary" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50 border-0 rounded-lg text-sm h-8"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 px-4">
            <p className="text-xs text-muted-foreground">
              {contacts.length === 0 ? "No contacts yet. Add one to get started." : `No contacts match "${search}"`}
            </p>
          </div>
        ) : (
          <div className="space-y-1 p-3">
            {filtered.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 transition-colors group"
              >
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={contact.avatarUrl} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                    {(contact.displayName || "?")[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs truncate">{contact.displayName}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-6 h-6 rounded text-primary hover:bg-primary/10"
                    onClick={() => onMessageContact(contact.contact_user_id)}
                    title="Message"
                  >
                    <MessageSquare className="w-3 h-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-6 h-6 rounded text-destructive hover:bg-destructive/10"
                    onClick={() => deleteContactMutation.mutate(contact.id)}
                    title="Remove"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Add Contact</DialogTitle>
          </DialogHeader>
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {availableUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">All users are already in your contacts</p>
            ) : (
              availableUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => addContactMutation.mutate(user.id)}
                  disabled={addContactMutation.isPending}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors text-left"
                >
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                      {(user.display_name || user.full_name || "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{user.display_name || user.full_name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge className={`text-[10px] ${roleColors[user.role] || "bg-secondary text-secondary-foreground"} border-0`}>
                    {user.role?.toUpperCase()}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}