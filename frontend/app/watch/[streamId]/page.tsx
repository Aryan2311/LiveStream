import { AppNav } from "@/components/app/app-nav";
import { WatchContent } from "@/components/streams/watch-content";
import { Shell } from "@/components/ui/shell";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ streamId: string }>;
}) {
  const { streamId } = await params;

  return (
    <Shell
      eyebrow="Live now"
      title="Watch the stream and join the conversation."
      description="Tune in, chat with other viewers, and follow along in real time."
    >
      <div className="space-y-6">
        <AppNav />
        <WatchContent streamId={streamId} />
      </div>
    </Shell>
  );
}
