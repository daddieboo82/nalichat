import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FolderOpen, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { motion } from "framer-motion";

export default function ProjectSelector({
  projects,
  subscription,
  currentUser,
  onSelectProject,
}) {
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectBpm, setNewProjectBpm] = useState(120);
  const queryClient = useQueryClient();

  const createProject = useMutation({
    mutationFn: () => {
      if (subscription?.plan === "free" && projects.length >= 3) {
        throw new Error("PROJECT_LIMIT");
      }
      return base44.entities.Project.create({
        title: newProjectTitle,
        owner_id: currentUser.id,
        bpm: newProjectBpm,
        key: "C",
        status: "draft",
        collaborator_ids: [],
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onSelectProject(data.id);
      setNewProjectTitle("");
    },
  });

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-secondary/20 to-background overflow-y-auto" style={{ background: "hsl(240 10% 3%)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl py-6"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-primary/30">
            <Music className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">NaliChat Studio</h1>
          <p className="text-muted-foreground text-base">Professional multi-track recording and mixing</p>
        </div>

        {/* Projects Grid */}
        {projects.length > 0 ? (
          <>
            <h2 className="text-lg font-heading font-bold text-foreground mb-4">Your Projects</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {projects.map((project) => (
                <motion.button
                  key={project.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelectProject(project.id)}
                  className="group text-left bg-secondary/40 border border-border/40 rounded-2xl p-6 hover:border-primary/50 hover:bg-secondary/50 transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4 group-hover:shadow-lg group-hover:shadow-primary/30 transition-all">
                    <Music className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-heading font-bold text-foreground mb-2">{project.title}</h3>
                  <p className="text-xs text-muted-foreground/70">
                    {project.bpm} BPM • {project.key}
                  </p>
                  <p className="text-xs text-muted-foreground/50 mt-2 capitalize">
                    {project.status?.replace("_", " ")}
                  </p>
                </motion.button>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center mb-8 py-8">
            <FolderOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No projects yet. Create your first one to get started!</p>
          </div>
        )}

        {/* Create New Project */}
        <Dialog>
          <DialogTrigger asChild>
            <Button className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-bold rounded-2xl h-10 text-sm shadow-lg shadow-primary/30">
              <Plus className="w-4 h-4 mr-2" />
              Create New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-heading text-lg">Create New Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground uppercase font-semibold mb-1.5 block">Project Name</label>
                <Input
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="My Awesome Track..."
                  className="bg-secondary/40 border-border/50 rounded-lg h-9 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase font-semibold mb-1.5 block">BPM</label>
                <Input
                  type="number"
                  value={newProjectBpm}
                  onChange={(e) => setNewProjectBpm(Number(e.target.value))}
                  className="bg-secondary/40 border-border/50 rounded-lg h-9 text-sm"
                />
              </div>
              <Button
                onClick={() => createProject.mutate()}
                disabled={!newProjectTitle.trim() || createProject.isPending}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg h-9 text-sm"
              >
                {createProject.isPending ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
}