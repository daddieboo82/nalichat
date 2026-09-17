import { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Trash2, MessageSquare, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

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

async function listAllContacts(userId) {
  const rows = [];
  const pageSize = 200;
  for (let skip = 0; ; skip += pageSize) {
    const page = await base44.entities.Contact.filter(
      { user_id: userId },
      "-created_date",
      pageSize,
      skip,
    );
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export default function ContactsTab({ currentUserId, onMessageContact }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [tab, setTab] = useState("contacts"); // "contacts" | "discover"
  const initialTabResolvedRef = useRef(false);
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading: loadingContacts, isError: contactsError, refetch: refetchContacts } = useQuery({
    queryKey: ["contacts", currentUserId],
    queryFn: () => currentUserId ? listAllContacts(currentUserId) : [],
    enabled: !!currentUserId,
  });

  const { data: allUsers = [], isLoading: loadingUsers, isError: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ["users", "presence", currentUserId],
    queryFn: async () => {
      const res = await base44.functions.invoke('listPublicUsers', { includePresence: true });
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        res?.data?.success !== true ||
        res?.data?.viewerUserId !== currentUserId ||
        !Array.isArray(res?.data?.users)
      ) {
        throw new Error("User directory response was not confirmed.");
      }
      return res.data?.users || [];
    },
    enabled: !!currentUserId,
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId) => {
      const res = await base44.functions.invoke("mutateContact", { action: "delete", contactId });
      if (res?.data?.error) throw new Error(res.data.error);
      if (res?.data?.success !== true ||
        res?.data?.action !== "delete" ||
        res?.data?.userId !== currentUserId ||
        res?.data?.contactId !== contactId ||
        res?.data?.deleted !== true) {
        throw new Error("Contact removal was not confirmed.");
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["users", "presence", currentUserId] });
    },
    onError: () => toast.error("Couldn't remove contact. Please try again."),
  });

  const addContactMutation = useMutation({
    mutationFn: async (user) => {
      const res = await base44.functions.invoke("mutateContact", {
        action: "add",
        targetUserId: user.id,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      const contact = res?.data?.contact;
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "add" ||
        res?.data?.userId !== currentUserId ||
        res?.data?.targetUserId !== user.id ||
        !contact?.id ||
        contact?.user_id !== currentUserId ||
        contact?.contact_user_id !== user.id
      ) {
        throw new Error("Contact addition was not confirmed.");
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts", currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["users", "presence", currentUserId] });
    },
    onError: () => toast.error("Couldn't add contact. Please try again."),
  });

  useEffect(() => {
    initialTabResolvedRef.current = false;
    setTab("contacts");
  }, [currentUserId]);

  useEffect(() => {
    if (
      initialTabResolvedRef.current
      || !currentUserId
      || loadingContacts
      || contactsError
    ) return;

    initialTabResolvedRef.current = true;
    if (contacts.length === 0) setTab("discover");
  }, [contacts.length, contactsError, currentUserId, loadingContacts]);

  const contactUserIds = new Set(contacts.map(c => c.contact_user_id));

  const listToShow = tab === "contacts" 
    ? allUsers.filter(u => contactUserIds.has(u.id))
    : allUsers.filter(u => u.id !== currentUserId && !contactUserIds.has(u.id));

  const filtered = listToShow.filter(u => {
    const publicRole = u.artist_role || (["artist", "producer", "engineer", "ar"].includes(u.role) ? u.role : "artist");
    if (roleFilter !== "all" && publicRole !== roleFilter) return false;
    const q = search.toLowerCase();
    return (u.display_name || u.full_name || "").toLowerCase().includes(q) ||
           (u.genres || []).some(g => g.toLowerCase().includes(q)) ||
           (u.location || "").toLowerCase().includes(q);
  });

  if (loadingContacts || loadingUsers || !currentUserId) {
    return <div className="flex-1 flex justify-center items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 space-y-3 px-4 pb-3 pt-2 sm:space-y-4 sm:px-6 sm:pb-4">
        <div className="flex gap-2">
          <Button variant={tab === "contacts" ? "default" : "outline"} size="sm" onClick={() => setTab("contacts")} className="ui-hover min-h-11 flex-1 rounded-xl font-semibold focus-visible:ring-2 focus-visible:ring-primary/40">My Contacts</Button>
          <Button variant={tab === "discover" ? "default" : "outline"} size="sm" onClick={() => setTab("discover")} className="ui-hover min-h-11 flex-1 rounded-xl font-semibold focus-visible:ring-2 focus-visible:ring-primary/40">Discover</Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, genre, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            title="Search contacts"
            aria-label="Search contacts"
            className="min-h-11 rounded-xl border border-border/50 bg-secondary/50 pl-9 text-sm focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar pr-4 after:content-[''] after:w-4 after:shrink-0">
          {["all", "artist", "producer", "engineer", "ar"].map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`ui-hover min-h-10 shrink-0 whitespace-nowrap rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 ${roleFilter === r ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            >
              {r === "all" ? "All" : r === "ar" ? "A&R" : r + "s"}
            </button>
          ))}
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
        {(contactsError || usersError) && (
          <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs leading-relaxed text-destructive" role="alert">
            <p>
              {usersError
                ? "Couldn't load people right now."
                : "Couldn't load your contacts. Discovery may be incomplete."}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ui-hover mt-3 min-h-10 rounded-xl px-4 text-xs font-semibold"
              onClick={() => {
                if (usersError) void refetchUsers();
                if (contactsError) void refetchContacts();
              }}
            >
              Retry
            </Button>
          </div>
        )}
        {!usersError && filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-sm font-semibold text-foreground">No people found</p><p className="mt-1 text-xs">Try another name, genre, location, or role.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((user) => {
              const contactRecord = contacts.find(c => c.contact_user_id === user.id);
              
              return (
                <div key={user.id} className="ui-surface group flex flex-col gap-3 rounded-3xl border border-border/50 bg-card/70 p-4 transition-all hover:border-primary/30">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <Avatar className="w-12 h-12 rounded-xl">
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback className="bg-primary/20 text-primary font-bold rounded-xl">
                          {(user.display_name || user.full_name || "?")[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {user.is_online && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-[2.5px] border-background shadow-sm"
                          aria-label="Active now"
                          title="Active now"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-heading font-semibold text-sm truncate">{user.display_name || user.full_name}</p>
                        <span className="text-xs">{roleIcons[user.artist_role]}</span>
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
                      className="ui-hover min-h-11 flex-1 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border-0 text-xs"
                      onClick={() => onMessageContact(user)}
                    >
                      <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Message
                    </Button>
                    
                    {tab === "discover" ? (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="ui-hover min-h-11 flex-1 rounded-xl text-xs"
                        onClick={() => addContactMutation.mutate(user)}
                        disabled={addContactMutation.isPending}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" /> Add
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="ui-hover h-11 w-11 rounded-xl border-border p-0 text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-destructive/30"
                        onClick={() => deleteContactMutation.mutate(contactRecord.id)}
                        disabled={deleteContactMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" /><span className="sr-only">Remove contact</span>
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