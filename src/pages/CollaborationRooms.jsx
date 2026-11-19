import ArtistExperiencePage from "@/components/artist/ArtistExperiencePage";

export default function CollaborationRooms() {
  return (
    <ArtistExperiencePage
      title="Collaboration Rooms"
      description="Keep artists, producers and collaborators moving together."
      actions={[
        { label: "Open team messages", to: "/messages" },
        { label: "Share project files", to: "/files" },
        { label: "Work in Studio", to: "/studio" },
      ]}
    />
  );
}