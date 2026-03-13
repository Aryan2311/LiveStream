import { AppNav } from "@/components/app/app-nav";
import { StudioContent } from "@/components/streams/studio-content";
import { Shell } from "@/components/ui/shell";

export default function StudioPage() {
  return (
    <Shell
      eyebrow="Stream studio"
      title="Set up your stream and go live with confidence."
      description="Create a stream, copy your encoder details, confirm your preview, and share the watch link with your audience."
    >
      <div className="space-y-6">
        <AppNav />
        <StudioContent />
      </div>
    </Shell>
  );
}
