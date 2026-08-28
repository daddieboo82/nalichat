import React, { useState, useRef, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Search, Music, Image, Film, FileText, File, Download, Trash2, Loader2, FolderOpen, FolderArchive, X, CheckSquare, Plus, ChevronRight, Play, Pause, Share2, Tag, Edit } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadFilesAsZip } from "@/lib/downloadZip";
import { useToast } from "@/components/ui/use-toast";
import { resumableDownload } from "@/lib/resumableUpload";
import { useAudioPlayer } from "@/lib/AudioPlayerContext";
import LargeFileTransfer from "@/components/files/LargeFileTransfer";
import { sounds } from "@/hooks/use-sound";
import PullToRefresh from "@/components/layout/PullToRefresh";

const typeIcons = {
  audio: Music,
  image: Image,
  video: Film,
  session: FileText,
  document: FileText,
  other: File,
};

const typeColors = {
  audio: "bg-primary/20 text-primary",
  image: "bg-chart-3/20 text-chart-3",
  video: "bg-chart-5/20 text-chart-5",
  session: "bg-accent/20 text-accent",
  document: "bg-chart-4/20 text-chart-4",
  other: "bg-secondary text-muted-foreground",
};

function detectFileType(file) {
  if (file.type.startsWith("audio")) return "audio";
  if (file.type.startsWith("image")) return "image";
  if (file.type.startsWith("video")) return "video";
  if (file.name.match(/\.(als|flp|logic|ptx|rpp|cpr)$/i)) return "session";
  if (file.type.includes("pdf") || file.type.includes("document")) return "document";
  return "other";
}

function FileDownloadButton({ file }) {
  const [dlProgress, setDlProgress] = useState(null);

  const handleDownload = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dlProgress !== null) return;
    sounds.click();
    setDlProgress(0);
    try {
      await resumableDownload(file.file_url, file.name || "file", (pct) => setDlProgress(pct));
    } catch (error) {
      console.error("Download failed", error);
    }
    setDlProgress(null);
  };

  if (dlProgress !== null) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20 text-primary text-[10px] font-bold">
        {dlProgress}%
      </div>
    );
  }

  return (
    <Button 
      size="icon" 
      variant="ghost" 
      className="w-8 h-8 rounded-lg hover:bg-primary/20 hover:text-primary transition-colors" 
      onClick={handleDownload}
      title="Download file"
    >
      <Download className="w-4 h-4" />
    </Button>
  );
}

