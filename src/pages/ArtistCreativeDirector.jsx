import ArtistExperiencePage from "@/components/artist/ArtistExperiencePage";

export default function ArtistCreativeDirector() {
  return (
    <ArtistExperiencePage
      title="AI Creative Director"
      description="Turn a release into a focused visual and campaign direction."
      actions={[
        { label: "Build the creative brief", to: "/cover-art" },
        { label: "Develop visual assets", to: "/music-video-generator" },
        { label: "Plan the rollout", to: "/release-war-room" },
      ]}
    />
  );
}