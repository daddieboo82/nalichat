import { useContext } from 'react';
import { TutorialContext } from '@/lib/TutorialContext';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function TutorialButton({ className }) {
  const { startTutorial } = useContext(TutorialContext);

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={startTutorial}
      className={cn("rounded-xl w-8 h-8 hover:bg-primary/20 hover:text-primary transition-all text-muted-foreground", className)}
      title="Tutorial"
    >
      <HelpCircle className="w-4 h-4" />
    </Button>
  );
}