function FileShareButton({ file }) {
  const { toast } = useToast();
  
  const handleShare = (e) => {
    e.preventDefault();
    e.stopPropagation();
    sounds.click();
    const url = `${window.location.origin}/files?download=${file.id}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: "Share link copied to clipboard" });
  };

  return (
    <Button 
      size="icon" 
      variant="ghost" 
      className="w-8 h-8 rounded-lg hover:bg-primary/20 hover:text-primary transition-colors" 
      onClick={handleShare}
      title="Copy share link"
    >
      <Share2 className="w-4 h-4" />
    </Button>
  );
}

export default function Files() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [zipping, setZipping] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showMoveFolder, setShowMoveFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderProject, setNewFolderProject] = useState("none");
  const [fileToEdit, setFileToEdit] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: "", tags: "", description: "" });
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { playTrack, currentTrack, isPlaying } = useAudioPlayer();

  useEffect(() => { 
    base44.auth.me().then(setCurrentUser); 
    
    // Check for download query param
    const urlParams = new URLSearchParams(window.location.search);
    const downloadId = urlParams.get('download');
    if (downloadId) {
      base44.entities.SharedFile.get(downloadId).then(async (file) => {
        if (file) {
          toast({ title: "Starting download...", description: `Downloading ${file.name}` });
          try {
            await resumableDownload(file.file_url, file.name || "file");
            toast({ title: "Download complete", description: `${file.name} downloaded successfully.` });
          } catch (e) {
            console.error(e);
            toast({ title: "Download failed", description: "There was an error downloading the file.", variant: "destructive" });
          }
        }
      }).catch(e => console.error("Could not fetch file to download", e));
    }
  }, []);

  const toggleSelect = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const clearSelection = () => setSelectedIds([]);

  const handleDownloadZip = async () => {
    const selectedFiles = files.filter((f) => selectedIds.includes(f.id));
    if (selectedFiles.length === 0) return;
    setZipping(true);
    try {
      await downloadFilesAsZip(selectedFiles, "selected-files.zip");
      clearSelection();
    } catch {
      toast({ title: "Download failed", description: "Could not bundle the selected files.", variant: "destructive" });
    }
    setZipping(false);
  };

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["shared-files"],
    queryFn: () => base44.entities.SharedFile.list("-created_date"),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      if (!currentUser) return [];
      const all = await base44.entities.Project.list();
      return all.filter(p => p.owner_id === currentUser.id || (p.collaborator_ids || []).includes(currentUser.id));
    },
    enabled: !!currentUser,
  });

  const { data: folders = [] } = useQuery({
    queryKey: ["folders"],
    queryFn: () => currentUser ? base44.entities.Folder.list("-created_date", 500) : [],
    enabled: !!currentUser,
  });

  const accessibleFolders = React.useMemo(() => {
    if (!currentUser) return [];
    const userProjectIds = projects.map(p => p.id);
    return folders.filter(f => f.owner_id === currentUser.id || (f.project_id && userProjectIds.includes(f.project_id)));
  }, [folders, projects, currentUser]);

  const uploadMutation = useMutation({
    mutationFn: async (filesArray) => {
      setUploading(true);
      const currentFolderObj = currentFolderId ? folders.find(f => f.id === currentFolderId) : null;
      for (const file of filesArray) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        await base44.entities.SharedFile.create({
          name: file.name,
          file_url,
          file_type: detectFileType(file),
          file_size: file.size,
          uploader_id: currentUser.id,
          uploader_name: currentUser.display_name || currentUser.full_name,
          folder_id: currentFolderId,
          project_id: currentFolderObj?.project_id || null,
        });
      }
      setUploading(false);
    },
    onSuccess: () => {
      sounds.upload();
      queryClient.invalidateQueries({ queryKey: ["shared-files"] });
    },
    onError: () => setUploading(false),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SharedFile.delete(id),
    onSuccess: () => {
      sounds.error();
      queryClient.invalidateQueries({ queryKey: ["shared-files"] });
    },
  });

  const updateFileMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SharedFile.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-files"] });
      toast({ title: "File updated", description: "File details have been saved." });
      setFileToEdit(null);
    },
  });

  const handleEditClick = (e, file) => {
    e.preventDefault();
    e.stopPropagation();
    setFileToEdit(file);
    setEditFormData({
      name: file.name || "",
      description: file.description || "",
      tags: (file.tags || []).join(", "),
    });
  };

  const createFolderMutation = useMutation({
    mutationFn: (name) => base44.entities.Folder.create({
      name,
      owner_id: currentUser.id,
      project_id: newFolderProject === "none" ? null : newFolderProject,
    }),
    onSuccess: () => {
      sounds.success();
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      setNewFolderName("");
      setNewFolderProject("none");
      setShowNewFolder(false);
      toast({ title: "Folder created", description: `${newFolderName} is ready for files.` });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id) => base44.entities.Folder.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      setCurrentFolderId(null);
    },
  });

  const moveToFolderMutation = useMutation({
    mutationFn: ({ fileIds, folderId }) => {
      const targetFolder = folders.find(f => f.id === folderId);
      return Promise.all(fileIds.map(id =>
        base44.entities.SharedFile.update(id, { 
          folder_id: folderId,
          project_id: targetFolder?.project_id || null
        })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-files"] });
      setSelectedIds([]);
      setShowMoveFolder(false);
      toast({ title: "Files organized", description: "Files moved to folder." });
    },
  });

  const currentFolder = currentFolderId ? folders.find(f => f.id === currentFolderId) : null;
  
  const accessibleFiles = React.useMemo(() => {
    if (!currentUser) return [];
    const userProjectIds = projects.map(p => p.id);
    return files.filter(f => f.uploader_id === currentUser.id || (f.project_id && userProjectIds.includes(f.project_id)));
  }, [files, projects, currentUser]);

  const filesInFolder = currentFolderId ? files.filter(f => f.folder_id === currentFolderId) : accessibleFiles.filter(f => !f.folder_id);

  const filtered = React.useMemo(() => filesInFolder.filter(f => {
    if (typeFilter !== "all" && f?.file_type !== typeFilter) return false;
    return (f?.name || "").toLowerCase().includes(search.toLowerCase());
  }), [filesInFolder, typeFilter, search]);

  const filteredFolders = React.useMemo(() => accessibleFolders.filter(f => (f?.name || "").toLowerCase().includes(search.toLowerCase())), [accessibleFolders, search]);

  const handleUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0 && currentUser) uploadMutation.mutate(files);
    e.target.value = "";
  };

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["shared-files"] });
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
    await queryClient.invalidateQueries({ queryKey: ["folders"] });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading font-bold">Files</h1>
            <p className="text-sm text-muted-foreground">Share music, sessions, art & more</p>
          </div>
          {typeFilter !== "transfer" && (
            <div className="flex items-center gap-2">
              {uploading && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
              <Button
                className="bg-primary hover:bg-primary/90 text-white shadow-sm"
                onClick={() => setShowUploadModal(true)}
                disabled={uploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Files
              </Button>
              <Button
                variant="default"
                size="sm"
                className="bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 transition-all text-white"
                onClick={() => window.location.href = '/explore?upload=true'}
                title="Publish Track to Explore"
              >
                Publish Track
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-6">
          {typeFilter !== "transfer" && (
            <>
              <Button 
                variant={selectedIds.length > 0 && selectedIds.length === filtered.length ? "default" : "outline"} 
                size="icon" 
                className="rounded-xl shrink-0" 
                onClick={() => {
                  if (selectedIds.length === filtered.length && filtered.length > 0) {
                    setSelectedIds([]);
                  } else {
                    setSelectedIds(filtered.map(f => f.id));
                  }
                }}
                title={selectedIds.length === filtered.length ? "Deselect All" : "Select All"}
              >
                <CheckSquare className="w-4 h-4" />
              </Button>
              <div className="relative flex-1 max-w-md min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search files..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-0 rounded-xl" />
              </div>
            </>
          )}
          <Tabs value={typeFilter} onValueChange={setTypeFilter} className={typeFilter === "transfer" ? "ml-auto" : ""}>
            <TabsList className="bg-secondary/50">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="audio">Audio</TabsTrigger>
              <TabsTrigger value="image">Images</TabsTrigger>
              <TabsTrigger value="session">Sessions</TabsTrigger>
              <TabsTrigger value="video">Video</TabsTrigger>
              <TabsTrigger value="transfer" className="text-primary font-bold">Transfer</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between gap-3 mb-4 p-3 rounded-xl bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <CheckSquare className="w-4 h-4" />
              {selectedIds.length} selected
            </div>
            <div className="flex items-center gap-2">
              {accessibleFolders.length > 0 && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="rounded-lg" 
                  onClick={() => setShowMoveFolder(true)}
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Move to Folder
                </Button>
              )}
              <Button size="sm" className="rounded-lg bg-primary hover:bg-primary/90" onClick={handleDownloadZip} disabled={zipping}>
                {zipping ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FolderArchive className="w-4 h-4 mr-2" />}
                Download ZIP
              </Button>
              <Button size="sm" variant="ghost" className="rounded-lg" onClick={clearSelection}>
                <X className="w-4 h-4 mr-1" /> Clear
              </Button>
            </div>
          </div>
        )}

        {typeFilter !== "transfer" && currentFolder && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-secondary/50 border border-border">
            <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => setCurrentFolderId(null)}>
              <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Back
            </Button>
            <FolderOpen className="w-4 h-4 text-accent" />
            <span className="font-medium text-sm flex-1">{currentFolder.name}</span>
            <Button 
              size="icon"
              variant="ghost"
              className="w-8 h-8 rounded-lg text-destructive"
              onClick={() => deleteFolderMutation.mutate(currentFolder.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {typeFilter !== "transfer" && (
          <div className="flex items-center gap-2 mb-4">
            <Button 
              size="sm"
              variant="outline"
              className="rounded-lg"
              onClick={() => setShowNewFolder(true)}
            >
              <Plus className="w-4 h-4 mr-1" /> New Folder
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <PullToRefresh onRefresh={handleRefresh}>
        {typeFilter === "transfer" ? (
          <LargeFileTransfer currentUser={currentUser} />
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (!currentFolderId && filteredFolders.length === 0 && filtered.length === 0) || (currentFolderId && filtered.length === 0) ? (
          <div className="text-center text-muted-foreground py-20">
            {search ? (
              <>
                <Search className="w-12 h-12 opacity-30 mx-auto mb-3" />
                <p className="font-heading text-lg">No results found</p>
                <p className="text-sm mt-1">We couldn't find anything matching "{search}"</p>
              </>
            ) : (
              <>
                <FolderOpen className="w-12 h-12 opacity-30 mx-auto mb-3" />
                <p className="font-heading text-lg">No files yet</p>
                <p className="text-sm mt-1">{currentFolder ? `Upload files to ${currentFolder.name}` : "Upload your first file to get started"}</p>
              </>
            )}
          </div>
        ) : !currentFolderId && (filteredFolders.length > 0 || accessibleFolders.length > 0) ? (
          <div className="space-y-4">
            {filteredFolders.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredFolders.map((folder, i) => (
                  <motion.div
                    key={folder.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="bg-card/50 backdrop-blur-xl rounded-xl border border-white/[0.06] hover:border-white/[0.12] hover:bg-card/70 p-4 cursor-pointer transition-all duration-300 group"
                    onClick={() => setCurrentFolderId(folder.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-accent/20">
                        <FolderOpen className="w-5 h-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{folder.name}</p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {files.filter(f => f.folder_id === folder.id).length} files
                          {folder.project_id && projects.find(p => p.id === folder.project_id) && ` • ${projects.find(p => p.id === folder.project_id).title}`}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
            {filtered.length > 0 && filteredFolders.length > 0 && <p className="text-xs font-semibold text-muted-foreground uppercase mt-6 mb-3">Ungrouped Files</p>}
            {filtered.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map((file, i) => {
                  const Icon = typeIcons[file.file_type] || File;
                  const isSelected = selectedIds.includes(file.id);
                  return (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`bg-card/50 backdrop-blur-xl rounded-xl border p-4 transition-all duration-300 group ${isSelected ? "border-primary ring-1 ring-primary/40" : "border-white/[0.06] hover:border-white/[0.12] hover:bg-card/70"}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(file.id)}
                          className="mt-1 shrink-0"
                        />
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${typeColors[file.file_type] || typeColors.other}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{file.name}</p>
                          {(file.tags && file.tags.length > 0) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {file.tags.map((t, idx) => (
                                <Badge key={idx} variant="secondary" className="text-[10px] px-1 py-0 h-4">{t}</Badge>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1 mb-2">
                            <span className="text-[10px] text-muted-foreground">
                              {file.file_size ? `${(file.file_size / 1024 / 1024).toFixed(1)} MB` : "—"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">•</span>
                            <span className="text-[10px] text-muted-foreground">{file.uploader_name || "Unknown"}</span>
                            <span className="text-[10px] text-muted-foreground">•</span>
                            <span className="text-[10px] text-muted-foreground">
                              {file.created_date && !isNaN(new Date(file.created_date).getTime()) ? formatDistanceToNow(new Date(file.created_date), { addSuffix: true }) : "..."}
                            </span>
                          </div>
                          {file.file_type === "audio" && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="mt-3 gap-2 w-fit rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                playTrack({
                                  id: file.id,
                                  title: file.name,
                                  creator_name: file.uploader_name || "Unknown",
                                  file_url: file.file_url,
                                });
                              }}
                            >
                              {currentTrack?.id === file.id && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                              {currentTrack?.id === file.id && isPlaying ? "Pause Audio" : "Play Audio"}
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <FileShareButton file={file} />
                          <FileDownloadButton file={file} />
                          {file.uploader_id === currentUser?.id && (
                            <>
                              <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg" onClick={(e) => handleEditClick(e, file)}>
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(file.id); }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((file, i) => {
              const Icon = typeIcons[file.file_type] || File;
              const isSelected = selectedIds.includes(file.id);
              return (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`bg-card/50 backdrop-blur-xl rounded-xl border p-4 transition-all duration-300 group ${isSelected ? "border-primary ring-1 ring-primary/40" : "border-white/[0.06] hover:border-white/[0.12] hover:bg-card/70"}`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(file.id)}
                      className="mt-1 shrink-0"
                    />
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${typeColors[file.file_type] || typeColors.other}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{file.name}</p>
                      {(file.tags && file.tags.length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {file.tags.map((t, idx) => (
                            <Badge key={idx} variant="secondary" className="text-[10px] px-1 py-0 h-4">{t}</Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1 mb-2">
                        <span className="text-[10px] text-muted-foreground">
                          {file.file_size ? `${(file.file_size / 1024 / 1024).toFixed(1)} MB` : "—"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">•</span>
                        <span className="text-[10px] text-muted-foreground">{file.uploader_name || "Unknown"}</span>
                        <span className="text-[10px] text-muted-foreground">•</span>
                        <span className="text-[10px] text-muted-foreground">
                          {file.created_date && !isNaN(new Date(file.created_date).getTime()) ? formatDistanceToNow(new Date(file.created_date), { addSuffix: true }) : "..."}
                        </span>
                      </div>
                      {file.file_type === "audio" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="mt-3 gap-2 w-fit rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            playTrack({
                              id: file.id,
                              title: file.name,
                              creator_name: file.uploader_name || "Unknown",
                              file_url: file.file_url,
                            });
                          }}
                        >
                          {currentTrack?.id === file.id && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                          {currentTrack?.id === file.id && isPlaying ? "Pause Audio" : "Play Audio"}
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <FileShareButton file={file} />
                      <FileDownloadButton file={file} />
                      {file.uploader_id === currentUser?.id && (
                        <>
                          <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg" onClick={(e) => handleEditClick(e, file)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(file.id); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        </PullToRefresh>
      </div>

      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Upload Files</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-xl p-8 flex flex-col items-center justify-center text-center bg-secondary/20">
              <input 
                type="file" 
                multiple 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                onChange={(e) => {
                  handleUpload(e);
                  setShowUploadModal(false);
                }} 
              />
              <div className="pointer-events-none relative z-0 flex flex-col items-center justify-center">
                <Upload className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="font-medium text-sm">Click to select files</p>
                <p className="text-xs text-muted-foreground mt-1">Or drag and drop</p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">Files will be uploaded to {currentFolder ? currentFolder.name : "the root directory"}.</p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  const file = new File(["dummy file content for testing"], "test-file.txt", { type: "text/plain" });
                  handleUpload({ target: { files: [file] } });
                  setShowUploadModal(false);
                }}
              >
                Mock Upload (Test)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Create Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="rounded-lg bg-secondary/50 border-0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newFolderName.trim()) {
                  createFolderMutation.mutate(newFolderName);
                }
              }}
            />
            {projects.length > 0 && (
              <Select value={newFolderProject} onValueChange={setNewFolderProject}>
                <SelectTrigger className="bg-secondary/50 border-0 rounded-lg h-10 w-full text-sm">
                  <SelectValue placeholder="Select Project (Optional)" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="none">No Project (Personal)</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-lg" onClick={() => setShowNewFolder(false)}>
                Cancel
              </Button>
              <Button 
                className="flex-1 rounded-lg bg-primary hover:bg-primary/90"
                onClick={() => {
                  if (newFolderName.trim()) createFolderMutation.mutate(newFolderName);
                }}
                disabled={!newFolderName.trim()}
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!fileToEdit} onOpenChange={(open) => !open && setFileToEdit(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Edit File Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Name</label>
              <Input
                placeholder="File name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                className="rounded-lg bg-secondary/50 border-0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Description</label>
              <Input
                placeholder="Description"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                className="rounded-lg bg-secondary/50 border-0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Tags (comma separated)</label>
              <Input
                placeholder="tag1, tag2"
                value={editFormData.tags}
                onChange={(e) => setEditFormData({ ...editFormData, tags: e.target.value })}
                className="rounded-lg bg-secondary/50 border-0"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 rounded-lg" onClick={() => setFileToEdit(null)}>
                Cancel
              </Button>
              <Button 
                className="flex-1 rounded-lg bg-primary hover:bg-primary/90"
                onClick={() => {
                  updateFileMutation.mutate({
                    id: fileToEdit.id,
                    data: {
                      name: editFormData.name,
                      description: editFormData.description,
                      tags: editFormData.tags.split(',').map(t => t.trim()).filter(Boolean)
                    }
                  });
                }}
                disabled={!editFormData.name.trim() || updateFileMutation.isPending}
              >
                {updateFileMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMoveFolder} onOpenChange={setShowMoveFolder}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Move to Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {accessibleFolders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => moveToFolderMutation.mutate({ fileIds: selectedIds, folderId: folder.id })}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors text-left"
              >
                <FolderOpen className="w-4 h-4 text-accent shrink-0" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-medium text-sm truncate">{folder.name}</span>
                  {folder.project_id && projects.find(p => p.id === folder.project_id) && (
                    <span className="text-[10px] text-muted-foreground truncate">{projects.find(p => p.id === folder.project_id).title}</span>
                  )}
                </div>
              </button>
            ))}
            {accessibleFolders.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No folders yet. Create one first.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}