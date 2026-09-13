import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Send } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClientMessageKey } from "@/lib/messageCache";
import { useAuth } from "@/lib/AuthContext";

export default function GlobalMessageDialog({ open, onOpenChange }) {
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { user: currentUser, isAuthenticated, isLoadingAuth } = useAuth();
  const retryKeyRef = useRef(null);
  const retrySignatureRef = useRef("");
  const identityGenerationRef = useRef(0);

  useEffect(() => {
    identityGenerationRef.current += 1;
    setSearch("");
    setSelectedUser(null);
    setMessage("");
    setSending(false);
    retryKeyRef.current = null;
    retrySignatureRef.current = "";
    if (!currentUser?.id) onOpenChange(false);
  }, [currentUser?.id, onOpenChange]);

  const { data: users = [], isLoading, isError: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ["users-list", currentUser?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke("listPublicUsers", {});
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        res?.data?.success !== true ||
        res?.data?.viewerUserId !== currentUser?.id ||
        !Array.isArray(res?.data?.users)
      ) {
        throw new Error("User directory response was not confirmed.");
      }
      return res?.data?.users || [];
    },
    enabled: open && isAuthenticated,
  });

  const filtered = users
    .filter(u => u.id !== currentUser?.id)
    .filter(u => {
      const query = search.toLowerCase();
      return (u.display_name || u.full_name || "").toLowerCase().includes(query);
    });

  const handleSendMessage = async () => {
    const trimmedMessage = message.trim();
    if (!selectedUser || !trimmedMessage) return;

    const signature = `${selectedUser.id}:${trimmedMessage}`;
    const clientMessageKey = retryKeyRef.current && retrySignatureRef.current === signature
      ? retryKeyRef.current
      : createClientMessageKey();
    retryKeyRef.current = clientMessageKey;
    retrySignatureRef.current = signature;

    const identityGeneration = identityGenerationRef.current;
    setSending(true);
    try {
      // Let the server perform the bounded, authorization-aware lookup and
      // create the DM only when no existing conversation matches.
      const created = await base44.functions.invoke("manageConversation", {
        action: "create_dm",
        participant_ids: [selectedUser.id],
      });
      if (created?.data?.error) throw new Error(created.data.error);
      const conversation = created?.data?.conversation;
      if (
        created?.data?.success !== true ||
        created?.data?.action !== "create_dm" ||
        created?.data?.userId !== currentUser?.id ||
        created?.data?.conversationId !== conversation?.id ||
        !conversation?.id ||
        conversation?.type !== "dm" ||
        !Array.isArray(conversation?.participant_ids) ||
        !conversation.participant_ids.includes(currentUser?.id) ||
        !conversation.participant_ids.includes(selectedUser.id)
      ) throw new Error("Conversation was not created");
      if (identityGeneration !== identityGenerationRef.current) return;

      const send = await base44.functions.invoke("sendConversationMessage", {
        conversation_id: conversation.id,
        text: trimmedMessage,
        type: "text",
        client_message_key: clientMessageKey,
      });
      if (identityGeneration !== identityGenerationRef.current) return;
      if (send?.data?.moderation) throw new Error("moderated");
      if (send?.data?.error) throw new Error(send.data.error);
      const sentMessage = send?.data?.message;
      if (
        send?.data?.success !== true ||
        send?.data?.action !== "send" ||
        send?.data?.userId !== currentUser?.id ||
        send?.data?.conversationId !== conversation.id ||
        send?.data?.clientMessageKey !== clientMessageKey ||
        !sentMessage?.id ||
        sentMessage?.conversation_id !== conversation.id ||
        sentMessage?.sender_id !== currentUser?.id ||
        sentMessage?.client_message_key !== clientMessageKey
      ) throw new Error("Message send was not confirmed.");

      retryKeyRef.current = null;
      retrySignatureRef.current = "";
      setMessage("");
      setSelectedUser(null);
      onOpenChange(false);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(error?.message === "moderated"
        ? "Message blocked by content moderation."
        : error?.message || "Couldn't send the message. Please try again.");
    } finally {
      if (identityGeneration === identityGenerationRef.current) setSending(false);
    }
  };

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
          <DialogTitle className="font-heading">
            {selectedUser ? `Message ${selectedUser.display_name || selectedUser.full_name}` : "Send Message"}
          </DialogTitle>
          <DialogDescription>
            {selectedUser ? "Type your message and send" : "Search and select a user to message"}
          </DialogDescription>
        </DialogHeader>

        {!selectedUser ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 rounded-lg bg-secondary/50 border-0"
                autoFocus
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {!isLoadingAuth && !isAuthenticated ? (
                <p className="text-sm text-destructive text-center py-8" role="alert">
                  Log in to send messages.
                </p>
              ) : usersError ? (
                <div className="text-center py-8" role="alert">
                  <p className="text-sm text-destructive">Couldn't load people.</p>
                  <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void refetchUsers()}>
                    Retry
                  </Button>
                </div>
              ) : isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {search ? `No users found matching "${search}"` : "No users available"}
                </p>
              ) : (
                filtered.map(user => (
                  <button
                    key={user.id}
                    onClick={() => {
                      retryKeyRef.current = null;
                      retrySignatureRef.current = "";
                      setSelectedUser(user);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors text-left"
                  >
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
                        {(user.display_name || user.full_name || "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{user.display_name || user.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.location || user.artist_role || "NaliChat member"}</p>
                    </div>
                    <Badge className={`text-[10px] ${roleColors[user.artist_role] || "bg-secondary text-secondary-foreground"} border-0`}>
                      {user.artist_role?.toUpperCase()}
                    </Badge>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              placeholder="Type your message..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full p-3 rounded-lg bg-secondary/50 border-0 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary h-24"
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter" && e.ctrlKey && message.trim()) {
                  handleSendMessage();
                }
              }}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-lg"
                onClick={() => {
                  retryKeyRef.current = null;
                  retrySignatureRef.current = "";
                  setSelectedUser(null);
                  setMessage("");
                }}
              >
                Back
              </Button>
              <Button
                className="flex-1 rounded-lg bg-primary hover:bg-primary/90"
                onClick={handleSendMessage}
                disabled={!message.trim() || sending}
              >
                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Send
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}