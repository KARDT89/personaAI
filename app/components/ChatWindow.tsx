"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircleIcon,
  BotIcon,
  FileTextIcon,
  LibraryIcon,
  LogOutIcon,
  MenuIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
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

type SourceType = "youtube-transcript" | "whatsapp-chat" | "other";
type PersonaDialogMode = "create" | "edit";

const FALLBACK_PERSONAS: PersonaOption[] = [
  { id: "hitesh", name: "Hitesh", avatarUrl: "/hitesh.jpg", isBuiltIn: true },
  { id: "piyush", name: "Piyush", avatarUrl: "/piyush.jpg", isBuiltIn: true },
];

export function ChatWindow() {
  const [personas, setPersonas] = useState<PersonaOption[]>(FALLBACK_PERSONAS);
  const [activePersona, setActivePersona] = useState("hitesh");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPersonas, setIsLoadingPersonas] = useState(true);
  const [isStartingSession, setIsStartingSession] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMobileLibraryOpen, setIsMobileLibraryOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<PersonaDialogMode>("create");
  const [isPersonaDialogOpen, setIsPersonaDialogOpen] = useState(false);
  const [personaBeingEdited, setPersonaBeingEdited] = useState<PersonaOption | null>(null);
  const [personaBeingDeleted, setPersonaBeingDeleted] = useState<PersonaOption | null>(null);
  const [isDeletingPersona, setIsDeletingPersona] = useState(false);
  const didInitRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const currentPersona =
    personas.find((persona) => persona.id === activePersona) ?? personas[0] ?? FALLBACK_PERSONAS[0];

  const createSession = useCallback(async (personaId: string) => {
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
      await createSession(loadedPersonas[0]?.id ?? "hitesh");
    }

    void boot();
  }, [createSession, loadPersonas]);

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
    await createSession(nextPersona.id);
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
        await createSession(loadedPersonas[0]?.id ?? "hitesh");
      }
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
    } finally {
      setIsDeletingPersona(false);
    }
  }

  const canSend = Boolean(input.trim()) && Boolean(sessionId) && !isStreaming;

  return (
    <div className="grid min-h-dvh bg-background text-foreground lg:grid-cols-[18rem_minmax(0,1fr)_20rem]">
      <aside className="hidden border-r bg-sidebar text-sidebar-foreground lg:block">
        <PersonaLibrary
          activePersonaId={activePersona}
          disabled={isStreaming || isStartingSession}
          isLoading={isLoadingPersonas}
          personas={personas}
          onCreate={openCreatePersona}
          onSelect={(personaId) => void createSession(personaId)}
        />
      </aside>

      <section className="flex min-h-dvh min-w-0 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-background/95 px-4">
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
                  disabled={isStreaming || isStartingSession}
                  isLoading={isLoadingPersonas}
                  personas={personas}
                  onCreate={() => {
                    setIsMobileLibraryOpen(false);
                    openCreatePersona();
                  }}
                  onSelect={(personaId) => {
                    setIsMobileLibraryOpen(false);
                    void createSession(personaId);
                  }}
                />
              </SheetContent>
            </Sheet>
            <PersonaAvatar persona={currentPersona} />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">{currentPersona.name}</h1>
              <p className="truncate text-xs text-muted-foreground">
                {currentPersona.tagline ?? "Ready to chat"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="hidden sm:inline-flex">
              GPT-4o
            </Badge>
            <ThemeToggle />
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

        <main className="flex min-h-0 flex-1 flex-col">
          {error ? (
            <Alert variant="destructive" className="m-4">
              <AlertCircleIcon />
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <ScrollArea className="min-h-0 flex-1">
            <MessageGroup className="mx-auto flex min-h-[calc(100dvh-9rem)] w-full max-w-3xl justify-end gap-4 px-4 py-6">
              {messages.length === 0 ? (
                <EmptyChat
                  isStartingSession={isStartingSession}
                  persona={currentPersona}
                  onPromptClick={setInput}
                />
              ) : (
                messages.map((message) => (
                  <Message
                    key={message.id}
                    align={message.role === "user" ? "end" : "start"}
                  >
                    <MessageContent>
                      <MessageHeader>
                        {message.role === "user" ? "You" : currentPersona.name}
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

          <form onSubmit={handleSubmit} className="border-t bg-background p-3">
            <div className="mx-auto flex max-w-3xl items-end gap-2">
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
                placeholder={`Message ${currentPersona.name}`}
                className="max-h-36 min-h-12 flex-1"
              />
              <Button type="submit" size="icon-lg" disabled={!canSend} aria-label="Send message">
                {isStreaming ? <Spinner /> : <SendIcon />}
              </Button>
            </div>
          </form>
        </main>
      </section>

      <aside className="hidden border-l bg-muted/20 lg:block">
        <PersonaDetails
          persona={currentPersona}
          onCreate={openCreatePersona}
          onDelete={setPersonaBeingDeleted}
          onEdit={openEditPersona}
        />
      </aside>

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
    </div>
  );
}

function PersonaLibrary({
  activePersonaId,
  disabled,
  isLoading,
  personas,
  onCreate,
  onSelect,
}: {
  activePersonaId: string;
  disabled: boolean;
  isLoading: boolean;
  personas: PersonaOption[];
  onCreate: () => void;
  onSelect: (personaId: string) => void;
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
      <ScrollArea className="min-h-0 flex-1 p-3">
        <div className="grid gap-2">
          {isLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 rounded-2xl" />
              ))
            : personas.map((persona) => (
                <button
                  key={persona.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(persona.id)}
                  className={cn(
                    "flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition hover:bg-muted disabled:opacity-60",
                    persona.id === activePersonaId && "border-primary bg-muted",
                  )}
                >
                  <PersonaAvatar persona={persona} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{persona.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {persona.tagline ?? (persona.isBuiltIn ? "Example persona" : "Custom persona")}
                    </span>
                  </span>
                  {persona.isBuiltIn ? <Badge variant="secondary">Example</Badge> : null}
                </button>
              ))}
        </div>
      </ScrollArea>
    </div>
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
      <div className="flex min-h-[calc(100dvh-12rem)] items-center justify-center">
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
    <div className="flex min-h-[calc(100dvh-12rem)] items-center justify-center">
      <div className="w-full max-w-xl text-center">
        <PersonaAvatar persona={persona} size="lg" className="mx-auto mb-4 size-16" />
        <h2 className="text-xl font-semibold">{persona.name} is ready.</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {persona.bio ?? persona.tagline ?? "Start with a prompt or ask anything in this persona's style."}
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {prompts.slice(0, 3).map((prompt) => (
            <Button
              key={prompt}
              type="button"
              variant="outline"
              className="h-auto min-h-16 whitespace-normal rounded-2xl text-wrap"
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
  const [sourceType, setSourceType] = useState<SourceType>("youtube-transcript");
  const [sourceText, setSourceText] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<PersonaData | null>(initialDraft);
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
      toast.success("Draft persona generated.");
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft) {
      return;
    }

    const nextDraft = readPersonaDraftFromForm(new FormData(event.currentTarget), draft);
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
      <DialogContent className="max-h-[92dvh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit persona" : "Create persona"}</DialogTitle>
          <DialogDescription>
            Paste a transcript or upload a .txt file. Only the compact persona draft is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-4 overflow-y-auto pr-1 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
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
            <Button
              type="button"
              className="w-full"
              disabled={!canGenerate || isGenerating}
              onClick={() => void handleGenerate()}
            >
              {isGenerating ? <Spinner /> : <SparklesIcon />}
              Generate draft
            </Button>
          </div>

          <form onSubmit={handleSave} className="space-y-3">
            {draft ? (
              <>
                <DraftField name="name" label="Name" defaultValue={draft.name} />
                <DraftField name="tagline" label="Tagline" defaultValue={draft.tagline ?? ""} />
                <DraftArea name="bio" label="Bio" defaultValue={draft.bio ?? ""} rows={2} />
                <DraftArea name="identity" label="Identity" defaultValue={draft.identity} rows={3} />
                <DraftArea
                  name="topics"
                  label="Topics"
                  defaultValue={(draft.topics ?? []).join("\n")}
                  rows={3}
                />
                <DraftArea
                  name="starter_prompts"
                  label="Starter prompts"
                  defaultValue={(draft.starter_prompts ?? []).join("\n")}
                  rows={3}
                />
                <DraftArea
                  name="tone_traits"
                  label="Tone traits"
                  defaultValue={draft.tone_traits.join("\n")}
                  rows={3}
                />
                <DraftArea
                  name="catchphrases"
                  label="Catchphrases"
                  defaultValue={draft.catchphrases.join("\n")}
                  rows={3}
                />
                <DraftField
                  name="teaching_pattern"
                  label="Response pattern"
                  defaultValue={draft.teaching_pattern}
                />
                <DraftArea
                  name="few_shot"
                  label="Few-shot examples"
                  defaultValue={draft.few_shot.map((item) => `${item.q} | ${item.a}`).join("\n")}
                  rows={4}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Spinner /> : <FileTextIcon />}
                    {mode === "edit" ? "Save changes" : "Save persona"}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <div className="flex min-h-full flex-col items-center justify-center rounded-3xl border border-dashed p-8 text-center">
                <UploadIcon className="mb-3 size-8 text-muted-foreground" />
                <h3 className="font-medium">Generate a draft to review</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add at least 200 characters of source text or upload a .txt file.
                </p>
              </div>
            )}
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DraftField({
  defaultValue,
  label,
  name,
}: {
  defaultValue: string;
  label: string;
  name: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue} />
    </div>
  );
}

function DraftArea({
  defaultValue,
  label,
  name,
  rows,
}: {
  defaultValue: string;
  label: string;
  name: string;
  rows: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} defaultValue={defaultValue} rows={rows} />
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

function readPersonaDraftFromForm(form: FormData, previousDraft: PersonaData): PersonaData {
  return {
    ...previousDraft,
    name: readFormText(form, "name", previousDraft.name),
    tagline: readFormText(form, "tagline", previousDraft.tagline ?? "Custom persona"),
    bio: readFormText(form, "bio", previousDraft.bio ?? previousDraft.identity),
    identity: readFormText(form, "identity", previousDraft.identity),
    topics: readLines(form, "topics"),
    starter_prompts: readLines(form, "starter_prompts"),
    tone_traits: readLines(form, "tone_traits"),
    catchphrases: readLines(form, "catchphrases"),
    teaching_pattern: readFormText(form, "teaching_pattern", previousDraft.teaching_pattern),
    few_shot: readFewShot(form),
  };
}

function readFormText(form: FormData, key: string, fallback: string) {
  const value = form.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readLines(form: FormData, key: string) {
  const value = form.get(key);

  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function readFewShot(form: FormData) {
  const value = form.get("few_shot");

  if (typeof value !== "string") {
    return [];
  }

  return value
    .split("\n")
    .map((line) => {
      const [q, ...answerParts] = line.split("|");
      const a = answerParts.join("|");

      return q?.trim() && a?.trim() ? { q: q.trim(), a: a.trim() } : null;
    })
    .filter((item): item is { q: string; a: string } => Boolean(item))
    .slice(0, 8);
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

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
