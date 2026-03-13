import { AppNav } from "@/components/app/app-nav";
import { BrowseContent } from "@/components/streams/browse-content";
import { Shell } from "@/components/ui/shell";

export default function BrowsePage() {
  return (
    <Shell
      eyebrow="Browse"
      title="Find what is live right now."
      description="Explore live channels, jump into the watch page, and discover creators on the platform."
    >
      <div className="space-y-6">
        <AppNav />
        <BrowseContent />
      </div>
    </Shell>
  );
}
