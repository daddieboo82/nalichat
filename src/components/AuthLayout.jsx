import React from "react";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen min-h-[100dvh] flex items-start sm:items-center justify-center overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] bg-background px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md py-2 sm:py-6">
        <div className="mb-7 text-center sm:mb-9">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-xl shadow-primary/20 ring-1 ring-primary/30">
            <Icon className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="ui-surface rounded-3xl border border-border/80 bg-card/90 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
          {children}
        </div>
        {footer && (
          <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
        )}
        <p className="mx-auto mt-5 max-w-sm text-center text-[11px] leading-relaxed text-muted-foreground/70">
          Copyright © 2026 nalibase. All rights reserved. All content, code, design, and other parts of this application are copyrighted. Copyright holder reference: b5hoWSbAnVafZZgu.
        </p>
      </div>
    </div>
  );
}
