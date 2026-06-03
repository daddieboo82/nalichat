import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Search, Music, Image, Film, FileText, File, Download, Trash2, Loader2, FolderOpen, FolderArchive, X, CheckSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { downloadFilesAsZip } from "@/lib/downloadZip";
import { useToast } from "@/components/ui/use-toast";

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

export default function Files() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [zipping, setZipping] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => { base44.auth.me().then(setCurrentUser); }, []);

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

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.SharedFile.create({
        name: file.name,
        file_url,
        file_type: detectFileType(file),
        file_size: file.size,
        uploader_id: currentUser.id,
        uploader_name: currentUser.display_name || currentUser.full_name,
      });
      setUploading(false);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shared-files"] }),
    onError: () => setUploading(false),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SharedFile.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shared-files"] }),
  });

  const filtered = files.filter(f => {
    if (typeFilter !== "all" && f.file_type !== typeFilter) return false;
    return (f.name || "").toLowerCase().includes(search.toLowerCase());
  });

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && currentUser) uploadMutation.mutate(file);
    e.target.value = "";
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading font-bold">Files</h1>
            <p className="text-sm text-muted-foreground">Share music, sessions, art & more</p>
          </div>
          <div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
            <Button className="rounded-xl bg-primary hover:bg-primary/90" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload File
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search files..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-0 rounded-xl" />
          </div>
          <Tabs value={typeFilter} onValueChange={setTypeFilter}>
            <TabsList className="bg-secondary/50">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="audio">Audio</TabsTrigger>
              <TabsTrigger value="image">Images</TabsTrigger>
              <TabsTrigger value="session">Sessions</TabsTrigger>
              <TabsTrigger value="video">Video</TabsTrigger>
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
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-20">
            <FolderOpen className="w-12 h-12 opacity-30 mx-auto mb-3" />
            <p className="font-heading text-lg">No files yet</p>
            <p className="text-sm mt-1">Upload your first file to get started</p>
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
                  className={`bg-card rounded-xl border p-4 transition-all group ${isSelected ? "border-primary ring-1 ring-primary/40" : "border-border hover:border-primary/30"}`}
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
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          {file.file_size ? `${(file.file_size / 1024 / 1024).toFixed(1)} MB` : "—"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">•</span>
                        <span className="text-[10px] text-muted-foreground">{file.uploader_name || "Unknown"}</span>
                        <span className="text-[10px] text-muted-foreground">•</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(file.created_date), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                        <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                      {file.uploader_id === currentUser?.id && (
                        <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg text-destructive" onClick={() => deleteMutation.mutate(file.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}