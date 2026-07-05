"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircleIcon,
  BotIcon,
  ChevronDownIcon,
  FileTextIcon,
  KeyRoundIcon,
  LibraryIcon,
  LogOutIcon,
  MenuIcon,
  MessageSquareIcon,
  PanelRightIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  SettingsIcon,
  SparklesIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Message,
  MessageContent,
  MessageGroup,
  MessageHeader,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client";
import type { PersonaData } from "@/lib/personas";
import { cn } from "@/lib/utils";

import { ThemeToggle } from "./ThemeToggle";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type PersonaOption = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  tagline?: string | null;
  bio?: string | null;
  topics?: string[];
  starterPrompts?: string[];
  isBuiltIn?: boolean;
  sourceCount?: number;
  personaData?: PersonaData;
};

type PersonaResponse = {
  personas?: PersonaOption[];
  sessionId?: string;
  persona?: PersonaOption;
  error?: string;
};

type SessionSummary = {
  id: string;
  title: string;
  preview: string | null;
  personaId: string;
  persona?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    tagline?: string | null;
    isBuiltIn?: boolean;
  };
  createdAt: string | null;
  updatedAt: string | null;
};

type SessionsResponse = {
  sessions?: SessionSummary[];
  session?: SessionSummary;
  messages?: ChatMessage[];
  error?: string;
};

type SourceType = "youtube-transcript" | "whatsapp-chat" | "other";
type PersonaDialogMode = "create" | "edit";
type PersonaDialogStep = "source" | "review";
type PersonaReviewForm = {
  name: string;
  tagline: string;
  bio: string;
  identity: string;
  topics: string;
  starterPrompts: string;
  toneTraits: string;
  catchphrases: string;
  teachingPattern: string;
  fewShot: string;
};

const FALLBACK_PERSONAS: PersonaOption[] = [
  { id: "hitesh", name: "Hitesh", avatarUrl: "/hitesh.jpg", isBuiltIn: true },
  { id: "piyush", name: "Piyush", avatarUrl: "/piyush.jpg", isBuiltIn: true },
];

