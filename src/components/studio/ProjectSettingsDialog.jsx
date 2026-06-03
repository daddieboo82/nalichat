import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";
import { Button } from "@/components/ui/button";
import { UserX, Settings, Crown } from "lucide-react";

const ROLE_COLORS = {
  editor: "bg-primary/20 text-primary",
  viewer: "bg-secondary text-muted-foreground",
};

export default function ProjectSettingsDialog({ project, open, onOpenChange }) {
  const queryClient = useQueryClient();

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
    enabled: open,
  });

  const collaborators = allUsers.filter(u =>
    project.collaborator_ids?.includes(u.id)
  );

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.update(project.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  const handleRoleChange = (userId, newRole) => {
    const roles = { ...(project.collaborator_roles || {}) };
    roles[userId] = newRole;
    updateMutation.mutate({ collaborator_roles: roles });
  };

  const handleRemove = (userId) => {
    const newIds = (project.collaborator_ids || []).filter(id => id !== userId);
    const roles = { ...(project.collaborator_roles || {}) };
    delete roles[userId];
    updateMutation.mutate({ collaborator_ids: newIds, collaborator_roles: roles });
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

          {/* Owner row */}
          {owner && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40">
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarImage src={owner.avatar_url} />
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                  {(owner.display_name || owner.full_name)?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{owner.display_name || owner.full_name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{owner.email}</p>
              </div>
              <Badge className="bg-chart-4/20 text-chart-4 border-0 flex items-center gap-1">
                <Crown className="w-3 h-3" /> Owner
              </Badge>
            </div>
          )}

          {/* Collaborators */}
          {collaborators.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">No collaborators yet.</p>
              <p className="text-xs mt-1">Add collaborators from the Network page.</p>
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
                      <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}