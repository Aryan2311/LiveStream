"use client";

import { useEffect, useMemo, useState } from "react";

import { useSession } from "@/components/providers/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { chatEventsUrl, postMessage } from "@/lib/api";
import { ApiError, type Message } from "@/lib/types";

type ChatPanelProps = {
  streamId: string;
};

export function ChatPanel({ streamId }: ChatPanelProps) {
  const { session, isAuthenticated } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const events = new EventSource(chatEventsUrl(streamId));
    events.onmessage = (event) => {
      const createdAt = new Date().toISOString();
      const [author, ...rest] = event.data.split(": ");
      const bodyText = rest.join(": ");
      setMessages((current) => [
        ...current,
        {
          id: `${createdAt}-${Math.random().toString(16).slice(2)}`,
          stream_id: streamId,
          user_id: "event",
          author,
          body: bodyText,
          created_at: createdAt,
        },
      ]);
    };
    events.onerror = () => {
      setError((current) => current || "Live chat connection was interrupted.");
    };

    return () => {
      events.close();
    };
  }, [streamId]);

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
      ),
    [messages],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !body.trim()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await postMessage(session, streamId, body.trim());
      setBody("");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to send your message.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Panel title="Live chat" description="Stay with the conversation while the stream is live.">
      <div className="space-y-4">
        <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-2">
          {sortedMessages.length === 0 ? (
            <p className="text-sm text-slate-400">No messages yet. Be the first to say hello in chat.</p>
          ) : (
            sortedMessages.map((message) => (
              <div key={message.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-white">{message.author}</span>
                  <span className="text-xs text-slate-500">{new Date(message.created_at).toLocaleTimeString()}</span>
                </div>
                <p className="text-sm leading-6 text-slate-300">{message.body}</p>
              </div>
            ))
          )}
        </div>

        {error ? <p className="text-sm text-amber-300">{error}</p> : null}

        <form className="space-y-3" onSubmit={handleSubmit}>
          <Input
            label="Message"
            placeholder={isAuthenticated ? "Say something useful to your audience" : "Sign in to chat"}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            disabled={!isAuthenticated || isSubmitting}
          />
          <Button type="submit" disabled={!isAuthenticated || isSubmitting || !body.trim()}>
            {isSubmitting ? "Sending..." : "Send message"}
          </Button>
        </form>
      </div>
    </Panel>
  );
}
