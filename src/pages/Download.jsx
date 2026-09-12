import React from 'react';
import { Clock3, Smartphone, Monitor, Laptop, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function Download() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full space-y-8 text-center">
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 glow-primary">
            <Clock3 className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-heading font-bold">NaliChat Downloads</h1>
          <p className="text-muted-foreground">
            New NaliChat apps for Android, Windows, and macOS are being prepared now.
          </p>
        </div>

        <Card className="border-primary/20">
          <CardContent className="pt-8 pb-8 space-y-6">
            <div>
              <p className="text-2xl font-heading font-bold">Coming Soon</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Downloads are temporarily unavailable while we finish and verify the latest builds.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-muted/50 p-4">
                <Smartphone className="w-6 h-6 mx-auto mb-2 text-primary" />
                <span className="text-sm font-medium">Android</span>
              </div>
              <div className="rounded-xl bg-muted/50 p-4">
                <Monitor className="w-6 h-6 mx-auto mb-2 text-primary" />
                <span className="text-sm font-medium">Windows</span>
              </div>
              <div className="rounded-xl bg-muted/50 p-4">
                <Laptop className="w-6 h-6 mx-auto mb-2 text-primary" />
                <span className="text-sm font-medium">macOS</span>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4 text-left text-sm text-muted-foreground">
              <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <p>
                We are verifying each installer before downloads reopen. Check back soon for the official NaliChat builds.
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          The NaliChat web app remains available while native downloads are being prepared.
        </p>
      </div>
    </div>
  );
}
