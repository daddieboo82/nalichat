import { useState, useRef } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { resumableUpload } from "@/lib/resumableUpload";
import { UploadCloud, FileText, CheckCircle2, Lock } from "lucide-react";
import { Link } from "react-router-dom";

export default function LargeFileTransfer({ currentUser }) {
  const { isPro } = useSubscription();
  const [file, setFile] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const fileInputRef = useRef(null);

  const MAX_FREE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
  const MAX_PRO_SIZE = 20 * 1024 * 1024 * 1024; // 20GB

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const maxSize = isPro ? MAX_PRO_SIZE : MAX_FREE_SIZE;
    if (selectedFile.size > maxSize) {
      toast.error(`File is too large. Max size is ${isPro ? "20GB" : "2GB"}.`);
      return;
    }

    setFile(selectedFile);
    setShareLink("");
    setUploadProgress(0);
  };

  const handleTransfer = async () => {
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 1. Resumable Upload
      const file_url = await resumableUpload(file, (progress) => {
        setUploadProgress(progress);
      });

      // 2. Create SharedFile record
      const newFile = await base44.entities.SharedFile.create({
        name: file.name,
        file_url,
        file_type: file.type.startsWith("audio") ? "audio" : file.type.startsWith("video") ? "video" : "other",
        file_size: file.size,
        uploader_id: currentUser.id,
        uploader_name: currentUser.display_name || currentUser.full_name,
        description: message,
      });

      // 3. Generate Link
      const link = `${window.location.origin}/files?download=${newFile.id}`;
      setShareLink(link);

      if (recipientEmail) {
        toast.success(`Transfer complete! Tell ${recipientEmail} to check their messages, or share the link directly.`);
      } else {
        toast.success("Upload complete! You can now share the link.");
      }

    } catch (error) {
      console.error(error);
      toast.error("Transfer failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-6 bg-card rounded-2xl border border-border shadow-xl overflow-hidden flex flex-col md:flex-row">
      {/* Left side: Form */}
      <div className="flex-1 p-6 md:p-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold font-heading mb-1">Transfer Large Files</h2>
          <p className="text-sm text-muted-foreground">Resume uploads anytime. {isPro ? "Up to 20GB limit." : "Up to 2GB limit."}</p>
        </div>

        {!isPro && (
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-primary" />
              <div className="text-sm">
                <p className="font-semibold text-primary">Need more space?</p>
                <p className="text-muted-foreground text-xs">Send up to 20GB per file with Pro</p>
              </div>
            </div>
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-white">
              <Link to="/pricing">Upgrade</Link>
            </Button>
          </div>
        )}

        {shareLink ? (
          <div className="space-y-6 text-center py-8">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <div>
              <h3 className="text-xl font-bold mb-2">You're done!</h3>
              <p className="text-muted-foreground mb-6">Your transfer is complete and ready to share.</p>
              <div className="flex gap-2">
                <Input value={shareLink} readOnly className="bg-secondary/50" />
                <Button onClick={() => {
                  navigator.clipboard.writeText(shareLink);
                  toast.success("Link copied!");
                }}>Copy</Button>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => {
              setFile(null);
              setShareLink("");
              setRecipientEmail("");
              setMessage("");
              setUploadProgress(0);
            }}>Send another file</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div 
              className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer bg-secondary/20"
              onClick={() => fileInputRef.current?.click()}
            >
              <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
              {file ? (
                <>
                  <FileText className="w-10 h-10 text-primary mb-3" />
                  <p className="font-medium text-sm truncate max-w-[250px]">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </>
              ) : (
                <>
                  <UploadCloud className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="font-medium text-sm">Click to select a file</p>
                  <p className="text-xs text-muted-foreground mt-1">Or drag and drop</p>
                </>
              )}
            </div>

            <Input 
              placeholder="Email to (optional)" 
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="bg-secondary/50"
            />
            
            <Textarea 
              placeholder="Message (optional)" 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="bg-secondary/50 resize-none h-24"
            />

            {isUploading ? (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span>Uploading...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-[10px] text-muted-foreground text-center">You can safely pause or close—uploads resume automatically.</p>
              </div>
            ) : (
              <Button 
                className="w-full h-12 text-lg font-medium bg-primary hover:bg-primary/90 text-white rounded-xl"
                onClick={handleTransfer}
                disabled={!file}
              >
                Transfer
              </Button>
            )}
          </div>
        )}
      </div>
      
      {/* Right side: Fancy graphic */}
      <div className="hidden md:flex md:w-2/5 bg-secondary/30 items-center justify-center relative overflow-hidden p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10" />
        <div className="relative z-10 text-center">
          <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
            <UploadCloud className="w-12 h-12 text-primary animate-pulse" />
          </div>
          <h3 className="font-heading font-bold text-2xl mb-3">Fast, secure, resumable.</h3>
          <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">Share your largest sessions and stems without a hitch. Resumes automatically if your connection drops.</p>
        </div>
      </div>
    </div>
  );
}