import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Trash2, MessageSquare, Loader2, Music, MapPin } from "lucide-react";
import { motion } from "framer-motion";

const roleColors = {
  artist: "bg-primary/20 text-primary border-primary/30",
  producer: "bg-accent/20 text-accent border-accent/30",
  engineer: "bg-chart-4/20 text-chart-4 border-chart-4/30",
  ar: "bg-chart-3/20 text-chart-3 border-chart-3/30",
};

const roleIcons = {
  artist: "🎤",
  producer: "🎹",
  engineer: "🎛️",
  ar: "📋",
};

export default function ContactsTab({ currentUserId, onMessageContact }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [tab, setTab] = useState("contacts"); // "contacts" | "discover"
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ["contacts", currentUserId],
    queryFn: () => currentUserId ? base44.entities.Contact.filter({ user_id: currentUserId }) : [],
    enabled: !!currentUserId,
  });

  const { data: allUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId) => base44.entities.Contact.delete(contactId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contacts", currentUserId] }),
  });

  const addContactMutation = useMutation({
    mutationFn: (user) =>
      base44.entities.Contact.create({
        user_id: currentUserId,
        contact_user_id: user.id,
        contact_name: user.display_name || user.full_name,
        contact_avatar: user.avatar_url,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", currentUserId] });
    },
  });

  const contactUserIds = new Set(contacts.map(c => c.contact_user_id));

  const listToShow = tab === "contacts" 
    ? allUsers.filter(u => contactUserIds.has(u.id))
    : allUsers.filter(u => u.id !== currentUserId && !contactUserIds.has(u.id));

  const filtered = listToShow.filter(u => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    const q = search.toLowerCase();
    return (u.display_name || u.full_name || "").toLowerCase().includes(q) ||
           (u.genres || []).some(g => g.toLowerCase().includes(q)) ||
           (u.location || "").toLowerCase().includes(q);
  });

  if (loadingContacts || loadingUsers) {
    return <div className="flex-1 flex justify-center items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-2 pb-4 space-y-4 shrink-0">
        <div className="flex gap-2">
          <Button variant={tab === "contacts" ? "default" : "outline"} size="sm" onClick={() => setTab("contacts")} className="flex-1 rounded-xl">My Contacts</Button>
          <Button variant={tab === "discover" ? "default" : "outline"} size="sm" onClick={() => setTab("discover")} className="flex-1 rounded-xl">Discover</Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, genre, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            title="Search contacts"
            aria-label="Search contacts"
            className="pl-9 bg-secondary/50 border-0 rounded-xl text-sm"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar pr-4">
          {["all", "artist", "producer", "engineer", "ar"].map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition-colors ${roleFilter === r ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            >
              {r === "all" ? "All" : r === "ar" ? "A&R" : r + "s"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-sm">No users found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((user) => {
              const contactRecord = contacts.find(c => c.contact_user_id === user.id);
              
              return (
                <div key={user.id} className="bg-card rounded-2xl border border-border/50 p-4 hover:border-primary/30 transition-all flex flex-col gap-3 group">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12 rounded-xl">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback className="bg-primary/20 text-primary font-bold rounded-xl">
                        {(user.display_name || user.full_name || "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-heading font-semibold text-sm truncate">{user.display_name || user.full_name}</p>
                        <span className="text-xs">{roleIcons[user.role]}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                        {user.location && <><MapPin className="w-3 h-3" /> {user.location}</>}
                      </p>
                    </div>
                  </div>

                  {user.genres?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {user.genres.slice(0, 3).map(g => (
                        <Badge key={g} variant="outline" className="text-[9px] border-border py-0 h-4 px-1.5">
                          {g}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button 
                      size="sm" 
                      className="flex-1 h-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border-0 text-xs"
                      onClick={() => onMessageContact(user)}
                    >
                      <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Message
                    </Button>
                    
                    {tab === "discover" ? (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="flex-1 h-8 rounded-lg text-xs"
                        onClick={() => addContactMutation.mutate(user)}
                        disabled={addContactMutation.isPending}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" /> Add
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-8 h-8 p-0 rounded-lg text-destructive hover:bg-destructive/10 border-border"
                        onClick={() => deleteContactMutation.mutate(contactRecord.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}