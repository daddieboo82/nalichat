import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FolderOpen, FileText, CheckCircle2, Circle, Users, Calendar, Link2, Copy, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

import { useSearchParams } from 'react-router-dom';

export default function ProjectsSummary() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ projects: [], milestones: [], sharedFiles: [] });
  const [showNewProject, setShowNewProject] = useState(searchParams.get('new') === 'true');
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setShowNewProject(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const handleCreateProject = async () => {
    if (!newProjectTitle.trim()) return toast.error("Project title is required");
    setIsCreating(true);
    try {
      const created = await base44.functions.invoke("createProject", {
        title: newProjectTitle.trim(),
        description: newProjectDescription.trim(),
      });
      if (created?.data?.error) throw new Error(created.data.error);
      const project = created?.data?.project;
      if (!project?.id) throw new Error("Project was not created");
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
    async function fetchData() {
      if (!user) return;
      try {
        const [projectsRes, milestonesRes, filesRes] = await Promise.all([
          base44.entities.Project.list(),
          base44.entities.Milestone.list(),
          base44.entities.SharedFile.list()
        ]);
        
        const myProjects = projectsRes.filter(p => p.owner_id === user.id || (p.collaborator_ids && p.collaborator_ids.includes(user.id)));
        const projectIds = myProjects.map(p => p.id);
        
        const myMilestones = milestonesRes.filter(m => projectIds.includes(m.project_id));
        const myFiles = filesRes.filter(f => projectIds.includes(f.project_id));

        setData({ projects: myProjects, milestones: myMilestones, sharedFiles: myFiles });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto h-full overflow-y-auto custom-scrollbar">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold mb-2">Collaboration Summary</h1>
          <p className="text-muted-foreground">Overview of your active projects, milestones, and shared files.</p>
        </div>
        <Button onClick={() => setShowNewProject(true)} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> New Project
        </Button>
      </div>

      {data.projects.length === 0 ? (
        <div className="text-center py-12 bg-card/50 backdrop-blur-xl rounded-2xl border border-white/[0.06]">
          <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Active Projects</h2>
          <p className="text-muted-foreground">You are not collaborating on any projects yet.</p>
        </div>
      ) : (
        <div className="space-y-6 pb-12">
          {data.projects.map((project, idx) => {
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
                  className="bg-card/50 backdrop-blur-xl border border-white/[0.06] shadow-sm overflow-hidden cursor-pointer hover:border-white/[0.12] hover:bg-card/70 transition-all duration-300 group"
                  onClick={() => navigate(`/studio?room=${project.id}`)}
                >
                  <CardHeader className="bg-secondary/30 border-b border-border/50 pb-4">
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
                          {project.status.replace('_', ' ')}
                        </Badge>
                        <Badge className="bg-primary/20 text-primary">
                          <Users className="w-3 h-3 mr-1" />
                          {project.collaborator_ids?.length || 0} Collaborator{(project.collaborator_ids?.length !== 1) ? 's' : ''}
                        </Badge>
                        <div onClick={e => e.stopPropagation()}>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="h-6 text-xs gap-1.5 ml-2 border-primary/50 text-primary hover:bg-primary/10 transition-colors">
                                <Link2 className="w-3 h-3" /> Invite
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-72">
                            <div className="space-y-3">
                              <div>
                                <h4 className="font-semibold text-sm">Invite to Project</h4>
                                <p className="text-xs text-muted-foreground">Share this link to collaborate in the studio.</p>
                              </div>
                              <div className="flex gap-2">
                                <Input 
                                  readOnly 
                                  value={`${window.location.origin}/studio?room=${project.id}`} 
                                  className="h-8 text-xs bg-secondary/50 font-mono"
                                />
                                <Button 
                                  size="sm" 
                                  className="h-8 px-3 shrink-0 bg-primary hover:bg-primary/90 text-white"
                                  onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/studio?room=${project.id}`);
                                    toast.success('Invite link copied to clipboard!');
                                  }}
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/50">
                      
                      {/* Milestones Column */}
                      <div className="p-5">
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
                              <div key={f.id} className="flex items-center gap-3 bg-secondary/30 p-2 rounded-lg border border-border/40">
                                <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                  <FileText className="w-4 h-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{f.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    by {f.uploader_name || 'Unknown'} • {(f.file_size / 1024 / 1024).toFixed(2)} MB
                                  </p>
                                </div>
                                <a 
                                  href={f.file_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs font-medium text-primary hover:underline shrink-0"
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
        <DialogContent className="sm:max-w-[425px]">
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