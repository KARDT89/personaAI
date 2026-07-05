"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AlertCircleIcon, RotateCcwIcon, SendIcon } from "lucide-react";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Message,
  MessageContent,
  MessageGroup,
  MessageHeader,
} from "@/components/ui/message";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { PersonaSwitch, type PersonaOption } from "./PersonaSwitch";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type PersonaResponse = {
  personas?: PersonaOption[];
  sessionId?: string;
  persona?: PersonaOption;
  error?: string;
};

const FALLBACK_PERSONAS: PersonaOption[] = [
  { id: "hitesh", name: "Hitesh" },
  { id: "piyush", name: "Piyush" },
];

export function ChatWindow() {
  const [personas, setPersonas] = useState<PersonaOption[]>(FALLBACK_PERSONAS);
  const [activePersona, setActivePersona] =
    useState<PersonaOption["id"]>("hitesh");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const didInitRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const createSession = useCallback(async (personaId: PersonaOption["id"]) => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStartingSession(true);
    setIsStreaming(false);
    setError(null);
    setMessages([]);
    setSessionId(null);
    setActivePersona(personaId);

    try {
      const response = await fetch("/api/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId }),
      });
      const data = (await response.json()) as PersonaResponse;

      if (!response.ok || !data.sessionId) {
        throw new Error(data.error ?? "Could not start session.");
      }

      setSessionId(data.sessionId);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsStartingSession(false);
    }
  }, []);

  useEffect(() => {
    if (didInitRef.current) {
      return;
    }

    didInitRef.current = true;

    async function boot() {
      try {
        const response = await fetch("/api/persona");
        const data = (await response.json()) as PersonaResponse;

        if (response.ok && data.personas?.length) {
          setPersonas(data.personas);
        }
      } catch {
      } finally {
        await createSession("hitesh");
      }
    }

    void boot();
  }, [createSession]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isStreaming]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextMessage = input.trim();

    if (!nextMessage || !sessionId || isStreaming || isStartingSession) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: nextMessage,
    };
    const assistantId = crypto.randomUUID();

    setInput("");
    setError(null);
    setIsStreaming(true);
    setMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          personaId: activePersona,
          message: nextMessage,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const data = await readJsonError(response);
        throw new Error(data ?? "Chat request failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });

        if (!chunk) {
          continue;
        }

        setMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === assistantId
              ? { ...message, content: message.content + chunk }
              : message,
          ),
        );
      }
    } catch (caughtError) {
      if ((caughtError as Error).name !== "AbortError") {
        setError(getErrorMessage(caughtError));
        setInput(nextMessage);
        setMessages((currentMessages) =>
          currentMessages.filter((message) => message.id !== assistantId),
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  const activePersonaName =
    personas.find((persona) => persona.id === activePersona)?.name ?? "Persona";
  const canSend = Boolean(input.trim()) && Boolean(sessionId) && !isStreaming;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b bg-background/95 px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-normal">
              PersonaAI
            </h1>
            <p className="text-sm text-muted-foreground">{activePersonaName}</p>
          </div>
          <PersonaSwitch
            disabled={isStreaming || isStartingSession}
            personas={personas}
            value={activePersona}
            onValueChange={createSession}
          />
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-4 sm:px-6">
        {error ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <div className="flex min-w-0 items-center gap-2">
              <AlertCircleIcon className="size-4 shrink-0" />
              <span className="min-w-0 break-words">{error}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Retry session"
              onClick={() => void createSession(activePersona)}
            >
              <RotateCcwIcon />
            </Button>
          </div>
        ) : null}

        <ScrollArea className="min-h-0 flex-1 py-4">
          <MessageGroup className="mx-auto flex min-h-[calc(100dvh-13rem)] w-full justify-end gap-4">
            {messages.length === 0 ? (
              <div className="flex min-h-[calc(100dvh-13rem)] items-center justify-center">
                {isStartingSession ? (
                  <Spinner className="size-5 text-muted-foreground" />
                ) : (
                  <div className="text-center text-sm text-muted-foreground">
                    {activePersonaName} is ready.
                  </div>
                )}
              </div>
            ) : (
              messages.map((message) => (
                <Message
                  key={message.id}
                  align={message.role === "user" ? "end" : "start"}
                >
                  <MessageContent>
                    <MessageHeader>
                      {message.role === "user" ? "You" : activePersonaName}
                    </MessageHeader>
                    <Bubble
                      align={message.role === "user" ? "end" : "start"}
                      variant={message.role === "user" ? "default" : "muted"}
                    >
                      <BubbleContent
                        className={cn(
                          "whitespace-pre-wrap",
                          !message.content && "min-h-10 min-w-16",
                        )}
                      >
                        {message.content || (
                          <Spinner className="size-4 text-muted-foreground" />
                        )}
                      </BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              ))
            )}
            <div ref={endRef} />
          </MessageGroup>
        </ScrollArea>

        <form
          onSubmit={handleSubmit}
          className="sticky bottom-0 border-t bg-background py-3"
        >
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              disabled={isStartingSession}
              placeholder={`Message ${activePersonaName}`}
              className="max-h-36 min-h-12 flex-1"
            />
            <Button
              type="submit"
              size="icon-lg"
              disabled={!canSend}
              aria-label="Send message"
            >
              {isStreaming ? <Spinner /> : <SendIcon />}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

async function readJsonError(response: Response) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
