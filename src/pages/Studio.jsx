import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Upload, Music, Loader2, FolderOpen, Disc3, ChevronLeft, Search, Settings, Flag } from "lucide-react";
import MultiTrackEditor from "@/components/studio/MultiTrackEditor";
import SessionTimer from "@/components/studio/SessionTimer";
import ProjectSettingsDialog from "@/components/studio/ProjectSettingsDialog";
import MilestonesPanel from "@/components/studio/MilestonesPanel";
import TrackImporter from "@/components/studio/TrackImporter";
import UpgradeModal from "@/components/billing/UpgradeModal";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/lib/OnboardingContext";
import TutorialTooltip from "@/components/onboarding/TutorialTooltip";

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/20 text-primary",
  mixing: "bg-accent/20 text-accent",
  mastering: "bg-chart-4/20 text-chart-4",
  complete: "bg-green-500/20 text-green-400",
};

export default function Studio() {
  const { isFirstTime, markStepComplete } = useOnboarding();
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectBpm, setNewProjectBpm] = useState(120);
  const [newProjectKey, setNewProjectKey] = useState("C");
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);
  const [showStudioTip, setShowStudioTip] = useState(isFirstTime);
  const [dragActive, setDragActive] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeTrigger, setUpgradeTrigger] = useState("projects");
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(setCurrentUser); }, []);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("-updated_date"),
  });

  const { data: subscription } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const subs = await base44.entities.Subscription.filter({ user_id: currentUser?.id });
      return subs[0] || { plan: "free", status: "active" };
    },
    enabled: !!currentUser?.id,
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
    mutationFn: () => {
      // Check project limit for free tier
      if (subscription?.plan === "free" && projects.length >= 3) {
        throw new Error("PROJECT_LIMIT");
      }
      return base44.entities.Project.create({
        title: newProjectTitle,
        owner_id: currentUser.id,
        bpm: newProjectBpm,
        key: newProjectKey,
        status: "draft",
        collaborator_ids: [],
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setSelectedProjectId(data.id);
      setShowNewProject(false);
      setNewProjectTitle("");
      setShowStudioTip(false);
      markStepComplete("studio");
    },
    onError: (err) => {
      if (err.message === "PROJECT_LIMIT") {
        setShowUpgradeModal(true);
        setUpgradeTrigger("projects");
        setShowNewProject(false);
      }
    },
  });

  const addTrack = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProjectId || !currentUser) return;
    setUploading(true);
    try {
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
    } finally {
      setUploading(false);
      e.target.value = "";
    }
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

  const deleteProject = useMutation({
    mutationFn: (id) => base44.entities.Project.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setSelectedProjectId(null);
    },
  });

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (!selectedProjectId || !currentUser) return;

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("audio/"));
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
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
      }
      queryClient.invalidateQueries({ queryKey: ["tracks", selectedProjectId] });
    } finally {
      setUploading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: "hsl(240 10% 3%)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground font-heading">Loading studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex" style={{ background: "hsl(240 10% 3%)" }}>
      {/* Project Sidebar — hidden on mobile when a project is open */}
      <div className={cn(
        "w-full md:w-68 border-r border-border/50 flex-col shrink-0",
        selectedProjectId ? "hidden md:flex" : "flex"
      )} style={{ background: "hsl(240 10% 5%)", minWidth: "260px", maxWidth: "268px" }}>
        <div className="p-4 border-b border-border/40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center shadow-lg shadow-primary/20">
                <Music className="w-3.5 h-3.5 text-white" />
              </div>
              <h2 className="font-heading font-bold text-base">Studio</h2>
            </div>
            <Dialog open={showNewProject} onOpenChange={(v) => {
              if (subscription?.plan === "free" && projects.length >= 3 && v) {
                setShowUpgradeModal(true);
                setUpgradeTrigger("projects");
                return;
              }
              setShowNewProject(v);
            }}>
              <DialogTrigger asChild>
                <div className="relative">
                  {showStudioTip && (
                    <TutorialTooltip
                      title="Create a Project"
                      description="Start by making a new project to organize your tracks"
                      position="bottom"
                      onDismiss={() => setShowStudioTip(false)}
                    />
                  )}
                  <Button size="icon" variant="ghost" className="rounded-xl w-8 h-8 hover:bg-primary/20 hover:text-primary transition-all hover:scale-105">
                    <Plus className="w-4 h-4" />
                  </Button>
                  {subscription?.plan === "free" && projects.length >= 3 && (
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-destructive rounded-full flex items-center justify-center text-white text-xs font-bold">3</div>
                  )}
                </div>
              </DialogTrigger>
              <DialogContent className="bg-card border-border shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="font-heading text-lg">New Project</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Give your project a title..."
                    value={newProjectTitle}
                    onChange={e => setNewProjectTitle(e.target.value)}
                    className="bg-secondary/50 border-border/50 rounded-xl focus:border-primary/50"
                    autoFocus
                  />
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground/70 mb-1.5 block font-medium">BPM</label>
                      <Input
                        type="number"
                        value={newProjectBpm}
                        onChange={e => setNewProjectBpm(Number(e.target.value))}
                        className="bg-secondary/50 border-border/50 rounded-xl"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground/70 mb-1.5 block font-medium">Key</label>
                      <Select value={newProjectKey} onValueChange={setNewProjectKey}>
                        <SelectTrigger className="bg-secondary/50 border-border/50 rounded-xl">
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
                  <Button
                    className="w-full rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 shadow-lg shadow-primary/20 font-semibold"
                    onClick={() => createProject.mutate()}
                    disabled={!newProjectTitle.trim() || createProject.isPending}
                  >
                    {createProject.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Create Project
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-secondary/30 border-border/40 rounded-xl pl-9 h-9 text-sm focus:border-primary/40"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1.5">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <FolderOpen className="w-7 h-7 opacity-30" />
              </div>
              <p className="text-sm text-center leading-relaxed opacity-70">No projects yet.<br/>Tap + to create your first!</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 p-6">
              <Search className="w-8 h-8 opacity-20" />
              <p className="text-sm text-center opacity-60">No matches for "{search}"</p>
            </div>
          ) : (
            <div className="px-2 space-y-0.5">
              {filteredProjects.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-xl transition-all group",
                    selectedProjectId === p.id
                      ? "bg-primary/15 shadow-sm"
                      : "hover:bg-secondary/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                      selectedProjectId === p.id ? "bg-primary/20" : "bg-secondary/50 group-hover:bg-primary/10"
                    )}>
                      <Disc3 className={cn("w-3.5 h-3.5 transition-colors", selectedProjectId === p.id ? "text-primary" : "text-muted-foreground group-hover:text-primary/70")} />
                    </div>
                    <p className={cn("font-medium text-sm truncate flex-1", selectedProjectId === p.id && "text-primary")}>{p.title}</p>
                    {selectedProjectId === p.id && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 ml-9">
                    <Badge className={`text-[9px] border-0 ${statusColors[p.status] || statusColors.draft}`}>
                      {p.status?.replace("_", " ").toUpperCase()}
                    </Badge>
                    {p.bpm && <span className="text-[10px] text-muted-foreground/60">{p.bpm} BPM</span>}
                    {p.key && <span className="text-[10px] text-muted-foreground/60">{p.key}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Studio Area */}
      <div
        className={cn(
          "flex-1 flex-col min-w-0",
          selectedProjectId ? "flex" : "hidden md:flex"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {dragActive && (
          <div className="absolute inset-0 bg-primary/20 border-2 border-dashed border-primary rounded-lg pointer-events-none flex items-center justify-center z-40">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/30 flex items-center justify-center mx-auto mb-2">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <p className="text-primary font-semibold">Drop audio files here</p>
            </div>
          </div>
        )}

        {!selectedProject ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-pink-500/20 border border-primary/20 flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-primary/10">
                <Music className="w-11 h-11 text-primary/50" />
              </div>
              <p className="font-heading font-semibold text-xl mb-2">Select a Project</p>
              <p className="text-sm text-muted-foreground/70">or create a new one to start mixing</p>
            </div>
          </div>
        ) : (
          <>
            {/* Project Header */}
            <div className="px-4 md:px-5 py-3 border-b border-border/50 flex items-center justify-between backdrop-blur-xl gap-2" style={{ background: "hsl(240 8% 7% / 0.95)" }}>
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setSelectedProjectId(null)}
                  className="md:hidden p-2 -ml-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <h1 className="text-lg font-heading font-bold truncate">{selectedProject.title}</h1>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-primary/20 text-primary font-semibold whitespace-nowrap">Professional Studio</span>
                  </div>
                  <div className="flex items-center gap-2.5 mt-0.5">
                    <Badge className={`text-[9px] border-0 ${statusColors[selectedProject.status]}`}>
                      {selectedProject.status?.replace("_", " ").toUpperCase()}
                    </Badge>
                    {selectedProject.bpm && <span className="text-[11px] text-muted-foreground/60">{selectedProject.bpm} BPM</span>}
                    {selectedProject.key && <span className="text-[11px] text-muted-foreground/60">Key: {selectedProject.key}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <SessionTimer />
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn("rounded-xl w-8 h-8 transition-all", showMilestones ? "bg-primary/20 text-primary" : "hover:bg-secondary/60 text-muted-foreground")}
                  onClick={() => setShowMilestones(v => !v)}
                  title="Milestones"
                >
                  <Flag className="w-4 h-4" />
                </Button>
                {isOwner && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-xl w-8 h-8 hover:bg-secondary/60 text-muted-foreground"
                    onClick={() => setShowProjectSettings(true)}
                    title="Project settings"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                )}
                <Select
                  value={selectedProject.status}
                  onValueChange={(v) => updateProject.mutate({ id: selectedProject.id, data: { status: v } })}
                >
                  <SelectTrigger className="w-32 bg-secondary/40 border-border/50 rounded-xl text-xs h-8">
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
                {canEdit && (
                  <TrackImporter
                    projectId={selectedProjectId}
                    currentUser={currentUser}
                    onSuccess={() => queryClient.invalidateQueries({ queryKey: ["tracks", selectedProjectId] })}
                  />
                )}
              </div>
            </div>

            {/* Multi-Track Editor + optional Milestones panel */}
            <div className="flex flex-1 min-h-0">
              <div className="flex-1 min-w-0">
                <MultiTrackEditor
                  tracks={tracks}
                  selectedProject={selectedProject}
                  projectTitle={selectedProject?.title}
                  onTrackUpdate={(id, data) => updateTrack.mutate({ id, data })}
                  onTrackDelete={(id) => deleteTrack.mutate(id)}
                  canEdit={canEdit}
                  currentUser={currentUser}
                />
              </div>
              {showMilestones && (
                <div className="w-72 shrink-0 border-l border-border bg-card/50 overflow-hidden flex flex-col">
                  <MilestonesPanel projectId={selectedProject.id} canEdit={canEdit} />
                </div>
              )}
            </div>

            {showProjectSettings && (
              <ProjectSettingsDialog
                project={selectedProject}
                open={showProjectSettings}
                onOpenChange={setShowProjectSettings}
                onDelete={(id) => deleteProject.mutate(id)}
              />
            )}
          </>
        )}
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal 
        open={showUpgradeModal} 
        onOpenChange={setShowUpgradeModal}
        triggerReason={upgradeTrigger}
      />
    </div>
  );
}