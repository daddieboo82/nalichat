import React, { useState, useEffect } from 'react';
import { Download as DownloadIcon, Shield, Smartphone, Apple, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ┌──────────────────────────────────────────────────────────────────────┐
// │  DOWNLOAD URLs                                                        │
// │  Update these to your GitHub Releases URLs after the first builds.     │
// │  APK: https://github.com/<owner>/<repo>/releases/latest/download/app-release.apk
// │  IPA: https://github.com/<owner>/<repo>/releases/latest/download/nalichat.ipa
// └──────────────────────────────────────────────────────────────────────┘
const APK_DOWNLOAD_URL = 'https://github.com/nalichat/nalichat/releases/latest/download/app-release.apk';
const IPA_DOWNLOAD_URL = 'https://github.com/nalichat/nalichat/releases/latest/download/nalichat.ipa';

function useAvailability(url) {
  const [state, setState] = useState({ checking: true, available: false, finalUrl: url });
  useEffect(() => {
    fetch(url, { method: 'HEAD', redirect: 'follow' })
      .then(res => {
        setState({ checking: false, available: res.ok, finalUrl: res.ok && res.url ? res.url : url });
      })
      .catch(() => setState({ checking: false, available: false, finalUrl: url }));
  }, [url]);
  return state;
}

function DownloadButton({ url, fileName, label }) {
  const { checking, available, finalUrl } = useAvailability(url);
  if (checking) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (available) {
    return (
      <>
        <div className="flex items-center gap-2 text-sm text-green-500">
          <CheckCircle className="w-4 h-4" />
          <span>Latest build is ready to download</span>
        </div>
        <a href={finalUrl} download={fileName} className="block">
          <Button className="w-full h-14 text-base font-semibold" size="lg">
            <DownloadIcon className="w-5 h-5" />
            {label}
          </Button>
        </a>
      </>
    );
  }
  return (
    <>
      <div className="flex items-center gap-2 text-sm text-yellow-500">
        <AlertTriangle className="w-4 h-4" />
        <span>Build is in progress — check back soon</span>
      </div>
      <a href={finalUrl} className="block">
        <Button className="w-full h-14 text-base font-semibold" size="lg" variant="outline">
          <DownloadIcon className="w-5 h-5" />
          {label}
        </Button>
      </a>
    </>
  );
}

function Step({ n, children }) {
  return (
    <div className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">{n}</span>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}

export default function Download() {
  const [platform, setPlatform] = useState('android');

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 glow-primary">
            <Smartphone className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-heading font-bold">Download NaliChat</h1>
          <p className="text-muted-foreground">
            Get the NaliChat app directly on your device — no app store required.
          </p>
        </div>

        <Tabs value={platform} onValueChange={setPlatform}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="android" className="text-sm">
              <Smartphone className="w-4 h-4 mr-1.5" />
              Android
            </TabsTrigger>
            <TabsTrigger value="ios" className="text-sm">
              <Apple className="w-4 h-4 mr-1.5" />
              iOS
            </TabsTrigger>
          </TabsList>

          {/* Android Tab */}
          <TabsContent value="android" className="space-y-6 mt-6">
            <Card className="border-primary/20">
              <CardContent className="pt-6 space-y-4">
                <DownloadButton url={APK_DOWNLOAD_URL} fileName="nalichat.apk" label="Download APK" />
                <p className="text-xs text-muted-foreground text-center">
                  File size: ~5–15 MB · Android 5.0+ (API 21+)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  How to Install
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Step n={1}>Tap <strong className="text-foreground">Download APK</strong> above and wait for the download to finish.</Step>
                <Step n={2}>Open the downloaded file. If prompted, allow <strong className="text-foreground">"Install from unknown sources"</strong> in your browser or file manager settings.</Step>
                <Step n={3}>Tap <strong className="text-foreground">Install</strong> and wait for the installation to complete.</Step>
                <Step n={4}>Open <strong className="text-foreground">NaliChat</strong> from your app drawer and start creating!</Step>
              </CardContent>
            </Card>
          </TabsContent>

          {/* iOS Tab */}
          <TabsContent value="ios" className="space-y-6 mt-6">
            <Card className="border-primary/20">
              <CardContent className="pt-6 space-y-4">
                <DownloadButton url={IPA_DOWNLOAD_URL} fileName="nalichat.ipa" label="Download IPA" />
                <p className="text-xs text-muted-foreground text-center">
                  File size: ~15–30 MB · iOS 14.0+
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  How to Install (Sideload)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Step n={1}>Download the <strong className="text-foreground">IPA file</strong> to your computer (Mac or PC).</Step>
                <Step n={2}>Install a sideloading tool: <strong className="text-foreground">AltStore</strong> (altstore.io), <strong className="text-foreground">Sideloadly</strong>, or use <strong className="text-foreground">Apple Configurator 2</strong> (Mac only).</Step>
                <Step n={3}>Connect your iPhone via USB and open the sideloading tool. Select the downloaded <strong className="text-foreground">nalichat.ipa</strong> file and enter your Apple ID to sign it.</Step>
                <Step n={4}>On your iPhone, go to <strong className="text-foreground">Settings → General → VPN & Device Management</strong> and tap <strong className="text-foreground">Trust</strong> on your developer certificate.</Step>
                <Step n={5}>Open <strong className="text-foreground">NaliChat</strong> from your home screen and start creating!</Step>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Important Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Sideloading requires re-signing every <strong className="text-foreground">7 days</strong> with a free Apple ID, or <strong className="text-foreground">1 year</strong> with a paid Apple Developer account.</p>
                <p>• For the best iOS experience, use the <strong className="text-foreground">Add to Home Screen</strong> option in Safari for the PWA version — it works without re-signing.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Safety Note */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <p>
            All builds are signed directly from our CI/CD pipeline. They are safe to install.
            For the best experience, use the official app store version when available.
          </p>
        </div>
      </div>
    </div>
  );
}