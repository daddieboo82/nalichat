import React, { useState, useEffect } from 'react';
import { Download as DownloadIcon, Shield, Smartphone, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ┌──────────────────────────────────────────────────────────────────────┐
// │  APK DOWNLOAD URL                                                     │
// │  Update this to your GitHub Releases URL after the first build.       │
// │  Pattern: https://github.com/<owner>/<repo>/releases/latest/download/app-release.apk
// └──────────────────────────────────────────────────────────────────────┘
const APK_DOWNLOAD_URL = 'https://github.com/nalichat/nalichat/releases/latest/download/app-release.apk';

export default function Download() {
  const [apkUrl, setApkUrl] = useState(APK_DOWNLOAD_URL);
  const [checking, setChecking] = useState(true);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    // Check if the APK is available (HEAD request)
    fetch(APK_DOWNLOAD_URL, { method: 'HEAD', redirect: 'follow' })
      .then(res => {
        setAvailable(res.ok);
        if (res.ok && res.url) setApkUrl(res.url);
      })
      .catch(() => setAvailable(false))
      .finally(() => setChecking(false));
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 glow-primary">
            <Smartphone className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-heading font-bold">Download NaliChat for Android</h1>
          <p className="text-muted-foreground">
            Get the NaliChat app directly on your Android device — no Play Store required.
          </p>
        </div>

        {/* Download Button */}
        <Card className="border-primary/20">
          <CardContent className="pt-6 space-y-4">
            {checking ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : available ? (
              <>
                <div className="flex items-center gap-2 text-sm text-green-500">
                  <CheckCircle className="w-4 h-4" />
                  <span>Latest build is ready to download</span>
                </div>
                <a href={apkUrl} download="nalichat.apk" className="block">
                  <Button className="w-full h-14 text-base font-semibold" size="lg">
                    <DownloadIcon className="w-5 h-5" />
                    Download APK
                  </Button>
                </a>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-yellow-500">
                  <AlertTriangle className="w-4 h-4" />
                  <span>APK is being built — check back soon</span>
                </div>
                <a href={apkUrl} className="block">
                  <Button className="w-full h-14 text-base font-semibold" size="lg" variant="outline">
                    <DownloadIcon className="w-5 h-5" />
                    Try Download
                  </Button>
                </a>
              </>
            )}
            <p className="text-xs text-muted-foreground text-center">
              File size: ~5–15 MB · Android 5.0+ (API 21+)
            </p>
          </CardContent>
        </Card>

        {/* Install Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              How to Install
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</span>
              <p>Tap <strong className="text-foreground">Download APK</strong> above and wait for the download to finish.</p>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</span>
              <p>Open the downloaded file. If prompted, allow <strong className="text-foreground">"Install from unknown sources"</strong> in your browser or file manager settings.</p>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">3</span>
              <p>Tap <strong className="text-foreground">Install</strong> and wait for the installation to complete.</p>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">4</span>
              <p>Open <strong className="text-foreground">NaliChat</strong> from your app drawer and start creating!</p>
            </div>
          </CardContent>
        </Card>

        {/* Safety Note */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <p>
            This APK is built and signed directly from our CI/CD pipeline. It is safe to install.
            For the best experience, we recommend the Google Play Store version when available.
          </p>
        </div>
      </div>
    </div>
  );
}