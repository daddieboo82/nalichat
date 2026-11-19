import ArtistExperiencePage from "@/components/artist/ArtistExperiencePage";

export default function ArtistBackstage() {
  return (
    <ArtistExperiencePage
      title="Backstage"
      description="Give supporters a closer connection to the artist journey."
      actions={[
        { label: "Build your profile", to: "/profile" },
        { label: "Engage community", to: "/explore" },
        { label: "Message supporters", to: "/messages" },
      ]}
    />
  );
}