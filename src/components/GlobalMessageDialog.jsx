import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Send } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { createClientMessageKey } from "@/lib/messageCache";
import { toast } from "sonner";

export default function GlobalMessageDialog({ open, onOpenChange }) {
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (open) base44.auth.me().then(setCurrentUser).catch(() => {});
  }, [open]);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users-list"],
    queryFn: () => base44.entities.User.list(),
    enabled: open,
  });

  const filtered = users
    .filter(u => u.id !== currentUser?.id)
    .filter(u => {
      const query = search.toLowerCase();
      return (
        (u.display_name || u.full_name || "").toLowerCase().includes(query) ||
        (u.email || "").toLowerCase().includes(query)
      );
    });

  const handleSendMessage = async () => {
    if (!selectedUser || !message.trim()) return;

    setSending(true);
    try {
      // Find or create conversation
      const conversations = await base44.entities.Conversation.filter({});
      let conversation = conversations.find(
        c =>
          c.type === "dm" &&
          c.participant_ids.includes(currentUser.id) &&
          c.participant_ids.includes(selectedUser.id)
      );

      if (!conversation) {
        conversation = await base44.entities.Conversation.create({
          type: "dm",
          participant_ids: [currentUser.id, selectedUser.id],
        });
      }

      // Send message
      const response = await base44.functions.invoke("sendMessage", {
        conversation_id: conversation.id,
        client_message_key: createClientMessageKey(),
        message: { text: message, type: "text" },
      });
      if (response.data?.rejection?.type === "moderation") {
        throw new Error("This message was blocked by moderation.");
      }

      setMessage("");
      setSelectedUser(null);
      onOpenChange(false);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(error?.message || "Message not sent. Please try again.");
    } finally {
      setSending(false);
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
                placeholder="Search by name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 rounded-lg bg-secondary/50 border-0"
                autoFocus
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {isLoading ? (
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
                    onClick={() => setSelectedUser(user)}
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
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <Badge className={`text-[10px] ${roleColors[user.role] || "bg-secondary text-secondary-foreground"} border-0`}>
                      {user.role?.toUpperCase()}
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