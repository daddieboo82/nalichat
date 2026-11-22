export default function SectionLinks({ label, sections }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {sections.map(([id, title]) => (
        <a
          key={id}
          href={`#${id}`}
          onClick={event => {
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            const target = document.getElementById(id);
            if (!target) return;
            event.preventDefault();
            target.focus({ preventScroll: true });
            target.scrollIntoView({ block: "start" });
          }}
          className="inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {title}
        </a>
      ))}
    </nav>
  );
}
