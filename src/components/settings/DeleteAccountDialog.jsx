import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function DeleteAccountDialog() {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await base44.functions.invoke("deleteMyAccount", { confirmation: "DELETE" });
      if (!res?.data?.success) {
        throw new Error(res?.data?.error || "Account deletion failed");
      }
      toast.success("Your account deletion has been completed.");
      await base44.auth.logout();
    } catch (err) {
      toast.error("Could not delete your account. Please contact support.");
      setDeleting(false);
    }
  };

  return (
    <div className="mt-10 pt-8 border-t border-destructive/20">
      <h2 className="text-sm font-semibold text-destructive mb-1">Danger Zone</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Permanently delete your account and all associated data. This action cannot be undone.
      </p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive select-none">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove your account and you will be logged out immediately.
              Type <span className="font-semibold text-foreground">DELETE</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type DELETE"
            className="rounded-xl"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText !== "DELETE" || deleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}