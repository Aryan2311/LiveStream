import { AppNav } from "@/components/app/app-nav";
import { Hero } from "@/components/app/hero";
import { BrowseContent } from "@/components/streams/browse-content";
import { Shell } from "@/components/ui/shell";

export default function Home() {
  return (
    <Shell
      eyebrow="Discover live creators"
      title="A home for viewers to watch and creators to go live."
      description="Browse live channels, join the chat, and launch your own stream from a studio built for a production-ready workflow."
    >
      <div className="space-y-6">
        <AppNav />
        <Hero />
        <BrowseContent />
      </div>
    </Shell>
  );
}
