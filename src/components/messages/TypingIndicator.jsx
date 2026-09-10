export default function TypingIndicator({ reduceMotion = false }) {
  const animationClass = reduceMotion ? "" : "animate-bounce";
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      <div className={`w-1.5 h-1.5 rounded-full bg-muted-foreground/60 ${animationClass}`} style={{ animationDelay: "0ms" }} />
      <div className={`w-1.5 h-1.5 rounded-full bg-muted-foreground/60 ${animationClass}`} style={{ animationDelay: "150ms" }} />
      <div className={`w-1.5 h-1.5 rounded-full bg-muted-foreground/60 ${animationClass}`} style={{ animationDelay: "300ms" }} />
    </div>
  );
}