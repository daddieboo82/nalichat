import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VOX_SHIFT_PRESETS } from '@/lib/voxShift';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { SlidersHorizontal, Power, X, Plus, Waves, Gauge, Sparkles, Clock } from 'lucide-react';

const PLUGINS = [
  { id: 'voxshift', name: 'VoxShift', icon: Waves, color: 'text-violet-400', params: [
    { label: 'Pitch', min: 60, max: 160, default: 100, unit: '%' },
    { label: 'Output', min: 0, max: 100, default: 100, unit: '%' },
  ]},
  { id: 'eq', name: 'Equalizer', icon: Waves, color: 'text-blue-400', params: [
    { label: 'Low', min: 0, max: 100, default: 50, unit: '%' },
    { label: 'Mid', min: 0, max: 100, default: 50, unit: '%' },
    { label: 'High', min: 0, max: 100, default: 50, unit: '%' },
  ]},
  { id: 'comp', name: 'Compressor', icon: Gauge, color: 'text-orange-400', params: [
    { label: 'Threshold', min: 0, max: 100, default: 60, unit: '%' },
    { label: 'Ratio', min: 1, max: 100, default: 40, unit: '%' },
    { label: 'Gain', min: 0, max: 100, default: 50, unit: '%' },
  ]},
  { id: 'reverb', name: 'Reverb', icon: Sparkles, color: 'text-purple-400', params: [
    { label: 'Size', min: 0, max: 100, default: 30, unit: '%' },
    { label: 'Damp', min: 0, max: 100, default: 50, unit: '%' },
    { label: 'Mix', min: 0, max: 100, default: 20, unit: '%' },
  ]},
  { id: 'delay', name: 'Delay', icon: Clock, color: 'text-cyan-400', params: [
    { label: 'Time', min: 0, max: 100, default: 30, unit: '%' },
    { label: 'Feedback', min: 0, max: 100, default: 25, unit: '%' },
    { label: 'Mix', min: 0, max: 100, default: 20, unit: '%' },
  ]},
];

