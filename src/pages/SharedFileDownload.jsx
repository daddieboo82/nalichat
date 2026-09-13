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
    setState("downloading");
    try {
      await resumableDownload(file.file_url, file.name || "NaliChat-file");
      setState("ready");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl p-8 text-center shadow-xl">
        {state === "loading" ? (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
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
            <h1 className="text-2xl font-heading font-bold mb-2">{file?.name || "Shared file"}</h1>
            <p className="text-muted-foreground mb-6">Securely shared through NaliChat.</p>
            <Button onClick={download} disabled={state === "downloading"} className="w-full h-12">
              {state === "downloading"
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Download className="w-4 h-4 mr-2" />}
              {state === "downloading" ? "Downloading…" : "Download file"}
            </Button>
            {state === "error" && (
              <p className="text-sm text-destructive mt-4">Download failed. Please try again.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
