import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip } from "@/components/ui/tooltip";
import { motion } from "framer-motion";

export default function CollaboratorPresence({ collaborators, currentUserId }) {
  if (!collaborators || collaborators.length === 0) return null;

  const activeCollaborators = collaborators.filter(c => c.id !== currentUserId);

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {activeCollaborators.map((collab) => (
          <motion.div
            key={collab.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <Tooltip>
              <div className="relative">
                <Avatar className="w-8 h-8 border-2 border-background">
                  <AvatarImage src={collab.avatar_url} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                    {collab.full_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border border-background" />
              </div>
            </Tooltip>
          </motion.div>
        ))}
      </div>
      <span className="text-xs text-muted-foreground ml-2">
        {activeCollaborators.length} editing
      </span>
    </div>
  );
}