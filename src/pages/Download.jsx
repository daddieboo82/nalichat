import React from 'react';
import { Clock3, Smartphone, Monitor, Laptop, Shield, Globe2, ArrowRight, ArrowLeft, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Download() {
  return (
    <div className="relative flex min-h-screen min-h-[100dvh] items-center justify-center bg-background px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(5rem,calc(env(safe-area-inset-top)+3rem))] text-foreground sm:py-12">
      <div className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] sm:left-6 sm:top-6">
        <Button asChild variant="outline" className="ui-hover min-h-11 rounded-xl border-border/70 bg-card/80 px-3 shadow-sm backdrop-blur sm:px-4">
          <Link to="/" aria-label="Back to Home">
            <ArrowLeft className="mr-2 h-4 w-4" />
            <Home className="mr-2 h-4 w-4" />
            <span>Home</span>
          </Link>
        </Button>
      </div>

      <div className="w-full max-w-xl space-y-6 text-center sm:space-y-8">
        <div className="space-y-4">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 glow-primary sm:h-20 sm:w-20 sm:rounded-3xl">
            <Clock3 className="w-10 h-10 text-primary" />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">NaliChat Downloads</h1>
          <p className="text-muted-foreground">
            New NaliChat apps for Android, Windows, and macOS are being prepared now.
          </p>
        </div>

        <Card className="ui-surface rounded-3xl border-primary/20 bg-card/70 backdrop-blur-xl">
          <CardContent className="space-y-6 px-4 pb-6 pt-6 sm:px-6 sm:pb-8 sm:pt-8">
            <div>
              <p className="text-2xl font-heading font-bold">Coming Soon</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Downloads are temporarily unavailable while we finish and verify the latest builds.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
              <div className="ui-surface rounded-2xl border border-border/50 bg-muted/50 p-4">
                <Smartphone className="w-6 h-6 mx-auto mb-2 text-primary" />
                <span className="text-sm font-medium">Android</span>
              </div>
              <div className="ui-surface rounded-2xl border border-border/50 bg-muted/50 p-4">
                <Monitor className="w-6 h-6 mx-auto mb-2 text-primary" />
                <span className="text-sm font-medium">Windows</span>
              </div>
              <div className="ui-surface rounded-2xl border border-border/50 bg-muted/50 p-4">
                <Laptop className="w-6 h-6 mx-auto mb-2 text-primary" />
                <span className="text-sm font-medium">macOS</span>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-muted/50 p-4 text-left text-sm leading-relaxed text-muted-foreground">
              <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <p>
                We are verifying each installer before downloads reopen. Check back soon for the official NaliChat builds.
              </p>
            </div>
          </CardContent>
        </Card>

        <Button asChild className="ui-hover min-h-12 w-full rounded-xl font-semibold shadow-lg shadow-primary/10 sm:w-auto sm:px-6"><Link to="/"><Globe2 className="mr-2 h-4 w-4" />Continue in the web app<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>

        <p className="text-xs text-muted-foreground">
          The NaliChat web app remains available while native downloads are being prepared.
        </p>
      </div>
    </div>
  );
}
