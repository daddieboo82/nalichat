import { useRef } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { getCategoryMeta } from "@/lib/relaxConfig";
import MediaCard from "./MediaCard";

export default function MediaRow({ categoryKey, items, onOpen, isAdmin, onEdit, onDelete, onAdd }) {
  const scroller = useRef(null);
  const meta = getCategoryMeta(categoryKey);
  const Icon = meta.icon;

  const scroll = (dir) => {
    scroller.current?.scrollBy({ left: dir * 600, behavior: "smooth" });
  };

  if (!items.length && !isAdmin) return null;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4 px-4 sm:px-8">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-xl text-foreground">{meta.label}</h2>
            <p className="text-xs text-muted-foreground">{meta.blurb}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => onAdd(categoryKey)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-secondary hover:bg-primary hover:text-primary-foreground text-foreground px-3 py-1.5 rounded-full transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          )}
          <button onClick={() => scroll(-1)} className="w-8 h-8 rounded-full bg-secondary hover:bg-primary/20 flex items-center justify-center transition-colors" aria-label="Scroll left">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => scroll(1)} className="w-8 h-8 rounded-full bg-secondary hover:bg-primary/20 flex items-center justify-center transition-colors" aria-label="Scroll right">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div ref={scroller} className="flex gap-4 overflow-x-auto px-4 sm:px-8 pb-4 scrollbar-none scroll-smooth">
        {items.length === 0 ? (
          <button
            onClick={() => onAdd(categoryKey)}
            className="shrink-0 w-44 sm:w-52 aspect-[2/3] rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="w-8 h-8 mb-2" />
            <span className="text-sm font-semibold">Add first item</span>
          </button>
        ) : (
          items.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              onOpen={onOpen}
              isAdmin={isAdmin}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}