import { useState } from "react";
// Removed Tabs dependency
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";

const EMOJI_CATEGORIES = {
  smileys: { label: "😊 Smileys", keywords: ["smile", "face", "happy", "sad", "laugh", "cry", "angry", "emoji"], emojis: ["😀", "😁", "😂", "🤣", "😃", "😄", "😅", "😆", "😉", "😊", "😇", "🙂", "🙃", "😌", "😍", "🥰", "😘", "😗", "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😌", "😑", "😐", "😏", "😒", "🙁", "☹️", "🥺", "😕", "😲", "😳", "🥵", "🥶", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺", "👻", "👽", "👾", "🤖"] },
  gestures: { label: "👋 Gestures", keywords: ["hand", "fingers", "wave", "point", "thumbs", "up", "down", "clap"], emojis: ["👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🤜", "🤛", "👊"] },
  hearts: { label: "❤️ Hearts", keywords: ["heart", "love", "like", "broken"], emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "❤️‍🔥", "❤️‍🩹", "💔", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"] },
  animals: { label: "🐶 Animals", keywords: ["dog", "cat", "animal", "pet", "wild", "bird", "bug"], emojis: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐒", "🐶", "🐱", "🐭", "🐹", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐜", "🪰", "🐢", "🐍", "🦎", "🦖", "🦕", "🦑", "🦐", "🦞", "🦀", "🦦", "🦧", "🐘", "🐪", "🦒", "🦓", "🦍", "🦎", "🐘", "🦏", "🦛", "🐂", "🐄", "🐎", "🐖", "🐏", "🐑", "🦉", "🦅", "🦆", "🦢", "🦜", "🦚", "🦃", "🦉", "🦅", "🦉", "🕊️", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐜", "🐢", "🐍", "🦎", "🦖", "🦕"] },
  food: { label: "🍕 Food", keywords: ["eat", "drink", "apple", "pizza", "burger", "coffee"], emojis: ["🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶️", "🌽", "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞", "🥓", "🥩", "🍗", "🍖", "🌭", "🍔", "🍟", "🍕", "🥪", "🥙", "🧆", "🌮", "🌯", "🥗", "🥘", "🥫", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🦪", "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🥮", "🍢", "🍡", "🍧", "🍨", "🍦", "🍰", "🎂", "🧁", "🍮", "🍭", "🍬", "🍫", "🍿", "🍩", "🍪", "🌰", "🍯", "🥛", "🍼", "☕", "🍵", "🍶", "🍾", "🍷", "🍸", "🍹", "🍺", "🍻", "🥂", "🥃"] },
  activities: { label: "⚽ Activities", keywords: ["sport", "play", "game", "ball", "run", "swim", "music"], emojis: ["⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎳", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "⛳", "⛸️", "🎣", "🎽", "🎿", "⛷️", "🏂", "🪂", "🛷", "🛹", "🛼", "🛺", "🏋️", "🏇", "🤺", "🤼", "🤸", "⛹️", "🤾", "🏌️", "🏄", "🏊", "🤽", "🚣", "🧗", "🚴", "🚵", "🎯", "🪃", "🪂", "🏹", "🎣", "🤿", "🥅", "⛳", "⛸️", "🎽", "🎿", "⛷️", "🏂", "🪂", "🛷", "🛹", "🛼", "🛺", "🏋️", "🏇", "🤺", "🤼", "🤸", "⛹️", "🤾", "🏌️", "🏄", "🏊", "🤽", "🚣", "🧗", "🚴", "🚵"] },
  objects: { label: "⌚ Objects", keywords: ["tech", "tool", "thing", "book", "clothes", "shoe"], emojis: ["⌚", "📱", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🖲️", "🕹️", "🗜️", "💽", "💾", "💿", "📀", "📼", "📷", "📸", "📹", "🎥", "🎬", "📺", "📷", "📸", "📹", "🎥", "🎬", "📺", "🎞️", "📽️", "🎦", "📻", "🎙️", "🎚️", "🎛️", "⏱️", "⏲️", "⏰", "🕰️", "⌛", "⏳", "📡", "🔋", "🔌", "💡", "🔦", "🕯️", "🪔", "🧯", "🛢️", "💸", "💵", "💴", "💶", "💷", "💰", "💳", "🧾", "✉️", "📩", "📨", "📤", "📥", "📦", "🏷️", "🧧", "📪", "📫", "📬", "📭", "📮", "📯", "📜", "📃", "📄", "📑", "🧾", "🧻", "📖", "📕", "📗", "📘", "📙", "📚", "📓", "📔", "📒", "📑", "🧾", "📰", "🗞️", "📄", "📃", "📑", "🧾", "📋", "📅", "📆", "🗒️", "🗓️", "📇", "📈", "📉", "📊", "📐", "📏", "📌", "📍", "✂️", "🖇️", "📎", "🖇️", "📐", "📏", "🧮", "📓", "📔", "📒", "📊", "📉", "📈", "📕", "📗", "📘", "📙", "📚", "📖", "🧷", "🧵", "🧶", "🌀", "🧸", "📮", "📭", "📬", "📪", "🧦", "🧤", "🧣", "🎒", "👜", "💼", "👝", "🎓", "🎀", "🧢", "👒", "🥾", "👞", "👟", "🥿", "👠", "👡", "🩴", "🩰", "👢", "👑", "👔", "👕", "👖", "🧥", "🧤", "🧣", "🧦", "👗", "👘", "👚", "👕", "🩳", "🩱", "🥻", "🩲", "🩳", "🧵", "🧶", "⌚", "⏰", "⏱️", "⏲️"] },
  symbols: { label: "❤️ Symbols", keywords: ["sign", "math", "warning", "arrow"], emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "❤️‍🔥", "❤️‍🩹", "💔", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "💬", "👁️‍🗨️", "🗨️", "🗯️", "💭", "💤", "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "💅", "👂", "👃", "🧠", "🦷", "🦴", "👀", "👁️", "👅", "👄", "♠️", "♥️", "♦️", "♣️", "♠️", "🚀", "✈️", "🚁", "🛂", "🛫", "🛬", "💺", "🛰️", "🛶", "⛵", "🚤", "🛳️", "⛴️", "🛥️", "🛩️", "🛫", "🛬", "🚀", "✈️", "🚁", "🛂", "🛫", "🛬"] }
};

export default function EmojiReactionPicker({ onSelect, onClose, position = "top" }) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("smileys");

  const searchTerm = search.trim().toLowerCase();
  
  const filteredEmojis = searchTerm
    ? Object.values(EMOJI_CATEGORIES)
        .filter(cat => cat.label.toLowerCase().includes(searchTerm) || cat.keywords.some(k => k.includes(searchTerm)))
        .flatMap(cat => cat.emojis)
        .filter((e, i, arr) => arr.indexOf(e) === i)
    : EMOJI_CATEGORIES[activeTab]?.emojis || [];

  return (
    <div className={cn(
      "absolute z-[60] bg-card border border-border/60 rounded-2xl shadow-2xl p-3 w-[280px] sm:w-80 backdrop-blur-xl",
      position === "bottom" ? "bottom-full mb-2 -left-2 sm:left-0" : "top-full mt-2 -left-32 sm:left-0"
    )}>
      <div className="mb-3 flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground absolute left-5" />
        <input
          type="text"
          placeholder="Search emoji..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          title="Search emoji"
          aria-label="Search emoji"
          className="w-full pl-8 pr-3 py-2 bg-secondary/40 border border-border/40 rounded-xl text-sm focus:outline-none focus:border-primary/50 transition-colors"
          autoFocus
        />
        <button
          type="button"
          onClick={onClose}
          title="Close emoji picker"
          aria-label="Close emoji picker"
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-secondary/60 transition-colors text-muted-foreground shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!search && (
        <div className="w-full grid grid-cols-6 gap-1 mb-3 h-8 bg-secondary/40 p-1 rounded-lg">
          {Object.entries(EMOJI_CATEGORIES).map(([key, { label }]) => (
            <button
              type="button"
              key={key}
              onClick={() => setActiveTab(key)}
              title={label}
              aria-label={label}
              className={cn(
                "text-xs p-0 h-full rounded-md flex items-center justify-center transition-all",
                activeTab === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label.split(" ")[0]}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
        {filteredEmojis.map((emoji, i) => (
          <button
            type="button"
            key={i}
            onClick={() => { onSelect(emoji); onClose(); }}
            title={`Select emoji ${emoji}`}
            aria-label={`Select emoji ${emoji}`}
            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-primary/20 rounded-lg transition-all hover:scale-110 active:scale-95"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}