import { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";
import { Button } from "@/components/ui/button";
import { UserX, Settings, Crown, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const ROLE_COLORS = {
  editor: "bg-primary/20 text-primary",
  viewer: "bg-secondary text-muted-foreground",
};

export default function ProjectSettingsDialog({ project, open, onOpenChange, onDelete }) {
  const [showDelete, setShowDelete] = useState(false);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const mutationGenerationRef = useRef(0);
  const lastContextRef = useRef({
    userId: currentUser?.id || null,
    projectId: project?.id || null,
  });

  useEffect(() => {
    const next = {
      userId: currentUser?.id || null,
      projectId: project?.id || null,
    };
    const userChanged = lastContextRef.current.userId !== next.userId;
    const projectChanged = lastContextRef.current.projectId !== next.projectId;
    if (!userChanged && !projectChanged) return;
    lastContextRef.current = next;
    mutationGenerationRef.current += 1;
    setShowDelete(false);
    if (userChanged) onOpenChange(false);
  }, [currentUser?.id, project?.id, onOpenChange]);

  const { data: allUsers = [], isLoading: usersLoading, isError: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ["users", "directory", currentUser?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke("listPublicUsers", {});
      if (res?.data?.error) throw new Error(res.data.error);
      return res?.data?.users || [];
    },
    enabled: open && !!currentUser?.id,
  });

  const collaborators = allUsers.filter(u =>
    project.collaborator_ids?.includes(u.id)
  );

  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      const generation = mutationGenerationRef.current;
      const response = await base44.functions.invoke("manageProjectCollaborator", {
        projectId: project.id,
        ...payload,
      });
      if (response?.data?.error) throw new Error(response.data.error);
      if (response?.data?.success !== true) {
        throw new Error("Collaborator update was not confirmed.");
      }
      return {
        stale: generation !== mutationGenerationRef.current,
        response,
      };
    },
    onSuccess: (result) => {
      if (result?.stale) return;
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project collaborator updated.");
    },
    onError: (error) => {
      toast.error(error?.message || "Couldn't update this collaborator. Please try again.");
    },
  });

  const handleRoleChange = (userId, newRole) => {
    updateMutation.mutate({ userId, action: "set_role", role: newRole });
  };

  const handleRemove = (userId) => {
    updateMutation.mutate({ userId, action: "remove" });
  };

  const owner = allUsers.find(u => u.id === project.owner_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            Project Settings — {project.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Assign <strong className="text-foreground">Editor</strong> to let collaborators add/edit tracks and export.
            Assign <strong className="text-foreground">Viewer</strong> to allow read-only access.
          </p>

          {usersLoading && (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading collaborators...</div>
          )}

          {usersError && !usersLoading && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-center" role="alert">
              <p className="text-sm font-semibold">Couldn't load collaborators</p>
              <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void refetchUsers()}>
                Retry
              </Button>
            </div>
          )}

          {/* Owner row */}
          {!usersLoading && !usersError && owner && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40">
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarImage src={owner.avatar_url} />
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                  {(owner.display_name || owner.full_name)?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{owner.display_name || owner.full_name}</p>
                
              </div>
              <Badge className="bg-chart-4/20 text-chart-4 border-0 flex items-center gap-1">
                <Crown className="w-3 h-3" /> Owner
              </Badge>
            </div>
          )}

          {/* Collaborators */}
          {!usersLoading && !usersError && (collaborators.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">No collaborators yet.</p>
              <p className="text-xs mt-1">Create an invite link from the project or Jam Room to add collaborators.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {collaborators.map(user => {
                const role = project.collaborator_roles?.[user.id] || "viewer";
                return (
                  <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
                    <Avatar className="w-8 h-8 shrink-0">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                        {(user.display_name || user.full_name)?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.display_name || user.full_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{user.location || user.artist_role || "NaliChat member"}</p>
                    </div>
                    <Select value={role} onValueChange={(v) => handleRoleChange(user.id, v)}>
                      <SelectTrigger className={`w-28 h-8 text-xs border-0 rounded-lg ${ROLE_COLORS[role]}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-8 h-8 rounded-lg text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => handleRemove(user.id)}
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Delete Project */}
          <div className="pt-4 border-t border-border/50">
            <Button
              variant="ghost"
              className="w-full text-destructive hover:bg-destructive/10 rounded-xl justify-start"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Project
            </Button>
          </div>
          </div>

          <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{project.title}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the project and all its tracks. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3">
              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                onClick={async () => {
                  const generation = mutationGenerationRef.current;
                  try {
                    const res = await base44.functions.invoke("deleteProject", {
                      projectId: project.id,
                      confirmation: "DELETE",
                    });
                    if (generation !== mutationGenerationRef.current) return;
                    if (res?.data?.error) throw new Error(res.data.error);
                    if (res?.data?.success !== true || res?.data?.project_id !== project.id) {
                      throw new Error("Project deletion was not confirmed.");
                    }
                    onDelete?.(project.id);
                    queryClient.invalidateQueries({ queryKey: ["projects"] });
                    setShowDelete(false);
                    onOpenChange(false);
                  } catch (error) {
                    console.error("Project deletion failed", error);
                    toast.error(error?.message || "Couldn't delete this project. Please try again.");
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
          </AlertDialog>
          </DialogContent>
          </Dialog>
          );
          }