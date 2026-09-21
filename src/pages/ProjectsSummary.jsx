import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FolderOpen, FileText, CheckCircle2, Circle, Users, Calendar, Link2, Copy, Plus, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { copyToClipboard } from '@/lib/clipboard';

import { useSearchParams } from 'react-router-dom';

async function listAllRows(entity, sort = "-created_date", pageSize = 200) {
  const rows = [];
  for (let skip = 0; ; skip += pageSize) {
    const page = await entity.list(sort, pageSize, skip);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export default function ProjectsSummary() {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [data, setData] = useState({ projects: [], milestones: [], sharedFiles: [] });
  const [dataOwnerId, setDataOwnerId] = useState(null);
  const [showNewProject, setShowNewProject] = useState(searchParams.get('new') === 'true');
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [inviteLinks, setInviteLinks] = useState({});
  const [creatingInviteId, setCreatingInviteId] = useState(null);
  const [projectSearch, setProjectSearch] = useState("");

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setShowNewProject(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const handleCreateInvite = async (projectId) => {
    setCreatingInviteId(projectId);
    try {
      const res = await base44.functions.invoke("createProjectInvite", {
        projectId,
        role: "viewer",
      });
      if (res?.data?.error) throw new Error(res.data.error);
      const token = res?.data?.token;
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "create_project_invite" ||
        res?.data?.userId !== user?.id ||
        res?.data?.projectId !== projectId ||
        res?.data?.role !== "viewer" ||
        !/^[0-9a-f]{64}$/i.test(String(token || ""))
      ) throw new Error("Invite token was not created");
      const url = `${window.location.origin}/studio?room=${projectId}&invite=${encodeURIComponent(token)}`;
      setInviteLinks((prev) => ({ ...prev, [projectId]: url }));
      const copied = await copyToClipboard(url);
      if (copied) {
        toast.success("Secure invite link copied to clipboard!");
      } else {
        toast.error("Invite created, but couldn't copy it. The link is shown below.");
      }
    } catch (error) {
      toast.error(error?.message || "Could not create invite link");
    } finally {
      setCreatingInviteId(null);
    }
  };

  const handleCreateProject = async () => {
    const submittingUserId = user?.id;
    const requestedTitle = newProjectTitle.trim();
    const requestedDescription = newProjectDescription.trim();
    if (!requestedTitle) return toast.error("Project title is required");
    if (!submittingUserId) return toast.error("Your account could not be verified.");
    setIsCreating(true);
    try {
      const created = await base44.functions.invoke("createProject", {
        title: requestedTitle,
        description: requestedDescription,
      });
      if (created?.data?.error) throw new Error(created.data.error);
      const project = created?.data?.project;
      if (
        created?.data?.success !== true ||
        created?.data?.action !== "create_project" ||
        created?.data?.userId !== submittingUserId ||
        created?.data?.projectId !== project?.id ||
        project?.owner_id !== submittingUserId ||
        project?.title !== requestedTitle ||
        (project?.description || "") !== requestedDescription
      ) throw new Error("Project was not created");
      setData(prev => ({ ...prev, projects: [project, ...prev.projects] }));
      setShowNewProject(false);
      setNewProjectTitle("");
      setNewProjectDescription("");
      toast.success("Project created successfully!");
      navigate(`/studio?room=${project.id}`);
    } catch (e) {
      toast.error("Failed to create project");
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    if (isLoadingAuth) return undefined;

    if (!user?.id) {
      setData({ projects: [], milestones: [], sharedFiles: [] });
      setDataOwnerId(null);
      setInviteLinks({});
      setCreatingInviteId(null);
      setShowNewProject(false);
      setNewProjectTitle("");
      setNewProjectDescription("");
      setLoadError(false);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const requestedUserId = user.id;
    setLoading(true);
    setLoadError(false);
    setInviteLinks({});
    setCreatingInviteId(null);
    setShowNewProject(false);
    setNewProjectTitle("");
    setNewProjectDescription("");

    async function fetchData() {
      try {
        const [projectsRes, milestonesRes, filesRes] = await Promise.all([
          listAllRows(base44.entities.Project),
          listAllRows(base44.entities.Milestone),
          listAllRows(base44.entities.SharedFile),
        ]);
        if (cancelled) return;
        
        const myProjects = projectsRes.filter(p => p.owner_id === requestedUserId || (p.collaborator_ids && p.collaborator_ids.includes(requestedUserId)));
        const projectIds = myProjects.map(p => p.id);
        
        const myMilestones = milestonesRes.filter(m => projectIds.includes(m.project_id));
        const myFiles = filesRes.filter(f => projectIds.includes(f.project_id));

        if (!cancelled) {
          setData({ projects: myProjects, milestones: myMilestones, sharedFiles: myFiles });
          setDataOwnerId(requestedUserId);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Projects summary load failed:", err);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();

    return () => {
      cancelled = true;
    };
  }, [isLoadingAuth, user?.id]);

  if (user?.id && dataOwnerId !== user.id) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-bold">Projects unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">We couldn't load your projects. Refresh and try again.</p>
          <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  const visibleProjects = data.projects.filter((project) => {
    const term = projectSearch.trim().toLowerCase();
    if (!term) return true;
    return [project.title, project.description, project.status].some(value => String(value || '').toLowerCase().includes(term));
  });

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto px-4 py-5 pb-[max(2rem,env(safe-area-inset-bottom))] custom-scrollbar sm:p-6">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="mb-2 text-2xl font-heading font-bold tracking-tight sm:text-3xl">Collaboration Summary</h1>
          <p className="text-muted-foreground">Overview of your active projects, milestones, and shared files.</p>
        </div>
        <Button onClick={() => setShowNewProject(true)} className="ui-hover min-h-11 shrink-0 gap-2 rounded-xl font-semibold shadow-lg shadow-primary/10">
          <Plus className="w-4 h-4" /> New Project
        </Button>
      </div>

      {data.projects.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} placeholder="Find a Studio session by name, description, or status..." className="h-12 rounded-2xl border-border/60 bg-card/60 pl-11" />
        </div>
      )}

      {data.projects.length === 0 ? (
        <div className="ui-surface rounded-3xl border border-white/[0.06] bg-card/50 px-5 py-12 text-center backdrop-blur-xl">
          <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Active Projects</h2>
          <p className="text-muted-foreground">You are not collaborating on any projects yet.</p>
        </div>
      ) : (
        <div className="space-y-6 pb-12">
          {visibleProjects.length === 0 && (
            <div className="rounded-3xl border border-border/60 bg-card/50 px-5 py-10 text-center">
              <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-semibold">No sessions match “{projectSearch}”</p>
              <p className="mt-1 text-sm text-muted-foreground">Try another project name, description, or status.</p>
            </div>
          )}
          {visibleProjects.map((project, idx) => {
            const projectMilestones = data.milestones.filter(m => m.project_id === project.id);
            const projectFiles = data.sharedFiles.filter(f => f.project_id === project.id);
            
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card 
                  className="ui-surface ui-hover group cursor-pointer overflow-hidden rounded-3xl border border-white/[0.06] bg-card/50 shadow-sm backdrop-blur-xl hover:border-white/[0.12] hover:bg-card/70"
                  onClick={() => navigate(`/studio?room=${project.id}`)}
                >
                  <CardHeader className="border-b border-border/50 bg-secondary/30 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="group-hover:text-primary transition-colors">
                        <CardTitle className="text-xl flex items-center gap-2">
                          <FolderOpen className="w-5 h-5 text-primary" />
                          {project.title}
                        </CardTitle>
                        {project.description && (
                          <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {String(project.status || 'draft').replace('_', ' ')}
                        </Badge>
                        <Badge className="bg-primary/20 text-primary">
                          <Users className="w-3 h-3 mr-1" />
                          {project.collaborator_ids?.length || 0} Collaborator{(project.collaborator_ids?.length !== 1) ? 's' : ''}
                        </Badge>
                        {project.owner_id === user.id && (
                          <div onClick={e => e.stopPropagation()}>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="ui-hover min-h-9 gap-1.5 rounded-xl border-primary/50 px-3 text-xs text-primary transition-colors hover:bg-primary/10">
                                  <Link2 className="w-3 h-3" /> Invite
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent align="end" className="w-72">
                                <div className="space-y-3">
                                  <div>
                                    <h4 className="font-semibold text-sm">Invite to Project</h4>
                                    <p className="text-xs text-muted-foreground">Create a viewer invite link. Links expire automatically.</p>
                                  </div>
                                  {inviteLinks[project.id] ? (
                                    <div className="flex gap-2">
                                      <Input
                                        readOnly
                                        value={inviteLinks[project.id]}
                                        className="h-8 text-xs bg-secondary/50 font-mono"
                                      />
                                      <Button
                                        size="sm"
                                        className="h-8 px-3 shrink-0 bg-primary hover:bg-primary/90 text-white"
                                        onClick={async () => {
                                          const copied = await copyToClipboard(inviteLinks[project.id]);
                                          if (copied) toast.success("Invite link copied to clipboard!");
                                          else toast.error("Couldn't copy the invite link. Please copy it manually.");
                                        }}
                                      >
                                        <Copy className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      className="w-full"
                                      disabled={creatingInviteId === project.id}
                                      onClick={() => handleCreateInvite(project.id)}
                                    >
                                      {creatingInviteId === project.id ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Link2 className="w-3 h-3 mr-2" />}
                                      Create & Copy Invite Link
                                    </Button>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/50">
                      
                      {/* Milestones Column */}
                      <div className="p-4 sm:p-5">
                        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          Current Milestones
                        </h3>
                        {projectMilestones.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">No milestones set.</p>
                        ) : (
                          <div className="space-y-3">
                            {projectMilestones.map(m => (
                              <div key={m.id} className="flex items-start gap-3">
                                {m.completed ? (
                                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                                ) : (
                                  <Circle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                                )}
                                <div>
                                  <p className={`text-sm font-medium ${m.completed ? 'text-muted-foreground line-through' : ''}`}>
                                    {m.title}
                                  </p>
                                  {m.due_date && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                      <Calendar className="w-3 h-3" />
                                      {new Date(m.due_date).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Files Column */}
                      <div className="p-5">
                        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Latest Shared Files
                        </h3>
                        {projectFiles.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">No files shared yet.</p>
                        ) : (
                          <div className="space-y-3">
                            {projectFiles.slice(0, 5).map(f => (
                              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-secondary/30 p-2.5">
                                <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                  <FileText className="w-4 h-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{f.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    by {f.uploader_name || 'Unknown'} • {Number.isFinite(Number(f.file_size)) ? `${(Number(f.file_size) / 1024 / 1024).toFixed(2)} MB` : 'Size unavailable'}
                                  </p>
                                </div>
                                <a 
                                  href={f.file_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="ui-hover shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                                  onClick={e => e.stopPropagation()}
                                >
                                  View
                                </a>
                              </div>
                            ))}
                            {projectFiles.length > 5 && (
                              <p className="text-xs text-muted-foreground text-center mt-2">
                                + {projectFiles.length - 5} more files
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Project Title</Label>
              <Input
                id="title"
                value={newProjectTitle}
                onChange={(e) => setNewProjectTitle(e.target.value)}
                placeholder="e.g. Summer Hit Track"
                disabled={isCreating}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder="Brief description of the project"
                disabled={isCreating}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewProject(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={isCreating || !newProjectTitle.trim()}>
              {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}