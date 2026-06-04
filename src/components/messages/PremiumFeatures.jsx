import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertCircle, Eye, EyeOff, Clock, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function PremiumFeatures({ onDisappearingChange, disappearingTime }) {
  const [showVanish, setShowVanish] = useState(false);
  const [selectedTime, setSelectedTime] = useState(disappearingTime || null);

  const timeOptions = [
    { label: "15 seconds", value: 15 },
    { label: "1 minute", value: 60 },
    { label: "15 minutes", value: 900 },
    { label: "1 hour", value: 3600 },
    { label: "1 day", value: 86400 },
  ];

  const handleTimeSelect = (time) => {
    setSelectedTime(time);
    onDisappearingChange(time);
    setShowVanish(false);
  };

  return (
    <div className="flex items-center gap-1">
      {/* Disappearing Messages */}
      <Popover open={showVanish} onOpenChange={setShowVanish}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "w-7 h-7 rounded-full",
              selectedTime ? "text-yellow-500 hover:bg-yellow-500/20" : "text-muted-foreground hover:bg-secondary/60"
            )}
            title="Disappearing messages"
          >
            <Eye className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="end">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-yellow-500" />
              <p className="text-sm font-semibold">Disappearing Messages</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Messages will vanish after:</p>
            <div className="space-y-1">
              {timeOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => handleTimeSelect(option.value)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-all",
                    selectedTime === option.value
                      ? "bg-yellow-500/20 text-yellow-600 font-medium"
                      : "hover:bg-secondary/60"
                  )}
                >
                  {option.label}
                </button>
              ))}
              {selectedTime && (
                <button
                  onClick={() => handleTimeSelect(null)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary/60 transition-all mt-2 pt-2 border-t border-border/40"
                >
                  Disable
                </button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}