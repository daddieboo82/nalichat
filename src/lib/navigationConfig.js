import { Home, MessageSquare, Music, Compass, Mic, Image, Video, FolderOpen, FolderKanban, Users, ListMusic, Trophy, BarChart3, Swords, UsersRound, Tv } from "lucide-react";

// Primary tabs shown in the mobile bottom bar — the 4 most-used destinations.
export const PRIMARY_TABS = [
  { icon: Home, label: "Home", path: "/" },
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: Music, label: "Studio", path: "/studio" },
  { icon: Compass, label: "Explore", path: "/explore" },
];

// Secondary features grouped by category for the "More" menu (mobile sheet + desktop dropdown).
export const NAV_GROUPS = [
  {
    label: "Create",
    items: [
      { icon: Music, label: "Studio", path: "/studio", desc: "Record, edit, and mix your tracks" },
      { icon: Mic, label: "Quick Record", path: "/record", desc: "Capture ideas on the go" },
      { icon: Image, label: "Cover Art", path: "/cover-art", desc: "Generate AI cover artwork" },
      { icon: Video, label: "Video Lab", path: "/music-video-generator", desc: "Create music videos with AI" },
    ],
  },
  {
    label: "Connect",
    items: [
      { icon: MessageSquare, label: "Messages", path: "/messages", desc: "Chat with your network" },
      { icon: FolderOpen, label: "Files", path: "/files", desc: "Your file vault and transfers" },
      { icon: FolderKanban, label: "Projects", path: "/projects-summary", desc: "Manage your projects" },
      { icon: Users, label: "Meetings", path: "/meetings", desc: "Private meetings and listening parties" },
    ],
  },
  {
    label: "Discover",
    items: [
      { icon: Compass, label: "Explore", path: "/explore", desc: "Browse tracks and creators" },
      { icon: ListMusic, label: "Playlists", path: "/playlists", desc: "Your saved playlists" },
      { icon: Trophy, label: "Leaderboard", path: "/leaderboard", desc: "Top creators and tracks" },
      { icon: BarChart3, label: "Analytics", path: "/analytics", desc: "Your stats and insights" },
    ],
  },
  {
    label: "Compete",
    items: [
      { icon: Swords, label: "Challenges", path: "/challenges", desc: "Remix challenges and prizes" },
      { icon: UsersRound, label: "Squads", path: "/squad", desc: "Team up with a partner" },
      { icon: Tv, label: "Live Battles", path: "/battles", desc: "Head-to-head live battles" },
    ],
  },
];

// Quick lookup: which paths belong to the "More" tab (secondary features not in the bottom bar).
const PRIMARY_PATHS = new Set(PRIMARY_TABS.map(t => t.path));
export const SECONDARY_PATHS = new Set(
  NAV_GROUPS.flatMap(g => g.items).map(i => i.path).filter(p => !PRIMARY_PATHS.has(p))
);

// Desktop nav: main links shown directly + everything else in the "More" dropdown.
export const DESKTOP_MAIN_LINKS = [
  { icon: Home, label: "Home", path: "/" },
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: Music, label: "Studio", path: "/studio" },
  { icon: Compass, label: "Explore", path: "/explore" },
  { icon: FolderOpen, label: "Files", path: "/files" },
  { icon: Swords, label: "Challenges", path: "/challenges" },
];

export const DESKTOP_MORE_LINKS = NAV_GROUPS.flatMap(group =>
  group.items
    .filter(item => !DESKTOP_MAIN_LINKS.some(link => link.path === item.path))
    .map(item => ({ icon: item.icon, label: item.label, path: item.path }))
);