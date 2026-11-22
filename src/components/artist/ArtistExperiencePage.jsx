import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowLeft, ArrowRight } from "lucide-react";

/**
 * Shared shell for the Nali Artist Experience pages: back link, themed header
 * and a grid of destination cards. Keeps every page on the same tokens.
 */
export default function ArtistExperiencePage({ title, description, actions = [] }) {
  const navigate = useNavigate();

  return (
    <div className="nali-artist-experience min-h-full overflow-y-auto bg-background px-4 pb-24 pt-6 text-foreground">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => navigate("/artist-career-os")}
          className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} /> Artist Career OS
        </button>

        <header className="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-primary/15 via-card/60 to-accent/10 p-6 sm:p-7">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.24em] text-primary">
            <Sparkles size={16} /> Nali Artist Experience
          </div>
          <h1 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </header>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {actions.map(({ label, to }) => (
            <button
              key={`${to}-${label}`}
              onClick={() => navigate(to)}
              className="ui-surface ui-hover group min-h-12 rounded-2xl p-5 text-left transition-colors hover:border-primary/40"
            >
              <div className="font-heading text-lg font-black">{label}</div>
              <div className="nali-artist-action-caption mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
                Open
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}