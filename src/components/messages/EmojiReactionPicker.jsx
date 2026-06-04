import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";

const EMOJI_CATEGORIES = {
  smileys: { label: "😊 Smileys", emojis: ["😀", "😁", "😂", "🤣", "😃", "😄", "😅", "😆", "😉", "😊", "😇", "🙂", "🙃", "😌", "😍", "🥰", "😘", "😗", "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😌", "😑", "😐", "😏", "😒", "🙁", "☹️", "🥺", "😕", "😲", "😳", "🥵", "🥶", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺", "👻", "👽", "👾", "🤖"] },
  gestures: { label: "👋 Gestures", emojis: ["👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🤜", "🤛", "👊"] },
  hearts: { label: "❤️ Hearts", emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "❤️‍🔥", "❤️‍🩹", "💔", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"] },
  animals: { label: "🐶 Animals", emojis: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐒", "🐶", "🐱", "🐭", "🐹", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐜", "🪰", "🐢", "🐍", "🦎", "🦖", "🦕", "🦑", "🦐", "🦞", "🦀", "🦦", "🦧", "🐘", "🐪", "🦒", "🦓", "🦍", "🦎", "🐘", "🦏", "🦛", "🐂", "🐄", "🐎", "🐖", "🐏", "🐑", "🦉", "🦅", "🦆", "🦢", "🦜", "🦚", "🦃", "🦉", "🦅", "🦉", "🕊️", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐜", "🐢", "🐍", "🦎", "🦖", "🦕"] },
  food: { label: "🍕 Food", emojis: ["🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶️", "🌽", "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞", "🥓", "🥩", "🍗", "🍖", "🌭", "🍔", "🍟", "🍕", "🥪", "🥙", "🧆", "🌮", "🌯", "🥗", "🥘", "🥫", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🦪", "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🥮", "🍢", "🍡", "🍧", "🍨", "🍦", "🍰", "🎂", "🧁", "🍮", "🍭", "🍬", "🍫", "🍿", "🍩", "🍪", "🌰", "🍯", "🥛", "🍼", "☕", "🍵", "🍶", "🍾", "🍷", "🍸", "🍹", "🍺", "🍻", "🥂", "🥃"] },
  activities: { label: "⚽ Activities", emojis: ["⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎳", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "⛳", "⛸️", "🎣", "🎽", "🎿", "⛷️", "🏂", "🪂", "🛷", "🛹", "🛼", "🛺", "🏋️", "🏇", "🤺", "🤼", "🤸", "⛹️", "🤾", "🏌️", "🏄", "🏊", "🤽", "🚣", "🧗", "🚴", "🚵", "🎯", "🪃", "🪂", "🏹", "🎣", "🤿", "🥅", "⛳", "⛸️", "🎽", "🎿", "⛷️", "🏂", "🪂", "🛷", "🛹", "🛼", "🛺", "🏋️", "🏇", "🤺", "🤼", "🤸", "⛹️", "🤾", "🏌️", "🏄", "🏊", "🤽", "🚣", "🧗", "🚴", "🚵"] },
  objects: { label: "⌚ Objects", emojis: ["⌚", "📱", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🖲️", "🕹️", "🗜️", "💽", "💾", "💿", "📀", "📼", "📷", "📸", "📹", "🎥", "🎬", "📺", "📷", "📸", "📹", "🎥", "🎬", "📺", "🎞️", "📽️", "🎦", "📻", "🎙️", "🎚️", "🎛️", "⏱️", "⏲️", "⏰", "🕰️", "⌛", "⏳", "📡", "🔋", "🔌", "💡", "🔦", "🕯️", "🪔", "🧯", "🛢️", "💸", "💵", "💴", "💶", "💷", "💰", "💳", "🧾", "✉️", "📩", "📨", "📤", "📥", "📦", "🏷️", "🧧", "📪", "📫", "📬", "📭", "📮", "📯", "📜", "📃", "📄", "📑", "🧾", "🧻", "📖", "📕", "📗", "📘", "📙", "📚", "📓", "📔", "📒", "📑", "🧾", "📰", "🗞️", "📄", "📃", "📑", "🧾", "📋", "📅", "📆", "🗒️", "🗓️", "📇", "📈", "📉", "📊", "📐", "📏", "📌", "📍", "✂️", "🖇️", "📎", "🖇️", "📐", "📏", "🧮", "📓", "📔", "📒", "📊", "📉", "📈", "📕", "📗", "📘", "📙", "📚", "📖", "🧷", "🧵", "🧶", "🌀", "🧸", "📮", "📭", "📬", "📪", "🧦", "🧤", "🧣", "🎒", "👜", "💼", "👝", "🎓", "🎀", "🧢", "👒", "🥾", "👞", "👟", "🥿", "👠", "👡", "🩴", "🩰", "👢", "👑", "👔", "👕", "👖", "🧥", "🧤", "🧣", "🧦", "👗", "👘", "👚", "👕", "🩳", "🩱", "🥻", "🩲", "🩳", "🧵", "🧶", "⌚", "⏰", "⏱️", "⏲️"] },
  symbols: { label: "❤️ Symbols", emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "❤️‍🔥", "❤️‍🩹", "💔", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "💬", "👁️‍🗨️", "🗨️", "🗯️", "💭", "💤", "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "💅", "👂", "👃", "🧠", "🦷", "🦴", "👀", "👁️", "👅", "👄", "♠️", "♥️", "♦️", "♣️", "♠️", "🚀", "✈️", "🚁", "🛂", "🛫", "🛬", "💺", "🛰️", "🛶", "⛵", "🚤", "🛳️", "⛴️", "🛥️", "🛩️", "🛫", "🛬", "🚀", "✈️", "🚁", "🛂", "🛫", "🛬"] }
};

export default function EmojiReactionPicker({ onSelect, onClose, position = "top" }) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("smileys");

  const filteredEmojis = search.trim()
    ? Object.values(EMOJI_CATEGORIES)
        .flatMap(cat => cat.emojis)
        .filter((e, i, arr) => arr.indexOf(e) === i)
    : EMOJI_CATEGORIES[activeTab]?.emojis || [];

  return (
    <div className={cn(
      "absolute z-[60] bg-card border border-border/60 rounded-2xl shadow-2xl p-3 w-96 backdrop-blur-xl",
      position === "bottom" ? "bottom-full mb-2" : "top-full mt-2"
    )}>
      <div className="mb-3 flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground absolute left-5" />
        <input
          type="text"
          placeholder="Search emoji..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 bg-secondary/40 border border-border/40 rounded-xl text-sm focus:outline-none focus:border-primary/50 transition-colors"
          autoFocus
        />
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-secondary/60 transition-colors text-muted-foreground shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!search && (
        <TabsList className="w-full grid grid-cols-6 mb-3 h-8">
          {Object.entries(EMOJI_CATEGORIES).map(([key, { label }]) => (
            <TabsTrigger key={key} value={key} className="text-xs p-0 h-full rounded-lg">
              {label.split(" ")[0]}
            </TabsTrigger>
          ))}
        </TabsList>
      )}

      <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
        {filteredEmojis.map((emoji, i) => (
          <button
            key={i}
            onClick={() => { onSelect(emoji); onClose(); }}
            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-primary/20 rounded-lg transition-all hover:scale-110 active:scale-95"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}