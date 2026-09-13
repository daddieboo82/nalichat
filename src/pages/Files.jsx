import { secureUploadFile } from "@/lib/secureUpload";
import { validateUpload } from "@/lib/uploadValidation";
import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Search, Music, Image, Film, FileText, File, Download, Trash2, Loader2, FolderOpen, FolderArchive, X, CheckSquare, Plus, ChevronRight, Play, Pause, Share2, Edit } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";
import { downloadFilesAsZip } from "@/lib/downloadZip";
import { useToast } from "@/components/ui/use-toast";
import { resumableDownload } from "@/lib/resumableUpload";
import { useAudioPlayer } from "@/lib/AudioPlayerContext";
import LargeFileTransfer from "@/components/files/LargeFileTransfer";
import { sounds } from "@/hooks/use-sound";
import { copyToClipboard } from "@/lib/clipboard";
import PullToRefresh from "@/components/layout/PullToRefresh";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

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

async function listAllAccessible(entity, sort = "-created_date", pageSize = 200) {
  const rows = [];
  for (let skip = 0; ; skip += pageSize) {
    const page = await entity.list(sort, pageSize, skip);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function FileDownloadButton({ file }) {
  const [dlProgress, setDlProgress] = useState(null);
  const { toast } = useToast();

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
      toast({ title: "Download failed", description: "Please try again.", variant: "destructive" });
    }
    setDlProgress(null);
  };

  if (dlProgress !== null) {
    return (
      <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-primary/20 text-primary text-[10px] font-bold">
        {dlProgress}%
      </div>
    );
  }

  return (
    <Button 
      size="icon" 
      variant="ghost" 
      className="w-11 h-11 rounded-lg hover:bg-primary/20 hover:text-primary transition-colors" 
      onClick={handleDownload}
      title="Download file"
    >
      <Download className="w-4 h-4" />
    </Button>
  );
}

function FileShareButton({ file, canShare, currentUserId }) {
  const { toast } = useToast();
  if (!canShare) return null;

  const handleShare = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    sounds.click();
    try {
      const res = await base44.functions.invoke("createFileShareLink", { fileId: file.id });
      const token = res?.data?.token;
      const expiresAt = res?.data?.expires_at;
      const expiresAtMs = typeof expiresAt === "string" ? Date.parse(expiresAt) : NaN;
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "create_file_share_link" ||
        res?.data?.userId !== currentUserId ||
        res?.data?.fileId !== file.id ||
        typeof token !== "string" ||
        !/^[0-9a-f]{64}$/i.test(token) ||
        !Number.isFinite(expiresAtMs) ||
        expiresAtMs <= Date.now()
      ) throw new Error("Secure share link was not confirmed");
      const url = `${window.location.origin}/shared-file?id=${encodeURIComponent(file.id)}&token=${encodeURIComponent(token)}`;
      const copied = await copyToClipboard(url);
      if (!copied) throw new Error("The secure link was created, but clipboard copy failed.");
      toast({ title: "Link copied", description: "Secure share link copied to clipboard" });
    } catch (error) {
      console.error("Could not create share link", error);
      toast({ title: "Share failed", description: "You do not have permission to share this file.", variant: "destructive" });
    }
  };

  return (
    <Button 
      size="icon" 
      variant="ghost" 
      className="w-11 h-11 rounded-lg hover:bg-primary/20 hover:text-primary transition-colors" 
      onClick={handleShare}
      title="Copy share link"
    >
      <Share2 className="w-4 h-4" />
    </Button>
  );
}

