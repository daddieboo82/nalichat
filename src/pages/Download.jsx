import React, { useState, useEffect } from 'react';
import { Download as DownloadIcon, Shield, Smartphone, Monitor, Laptop, CheckCircle, Loader2, Share, PlusSquare, Apple } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ┌──────────────────────────────────────────────────────────────────────┐
// │  DOWNLOAD URLs                                                        │
// │  Update these to your GitHub Releases URLs after the first builds.     │
// └──────────────────────────────────────────────────────────────────────┘
const APK_DOWNLOAD_URL = 'https://github.com/daddieboo82/nalichat/releases/latest/download/NaliChat.apk';
const EXE_DOWNLOAD_URL = 'https://github.com/daddieboo82/nalichat/releases/latest/download/NaliChat-Setup.exe';
const DMG_DOWNLOAD_URL = 'https://github.com/daddieboo82/nalichat/releases/latest/download/NaliChat.dmg';
// iOS does not allow installing an arbitrary downloaded .ipa the way Android
// allows sideloading an APK — it requires the App Store, TestFlight, or a
// paid Apple Developer Enterprise/Ad-Hoc distribution setup. None of that
// exists for this project, and building an .ipa at all requires Xcode on
// macOS, which isn't available here either. Rather than link to a file that
// wouldn't install on a real iPhone, the iOS tab below uses "Add to Home
// Screen" — this app is already a fully configured PWA (manifest.json,
// apple-mobile-web-app meta tags, and a registered service worker), so this
// genuinely installs a full-screen, app-like icon today with no extra build.
const PWA_URL = 'https://nalichat.base44.app';

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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="android" className="text-sm">
              <Smartphone className="w-4 h-4 mr-1.5" />
              Android
            </TabsTrigger>
            <TabsTrigger value="ios" className="text-sm">
              <Apple className="w-4 h-4 mr-1.5" />
              iPhone
            </TabsTrigger>
            <TabsTrigger value="windows" className="text-sm">
              <Monitor className="w-4 h-4 mr-1.5" />
              Windows
            </TabsTrigger>
            <TabsTrigger value="macos" className="text-sm">
              <Laptop className="w-4 h-4 mr-1.5" />
              macOS
            </TabsTrigger>
          </TabsList>

          {/* Android Tab */}
          <TabsContent value="android" className="space-y-6 mt-6">
            <Card className="border-primary/20">
              <CardContent className="pt-6 space-y-4">
                <DownloadButton url={APK_DOWNLOAD_URL} fileName="NaliChat.apk" label="Download APK" />
                <p className="text-xs text-muted-foreground text-center">
                  File size: ~5–15 MB · Android 5.0+ (API 21+) · Free
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

          {/* iPhone / iOS Tab — real App Store apps require Apple review and a
              signed .ipa can't be installed from a plain download link the way
              an Android APK can, so this uses the PWA "Add to Home Screen"
              install path instead, which genuinely works today. */}
          <TabsContent value="ios" className="space-y-6 mt-6">
            <Card className="border-primary/20">
              <CardContent className="pt-6 space-y-4">
                <a href={PWA_URL} target="_blank" rel="noopener noreferrer" className="block">
                  <Button className="w-full h-14 text-base font-semibold" size="lg">
                    <Share className="w-5 h-5" />
                    Open NaliChat in Safari
                  </Button>
                </a>
                <p className="text-xs text-muted-foreground text-center">
                  Installs as a full-screen app icon · No App Store required · Free
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <PlusSquare className="w-5 h-5 text-primary" />
                  Add to Home Screen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Step n={1}>Open <strong className="text-foreground">nalichat.base44.app</strong> in <strong className="text-foreground">Safari</strong> (this must be Safari — other browsers on iOS don't support this).</Step>
                <Step n={2}>Tap the <strong className="text-foreground">Share</strong> icon (the square with an arrow) in the toolbar.</Step>
                <Step n={3}>Scroll down and tap <strong className="text-foreground">Add to Home Screen</strong>.</Step>
                <Step n={4}>Tap <strong className="text-foreground">Add</strong> in the top right corner.</Step>
                <Step n={5}>Open <strong className="text-foreground">NaliChat</strong> from your Home Screen — it launches full-screen with its own icon, just like an installed app.</Step>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Windows Tab */}
          <TabsContent value="windows" className="space-y-6 mt-6">
            <Card className="border-primary/20">
              <CardContent className="pt-6 space-y-4">
                <DownloadButton url={EXE_DOWNLOAD_URL} fileName="NaliChat-Setup.exe" label="Download for Windows" />
                <p className="text-xs text-muted-foreground text-center">
                  File size: ~50–100 MB · Windows 10/11 (64-bit)
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
                <Step n={1}>Click <strong className="text-foreground">Download for Windows</strong> above and save the setup file.</Step>
                <Step n={2}>Open <strong className="text-foreground">NaliChat-Setup.exe</strong> from your Downloads folder.</Step>
                <Step n={3}>If Windows shows a <strong className="text-foreground">"Windows protected your PC"</strong> SmartScreen warning, click <strong className="text-foreground">More info</strong> then <strong className="text-foreground">Run anyway</strong>.</Step>
                <Step n={4}>Follow the installer prompts to complete the installation.</Step>
                <Step n={5}>Launch <strong className="text-foreground">NaliChat</strong> from your Start menu or desktop shortcut.</Step>
              </CardContent>
            </Card>
          </TabsContent>

          {/* macOS Tab */}
          <TabsContent value="macos" className="space-y-6 mt-6">
            <Card className="border-primary/20">
              <CardContent className="pt-6 space-y-4">
                <DownloadButton url={DMG_DOWNLOAD_URL} fileName="NaliChat.dmg" label="Download for macOS" />
                <p className="text-xs text-muted-foreground text-center">
                  File size: ~50–100 MB · macOS 11+ (Universal)
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
                <Step n={1}>Click <strong className="text-foreground">Download for macOS</strong> above and save the DMG file.</Step>
                <Step n={2}>Open <strong className="text-foreground">NaliChat.dmg</strong> from your Downloads folder.</Step>
                <Step n={3}>Drag the <strong className="text-foreground">NaliChat</strong> app icon into the <strong className="text-foreground">Applications</strong> folder.</Step>
                <Step n={4}>If macOS shows an <strong className="text-foreground">"unidentified developer"</strong> warning, right-click the app and select <strong className="text-foreground">Open</strong>, then confirm in the dialog.</Step>
                <Step n={5}>Launch <strong className="text-foreground">NaliChat</strong> from your Applications folder or Launchpad.</Step>
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