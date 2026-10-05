import { useState, useEffect } from "react";
import { ExternalLink, Music, Wrench, GraduationCap, Truck, Plug, Briefcase } from "lucide-react";
import { base44 } from "@/api/base44Client";

const CATEGORY_META = {
  gear: { label: "Gear", icon: Wrench },
  plugins: { label: "Plugins & Software", icon: Plug },
  distribution: { label: "Distribution", icon: Truck },
  education: { label: "Learning", icon: GraduationCap },
  services: { label: "Services", icon: Briefcase },
  other: { label: "Resources", icon: Music },
};

export default function AffiliateLinksSection() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await base44.entities.AffiliateLink.filter(
          { active: true },
          { sort: "display_order", limit: 50 }
        );
        if (!cancelled) setLinks(page.items || []);
      } catch {
        // Affiliate links are non-critical — fail silently
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading || links.length === 0) return null;

  const grouped = links.reduce((acc, link) => {
    (acc[link.category] = acc[link.category] || []).push(link);
    return acc;
  }, {});

  return (
    <section className="ui-surface rounded-3xl border border-white/[0.06] bg-card/50 p-5 backdrop-blur-xl sm:p-8">
      <div className="mb-6">
        <h2 className="font-heading font-bold text-2xl sm:text-3xl">Creator Resources</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tools and services we recommend. NaliBase may earn a commission at no extra cost to you.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(grouped).map(([category, items]) => {
          const meta = CATEGORY_META[category] || CATEGORY_META.other;
          const Icon = meta.icon;
          return (
            <div key={category} className="space-y-3">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
                <Icon className="w-3.5 h-3.5" />
                {meta.label}
              </h3>
              {items.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  className="ui-hover block rounded-2xl border border-border bg-card/60 p-4 transition-all hover:border-primary/40 hover:bg-card/80"
                >
                  <div className="flex items-start gap-3">
                    {link.logo_url && (
                      <img src={link.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm truncate">{link.title}</p>
                        <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground" />
                      </div>
                      {link.description && (
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">{link.description}</p>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}