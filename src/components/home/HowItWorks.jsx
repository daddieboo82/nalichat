import {
  UserPlus, FolderPlus, Upload, Wand2, Video, SlidersHorizontal,
  Rocket, ShoppingCart, ArrowRight
} from "lucide-react";
import { motion } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const steps = [
  {
    number: "01",
    icon: UserPlus,
    title: "Create Your Profile",
    description: "Sign up, set your artist name, genres, and bio. Build your contacts and start connecting with creators worldwide.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    number: "02",
    icon: FolderPlus,
    title: "Start a Project",
    description: "Spin up a new music project, organize it into tracks and folders, set milestones, and invite collaborators with roles.",
    color: "text-teal-400",
    bg: "bg-teal-400/10",
  },
  {
    number: "03",
    icon: Upload,
    title: "Upload & Auto-Tag",
    description: "Drop in your stems and recordings. AI automatically suggests BPM, genre, and key so everything stays organized.",
    color: "text-fuchsia-400",
    bg: "bg-fuchsia-400/10",
  },
  {
    number: "04",
    icon: Wand2,
    title: "Produce with AI",
    description: "Separate stems from any mix, generate fresh samples and ideas, and craft your sound right inside the built-in DAW.",
    color: "text-indigo-400",
    bg: "bg-indigo-400/10",
  },
  {
    number: "05",
    icon: Video,
    title: "Jam Live Together",
    description: "Launch a multiplayer Jam Room with live audio and video to co-edit tracks with your collaborators in real time.",
    color: "text-pink-400",
    bg: "bg-pink-400/10",
  },
  {
    number: "06",
    icon: SlidersHorizontal,
    title: "Master Your Track",
    description: "Run AI Mastering to polish your mix to industry-standard loudness and clarity — no expensive engineer required.",
    color: "text-orange-400",
    bg: "bg-orange-400/10",
  },
  {
    number: "07",
    icon: Rocket,
    title: "Release & Grow",
    description: "Drop your finished tracks and art posts to Explore, build playlists, climb the leaderboard, and grow your following.",
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    number: "08",
    icon: ShoppingCart,
    title: "Sell Your Stems",
    description: "List your stems on the marketplace and securely sell licenses directly to other artists and producers.",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
];

export default function HowItWorks() {
  return (
    <div>
      <div className="text-center mb-10 md:mb-12">
        <span className="text-xs font-bold tracking-widest text-primary uppercase bg-primary/10 px-3 py-1 rounded-full">The Full Journey</span>
        <h2 className="font-heading font-bold text-3xl md:text-4xl mt-4 mb-3">How It Works</h2>
        <p className="text-foreground/90 text-lg max-w-2xl mx-auto">From signing up to selling your sound — NaliChat covers every step of your creative process in one place.</p>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <motion.div key={step.number} variants={itemVariants} className="relative h-full">
              <div className="bg-card border border-border rounded-2xl p-6 h-full hover:border-primary/40 transition-colors duration-300 flex flex-col">
                <div className="flex items-center justify-between mb-5">
                  <div className={`w-12 h-12 rounded-xl ${step.bg} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${step.color}`} />
                  </div>
                  <span className="text-4xl font-black text-border">{step.number}</span>
                </div>
                <h3 className="font-heading font-bold text-lg mb-2">{step.title}</h3>
                <p className="text-sm text-foreground/90 leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}