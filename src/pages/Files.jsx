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
      <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-primary/20 text-primary text-[10px] font-bold">
        {dlProgress}%
      </div>
    );
  }

  return (
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