export default function Files() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const { user: currentUser } = useAuth();
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
    // File-management state can contain private IDs/names from the previous
    // account even after user-scoped queries switch over. Clear it immediately
    // whenever the authenticated identity changes.
    setSelectedIds([]);
    setCurrentFolderId(null);
    setShowNewFolder(false);
    setShowUploadModal(false);
    setShowMoveFolder(false);
    setNewFolderName("");
    setNewFolderProject("none");
    setFileToEdit(null);
    setEditFormData({ name: "", tags: "", description: "" });
    setSearch("");
    setTypeFilter("all");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [currentUser?.id]);

  useEffect(() => { 
    
    // Check for download query param
    const urlParams = new URLSearchParams(window.location.search);
    const downloadId = urlParams.get('download');
    const shareToken = urlParams.get('token');
    if (downloadId && shareToken) {
      base44.functions.invoke("getSharedFileByToken", { fileId: downloadId, token: shareToken })
        .then(async (res) => {
          const file = res?.data?.file;
          const tokenFingerprint = res?.data?.tokenFingerprint;
          const expectedFingerprint = (await sha256Hex(shareToken)).slice(0, 16);
          if (
            res?.data?.success !== true ||
            res?.data?.action !== "get_shared_file_by_token" ||
            res?.data?.fileId !== downloadId ||
            file?.id !== downloadId ||
            tokenFingerprint !== expectedFingerprint ||
            typeof file?.file_url !== "string" ||
            !file.file_url.trim() ||
            typeof file?.name !== "string" ||
            !file.name.trim()
          ) {
            throw new Error("Shared file response was not confirmed");
          }
          toast({ title: "Starting download...", description: `Downloading ${file.name}` });
          await resumableDownload(file.file_url, file.name || "file");
          toast({ title: "Download complete", description: `${file.name} downloaded successfully.` });
        })
        .catch((e) => {
          console.error("Could not fetch shared file", e);
          toast({ title: "Share link invalid", description: "This file link is invalid or has been replaced.", variant: "destructive" });
        });
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

  const { data: files = [], isLoading, isError: filesError } = useQuery({
    queryKey: ["shared-files", currentUser?.id],
    queryFn: () => listAllAccessible(base44.entities.SharedFile),
    enabled: !!currentUser?.id,
  });

  const { data: projects = [], isError: projectsError } = useQuery({
    queryKey: ["projects", currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const all = await listAllAccessible(base44.entities.Project);
      return all.filter(p => p.owner_id === currentUser.id || (p.collaborator_ids || []).includes(currentUser.id));
    },
    enabled: !!currentUser?.id,
  });

  const { data: folders = [], isError: foldersError } = useQuery({
    queryKey: ["folders", currentUser?.id],
    queryFn: () => currentUser ? listAllAccessible(base44.entities.Folder) : [],
    enabled: !!currentUser?.id,
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
      let uploaded = 0;
      const failures = [];

      for (const file of filesArray) {
        try {
          const { file_url } = await secureUploadFile({ file });
          const created = await base44.functions.invoke("createSharedFileRecord", {
            name: file.name,
            file_url,
            file_type: detectFileType(file),
            file_size: file.size,
            folder_id: currentFolderId,
            project_id: currentFolderObj?.project_id || null,
          });
          if (created?.data?.error) throw new Error(created.data.error);
          if (
            created?.data?.success !== true ||
            created?.data?.action !== "create_shared_file" ||
            created?.data?.userId !== currentUser?.id ||
            created?.data?.fileId !== created?.data?.file?.id ||
            created?.data?.file?.uploader_id !== currentUser?.id
          ) throw new Error("File upload was not confirmed");
          uploaded += 1;
        } catch (error) {
          failures.push({ name: file.name, message: error?.message || "Upload failed" });
        }
      }

      return { uploaded, failures, total: filesArray.length };
    },
    onSuccess: ({ uploaded, failures, total }) => {
      if (uploaded > 0) sounds.upload();
      queryClient.invalidateQueries({ queryKey: ["shared-files"] });
      if (failures.length === 0) {
        toast({ title: "Upload complete", description: `${uploaded} file${uploaded === 1 ? "" : "s"} uploaded.` });
      } else if (uploaded > 0) {
        toast({
          title: "Upload partially completed",
          description: `${uploaded} of ${total} files uploaded. ${failures.length} failed and can be retried.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Upload failed",
          description: "No files were uploaded. Your local files were not changed.",
          variant: "destructive",
        });
      }
    },
    onSettled: () => setUploading(false),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await base44.functions.invoke("mutateSharedFile", { action: "delete", fileId: id });
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "delete" ||
        res?.data?.userId !== currentUser?.id ||
        res?.data?.fileId !== id ||
        res?.data?.deleted !== true
      ) {
        throw new Error("File deletion was not confirmed");
      }
      return res.data;
    },
    onSuccess: () => {
      sounds.error();
      queryClient.invalidateQueries({ queryKey: ["shared-files"] });
    },
  });

  const updateFileMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await base44.functions.invoke("mutateSharedFile", {
        action: "update",
        fileId: id,
        ...data,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      const updatedFile = res?.data?.file;
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "update" ||
        res?.data?.userId !== currentUser?.id ||
        res?.data?.fileId !== id ||
        updatedFile?.id !== id
      ) {
        throw new Error("File update was not confirmed");
      }
      return updatedFile;
    },
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
    mutationFn: async (name) => {
      const res = await base44.functions.invoke("createProjectFolder", {
        name,
        project_id: newFolderProject === "none" ? null : newFolderProject,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      const folder = res?.data?.folder;
      const expectedProjectId = newFolderProject === "none" ? null : newFolderProject;
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "create_project_folder" ||
        res?.data?.userId !== currentUser?.id ||
        res?.data?.folderId !== folder?.id ||
        res?.data?.projectId !== expectedProjectId ||
        folder?.owner_id !== currentUser?.id ||
        (folder?.project_id || null) !== expectedProjectId
      ) throw new Error("Folder creation was not confirmed");
      return folder;
    },
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
    mutationFn: async (id) => {
      const res = await base44.functions.invoke("deleteFolder", { folderId: id });
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "delete_folder" ||
        res?.data?.userId !== currentUser?.id ||
        res?.data?.folderId !== id ||
        res?.data?.deleted !== true ||
        !Number.isFinite(Number(res?.data?.detached_files))
      ) {
        throw new Error("Folder deletion was not confirmed");
      }
      return res.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["shared-files"] });
      setCurrentFolderId(null);
      toast({
        title: "Folder deleted",
        description: result?.detached_files
          ? `${result.detached_files} file${result.detached_files === 1 ? "" : "s"} moved back to the root.`
          : "Folder removed.",
      });
    },
  });

  const moveToFolderMutation = useMutation({
    mutationFn: ({ fileIds, folderId }) => Promise.all(fileIds.map(async (id) => {
      const res = await base44.functions.invoke("mutateSharedFile", {
        action: "move",
        fileId: id,
        folderId,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      const movedFile = res?.data?.file;
      if (
        res?.data?.success !== true ||
        res?.data?.action !== "move" ||
        res?.data?.userId !== currentUser?.id ||
        res?.data?.fileId !== id ||
        res?.data?.folderId !== folderId ||
        movedFile?.id !== id ||
        movedFile?.folder_id !== folderId
      ) {
        throw new Error("File move was not confirmed");
      }
      return movedFile;
    })),
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
    if (files.length > 0 && currentUser) {
      const validFiles = [];
      for (const file of files) {
        const validation = validateUpload(file);
        if (validation.ok) validFiles.push(file);
        else toast.error(`${file.name}: ${validation.error}`);
      }
      if (validFiles.length > 0) uploadMutation.mutate(validFiles);
    }
    e.target.value = "";
  };

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["shared-files"] });
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
    await queryClient.invalidateQueries({ queryKey: ["folders"] });
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="px-4 pt-5 sm:px-6 sm:pt-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold">Files</h1>
            <p className="text-sm text-muted-foreground">Share music, sessions, art & more</p>
          </div>
          {typeFilter !== "transfer" && (
            <div className="flex flex-wrap items-center gap-2">
              {uploading && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
              <Button
                className="ui-hover min-h-11 flex-1 rounded-xl bg-primary font-semibold text-white shadow-lg shadow-primary/10 hover:bg-primary/90 sm:flex-none"
                onClick={() => setShowUploadModal(true)}
                disabled={uploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Files
              </Button>
              <Button
                variant="default"
                size="sm"
                className="ui-hover min-h-11 flex-1 rounded-xl bg-gradient-to-r from-primary to-pink-500 font-semibold text-white transition-all hover:opacity-90 sm:flex-none"
                onClick={() => navigate('/explore?upload=true')}
                title="Publish Track to Explore"
              >
                Publish Track
              </Button>
            </div>
          )}
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2 sm:gap-4">
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
                <Input placeholder="Search files..." value={search} onChange={e => setSearch(e.target.value)} className="h-11 rounded-xl border border-border/50 bg-secondary/40 pl-9 focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
              </div>
            </>
          )}
          <Tabs value={typeFilter} onValueChange={setTypeFilter} className={typeFilter === "transfer" ? "ml-auto" : ""}>
            <TabsList className="no-scrollbar max-w-[calc(100vw-2rem)] justify-start overflow-x-auto rounded-xl bg-secondary/50 p-1">
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
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/10 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <CheckSquare className="w-4 h-4" />
              {selectedIds.length} selected
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
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
              className="w-11 h-11 rounded-lg text-destructive"
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

      <div className="flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
        <PullToRefresh onRefresh={handleRefresh}>
        {typeFilter === "transfer" ? (
          <LargeFileTransfer currentUser={currentUser} />
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filesError || projectsError || foldersError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderOpen className="w-12 h-12 opacity-30 mb-3" />
            <p className="font-heading text-lg">Couldn't load your files</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Your data is still safe. Try loading it again.</p>
            <Button type="button" variant="outline" onClick={() => void handleRefresh()}>
              Retry
            </Button>
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
                    className="ui-surface ui-hover group cursor-pointer rounded-2xl border border-white/[0.06] bg-card/50 p-4 backdrop-blur-xl hover:border-white/[0.12] hover:bg-card/70"
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
              const canEditFile = file.uploader_id === currentUser?.id || (file.edit_user_ids || []).includes(currentUser?.id);
                  return (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`ui-surface group rounded-2xl border bg-card/50 p-4 backdrop-blur-xl transition-all ${isSelected ? "border-primary ring-1 ring-primary/40" : "border-white/[0.06] hover:border-white/[0.12] hover:bg-card/70"}`}
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
                        <div className="flex flex-wrap justify-end gap-1 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
                          <FileShareButton file={file} canShare={canEditFile} currentUserId={currentUser?.id} />
                          <FileDownloadButton file={file} />
                          {canEditFile && (
                            <>
                              <Button size="icon" variant="ghost" className="w-11 h-11 rounded-lg" onClick={(e) => handleEditClick(e, file)}>
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="w-11 h-11 rounded-lg text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(file.id); }}>
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
              const canEditFile = file.uploader_id === currentUser?.id || (file.edit_user_ids || []).includes(currentUser?.id);
              return (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`ui-surface group rounded-2xl border bg-card/50 p-4 backdrop-blur-xl transition-all ${isSelected ? "border-primary ring-1 ring-primary/40" : "border-white/[0.06] hover:border-white/[0.12] hover:bg-card/70"}`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      disabled={!canEditFile}
                      onCheckedChange={() => canEditFile && toggleSelect(file.id)}
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
                    <div className="flex flex-wrap justify-end gap-1 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
                      <FileShareButton file={file} canShare={canEditFile} currentUserId={currentUser?.id} />
                      <FileDownloadButton file={file} />
                      {canEditFile && (
                        <>
                          <Button size="icon" variant="ghost" className="w-11 h-11 rounded-lg" onClick={(e) => handleEditClick(e, file)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="w-11 h-11 rounded-lg text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(file.id); }}>
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
                data-testid="files-upload-input"
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
              className="h-11 rounded-xl border border-border/50 bg-secondary/40 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
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
                className="h-11 rounded-xl border border-border/50 bg-secondary/40 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Description</label>
              <Input
                placeholder="Description"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                className="h-11 rounded-xl border border-border/50 bg-secondary/40 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Tags (comma separated)</label>
              <Input
                placeholder="tag1, tag2"
                value={editFormData.tags}
                onChange={(e) => setEditFormData({ ...editFormData, tags: e.target.value })}
                className="h-11 rounded-xl border border-border/50 bg-secondary/40 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
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
                className="ui-hover flex min-h-12 w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-primary/40"
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