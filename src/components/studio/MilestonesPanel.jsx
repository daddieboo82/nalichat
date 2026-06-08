import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/responsive-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, CheckCircle2, Circle, Calendar as CalendarIcon, Flag, Trash2, AlertTriangle, Clock, X
} from "lucide-react";
import { format, isPast, isToday, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const priorityColors = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-accent/20 text-accent",
  high: "bg-destructive/20 text-destructive",
};

const priorityIcon = {
  low: null,
  medium: null,
  high: <AlertTriangle className="w-3 h-3" />,
};

function dueBadge(due_date, completed) {
  if (!due_date) return null;
  const d = parseISO(due_date);
  if (completed) return null;
  if (isToday(d)) return <span className="text-[10px] font-bold text-yellow-400 flex items-center gap-1"><Clock className="w-3 h-3" />Due today</span>;
  if (isPast(d)) return <span className="text-[10px] font-bold text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Overdue</span>;
  return null;
}

export default function MilestonesPanel({ projectId, canEdit }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", due_date: "", priority: "medium" });

  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones", projectId],
    queryFn: () => base44.entities.Milestone.filter({ project_id: projectId }, "created_date"),
    enabled: !!projectId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["milestones", projectId] });

  const addMilestone = useMutation({
    mutationFn: () => base44.entities.Milestone.create({ ...form, project_id: projectId }),
    onSuccess: () => { invalidate(); setShowAdd(false); setForm({ title: "", description: "", due_date: "", priority: "medium" }); },
  });

  const toggle = useMutation({
    mutationFn: (m) => base44.entities.Milestone.update(m.id, {
      completed: !m.completed,
      completed_at: !m.completed ? new Date().toISOString() : null,
    }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id) => base44.entities.Milestone.delete(id),
    onSuccess: invalidate,
  });

  const done = milestones.filter(m => m.completed);
  const todo = milestones.filter(m => !m.completed);
  const progress = milestones.length > 0 ? Math.round((done.length / milestones.length) * 100) : 0;

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center justify-between pl-4 pr-12 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-primary" />
          <span className="font-heading font-bold text-sm">Milestones</span>
          {milestones.length > 0 && (
            <span className="text-xs text-muted-foreground">{done.length}/{milestones.length}</span>
          )}
        </div>
        {canEdit && (
          <Button id="add-milestone-btn" type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-lg hover:bg-primary/20 hover:text-primary" onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowAdd(true);
          }}>
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Progress bar */}
      {milestones.length > 0 && (
        <div className="px-4 py-2 border-b border-border/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">Overall progress</span>
            <span className="text-[10px] font-bold text-primary">{progress}%</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {milestones.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
            <Flag className="w-8 h-8 opacity-20" />
            <p className="text-xs text-center">No milestones yet.<br />{canEdit ? "Add one to track progress." : ""}</p>
          </div>
        )}

        {/* Pending */}
        {todo.map((m) => (
          <MilestoneRow key={m.id} m={m} canEdit={canEdit} onToggle={() => toggle.mutate(m)} onDelete={() => remove.mutate(m.id)} />
        ))}

        {/* Completed section */}
        {done.length > 0 && (
          <>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest pt-2 pb-1">Completed</p>
            {done.map((m) => (
              <MilestoneRow key={m.id} m={m} canEdit={canEdit} onToggle={() => toggle.mutate(m)} onDelete={() => remove.mutate(m.id)} />
            ))}
          </>
        )}
      </div>

      {/* Add form overlay */}
      {showAdd && (
        <div className="absolute inset-0 z-20 flex flex-col bg-background/95 backdrop-blur-sm p-5">
          <div className="flex items-center justify-between mb-5 pr-8">
            <h4 className="font-heading font-bold text-lg">Add Milestone</h4>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowAdd(false);
            }}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
            <Input
              id="milestone-title-input"
              placeholder="Milestone title..."
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="bg-secondary/50 border-0 rounded-xl h-11"
            />
            <Input
              placeholder="Description (optional)..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="bg-secondary/50 border-0 rounded-xl h-11"
            />
            <div className="flex gap-4">
              <div className="flex-1">
                <label htmlFor="milestone-due-date" className="text-xs font-semibold text-muted-foreground mb-1.5 block">Due Date</label>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="milestone-due-date"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-secondary/50 border-0 rounded-xl h-11",
                        !form.due_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.due_date ? format(parseISO(form.due_date), "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.due_date ? parseISO(form.due_date) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setForm(f => ({ ...f, due_date: format(date, 'yyyy-MM-dd') }));
                          setDateOpen(false);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Priority</label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="bg-secondary/50 border-0 rounded-xl h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              id="save-milestone-btn"
              type="button"
              title="Add Milestone"
              aria-label="Add Milestone"
              className="w-full rounded-xl bg-primary hover:bg-primary/90 h-11 mt-4"
              disabled={!form.title.trim() || addMilestone.isPending}
              onClick={() => addMilestone.mutate()}
            >
              Add Milestone
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MilestoneRow({ m, canEdit, onToggle, onDelete }) {
  return (
    <div className={cn(
      "group flex items-start gap-2.5 rounded-xl p-3 border transition-colors duration-200",
      m.completed ? "border-border/40 bg-secondary/20 opacity-60" : "border-border bg-card/60 hover:border-primary/30"
    )}>
      <button onClick={onToggle} className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors">
        {m.completed
          ? <CheckCircle2 className="w-4 h-4 text-green-400" />
          : <Circle className="w-4 h-4" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium leading-snug", m.completed && "line-through text-muted-foreground")}>
          {m.title}
        </p>
        {m.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{m.description}</p>}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <Badge className={`text-[10px] border-0 px-2 py-0 ${priorityColors[m.priority]}`}>
            <span className="flex items-center gap-1">
              {priorityIcon[m.priority]}
              {m.priority}
            </span>
          </Badge>
          {m.due_date && !m.completed && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <CalendarIcon className="w-3 h-3" />
              {format(parseISO(m.due_date), "MMM d")}
            </span>
          )}
          {dueBadge(m.due_date, m.completed)}
          {m.completed && m.completed_at && (
            <span className="text-[10px] text-green-400">✓ {format(new Date(m.completed_at), "MMM d")}</span>
          )}
        </div>
      </div>
      {canEdit && (
        <button
          onClick={onDelete}
          className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}