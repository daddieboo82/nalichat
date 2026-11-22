import { useEffect, useState } from "react";
import { Download, FileText, Loader2, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { resumableDownload } from "@/lib/resumableUpload";

async function tokenFingerprint(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

export default function SharedFileDownload() {
  const params = new URLSearchParams(window.location.search);
  const fileId = params.get("id");
  const token = params.get("token");
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let active = true;
    if (!fileId || !token) {
      setState("invalid");
      return () => { active = false; };
    }

    Promise.all([base44.functions.invoke("getSharedFileByToken", { fileId, token }), tokenFingerprint(token)])
      .then(([res, expectedFingerprint]) => {
        if (!active) return;
        const sharedFile = res?.data?.file;
        if (
          res?.data?.success !== true ||
          res?.data?.action !== "get_shared_file_by_token" ||
          res?.data?.fileId !== fileId ||
          res?.data?.tokenFingerprint !== expectedFingerprint ||
          sharedFile?.id !== fileId ||
          typeof sharedFile?.file_url !== "string" ||
          !sharedFile.file_url.trim() ||
          typeof sharedFile?.name !== "string" ||
          !sharedFile.name.trim()
        ) throw new Error("Shared file not found");
        setFile(sharedFile);
        setState("ready");
      })
      .catch(() => {
        if (active) setState("invalid");
      });

    return () => { active = false; };
  }, [fileId, token]);

  const download = async () => {
    if (!file) return;
    setProgress(null);
    setState("downloading");
    try {
      const refreshUrl = async () => {
        const res = await base44.functions.invoke("getSharedFileByToken", { fileId, token });
        const refreshed = res?.data?.file;
        if (
          res?.data?.success !== true ||
          res?.data?.action !== "get_shared_file_by_token" ||
          res?.data?.fileId !== fileId ||
          typeof refreshed?.file_url !== "string" ||
          !refreshed.file_url.trim()
        ) throw new Error("Could not refresh download authorization.");
        return refreshed.file_url;
      };
      await resumableDownload(refreshUrl, file.name || "NaliBase-file", setProgress);
      setState("ready");
    } catch {
      setState("error");
    }
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-6">
      <div className="w-full min-w-0 max-w-md rounded-2xl border border-border bg-card p-5 text-center shadow-xl sm:p-8">
        {state === "loading" ? (
          <>
            <Loader2 className="mx-auto mb-3 h-8 w-8 motion-safe:animate-spin text-primary" />
            <h1 className="text-2xl font-heading font-bold">Loading shared file…</h1>
          </>
        ) : state === "invalid" ? (
          <>
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-heading font-bold mb-2">Share link unavailable</h1>
            <p className="text-muted-foreground">This link is invalid, expired, or has been replaced by the sender.</p>
          </>
        ) : (
          <>
            <ShieldCheck className="w-12 h-12 text-primary mx-auto mb-4" />
            <h1 className="mb-2 break-words font-heading text-xl font-bold sm:text-2xl">{file?.name || "Shared file"}</h1>
            <p className="text-muted-foreground mb-6">Shared through NaliBase.</p>
            <Button onClick={download} disabled={state === "downloading"} className="h-12 w-full rounded-xl font-semibold">
              {state === "downloading"
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Download className="w-4 h-4 mr-2" />}
              {state === "downloading" ? "Downloading…" : state === "error" ? "Retry download" : "Download file"}
            </Button>
            {state === "downloading" && (
              <div className="mt-3">
                <progress aria-label="Download progress" max={100} value={progress ?? undefined} className="h-2 w-full accent-primary" />
                {progress !== null && <p className="mt-1 text-xs tabular-nums text-muted-foreground">{progress}%</p>}
              </div>
            )}
            {state === "error" && (
              <p role="alert" className="mt-4 text-sm text-destructive">Download failed. You can try again.</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
