import { Button } from "@/components/ui/button";
import { Twitter, Facebook, Link2, Instagram } from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboard";

export default function ShareButtons({ url, text }) {
  const copy = () => {
    copyToClipboard(url);
    toast.success("Link copied — paste it anywhere!");
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        size="icon"
        variant="outline"
        className="rounded-full"
        onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank")}
        title="Share on X"
      >
        <Twitter className="w-4 h-4" />
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="rounded-full"
        onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank")}
        title="Share on Facebook"
      >
        <Facebook className="w-4 h-4" />
      </Button>
      <Button size="icon" variant="outline" className="rounded-full" onClick={copy} title="Copy link for Instagram / TikTok">
        <Instagram className="w-4 h-4" />
      </Button>
      <Button size="icon" variant="outline" className="rounded-full" onClick={copy} title="Copy link">
        <Link2 className="w-4 h-4" />
      </Button>
    </div>
  );
}