import ArtistExperiencePage from "@/components/artist/ArtistExperiencePage";

export default function LiveStudioSessions() {
  return (
    <ArtistExperiencePage
      title="Live Studio Sessions"
      description="Bring collaborators into the creative process without breaking the workflow."
      actions={[
        { label: "Enter Studio", to: "/studio" },
        { label: "Coordinate session", to: "/messages" },
        { label: "Move session files", to: "/files" },
      ]}
    />
  );
}