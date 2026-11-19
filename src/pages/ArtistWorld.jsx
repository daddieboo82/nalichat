import ArtistExperiencePage from "@/components/artist/ArtistExperiencePage";

export default function ArtistWorld() {
  return (
    <ArtistExperiencePage
      title="Artist World"
      description="Your explorable Nali destination for music, visuals, community and collaboration."
      actions={[
        { label: "Create", to: "/artist-career-os" },
        { label: "Watch", to: "/music-video-generator" },
        { label: "Backstage", to: "/artist-backstage" },
        { label: "Collaborate", to: "/collaboration-rooms" },
        { label: "Release", to: "/release-war-room" },
        { label: "Community", to: "/explore" },
      ]}
    />
  );
}