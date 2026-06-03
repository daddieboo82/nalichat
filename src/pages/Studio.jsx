import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Upload, Music, Loader2, FolderOpen, Disc3, ChevronLeft, Search, Settings } from "lucide-react";
import MultiTrackEditor from "@/components/studio/MultiTrackEditor";
import SessionTimer from "@/components/studio/SessionTimer";
import ProjectSettingsDialog from "@/components/studio/ProjectSettingsDialog";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/20 text-primary",
  mixing: "bg-accent/20 text-accent",
  mastering: "bg-chart-4/20 text-chart-4",
  complete: "bg-green-500/20 text-green-400",
};

export default function Studio() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectBpm, setNewProjectBpm] = useState(120);
  const [newProjectKey, setNewProjectKey] = useState("C");
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(setCurrentUser); }, []);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-updated_date"),
  });

  const { data: tracks = [] } = useQuery({
    queryKey: ["tracks", selectedProjectId],
    queryFn: () => base44.entities.Track.filter({ project_id: selectedProjectId }),
    enabled: !!selectedProjectId,
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // Role helpers
  const isOwner = selectedProject?.owner_id === currentUser?.id;
  const myRole = selectedProject?.collaborator_roles?.[currentUser?.id] || "viewer";
  const canEdit = isOwner || myRole === "editor";

  const filteredProjects = projects.filter(p =>
    p.title?.toLowerCase().includes(search.toLowerCase())
  );

  const createProject = useMutation({
    mutationFn: () => base44.entities.Project.create({
      title: newProjectTitle,
      owner_id: currentUser.id,
      bpm: newProjectBpm,
      key: newProjectKey,
      status: "draft",
      collaborator_ids: [],
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setSelectedProjectId(data.id);
      setShowNewProject(false);
      setNewProjectTitle("");
    },
  });

  const addTrack = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProjectId) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Track.create({
      project_id: selectedProjectId,
      name: file.name.replace(/\.[^/.]+$/, ""),
      file_url,
      type: "vocal",
      volume: 75,
      pan: 0,
      muted: false,
      solo: false,
      uploaded_by: currentUser.id,
    });
    queryClient.invalidateQueries({ queryKey: ["tracks", selectedProjectId] });
    setUploading(false);
    e.target.value = "";
  };

  const updateTrack = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Track.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tracks", selectedProjectId] }),
  });

  const deleteTrack = useMutation({
    mutationFn: (id) => base44.entities.Track.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tracks", selectedProjectId] }),
  });

  const updateProject = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Project.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  return (
    <div className="h-full flex">
      {/* Project Sidebar — hidden on mobile when a project is open */}
      <div className={cn(
        "w-full md:w-72 border-r border-border flex-col bg-card/50 shrink-0",
        selectedProjectId ? "hidden md:flex" : "flex"
      )}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-bold text-lg">Studio</h2>
            <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="rounded-xl hover:bg-primary/20 hover:text-primary">
                  <Plus className="w-5 h-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="font-heading">New Project</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Project title..."
                    value={newProjectTitle}
                    onChange={e => setNewProjectTitle(e.target.value)}
                    className="bg-secondary/50 border-0 rounded-xl"
                  />
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1 block">BPM</label>
                      <Input
                        type="number"
                        value={newProjectBpm}
                        onChange={e => setNewProjectBpm(Number(e.target.value))}
                        className="bg-secondary/50 border-0 rounded-xl"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1 block">Key</label>
                      <Select value={newProjectKey} onValueChange={setNewProjectKey}>
                        <SelectTrigger className="bg-secondary/50 border-0 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].map(k => (
                            <SelectItem key={k} value={k}>{k} Major</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button className="w-full rounded-xl bg-primary hover:bg-primary/90" onClick={() => createProject.mutate()} disabled={!newProjectTitle.trim()}>
                    Create Project
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-secondary/50 border-0 rounded-xl pl-9 h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-6">
              <FolderOpen className="w-10 h-10 opacity-30" />
              <p className="text-sm text-center">No projects yet.<br/>Create your first one!</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-6">
              <Search className="w-10 h-10 opacity-30" />
              <p className="text-sm text-center">No projects match "{search}"</p>
            </div>
          ) : (
            filteredProjects.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className={cn(
                  "w-full text-left px-4 py-3 hover:bg-secondary/50 transition-colors border-b border-border/50",
                  selectedProjectId === p.id && "bg-primary/10 border-l-2 border-l-primary"
                )}
              >
                <div className="flex items-center gap-2">
                  <Disc3 className="w-4 h-4 text-primary shrink-0" />
                  <p className="font-medium text-sm truncate">{p.title}</p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`text-[9px] border-0 ${statusColors[p.status] || statusColors.draft}`}>
                    {p.status?.replace("_", " ").toUpperCase()}
                  </Badge>
                  {p.bpm && <span className="text-[10px] text-muted-foreground">{p.bpm} BPM</span>}
                  {p.key && <span className="text-[10px] text-muted-foreground">{p.key}</span>}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Studio Area */}
      <div className={cn(
        "flex-1 flex-col min-w-0",
        selectedProjectId ? "flex" : "hidden md:flex"
      )}>
        {!selectedProject ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Music className="w-10 h-10 text-primary/40" />
              </div>
              <p className="font-heading font-semibold text-lg">Select a project</p>
              <p className="text-sm mt-1">or create a new one to start mixing</p>
            </div>
          </div>
        ) : (
          <>
            {/* Project Header */}
            <div className="p-4 md:p-6 border-b border-border flex items-center justify-between bg-card/50 backdrop-blur-sm gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setSelectedProjectId(null)}
                  className="md:hidden p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                <h1 className="text-xl font-heading font-bold truncate">{selectedProject.title}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <Badge className={`text-[9px] border-0 ${statusColors[selectedProject.status]}`}>
                    {selectedProject.status?.replace("_", " ").toUpperCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{selectedProject.bpm} BPM</span>
                  <span className="text-xs text-muted-foreground">Key: {selectedProject.key}</span>
                </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <SessionTimer />
                {isOwner && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-xl hover:bg-secondary"
                    onClick={() => setShowProjectSettings(true)}
                    title="Project settings"
                  >
                    <Settings className="w-4 h-4 text-muted-foreground" />
                  </Button>
                )}
                <Select
                  value={selectedProject.status}
                  onValueChange={(v) => updateProject.mutate({ id: selectedProject.id, data: { status: v } })}
                >
                  <SelectTrigger className="w-36 bg-secondary/50 border-0 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="mixing">Mixing</SelectItem>
                    <SelectItem value="mastering">Mastering</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                  </SelectContent>
                </Select>
                <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={addTrack} />
                {canEdit && (
                  <Button className="rounded-xl bg-primary hover:bg-primary/90" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    Add Track
                  </Button>
                )}
              </div>
            </div>

            {/* Multi-Track Editor */}
            <MultiTrackEditor
              tracks={tracks}
              selectedProject={selectedProject}
              projectTitle={selectedProject?.title}
              onTrackUpdate={(id, data) => updateTrack.mutate({ id, data })}
              onTrackDelete={(id) => deleteTrack.mutate(id)}
              canEdit={canEdit}
            />

            {showProjectSettings && (
              <ProjectSettingsDialog
                project={selectedProject}
                open={showProjectSettings}
                onOpenChange={setShowProjectSettings}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}