import { Award, Zap } from 'lucide-react';

const MASTER_PRESETS = [
  {
    id: 'spotify',
    name: 'Spotify Master',
    description: 'Optimized for Spotify streaming (-14 LUFS)',
    icon: '♪',
    settings: { loudnessStandard: 'spotify', bitDepth: '24bit', sampleRate: '44.1khz' },
  },
  {
    id: 'apple',
    name: 'Apple Music',
    description: 'iTunes optimized (-16 LUFS)',
    icon: '♫',
    settings: { loudnessStandard: 'apple', bitDepth: '24bit', sampleRate: '44.1khz' },
  },
  {
    id: 'youtube',
    name: 'YouTube Master',
    description: 'Video platform ready (-13 LUFS)',
    icon: '▶',
    settings: { loudnessStandard: 'youtube', bitDepth: '24bit', sampleRate: '48khz' },
  },
  {
    id: 'studio',
    name: 'Studio Reference',
    description: 'Uncompressed mastering reference',
    icon: '◆',
    settings: { loudnessStandard: 'streaming', bitDepth: '32bit', sampleRate: '96khz' },
  },
];

export default function MasterPresets({ onSelect }) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Award className="w-4 h-4 text-accent" />
        Master Presets
      </label>
      <div className="grid grid-cols-2 gap-2">
        {MASTER_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset.settings)}
            className="group relative p-3 rounded-lg border border-border/50 bg-secondary/30 hover:border-accent/50 hover:bg-accent/10 transition-all text-left"
          >
            <div className="text-xl mb-2">{preset.icon}</div>
            <div className="text-xs font-semibold text-foreground group-hover:text-accent transition-colors">
              {preset.name}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
              {preset.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}