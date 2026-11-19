import ArtistExperiencePage from "@/components/artist/ArtistExperiencePage";

export default function SongFeedbackLab() {
  return (
    <ArtistExperiencePage
      title="Song Feedback Lab"
      description="Collect focused feedback before the record leaves the room."
      actions={[
        { label: "Play and refine", to: "/studio" },
        { label: "Send for feedback", to: "/messages" },
        { label: "Manage versions", to: "/files" },
      ]}
    />
  );
}