export function ChatWindow() {
  const [personas, setPersonas] = useState<PersonaOption[]>(FALLBACK_PERSONAS);
  const [activePersona, setActivePersona] = useState("hitesh");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPersonas, setIsLoadingPersonas] = useState(true);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isStartingSession, setIsStartingSession] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMobileLibraryOpen, setIsMobileLibraryOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<PersonaDialogMode>("create");
  const [isPersonaDialogOpen, setIsPersonaDialogOpen] = useState(false);
  const [personaBeingEdited, setPersonaBeingEdited] = useState<PersonaOption | null>(null);
  const [personaBeingDeleted, setPersonaBeingDeleted] = useState<PersonaOption | null>(null);
  const [sessionBeingDeleted, setSessionBeingDeleted] = useState<SessionSummary | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeletingPersona, setIsDeletingPersona] = useState(false);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(() =>
    readStoredSetting("persona-ai-compact-mode") === "true",
  );
  const [showProfileRail, setShowProfileRail] = useState(() =>
    readStoredSetting("persona-ai-show-profile-rail") !== "false",
  );
  const [personalApiKey, setPersonalApiKey] = useState(
    () => readStoredSetting("persona-ai-openrouter-key") ?? "",
  );
  const [preferredModel, setPreferredModel] = useState(
    () => readStoredSetting("persona-ai-model") ?? "openai/gpt-4o",
  );
  const didInitRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const currentPersona =
    personas.find((persona) => persona.id === activePersona) ?? personas[0] ?? FALLBACK_PERSONAS[0];

  useEffect(() => {
    localStorage.setItem("persona-ai-compact-mode", String(isCompactMode));
  }, [isCompactMode]);

  useEffect(() => {
    localStorage.setItem("persona-ai-show-profile-rail", String(showProfileRail));
  }, [showProfileRail]);

  useEffect(() => {
    if (personalApiKey.trim()) {
      localStorage.setItem("persona-ai-openrouter-key", personalApiKey.trim());
    } else {
      localStorage.removeItem("persona-ai-openrouter-key");
    }
  }, [personalApiKey]);

  useEffect(() => {
    localStorage.setItem("persona-ai-model", preferredModel.trim() || "openai/gpt-4o");
  }, [preferredModel]);

  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true);

    try {
      const response = await fetch("/api/sessions");
      const data = (await response.json()) as SessionsResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load sessions.");
      }

      setSessions(data.sessions ?? []);
      return data.sessions ?? [];
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      return [];
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  const openSession = useCallback(async (nextSessionId: string) => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStartingSession(true);
    setIsStreaming(false);
    setError(null);
    setMessages([]);

    try {
      const response = await fetch(`/api/sessions/${nextSessionId}`);
      const data = (await response.json()) as SessionsResponse;

      if (!response.ok || !data.session) {
        throw new Error(data.error ?? "Could not open session.");
      }

      setActivePersona(data.session.personaId);
      setSessionId(data.session.id);
      setMessages(data.messages ?? []);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsStartingSession(false);
    }
  }, []);

  const startNewDraft = useCallback((personaId: string) => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setError(null);
    setMessages([]);
    setSessionId(null);
    setActivePersona(personaId);
    setInput("");
    setIsStartingSession(false);
  }, []);

  const createSession = useCallback(async (personaId: string) => {
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId }),
      });
      const data = (await response.json()) as SessionsResponse;

      if (!response.ok || !data.session) {
        throw new Error(data.error ?? "Could not start session.");
      }

      setSessionId(data.session.id);
      setActivePersona(personaId);
      return data.session;
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      return null;
    }
  }, []);

  const openLatestSessionForPersona = useCallback(
    async (personaId: string) => {
      setActivePersona(personaId);
      const latestSession = sessions.find((session) => session.personaId === personaId);

      if (latestSession) {
        await openSession(latestSession.id);
        return;
      }

      startNewDraft(personaId);
    },
    [openSession, sessions, startNewDraft],
  );

  const loadPersonas = useCallback(async () => {
    setIsLoadingPersonas(true);

    try {
      const response = await fetch("/api/persona");
      const data = (await response.json()) as PersonaResponse;

      if (!response.ok || !data.personas?.length) {
        throw new Error(data.error ?? "Could not load personas.");
      }

      setPersonas(data.personas);
      return data.personas;
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      return FALLBACK_PERSONAS;
    } finally {
      setIsLoadingPersonas(false);
    }
  }, []);

  useEffect(() => {
    if (didInitRef.current) {
      return;
    }

    didInitRef.current = true;

    async function boot() {
      const loadedPersonas = await loadPersonas();
      const loadedSessions = await loadSessions();
      const firstPersonaId = loadedPersonas[0]?.id ?? "hitesh";
      const latestSession = loadedSessions.find(
        (session) => session.personaId === firstPersonaId,
      );

      if (latestSession) {
        await openSession(latestSession.id);
      } else {
        startNewDraft(firstPersonaId);
      }
    }

    void boot();
  }, [loadPersonas, loadSessions, openSession, startNewDraft]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextMessage = input.trim();

    if (!nextMessage || isStreaming || isStartingSession) {
      return;
    }

    let nextSessionId = sessionId;

    if (!nextSessionId) {
      setIsStartingSession(true);
      const createdSession = await createSession(activePersona);
      setIsStartingSession(false);

      if (!createdSession) {
        return;
      }

      nextSessionId = createdSession.id;
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
          sessionId: nextSessionId,
          personaId: activePersona,
          message: nextMessage,
          apiKey: personalApiKey.trim() || undefined,
          model: preferredModel.trim() || undefined,
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
      await loadSessions();
    }
  }

  function openCreatePersona() {
    setDialogMode("create");
    setPersonaBeingEdited(null);
    setIsPersonaDialogOpen(true);
  }

  function openEditPersona(persona: PersonaOption) {
    setDialogMode("edit");
    setPersonaBeingEdited(persona);
    setIsPersonaDialogOpen(true);
  }

  async function handlePersonaSaved(persona: PersonaOption) {
    const loadedPersonas = await loadPersonas();
    const nextPersona = loadedPersonas.find((item) => item.id === persona.id) ?? persona;
    setIsPersonaDialogOpen(false);
    setPersonaBeingEdited(null);
    startNewDraft(nextPersona.id);
  }

  async function handleDeletePersona() {
    if (!personaBeingDeleted) {
      return;
    }

    setIsDeletingPersona(true);

    try {
      const response = await fetch(`/api/persona/${personaBeingDeleted.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not delete persona.");
      }

      toast.success(`${personaBeingDeleted.name} deleted.`);
      const loadedPersonas = await loadPersonas();
      setPersonaBeingDeleted(null);

      if (personaBeingDeleted.id === activePersona) {
        startNewDraft(loadedPersonas[0]?.id ?? "hitesh");
      }
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
    } finally {
      setIsDeletingPersona(false);
    }
  }

  async function handleDeleteSession() {
    if (!sessionBeingDeleted) {
      return;
    }

    setIsDeletingSession(true);

    try {
      const response = await fetch(`/api/sessions/${sessionBeingDeleted.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not delete chat.");
      }

      toast.success("Chat deleted.");
      const deletedSession = sessionBeingDeleted;
      setSessionBeingDeleted(null);
      await loadSessions();

      if (deletedSession.id === sessionId) {
        startNewDraft(deletedSession.personaId);
      }
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
    } finally {
      setIsDeletingSession(false);
    }
  }

  const canSend = Boolean(input.trim()) && !isStreaming && !isStartingSession;

  return (
    <div
      className={cn(
        "grid h-dvh max-h-dvh overflow-hidden bg-muted/25 text-foreground lg:grid-cols-[18rem_minmax(0,1fr)]",
        showProfileRail && "xl:grid-cols-[18rem_minmax(0,1fr)_17rem]",
      )}
    >
      <aside className="hidden min-h-0 min-w-0 overflow-hidden border-r bg-sidebar/95 text-sidebar-foreground lg:block">
        <PersonaLibrary
          activePersonaId={activePersona}
          activeSessionId={sessionId}
          disabled={isStreaming || isStartingSession}
          isLoading={isLoadingPersonas || isLoadingSessions}
          personas={personas}
          sessions={sessions}
          onCreate={openCreatePersona}
          onDeleteSession={setSessionBeingDeleted}
          onNewChat={startNewDraft}
          onSelectPersona={(personaId) => void openLatestSessionForPersona(personaId)}
          onSelectSession={(nextSessionId) => void openSession(nextSessionId)}
        />
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-background">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={isMobileLibraryOpen} onOpenChange={setIsMobileLibraryOpen}>
              <SheetTrigger render={<Button variant="ghost" size="icon-sm" className="lg:hidden" />}>
                <MenuIcon />
                <span className="sr-only">Open personas</span>
              </SheetTrigger>
              <SheetContent side="left" className="w-[20rem] p-0">
                <SheetHeader className="border-b">
                  <SheetTitle>Personas</SheetTitle>
                </SheetHeader>
                <PersonaLibrary
                  activePersonaId={activePersona}
                  activeSessionId={sessionId}
                  disabled={isStreaming || isStartingSession}
                  isLoading={isLoadingPersonas || isLoadingSessions}
                  personas={personas}
                  sessions={sessions}
                  onCreate={() => {
                    setIsMobileLibraryOpen(false);
                    openCreatePersona();
                  }}
                  onDeleteSession={(session) => {
                    setIsMobileLibraryOpen(false);
                    setSessionBeingDeleted(session);
                  }}
                  onNewChat={(personaId) => {
                    setIsMobileLibraryOpen(false);
                    startNewDraft(personaId);
                  }}
                  onSelectPersona={(personaId) => {
                    setIsMobileLibraryOpen(false);
                    void openLatestSessionForPersona(personaId);
                  }}
                  onSelectSession={(nextSessionId) => {
                    setIsMobileLibraryOpen(false);
                    void openSession(nextSessionId);
                  }}
                />
              </SheetContent>
            </Sheet>
            <PersonaAvatar persona={currentPersona} />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">{currentPersona.name}</h1>
              <p className="truncate text-xs text-muted-foreground">
                {sessionId ? currentPersona.tagline ?? "Conversation open" : "Draft chat ready"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="hidden sm:inline-flex">
              GPT-4o
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isStreaming || isStartingSession}
              onClick={() => startNewDraft(activePersona)}
            >
              <PlusIcon />
              New chat
            </Button>
            <ThemeToggle />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Open settings"
                    onClick={() => setIsSettingsOpen(true)}
                  />
                }
              >
                <SettingsIcon />
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Sign out"
                    onClick={() => {
                      void authClient.signOut({
                        fetchOptions: {
                          onSuccess: () => {
                            window.location.href = "/";
                          },
                        },
                      });
                    }}
                  />
                }
              >
                <LogOutIcon />
              </TooltipTrigger>
              <TooltipContent>Sign out</TooltipContent>
            </Tooltip>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_var(--muted),_transparent_28rem)]">
          {error ? (
            <Alert variant="destructive" className="m-4">
              <AlertCircleIcon />
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <MessageScrollerProvider>
            <MessageScroller className="min-h-0 flex-1">
              <MessageScrollerViewport>
                <MessageScrollerContent
                  className={cn(
                    "mx-auto w-full max-w-3xl px-4",
                    isCompactMode ? "gap-2 py-3" : "gap-4 py-6",
                  )}
                >
                  {messages.length === 0 ? (
                    <EmptyChat
                      isStartingSession={isStartingSession}
                      persona={currentPersona}
                      onPromptClick={setInput}
                    />
                  ) : (
                    <MessageGroup className="flex w-full gap-4">
                      {messages.map((message) => (
                        <MessageScrollerItem key={message.id}>
                          <Message
                            align={message.role === "user" ? "end" : "start"}
                            className="min-w-0"
                          >
                            <MessageContent className="min-w-0 max-w-[min(42rem,85%)]">
                              <MessageHeader>
                                {message.role === "user" ? "You" : currentPersona.name}
                              </MessageHeader>
                              <Bubble
                                align={message.role === "user" ? "end" : "start"}
                                variant={message.role === "user" ? "default" : "muted"}
                              >
                                <BubbleContent
                                  className={cn(
                                    "min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
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
                        </MessageScrollerItem>
                      ))}
                    </MessageGroup>
                  )}
                  <MessageScrollerItem scrollAnchor />
                </MessageScrollerContent>
                <MessageScrollerButton />
              </MessageScrollerViewport>
            </MessageScroller>
          </MessageScrollerProvider>

          <form onSubmit={handleSubmit} className="border-t bg-background p-3">
            <div className="mx-auto flex max-w-3xl items-end gap-2">
              <Label htmlFor="chat-message" className="sr-only">
                Message
              </Label>
              <Textarea
                id="chat-message"
                name="message"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                disabled={isStartingSession}
                placeholder={`Message ${currentPersona.name}…`}
                className="max-h-36 min-h-12 flex-1 bg-background shadow-sm"
              />
              <Button type="submit" size="icon-lg" disabled={!canSend} aria-label="Send message">
                {isStreaming ? <Spinner /> : <SendIcon />}
              </Button>
            </div>
          </form>
        </main>
      </section>

      <aside
        className={cn(
          "hidden min-h-0 overflow-hidden border-l bg-background/80 xl:block",
          !showProfileRail && "xl:hidden",
        )}
      >
        <PersonaDetails
          persona={currentPersona}
          onCreate={openCreatePersona}
          onDelete={setPersonaBeingDeleted}
          onEdit={openEditPersona}
        />
      </aside>

      <SettingsDialog
        compactMode={isCompactMode}
        model={preferredModel}
        open={isSettingsOpen}
        personalApiKey={personalApiKey}
        showProfileRail={showProfileRail}
        onCompactModeChange={setIsCompactMode}
        onModelChange={setPreferredModel}
        onOpenChange={setIsSettingsOpen}
        onPersonalApiKeyChange={setPersonalApiKey}
        onShowProfileRailChange={setShowProfileRail}
      />

      <PersonaEditorDialog
        key={`${dialogMode}-${personaBeingEdited?.id ?? "new"}-${isPersonaDialogOpen}`}
        mode={dialogMode}
        open={isPersonaDialogOpen}
        persona={personaBeingEdited}
        onOpenChange={setIsPersonaDialogOpen}
        onSaved={(persona) => void handlePersonaSaved(persona)}
      />

      <Dialog
        open={Boolean(personaBeingDeleted)}
        onOpenChange={(open) => {
          if (!open) {
            setPersonaBeingDeleted(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete custom persona?</DialogTitle>
            <DialogDescription>
              This removes the persona and its chat sessions. Built-in examples cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPersonaBeingDeleted(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeletingPersona}
              onClick={() => void handleDeletePersona()}
            >
              {isDeletingPersona ? <Spinner /> : <Trash2Icon />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(sessionBeingDeleted)}
        onOpenChange={(open) => {
          if (!open) {
            setSessionBeingDeleted(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete chat?</DialogTitle>
            <DialogDescription>
              This removes the conversation and its messages. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSessionBeingDeleted(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeletingSession}
              onClick={() => void handleDeleteSession()}
            >
              {isDeletingSession ? <Spinner /> : <Trash2Icon />}
              Delete chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PersonaLibrary({
  activeSessionId,
  activePersonaId,
  disabled,
  isLoading,
  personas,
  sessions,
  onCreate,
  onDeleteSession,
  onNewChat,
  onSelectPersona,
  onSelectSession,
}: {
  activeSessionId: string | null;
  activePersonaId: string;
  disabled: boolean;
  isLoading: boolean;
  personas: PersonaOption[];
  sessions: SessionSummary[];
  onCreate: () => void;
  onDeleteSession: (session: SessionSummary) => void;
  onNewChat: (personaId: string) => void;
  onSelectPersona: (personaId: string) => void;
  onSelectSession: (sessionId: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2 font-semibold">
          <LibraryIcon className="size-4" />
          PersonaAI
        </div>
        <Button type="button" size="icon-sm" onClick={onCreate} aria-label="New persona">
          <PlusIcon />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1 p-2">
        <div className="grid min-w-0 gap-2">
          {isLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20 rounded-lg" />
              ))
            : personas.map((persona) => {
                const personaSessions = sessions
                  .filter((session) => session.personaId === persona.id)
                  .slice(0, 6);
                const isActivePersona = persona.id === activePersonaId;
                const hasActiveSession = personaSessions.some(
                  (session) => session.id === activeSessionId,
                );

                return (
                  <Collapsible
                    key={persona.id}
                    defaultOpen={isActivePersona || hasActiveSession}
                    className="min-w-0 overflow-hidden rounded-lg border bg-background/70 shadow-sm"
                  >
                    <div className="flex min-w-0 items-center gap-1 p-1.5">
                      <CollapsibleTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0 text-muted-foreground"
                            aria-label={`Toggle ${persona.name} chats`}
                          />
                        }
                      >
                        <ChevronDownIcon />
                      </CollapsibleTrigger>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onSelectPersona(persona.id)}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 rounded-md p-2 text-left transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                          isActivePersona && "bg-muted",
                        )}
                      >
                        <PersonaAvatar persona={persona} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{persona.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {persona.tagline ??
                              (persona.isBuiltIn ? "Example persona" : "Custom persona")}
                          </span>
                        </span>
                        {persona.isBuiltIn ? <Badge variant="secondary">Example</Badge> : null}
                      </button>
                    </div>

                    <CollapsibleContent>
                      <div className="grid min-w-0 gap-1 px-1.5 pb-2 pl-8">
                        {personaSessions.length > 0 ? (
                          personaSessions.map((session) => (
                            <ChatHistoryRow
                              key={session.id}
                              disabled={disabled}
                              isActive={session.id === activeSessionId}
                              session={session}
                              onDelete={onDeleteSession}
                              onSelect={onSelectSession}
                            />
                          ))
                        ) : (
                          <div className="rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">
                            No saved chats yet.
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="mt-1 w-fit justify-start px-2"
                          disabled={disabled}
                          onClick={() => onNewChat(persona.id)}
                        >
                          <PlusIcon />
                          New chat
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
        </div>
      </ScrollArea>
    </div>
  );
}

function ChatHistoryRow({
  disabled,
  isActive,
  onDelete,
  onSelect,
  session,
}: {
  disabled: boolean;
  isActive: boolean;
  onDelete: (session: SessionSummary) => void;
  onSelect: (sessionId: string) => void;
  session: SessionSummary;
}) {
  const title = session.title === "New chat" ? "Untitled chat" : session.title;

  return (
    <div
      className={cn(
        "group flex min-w-0 max-w-full items-start gap-1 overflow-hidden rounded-md transition hover:bg-muted",
        isActive && "bg-muted text-foreground",
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(session.id)}
        className="min-w-0 flex-1 overflow-hidden rounded-md px-2.5 py-2 text-left focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        <span className="flex min-w-0 items-center gap-2">
          <MessageSquareIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs font-medium">{title}</span>
        </span>
        <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {session.preview ?? "Saved conversation."}
        </span>
        <span className="mt-1 block text-[11px] text-muted-foreground">
          {formatSessionDate(session.updatedAt ?? session.createdAt)}
        </span>
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={`Delete ${title}`}
        onClick={() => onDelete(session)}
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}

function SettingsDialog({
  compactMode,
  model,
  onCompactModeChange,
  onModelChange,
  onOpenChange,
  onPersonalApiKeyChange,
  onShowProfileRailChange,
  open,
  personalApiKey,
  showProfileRail,
}: {
  compactMode: boolean;
  model: string;
  onCompactModeChange: (enabled: boolean) => void;
  onModelChange: (model: string) => void;
  onOpenChange: (open: boolean) => void;
  onPersonalApiKeyChange: (apiKey: string) => void;
  onShowProfileRailChange: (enabled: boolean) => void;
  open: boolean;
  personalApiKey: string;
  showProfileRail: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Tune the chat layout and use your own OpenRouter credentials for messages.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <div className="grid gap-3 rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <PanelRightIcon className="size-4 text-muted-foreground" />
              Interface
            </div>
            <SettingSwitch
              checked={compactMode}
              description="Reduce vertical spacing in the conversation."
              label="Compact Chat"
              onCheckedChange={onCompactModeChange}
            />
            <SettingSwitch
              checked={showProfileRail}
              description="Show the persona profile panel on wide screens."
              label="Profile Rail"
              onCheckedChange={onShowProfileRailChange}
            />
          </div>

          <div className="grid gap-3 rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <KeyRoundIcon className="size-4 text-muted-foreground" />
              OpenRouter
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settings-openrouter-key">API Key</Label>
              <Input
                id="settings-openrouter-key"
                name="openrouter-api-key"
                type="password"
                autoComplete="off"
                value={personalApiKey}
                onChange={(event) => onPersonalApiKeyChange(event.target.value)}
                placeholder="sk-or-…"
              />
              <p className="text-xs text-muted-foreground">
                Stored in this browser and sent only with chat requests.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settings-openrouter-model">Model</Label>
              <Input
                id="settings-openrouter-model"
                name="openrouter-model"
                autoComplete="off"
                value={model}
                onChange={(event) => onModelChange(event.target.value)}
                placeholder="openai/gpt-4o"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingSwitch({
  checked,
  description,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md p-2 hover:bg-muted">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </label>
  );
}

function PersonaDetails({
  persona,
  onCreate,
  onDelete,
  onEdit,
}: {
  persona: PersonaOption;
  onCreate: () => void;
  onDelete: (persona: PersonaOption) => void;
  onEdit: (persona: PersonaOption) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-16 items-center justify-between border-b px-4">
        <div className="text-sm font-semibold">Persona profile</div>
        <Button type="button" variant="outline" size="sm" onClick={onCreate}>
          <PlusIcon />
          New
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-4">
          <div className="flex items-center gap-3">
            <PersonaAvatar persona={persona} size="lg" />
            <div className="min-w-0">
              <h2 className="truncate font-semibold">{persona.name}</h2>
              <p className="text-sm text-muted-foreground">
                {persona.tagline ?? "Custom chat persona"}
              </p>
            </div>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {persona.bio ?? "This persona is ready for a focused chat session."}
          </p>
          <div className="flex flex-wrap gap-2">
            {(persona.topics?.length ? persona.topics : ["Conversation", "Style"]).map((topic) => (
              <Badge key={topic} variant="outline">
                {topic}
              </Badge>
            ))}
          </div>
          <div className="rounded-2xl border bg-background p-3 text-sm">
            <div className="text-xs font-medium uppercase text-muted-foreground">
              Source count
            </div>
            <div className="mt-1 font-medium">{persona.sourceCount ?? 0}</div>
          </div>
          <div className="grid gap-2">
            {persona.isBuiltIn ? (
              <Alert>
                <BotIcon />
                <AlertTitle>Example persona</AlertTitle>
                <AlertDescription>
                  Hitesh and Piyush are built-in examples. Create your own persona to edit or delete it.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => onEdit(persona)}>
                  <PencilIcon />
                  Edit or regenerate
                </Button>
                <Button type="button" variant="destructive" onClick={() => onDelete(persona)}>
                  <Trash2Icon />
                  Delete persona
                </Button>
              </>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function EmptyChat({
  isStartingSession,
  persona,
  onPromptClick,
}: {
  isStartingSession: boolean;
  persona: PersonaOption;
  onPromptClick: (prompt: string) => void;
}) {
  if (isStartingSession) {
    return (
      <div className="flex min-h-72 flex-1 items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    );
  }

  const prompts = persona.starterPrompts?.length
    ? persona.starterPrompts
    : [
        "Explain your approach to learning this topic.",
        "Give me a practical starter roadmap.",
        "Review this idea and suggest improvements.",
      ];

  return (
    <div className="flex min-h-72 flex-1 items-center justify-center">
      <div className="w-full max-w-xl text-center">
        <PersonaAvatar persona={persona} size="lg" className="mx-auto mb-4 size-16" />
        <h2 className="text-xl font-semibold text-pretty">Start a chat with {persona.name}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {persona.bio ?? persona.tagline ?? "Pick a starter or write anything in the composer."}
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {prompts.slice(0, 3).map((prompt) => (
            <Button
              key={prompt}
              type="button"
              variant="outline"
              className="h-auto min-h-16 whitespace-normal rounded-lg bg-background/80 text-wrap shadow-sm"
              onClick={() => onPromptClick(prompt)}
            >
              {prompt}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PersonaEditorDialog({
  mode,
  open,
  persona,
  onOpenChange,
  onSaved,
}: {
  mode: PersonaDialogMode;
  open: boolean;
  persona: PersonaOption | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (persona: PersonaOption) => void;
}) {
  const initialDraft = persona?.personaData ?? (persona ? personaToDraft(persona) : null);
  const [name, setName] = useState(initialDraft?.name ?? "");
  const [step, setStep] = useState<PersonaDialogStep>(
    mode === "edit" && initialDraft ? "review" : "source",
  );
  const [sourceType, setSourceType] = useState<SourceType>("youtube-transcript");
  const [sourceText, setSourceText] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<PersonaData | null>(initialDraft);
  const [reviewForm, setReviewForm] = useState<PersonaReviewForm>(
    initialDraft ? personaToReviewForm(initialDraft) : createEmptyReviewForm(),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleGenerate() {
    setIsGenerating(true);

    try {
      const body = new FormData();
      body.set("name", name.trim());
      body.set("sourceType", sourceType);

      if (sourceFile) {
        body.set("file", sourceFile);
      } else {
        body.set("sourceText", sourceText);
      }

      const response = await fetch("/api/persona/generate", {
        method: "POST",
        body,
      });
      const data = (await response.json()) as { persona?: PersonaData; error?: string };

      if (!response.ok || !data.persona) {
        throw new Error(data.error ?? "Could not generate persona.");
      }

      setDraft(data.persona);
      setReviewForm(personaToReviewForm(data.persona));
      setName(data.persona.name);
      setStep("review");
      toast.success("Draft generated. Review it, then save to your library.");
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    if (!draft) {
      return;
    }

    const nextDraft = reviewFormToPersonaData(reviewForm, draft);
    setIsSaving(true);

    try {
      const endpoint = mode === "edit" && persona ? `/api/persona/${persona.id}` : "/api/persona/save";
      const response = await fetch(endpoint, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: nextDraft }),
      });
      const data = (await response.json()) as { persona?: PersonaOption; error?: string };

      if (!response.ok || !data.persona) {
        throw new Error(data.error ?? "Could not save persona.");
      }

      toast.success(mode === "edit" ? "Persona updated." : "Persona saved.");
      setDraft(nextDraft);
      onSaved(data.persona);
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
    } finally {
      setIsSaving(false);
    }
  }

  const canGenerate = name.trim().length >= 2 && (sourceFile || sourceText.trim().length >= 200);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b p-6 pb-4">
          <DialogTitle>{mode === "edit" ? "Edit persona" : "Create persona"}</DialogTitle>
          <DialogDescription>
            Paste a transcript or upload a .txt file. Only the compact persona draft is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b px-6 py-3">
          <StepPill active={step === "source"} index={1} label="Source" />
          <div className="h-px flex-1 bg-border" />
          <StepPill active={step === "review"} index={2} label="Review & Save" />
        </div>

        {step === "source" ? (
          <div className="min-h-0 space-y-4 overflow-y-auto p-6">
            {draft ? (
              <Alert className="mb-4">
                <FileTextIcon />
                <AlertTitle>Draft ready</AlertTitle>
                <AlertDescription>
                  You already generated a draft. Review it or generate again with new source text.
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="persona-name">Persona name</Label>
              <Input
                id="persona-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="My favorite teacher"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source-type">Source type</Label>
              <NativeSelect
                id="source-type"
                className="w-full"
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value as SourceType)}
              >
                <NativeSelectOption value="youtube-transcript">YouTube transcript</NativeSelectOption>
                <NativeSelectOption value="whatsapp-chat">WhatsApp chat</NativeSelectOption>
                <NativeSelectOption value="other">Other text</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source-file">Upload .txt file</Label>
              <Input
                id="source-file"
                type="file"
                accept=".txt,text/plain"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setSourceFile(event.target.files?.[0] ?? null)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source-text">Or paste text</Label>
              <Textarea
                id="source-text"
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder="Paste transcript or chat export..."
                className="min-h-40"
              />
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              {draft ? (
              <>
                <div className="mb-5 rounded-3xl border bg-muted/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold">
                        {reviewForm.name || "Untitled persona"}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {reviewForm.tagline || "Private custom persona"}
                      </div>
                    </div>
                    <Badge variant="secondary">Private custom persona</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {lineStringToArray(reviewForm.topics)
                      .slice(0, 5)
                      .map((topic) => (
                        <Badge key={topic} variant="outline">
                          {topic}
                        </Badge>
                      ))}
                  </div>
                </div>

                <div className="grid gap-3">
                  <DraftField
                    name="review-name"
                    label="Name"
                    value={reviewForm.name}
                    onChange={(value) => setReviewField("name", value)}
                  />
                  <DraftField
                    name="review-tagline"
                    label="Tagline"
                    value={reviewForm.tagline}
                    onChange={(value) => setReviewField("tagline", value)}
                  />
                  <DraftArea
                    name="review-bio"
                    label="Bio"
                    value={reviewForm.bio}
                    rows={2}
                    onChange={(value) => setReviewField("bio", value)}
                  />
                  <DraftArea
                    name="review-identity"
                    label="Identity"
                    value={reviewForm.identity}
                    rows={3}
                    onChange={(value) => setReviewField("identity", value)}
                  />
                <DraftArea
                  name="review-topics"
                  label="Topics"
                  value={reviewForm.topics}
                  rows={3}
                  onChange={(value) => setReviewField("topics", value)}
                />
                <DraftArea
                  name="review-starter-prompts"
                  label="Starter prompts"
                  value={reviewForm.starterPrompts}
                  rows={3}
                  onChange={(value) => setReviewField("starterPrompts", value)}
                />
                <DraftArea
                  name="review-tone-traits"
                  label="Tone traits"
                  value={reviewForm.toneTraits}
                  rows={3}
                  onChange={(value) => setReviewField("toneTraits", value)}
                />
                <DraftArea
                  name="review-catchphrases"
                  label="Catchphrases"
                  value={reviewForm.catchphrases}
                  rows={3}
                  onChange={(value) => setReviewField("catchphrases", value)}
                />
                <DraftField
                  name="review-teaching-pattern"
                  label="Response pattern"
                  value={reviewForm.teachingPattern}
                  onChange={(value) => setReviewField("teachingPattern", value)}
                />
                <DraftArea
                  name="review-few-shot"
                  label="Few-shot examples"
                  value={reviewForm.fewShot}
                  rows={4}
                  onChange={(value) => setReviewField("fewShot", value)}
                />
                </div>
              </>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed p-8 text-center">
                <UploadIcon className="mb-3 size-8 text-muted-foreground" />
                <h3 className="font-medium">Generate a draft to review</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add at least 200 characters of source text or upload a .txt file.
                </p>
              </div>
            )}
            </div>
          </>
        )}

        <DialogFooter className="sticky bottom-0 border-t bg-popover p-4">
          {step === "review" ? (
            <Button type="button" variant="outline" onClick={() => setStep("source")}>
              <SparklesIcon />
              Regenerate from source
            </Button>
          ) : draft ? (
            <Button type="button" variant="outline" onClick={() => setStep("review")}>
              Review draft
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          {step === "source" ? (
            <Button
              type="button"
              disabled={!canGenerate || isGenerating}
              onClick={() => void handleGenerate()}
            >
              {isGenerating ? <Spinner /> : <SparklesIcon />}
              Generate draft
            </Button>
          ) : (
            <Button type="button" disabled={!draft || isSaving} onClick={() => void handleSave()}>
              {isSaving ? <Spinner /> : <FileTextIcon />}
              {mode === "edit" ? "Save changes" : "Save persona"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  function setReviewField(field: keyof PersonaReviewForm, value: string) {
    setReviewForm((currentForm) => ({ ...currentForm, [field]: value }));
  }
}

function DraftField({
  label,
  name,
  onChange,
  value,
}: {
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function DraftArea({
  label,
  name,
  onChange,
  rows,
  value,
}: {
  label: string;
  name: string;
  onChange: (value: string) => void;
  rows: number;
  value: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} value={value} rows={rows} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function StepPill({
  active,
  index,
  label,
}: {
  active: boolean;
  index: number;
  label: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-2xl px-2 py-1 text-xs font-medium",
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      <span className="flex size-5 items-center justify-center rounded-full bg-background/20">
        {index}
      </span>
      {label}
    </div>
  );
}

function PersonaAvatar({
  className,
  persona,
  size,
}: {
  className?: string;
  persona: PersonaOption;
  size?: "default" | "sm" | "lg";
}) {
  return (
    <Avatar size={size} className={className}>
      {persona.avatarUrl ? <AvatarImage src={persona.avatarUrl} alt={persona.name} /> : null}
      <AvatarFallback>{getInitials(persona.name)}</AvatarFallback>
    </Avatar>
  );
}

function createEmptyReviewForm(): PersonaReviewForm {
  return {
    name: "",
    tagline: "",
    bio: "",
    identity: "",
    topics: "",
    starterPrompts: "",
    toneTraits: "",
    catchphrases: "",
    teachingPattern:
      "understand the question -> answer in style -> give a practical next step",
    fewShot: "",
  };
}

function personaToReviewForm(persona: PersonaData): PersonaReviewForm {
  return {
    name: persona.name,
    tagline: persona.tagline ?? "",
    bio: persona.bio ?? "",
    identity: persona.identity,
    topics: (persona.topics ?? []).join("\n"),
    starterPrompts: (persona.starter_prompts ?? []).join("\n"),
    toneTraits: persona.tone_traits.join("\n"),
    catchphrases: persona.catchphrases.join("\n"),
    teachingPattern: persona.teaching_pattern,
    fewShot: persona.few_shot.map((item) => `${item.q} | ${item.a}`).join("\n"),
  };
}

function reviewFormToPersonaData(
  form: PersonaReviewForm,
  previousDraft: PersonaData,
): PersonaData {
  return {
    ...previousDraft,
    name: form.name.trim() || previousDraft.name,
    tagline: form.tagline.trim() || "Custom persona",
    bio: form.bio.trim() || previousDraft.bio || previousDraft.identity,
    identity: form.identity.trim() || previousDraft.identity,
    topics: lineStringToArray(form.topics),
    starter_prompts: lineStringToArray(form.starterPrompts).slice(0, 4),
    tone_traits: lineStringToArray(form.toneTraits),
    catchphrases: lineStringToArray(form.catchphrases),
    teaching_pattern: form.teachingPattern.trim() || previousDraft.teaching_pattern,
    few_shot: fewShotStringToArray(form.fewShot),
  };
}

function lineStringToArray(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function fewShotStringToArray(value: string) {
  return value
    .split("\n")
    .map((line) => parseFewShotLine(line))
    .filter((item): item is { q: string; a: string } => Boolean(item))
    .slice(0, 8);
}

function parseFewShotLine(line: string) {
  const [q, ...answerParts] = line.split("|");
  const a = answerParts.join("|");

  return q?.trim() && a?.trim() ? { q: q.trim(), a: a.trim() } : null;
}

function personaToDraft(persona: PersonaOption): PersonaData {
  return {
    persona_id: persona.id,
    name: persona.name,
    avatar_url: persona.avatarUrl ?? undefined,
    tagline: persona.tagline ?? "Custom persona",
    bio: persona.bio ?? persona.tagline ?? "Custom persona",
    identity: persona.bio ?? `${persona.name} responds in the captured style.`,
    catchphrases: [],
    tone_traits: persona.topics ?? [],
    teaching_pattern: "understand the question -> answer in style -> give a practical next step",
    topics: persona.topics ?? [],
    starter_prompts: persona.starterPrompts ?? [],
    few_shot: [],
    source_count: persona.sourceCount ?? 1,
  };
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

function readStoredSetting(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(key);
}

function formatSessionDate(value: string | null) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
