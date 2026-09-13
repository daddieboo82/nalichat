import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Wrench, Stethoscope, Loader2, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

// Nali Maintenance Panel — lets the app owner run Nali's diagnostic scan
// and trigger automatic repairs for safe, non-destructive data issues.
export default function NaliMaintenancePanel() {
  const [mode, setMode] = useState(null); // 'diagnose' | 'repair'
  const [result, setResult] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const run = async (repairMode) => {
    if (mode) return;
    const runMode = repairMode ? 'repair' : 'diagnose';
    setMode(runMode);
    setResult(null);
    setShowDetails(false);
    try {
      const res = await base44.functions.invoke('nali-maintenance', { mode: runMode });
      if (res?.data?.error) throw new Error(res.data.error);
      if (!res?.data || typeof res.data.totalIssues !== 'number') {
        throw new Error("Maintenance response was invalid");
      }
      setResult(res.data);
      if (repairMode) {
        toast.success(`Nali repaired ${res.data.totalFixed || 0} issue${(res.data.totalFixed || 0) === 1 ? '' : 's'}.`);
      } else {
        toast.success(`Nali found ${res.data.totalIssues || 0} issue${(res.data.totalIssues || 0) === 1 ? '' : 's'}.`);
      }
    } catch (e) {
      toast.error("Maintenance scan failed: " + (e.message || "unknown error"));
    } finally {
      setMode(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-8">
      <h2 className="text-xl font-bold mb-4 border-b border-border pb-2 flex items-center gap-2">
        <Wrench className="w-5 h-5 text-primary" />
        Nali Maintenance & Repair
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Nali can scan the entire app for data issues — broken records, stale statuses, out-of-sync counts — and automatically repair safe, non-destructive problems across every entity.
      </p>

      <div className="flex flex-wrap gap-3 mb-4">
        <Button
          variant="outline"
          onClick={() => run(false)}
          disabled={mode !== null}
          className="gap-2"
        >
          {mode === "diagnose" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Stethoscope className="w-4 h-4" />}
          Diagnose Only
        </Button>
        <Button
          onClick={() => run(true)}
          disabled={mode !== null}
          className="gap-2"
        >
          {mode === "repair" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
          Diagnose & Repair
        </Button>
      </div>

      {result && (
        <div className="space-y-4">
          {/* Summary badges */}
          <div className="flex flex-wrap gap-3">
            <div className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${result.totalIssues > 0 ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600' : 'bg-green-500/10 border-green-500/20 text-green-600'}`}>
              {result.totalIssues > 0 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              <span className="text-sm font-bold">{result.totalIssues} issue{result.totalIssues === 1 ? '' : 's'} found</span>
            </div>
            {result.mode === 'repair' && (
              <div className="px-4 py-2 rounded-lg border bg-primary/10 border-primary/20 text-primary flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                <span className="text-sm font-bold">{result.totalFixed} repaired</span>
              </div>
            )}
          </div>

          {/* Scanned entities */}
          {result.scanned && Object.keys(result.scanned).length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Records Scanned</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.scanned).map(([key, count]) => (
                  <span key={key} className="text-xs bg-secondary/50 px-2 py-1 rounded-md border border-border/50">
                    {key}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Issues by entity */}
          {result.issuesByEntity && Object.keys(result.issuesByEntity).length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Issues by Entity</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.issuesByEntity).map(([entity, count]) => (
                  <span key={entity} className="text-xs bg-yellow-500/10 text-yellow-600 px-2 py-1 rounded-md border border-yellow-500/20">
                    {entity}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Detailed issue list */}
          {result.issues && result.issues.length > 0 && (
            <div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1 hover:text-foreground transition-colors"
              >
                {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Issue Details ({result.issues.length}{result.totalIssues > result.issues.length ? ` of ${result.totalIssues}` : ''})
              </button>
              {showDetails && (
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-2">
                  {result.issues.map((iss, i) => (
                    <div key={i} className="text-xs bg-secondary/30 border border-border/50 rounded-md px-3 py-2 flex items-start gap-2">
                      <span className="font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">{iss.entity}</span>
                      <span className="text-muted-foreground">{iss.issue}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fixed list */}
          {result.mode === 'repair' && result.fixed && result.fixed.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Repaired</p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-2">
                {result.fixed.map((f, i) => (
                  <div key={i} className="text-xs bg-green-500/5 border border-green-500/20 rounded-md px-3 py-2 flex items-start gap-2">
                    <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                    <span className="font-mono text-[10px] text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded shrink-0">{f.entity}</span>
                    <span className="text-muted-foreground">{f.change}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.totalIssues === 0 && (
            <p className="text-sm text-green-600 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              All clear — Nali found no issues across the entire app.
            </p>
          )}
        </div>
      )}
    </div>
  );
}