export default function PluginRack({ open, onToggle, trackName, tracks, plugins, onPluginsChange, isMaster = false, onTargetChange, onTuneVocal, isTuningVocal, tuningDisabled, songKey, onVoiceMatch }) {
  const [activePlugins, setActivePlugins] = useState({});

  useEffect(() => {
    setActivePlugins(plugins || {});
  }, [plugins, trackName, isMaster]);

  const hasTarget = isMaster || !!trackName;

  const updatePlugins = (updater) => {
    if (!hasTarget) return;
    setActivePlugins(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onPluginsChange?.(next);
      return next;
    });
  };

  const togglePlugin = (pluginId) => {
    updatePlugins(prev => {
      const next = { ...prev };
      if (next[pluginId]) {
        delete next[pluginId];
      } else {
        const plugin = PLUGINS.find(p => p.id === pluginId);
        next[pluginId] = {
          enabled: true,
          params: {
            ...(pluginId === 'voxshift' ? { Preset: 'natural' } : {}),
            ...Object.fromEntries(plugin.params.map(p => [p.label, p.default])),
          },
        };
      }
      return next;
    });
  };

  const updateParam = (pluginId, paramLabel, value) => {
    updatePlugins(prev => ({
      ...prev,
      [pluginId]: {
        ...prev[pluginId],
        params: { ...prev[pluginId].params, [paramLabel]: value[0] },
      },
    }));
  };

  const selectVoxShiftPreset = (preset) => {
    updatePlugins(prev => ({
      ...prev,
      voxshift: {
        ...prev.voxshift,
        params: { ...prev.voxshift.params, Preset: preset, Pitch: VOX_SHIFT_PRESETS[preset].pitch },
      },
    }));
  };

  const togglePower = (pluginId) => {
    updatePlugins(prev => ({
      ...prev,
      [pluginId]: { ...prev[pluginId], enabled: !prev[pluginId].enabled },
    }));
  };

  const hasTracks = tracks && tracks.length > 0;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden shrink-0 relative z-10"
          >
            <div className="mx-2 sm:mx-3 mt-2 rounded-2xl border border-foreground/10 bg-studio-raised/60 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-foreground/10 bg-studio-raised/40">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-primary" />
                  <span className="font-heading font-bold text-sm">Plugin Rack</span>
                  {trackName && (
                    <span className="text-xs text-muted-foreground ml-2 truncate max-w-[200px]">
                      on <span className="text-primary/80">{trackName}</span>
                    </span>
                  )}
                  {onTargetChange && (
                    <div className="flex items-center gap-1 ml-3">
                      <button
                        onClick={() => onTargetChange(null)}
                        className={cn(
                          'px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors',
                          !isMaster ? 'border-primary/50 bg-primary/10 text-primary' : 'border-foreground/10 text-muted-foreground hover:text-foreground'
                        )}
                        title="Edit the selected track's FX chain"
                      >
                        Track
                      </button>
                      <button
                        onClick={() => onTargetChange('master')}
                        className={cn(
                          'px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors',
                          isMaster ? 'border-primary/50 bg-primary/10 text-primary' : 'border-foreground/10 text-muted-foreground hover:text-foreground'
                        )}
                        title="Edit the master bus FX chain"
                      >
                        Master
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={onToggle}
                  className="w-7 h-7 rounded-lg hover:bg-studio-raised flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  title="Close Plugin Rack"
                  aria-label="Close Plugin Rack"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {onTuneVocal && !isMaster && (
                <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-foreground/10">
                  <button
                    type="button"
                    onClick={onTuneVocal}
                    disabled={isTuningVocal || tuningDisabled}
                    className="rounded-md bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
                  >
                    {isTuningVocal ? 'Tuning vocal…' : 'Tune Vocal to New Track'}
                  </button>
                  <span className="text-xs text-muted-foreground">Project key {songKey} · Isolated vocal</span>
                </div>
              )}

              {onVoiceMatch && !isMaster && (
                <div className="px-4 py-2 border-b border-foreground/10">
                  <button type="button" onClick={onVoiceMatch} className="rounded-md bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary">
                    Voice Match
                  </button>
                </div>
              )}

              {/* Plugin Slots */}
              <div className={cn("flex overflow-x-auto custom-scrollbar gap-0 shrink-0", !hasTarget && "opacity-50 pointer-events-none")}>
                {PLUGINS.filter(plugin => !isMaster || plugin.id !== 'voxshift').map((plugin) => {
                  const state = activePlugins[plugin.id];
                  const isActive = !!state;
                  const isEnabled = state?.enabled !== false;
                  const Icon = plugin.icon;

                  return (
                    <div
                      key={plugin.id}
                      className={cn(
                        "w-[220px] shrink-0 border-r border-foreground/10 p-3 flex flex-col gap-2 transition-all",
                        !isActive && "opacity-50",
                        !isEnabled && isActive && "opacity-40"
                      )}
                    >
                      {/* Plugin Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center bg-studio-raised", isActive && "bg-studio-overlay")}>
                            <Icon className={cn("w-3.5 h-3.5", isActive ? plugin.color : "text-muted-foreground")} />
                          </div>
                          <span className="text-xs font-semibold truncate">{plugin.name}</span>
                        </div>
                        {isActive ? (
                          <button
                            onClick={() => togglePower(plugin.id)}
                            className={cn(
                              "w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 min-w-[28px] min-h-[28px]",
                              isEnabled
                                ? "bg-primary/20 text-primary hover:bg-primary/30"
                                : "bg-studio-raised text-muted-foreground hover:text-foreground"
                            )}
                            title={isEnabled ? "Disable" : "Enable"}
                            aria-label={isEnabled ? "Disable plugin" : "Enable plugin"}
                          >
                            <Power className="w-3 h-3" />
                          </button>
                        ) : (
                          <button
                            onClick={() => togglePlugin(plugin.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/20 transition-all shrink-0 min-w-[28px] min-h-[28px]"
                            title="Add plugin"
                            aria-label="Add plugin"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Plugin Params */}
                      {isActive && isEnabled && (
                        <div className="flex flex-col gap-1.5">
                          {plugin.id === 'voxshift' && (
                            <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              Preset
                              <select
                                value={state.params?.Preset ?? 'natural'}
                                onChange={event => selectVoxShiftPreset(event.target.value)}
                                className="min-w-0 flex-1 rounded bg-studio-overlay px-2 py-1 text-foreground"
                              >
                                {Object.entries(VOX_SHIFT_PRESETS).map(([id, preset]) => (
                                  <option key={id} value={id}>{preset.name}</option>
                                ))}
                              </select>
                            </label>
                          )}
                          {plugin.params.map(param => (
                            <div key={param.label} className="flex items-center gap-2">
                              <span className="text-[9px] text-muted-foreground w-14 shrink-0 uppercase tracking-wider">{param.label}</span>
                              <Slider
                                aria-label={`${plugin.name} ${param.label}`}
                                value={[state.params?.[param.label] ?? param.default]}
                                min={param.min}
                                max={param.max}
                                step={1}
                                onValueChange={(v) => updateParam(plugin.id, param.label, v)}
                                className="flex-1"
                              />
                              <span className="text-[9px] font-mono text-muted-foreground w-8 text-right shrink-0">
                                {state.params?.[param.label] ?? param.default}{param.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Remove button when active */}
                      {isActive && (
                        <button
                          onClick={() => togglePlugin(plugin.id)}
                          className="text-[9px] text-muted-foreground hover:text-destructive transition-colors mt-auto text-left"
                        >
                          Remove {plugin.name}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {!hasTracks && !isMaster && (
                <div className="px-4 py-3 text-xs text-muted-foreground text-center bg-studio-raised/40">
                  Add tracks to your session to start using effects and plugins.
                </div>
              )}

              {hasTracks && !hasTarget && (
                <div className="px-4 py-3 text-xs text-muted-foreground text-center bg-studio-raised/40">
                  Select a track (or hit <span className="text-primary/80">FX</span> in the mixer) to edit its chain — or switch to <span className="text-primary/80">Master</span>.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}