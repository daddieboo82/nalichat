import React from 'react';
import { Smartphone, Monitor, ShieldCheck, Globe2, ArrowRight, ArrowLeft, Home, Download as DownloadIcon, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const WINDOWS_DOWNLOAD_URL = 'https://github.com/daddieboo82/nalichat/releases/download/1.0.0/NaliChat-Setup.exe';
const ANDROID_DOWNLOAD_URL = 'https://github.com/daddieboo82/nalichat/releases/download/1.0.0/NaliChat.apk';

export default function Download() {
  return (
    <div className="relative flex min-h-screen min-h-[100dvh] items-center justify-center bg-background px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(5rem,calc(env(safe-area-inset-top)+3rem))] text-foreground sm:py-12">
      <div className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] sm:left-6 sm:top-6">
        <Button asChild variant="outline" className="ui-hover min-h-11 rounded-xl border-border/70 bg-card/80 px-3 shadow-sm backdrop-blur sm:px-4">
          <Link to="/" aria-label="Back to Home"><ArrowLeft className="mr-2 h-4 w-4" /><Home className="mr-2 h-4 w-4" /><span>Home</span></Link>
        </Button>
      </div>

      <div className="w-full max-w-3xl space-y-6 text-center sm:space-y-8">
        <div className="space-y-4">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 glow-primary sm:h-20 sm:w-20 sm:rounded-3xl">
            <DownloadIcon className="h-10 w-10 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">Download NaliChat</h1>
          <p className="text-muted-foreground">Official NaliChat apps for Android and Windows.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="ui-surface rounded-3xl border-primary/20 bg-card/70 text-left backdrop-blur-xl">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center gap-3"><Smartphone className="h-7 w-7 text-primary" /><div><h2 className="font-heading text-xl font-bold">Android</h2><p className="text-sm text-muted-foreground">NaliChat for Android</p></div></div>
              <p className="text-sm leading-relaxed text-muted-foreground">Install the official Android app directly. Google Play updates use the signed AAB release pipeline.</p>
              <Button asChild className="ui-hover min-h-12 w-full rounded-xl font-semibold">
                <a href={ANDROID_DOWNLOAD_URL}><DownloadIcon className="mr-2 h-4 w-4" />Download Android APK<ExternalLink className="ml-2 h-4 w-4" /></a>
              </Button>
            </CardContent>
          </Card>

          <Card className="ui-surface rounded-3xl border-primary/20 bg-card/70 text-left backdrop-blur-xl">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center gap-3"><Monitor className="h-7 w-7 text-primary" /><div><h2 className="font-heading text-xl font-bold">Windows</h2><p className="text-sm text-muted-foreground">NaliChat desktop installer</p></div></div>
              <p className="text-sm leading-relaxed text-muted-foreground">Download the Windows installer for the full NaliChat desktop experience.</p>
              <Button asChild className="ui-hover min-h-12 w-full rounded-xl font-semibold">
                <a href={WINDOWS_DOWNLOAD_URL}><DownloadIcon className="mr-2 h-4 w-4" />Download for Windows<ExternalLink className="ml-2 h-4 w-4" /></a>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-muted/50 p-4 text-left text-sm leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
          <p>Use this page for official NaliChat downloads. Android store releases are signed for package <strong>com.nalichat</strong>.</p>
        </div>

        <Button asChild variant="outline" className="ui-hover min-h-12 rounded-xl font-semibold"><Link to="/"><Globe2 className="mr-2 h-4 w-4" />Continue in the web app<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
      </div>
    </div>
  );
}
