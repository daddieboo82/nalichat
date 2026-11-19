import ArtistExperiencePage from "@/components/artist/ArtistExperiencePage";

export default function ArtistMarketplace() {
  return (
    <ArtistExperiencePage
      title="Artist Marketplace"
      description="A home for artist services, collaborators and creative opportunities."
      actions={[
        { label: "Discover creators", to: "/explore" },
        { label: "Start a conversation", to: "/messages" },
        { label: "Manage project files", to: "/files" },
      ]}
    />
  );
}