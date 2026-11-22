import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { resumableUpload } from "@/lib/resumableUpload";
import { UploadCloud, FileText, CheckCircle2, Copy } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";

function LargeFileTransferContent({ currentUser }) {
  const [file, setFile] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [controlBusy, setControlBusy] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const attemptRef = useRef(0);
  const fileInputRef = useRef(null);
  const transferRef = useRef(null);
  useEffect(() => () => {
    attemptRef.current += 1;
    const transfer = transferRef.current;
    if (transfer) void (async () => {
      try { await transfer.pause(); } catch {}
    })();
  }, []);

  const finishing = isFinalizing || uploadProgress >= 100;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    e.target.value = "";
    if (busyRef.current) return;
    if (!selectedFile) return;

    if (!selectedFile.name || selectedFile.size <= 0) {
      setError("The selected file is empty or invalid.");
      return;
    }

    setError("");
    setFile(selectedFile);
    setShareLink("");
    setUploadProgress(0);
  };

  const handleTransfer = async (event) => {
    event.preventDefault();
    if (busyRef.current || !currentUser?.id) return;
    if (!file) {
      toast.error("Please select a file to transfer.");
      return;
    }
    busyRef.current = true;
    const attempt = ++attemptRef.current;
    setError("");
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 1. Resumable Upload
      const transferPromise = resumableUpload(file, (progress) => {
        if (attempt === attemptRef.current) setUploadProgress(progress);
      });
      transferRef.current = transferPromise.controller;
      const transfer = await transferPromise;
      if (attempt !== attemptRef.current) return;
      transferRef.current = null;
      setIsFinalizing(true);
      const file_url = transfer?.file_url;
      if (!file_url) throw new Error("Transfer verification returned no download URL.");

      // 2. Create SharedFile record
      const created = await base44.functions.invoke("createSharedFileRecord", {
        name: file.name,
        file_url,
        storage_provider: "supabase",
        storage_bucket: transfer.bucket,
        storage_path: transfer.objectPath,
        file_type: file.type.startsWith("audio") ? "audio" : file.type.startsWith("video") ? "video" : "other",
        file_size: file.size,
        description: message,
      });
      if (attempt !== attemptRef.current) return;
      if (created?.data?.error) throw new Error(created.data.error);
      const newFile = created.data.file;
      if (
        created?.data?.success !== true ||
        created?.data?.action !== "create_shared_file" ||
        created?.data?.userId !== currentUser?.id ||
        created?.data?.fileId !== newFile?.id ||
        newFile?.uploader_id !== currentUser?.id
      ) throw new Error("Shared file creation was not confirmed.");

      // 3. Generate a tokenized public link. The file record itself is not
      // globally readable.
      const share = await base44.functions.invoke("createFileShareLink", { fileId: newFile.id });
      if (attempt !== attemptRef.current) return;
      const token = share?.data?.token;
      const expiresAt = share?.data?.expires_at;
      const expiresAtMs = typeof expiresAt === "string" ? Date.parse(expiresAt) : NaN;
      if (
        share?.data?.success !== true ||
        share?.data?.action !== "create_file_share_link" ||
        share?.data?.userId !== currentUser?.id ||
        share?.data?.fileId !== newFile.id ||
        typeof token !== "string" ||
        !/^[0-9a-f]{64}$/i.test(token) ||
        !Number.isFinite(expiresAtMs) ||
        expiresAtMs <= Date.now()
      ) throw new Error("Could not create share link");
      const link = `${window.location.origin}/shared-file?id=${encodeURIComponent(newFile.id)}&token=${encodeURIComponent(token)}`;
      setShareLink(link);
      setExpiresAt(expiresAt);

      if (recipientEmail) {
        toast.success(`Upload complete! Copy the link and send it to ${recipientEmail}.`);
      } else {
        toast.success("Upload complete! You can now share the link.");
      }

    } catch (error) {
      if (attempt === attemptRef.current) {
        console.error(error);
        setError("Transfer could not finish. Try again, or check My files if the upload already completed.");
      }
    } finally {
      if (attempt === attemptRef.current) {
        transferRef.current = null;
        busyRef.current = false;
        setIsUploading(false);
        setIsPaused(false);
        setIsFinalizing(false);
        setControlBusy(false);
      }
    }
  };

  const togglePause = async () => {
    const transfer = transferRef.current;
    if (!transfer || controlBusy || finishing) return;
    const attempt = attemptRef.current;
    setControlBusy(true);
    setError("");
    try {
      if (isPaused) await transfer.resume();
      else await transfer.pause();
      if (attempt === attemptRef.current) setIsPaused(!isPaused);
    } catch {
      if (attempt === attemptRef.current) setError("Could not change the upload state. Try again.");
    } finally {
      if (attempt === attemptRef.current) setControlBusy(false);
    }
  };

  const cancelTransfer = async () => {
    const transfer = transferRef.current;
    if (!transfer || controlBusy || finishing) return;
    attemptRef.current += 1;
    const attempt = attemptRef.current;
    transferRef.current = null;
    setControlBusy(true);
    setError("");
    try {
      await transfer.cancel();
      if (attempt === attemptRef.current) toast.info("Transfer cancelled.");
    } catch {
      if (attempt === attemptRef.current) setError("The upload was stopped here, but storage did not confirm cancellation.");
    } finally {
      if (attempt === attemptRef.current) {
        busyRef.current = false;
        setControlBusy(false);
        setIsUploading(false);
        setIsPaused(false);
        setUploadProgress(0);
      }
    }
  };

  function resetTransfer() {
    setFile(null);
    setShareLink("");
    setExpiresAt("");
    setRecipientEmail("");
    setMessage("");
    setUploadProgress(0);
    setError("");
  }

  return (
    <section className="mx-auto my-3 max-w-xl space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="nali-transfer-title">
      <header className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <UploadCloud className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 id="nali-transfer-title" className="font-heading text-2xl font-bold tracking-tight">Nali Transfer</h2>
          <p className="mt-1 text-sm text-muted-foreground">Upload a file and get a shareable download link.</p>
        </div>
      </header>

      {shareLink ? (
        <div className="space-y-3 rounded-xl border border-border bg-background p-3 sm:p-4">
          <p role="status" className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" /> Download link ready
          </p>
          <p className="break-words text-sm text-muted-foreground">{file?.name}</p>
          <label className="block text-sm font-medium">Share link
            <Input value={shareLink} readOnly onFocus={event => event.target.select()} className="mt-1 min-h-11 text-base sm:text-sm" />
          </label>
          <p className="text-xs text-muted-foreground">
            Anyone with the link can download the file until {new Date(expiresAt).toLocaleString()}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="min-h-11 flex-1 gap-2 rounded-xl" onClick={async () => {
              const copied = await copyToClipboard(shareLink);
              if (copied) toast.success("Link copied!");
              else toast.error("Couldn't copy the link. Please copy it manually.");
            }}><Copy className="h-4 w-4" aria-hidden="true" /> Copy link</Button>
            <Button type="button" variant="outline" className="min-h-11 flex-1 rounded-xl" onClick={resetTransfer}>Send another file</Button>
          </div>
          {recipientEmail && <p className="break-words text-xs text-muted-foreground">Copy the link and send it to {recipientEmail}.</p>}
        </div>
      ) : (
        <form onSubmit={handleTransfer} className="space-y-4">
          <label className="relative flex min-h-24 cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-border bg-background p-3 hover:border-primary/50 focus-within:ring-2 focus-within:ring-primary">
            <input type="file" aria-label={file ? "Replace transfer file" : "Choose transfer file"} className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default" ref={fileInputRef} onChange={handleFileChange} disabled={isUploading} />
            {file ? <FileText className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" /> : <UploadCloud className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />}
            <span className="min-w-0">
              <span className="block break-words text-sm font-semibold">{file ? file.name : "Choose a file"}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "No NaliBase file-size limit"}</span>
            </span>
          </label>
          {!isUploading && (
            <details className="rounded-xl border border-border px-3">
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Optional transfer details</summary>
              <div className="space-y-3 pb-3">
                <label className="block text-sm font-medium">Recipient email
                  <Input type="email" value={recipientEmail} onChange={event => setRecipientEmail(event.target.value)} className="mt-1 min-h-11 text-base sm:text-sm" />
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">For reference. NaliBase does not email the link automatically.</span>
                </label>
                <label className="block text-sm font-medium">File description
                  <Textarea value={message} onChange={event => setMessage(event.target.value)} className="mt-1 text-base sm:text-sm" />
                </label>
              </div>
            </details>
          )}

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {isUploading ? (
            <div className="space-y-3 rounded-xl border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-2 text-sm font-medium">
                <p role="status">{finishing ? "Preparing download link…" : isPaused ? "Upload paused" : "Uploading…"}</p>
                <span className="tabular-nums">{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} aria-label="File upload progress" className="h-2" />
              {!finishing && (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="min-h-11 flex-1 rounded-xl" disabled={controlBusy} onClick={togglePause}>{isPaused ? "Resume" : "Pause"}</Button>
                  <Button type="button" variant="ghost" className="min-h-11 flex-1 rounded-xl text-destructive" disabled={controlBusy} onClick={cancelTransfer}>Cancel</Button>
                </div>
              )}
            </div>
          ) : (
            <Button type="submit" className="min-h-12 w-full rounded-xl font-semibold" disabled={!file || !currentUser?.id}>Upload and create link</Button>
          )}
        </form>
      )}
    </section>
  );
}

export default function LargeFileTransfer({ currentUser }) {
  return <LargeFileTransferContent key={currentUser?.id || "anonymous"} currentUser={currentUser} />;
}
