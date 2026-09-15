import { useState } from "react";
import { LockKeyhole, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import LockedChatAccessDialog from "@/components/messages/LockedChatAccessDialog";
import { useLockedChats } from "@/lib/LockedChatsContext";

export default function LockedChatSettings() {
  const {
    security,
    isEntitled,
    isUnlocked,
    hasLockedChats,
    lockNow,
    status,
  } = useLockedChats();
  const [dialogMode, setDialogMode] = useState(null);

  return (
    <div className="bg-card/50 backdrop-blur-xl rounded-2xl p-6 border border-white/[0.06]">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <LockKeyhole className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading font-semibold text-lg">Locked chats</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Hide selected chats from normal lists, search, unread counts, and notification previews.
            This is an app-level privacy screen, not end-to-end encryption or server secrecy.
          </p>
        </div>
      </div>

      {!isEntitled && (
        <div className="mt-4 flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p>
            Premium Plus adds the ability to lock new chats.
            {hasLockedChats && " Your existing locked chats remain hidden and can still be opened with your PIN."}
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {!security?.configured ? (
          <Button
            onClick={() => setDialogMode("setup")}
            disabled={!isEntitled || status !== "ready"}
          >
            Set up PIN
          </Button>
        ) : isUnlocked ? (
          <Button onClick={lockNow}>Lock now</Button>
        ) : (
          <Button onClick={() => setDialogMode("unlock")}>Unlock locked chats</Button>
        )}
        {security?.configured && (
          <Button variant="outline" onClick={() => setDialogMode("reset")}>
            Reset PIN by email
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Locked chats relock after five minutes without activity, whenever the app is hidden, on sign-out,
        and after a browser or app restart. Device/passkey verification is not offered until it can be
        verified securely by the server.
      </p>

      <LockedChatAccessDialog
        open={dialogMode !== null}
        onOpenChange={(open) => !open && setDialogMode(null)}
        initialMode={dialogMode || "unlock"}
      />
    </div>
  );
}
