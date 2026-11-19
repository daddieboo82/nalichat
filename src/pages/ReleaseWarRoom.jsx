import ArtistExperiencePage from "@/components/artist/ArtistExperiencePage";

export default function ReleaseWarRoom() {
  return (
    <ArtistExperiencePage
      title="Release War Room"
      description="Coordinate the final push around a release from one room."
      actions={[
        { label: "Release checklist", to: "/artist-release-center" },
        { label: "Campaign community", to: "/explore" },
        { label: "Watch performance", to: "/analytics" },
      ]}
    />
  );
}