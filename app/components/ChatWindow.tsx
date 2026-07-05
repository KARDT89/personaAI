"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircleIcon,
  BookOpenIcon,
  BotIcon,
  ChevronDownIcon,
  CheckCircle2Icon,
  ClipboardPasteIcon,
  CopyIcon,
  DatabaseIcon,
  FileTextIcon,
  HeadphonesIcon,
  KeyRoundIcon,
  LibraryIcon,
  LayersIcon,
  LogOutIcon,
  MenuIcon,
  MessageSquareIcon,
  PanelRightIcon,
  PencilIcon,
  PlusIcon,
  SearchCheckIcon,
  SendIcon,
  SettingsIcon,
  ShieldIcon,
  SparklesIcon,
  Trash2Icon,
  UserIcon,
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
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client";
import type { GenerationMeta, GenerationMode, PersonaData } from "@/lib/personas";
import { cn } from "@/lib/utils";

import { ThemeToggle } from "./ThemeToggle";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: LearningCitation[];
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

type AppMode = "personas" | "learning";
type AppConfigResponse = {
  llm?: {
    appApiKeyAvailable?: boolean;
    defaultModel?: string;
    modelOptions?: ModelOptionGroup[];
  };
};

type ModelOption = {
  id: string;
  label: string;
  description?: string;
};

type ModelOptionGroup = {
  label: string;
  options: ModelOption[];
};

type ApiKeyMode = "app" | "personal";
type ModelSelectionMode = "curated" | "custom";
type SourceType = "youtube-transcript" | "whatsapp-chat" | "other";
type SourceMemoryPayload = {
  sourceType: SourceType;
  sourceChars: number;
  targetSpeaker?: string | null;
  userSpeaker?: string | null;
  metadata?: Record<string, unknown>;
  chunks: Array<{
    chunkIndex: number;
    speaker?: string | null;
    text: string;
    tokenHint?: number;
    metadata?: Record<string, unknown>;
  }>;
};
type PersonaDialogMode = "create" | "edit";
type PersonaDialogStep = "source" | "review";
type LearningSourceKind = "book_pdf" | "podcast_transcript";
type LearningCitation = {
  chunkIndex: number;
  label: string;
  pageEnd?: number | null;
  pageStart?: number | null;
  sourceId: string;
};
type LearningSource = {
  id: string;
  title: string;
  sourceKind: LearningSourceKind;
  originalFilename?: string | null;
  sourceChars: number;
  pageCount?: number | null;
  chunkCount: number;
  metadata?: Record<string, unknown>;
  createdAt: string | null;
  updatedAt: string | null;
};
type LearningSessionSummary = {
  id: string;
  title: string;
  preview: string | null;
  sourceId: string;
  createdAt: string | null;
  updatedAt: string | null;
};
type LearningSourcesResponse = {
  sources?: LearningSource[];
  source?: LearningSource;
  error?: string;
};
type LearningSessionsResponse = {
  sessions?: LearningSessionSummary[];
  session?: LearningSessionSummary;
  messages?: ChatMessage[];
  error?: string;
};
type GenerationProgress =
  | "idle"
  | "reading"
  | "splitting"
  | "analyzing"
  | "merging"
  | "examples"
  | "ready";
type PersonaReviewForm = {
  generationMode: GenerationMode;
  name: string;
  tagline: string;
  bio: string;
  identity: string;
  voiceProfile: string;
  languageProfile: string;
  reasoningProfile: string;
  interactionRules: string;
  addressingRules: string;
  phraseBank: string;
  doRules: string;
  dontRules: string;
  topics: string;
  starterPrompts: string;
  toneTraits: string;
  catchphrases: string;
  teachingPattern: string;
  fewShot: string;
  scenarioExamples: string;
  styleConfidence: string;
};

const FALLBACK_PERSONAS: PersonaOption[] = [
  { id: "hitesh", name: "Hitesh", avatarUrl: "/hitesh.jpg", isBuiltIn: true },
  { id: "piyush", name: "Piyush", avatarUrl: "/piyush.jpg", isBuiltIn: true },
];
const DEFAULT_CHAT_MODEL = "openai/gpt-4o";
const CUSTOM_MODEL_VALUE = "__custom-openrouter-model__";

export function ChatWindow() {
  const { data: authSession, refetch: refetchAuthSession } = authClient.useSession();
  const [activeMode, setActiveMode] = useState<AppMode>("personas");
  const [personas, setPersonas] = useState<PersonaOption[]>(FALLBACK_PERSONAS);
  const [activePersona, setActivePersona] = useState("hitesh");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [learningSources, setLearningSources] = useState<LearningSource[]>([]);
  const [activeLearningSourceId, setActiveLearningSourceId] = useState<string | null>(null);
  const [learningSessionId, setLearningSessionId] = useState<string | null>(null);
  const [learningSessions, setLearningSessions] = useState<LearningSessionSummary[]>([]);
  const [learningMessages, setLearningMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPersonas, setIsLoadingPersonas] = useState(true);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingLearningSources, setIsLoadingLearningSources] = useState(true);
  const [isLoadingLearningSessions, setIsLoadingLearningSessions] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMobileLibraryOpen, setIsMobileLibraryOpen] = useState(false);
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<PersonaDialogMode>("create");
  const [isPersonaDialogOpen, setIsPersonaDialogOpen] = useState(false);
  const [isLearningSourceDialogOpen, setIsLearningSourceDialogOpen] = useState(false);
  const [learningSourceDialogKind, setLearningSourceDialogKind] = useState<LearningSourceKind>("book_pdf");
  const [personaBeingEdited, setPersonaBeingEdited] = useState<PersonaOption | null>(null);
  const [personaBeingDeleted, setPersonaBeingDeleted] = useState<PersonaOption | null>(null);
  const [sessionBeingDeleted, setSessionBeingDeleted] = useState<SessionSummary | null>(null);
  const [learningSourceBeingDeleted, setLearningSourceBeingDeleted] = useState<LearningSource | null>(null);
  const [learningSessionBeingDeleted, setLearningSessionBeingDeleted] = useState<LearningSessionSummary | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeletingPersona, setIsDeletingPersona] = useState(false);
  const [isDeletingSession, setIsDeletingSession] = useState(false);
  const [isDeletingLearningSource, setIsDeletingLearningSource] = useState(false);
  const [isDeletingLearningSession, setIsDeletingLearningSession] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(() =>
    readStoredSetting("persona-ai-compact-mode") === "true",
  );
  const [showProfileRail, setShowProfileRail] = useState(() =>
    readStoredSetting("persona-ai-show-profile-rail") !== "false",
  );
  const [apiKeyMode, setApiKeyMode] = useState<ApiKeyMode>(() =>
    readStoredSetting("persona-ai-api-key-mode") === "personal" ? "personal" : "app",
  );
  const [appApiKeyAvailable, setAppApiKeyAvailable] = useState(true);
  const [personalApiKey, setPersonalApiKey] = useState(
    () => readStoredSetting("persona-ai-openrouter-key") ?? "",
  );
  const [preferredModel, setPreferredModel] = useState(
    () => readStoredSetting("persona-ai-model") ?? DEFAULT_CHAT_MODEL,
  );
  const [modelSelectionMode, setModelSelectionMode] = useState<ModelSelectionMode>(() =>
    readStoredSetting("persona-ai-model-mode") === "custom" ? "custom" : "curated",
  );
  const [appDefaultModel, setAppDefaultModel] = useState(DEFAULT_CHAT_MODEL);
  const [modelOptions, setModelOptions] = useState<ModelOptionGroup[]>([]);
  const didInitRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const currentPersona =
    personas.find((persona) => persona.id === activePersona) ?? personas[0] ?? FALLBACK_PERSONAS[0];
  const currentLearningSource =
    learningSources.find((source) => source.id === activeLearningSourceId) ?? learningSources[0] ?? null;
  const visibleMessages = activeMode === "learning" ? learningMessages : messages;
  const latestVisibleMessage = visibleMessages.at(-1);
  const latestVisibleMessageContent = latestVisibleMessage?.content ?? "";
  const requestModel = apiKeyMode === "personal" ? preferredModel.trim() || undefined : undefined;

  useEffect(() => {
    localStorage.setItem("persona-ai-compact-mode", String(isCompactMode));
  }, [isCompactMode]);

  useEffect(() => {
    localStorage.setItem("persona-ai-show-profile-rail", String(showProfileRail));
  }, [showProfileRail]);

  useEffect(() => {
    localStorage.setItem("persona-ai-api-key-mode", apiKeyMode);
  }, [apiKeyMode]);

  useEffect(() => {
    if (!bottomRef.current) {
      return;
    }

    bottomRef.current.scrollIntoView({
      block: "end",
      behavior: isStreaming ? "auto" : "smooth",
    });
  }, [isStartingSession, isStreaming, latestVisibleMessageContent, visibleMessages.length]);

  useEffect(() => {
    if (personalApiKey.trim()) {
      localStorage.setItem("persona-ai-openrouter-key", personalApiKey.trim());
    } else {
      localStorage.removeItem("persona-ai-openrouter-key");
    }
  }, [personalApiKey]);

  useEffect(() => {
    if (preferredModel.trim()) {
      localStorage.setItem("persona-ai-model", preferredModel.trim());
    } else {
      localStorage.removeItem("persona-ai-model");
    }
  }, [preferredModel]);

  useEffect(() => {
    localStorage.setItem("persona-ai-model-mode", modelSelectionMode);
  }, [modelSelectionMode]);

  useEffect(() => {
    async function loadAppConfig() {
      try {
        const response = await fetch("/api/app-config");
        const data = (await response.json()) as AppConfigResponse;
        const hasAppKey = Boolean(data.llm?.appApiKeyAvailable);
        const nextDefaultModel = data.llm?.defaultModel || DEFAULT_CHAT_MODEL;

        setAppApiKeyAvailable(hasAppKey);
        setAppDefaultModel(nextDefaultModel);
        setModelOptions(data.llm?.modelOptions ?? []);

        if (data.llm?.defaultModel && !readStoredSetting("persona-ai-model")) {
          setPreferredModel(nextDefaultModel);
        }

        if (!hasAppKey && apiKeyMode === "app") {
          setApiKeyMode("personal");
        }
      } catch {
        setAppApiKeyAvailable(false);

        if (apiKeyMode === "app") {
          setApiKeyMode("personal");
        }
      }
    }

    void loadAppConfig();
  }, [apiKeyMode]);

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

  const loadLearningSources = useCallback(async () => {
    setIsLoadingLearningSources(true);

    try {
      const response = await fetch("/api/learning-sources");
      const data = (await response.json()) as LearningSourcesResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load learning sources.");
      }

      setLearningSources(data.sources ?? []);
      return data.sources ?? [];
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      return [];
    } finally {
      setIsLoadingLearningSources(false);
    }
  }, []);

  const loadLearningSessions = useCallback(async (sourceId: string) => {
    setIsLoadingLearningSessions(true);

    try {
      const response = await fetch(`/api/learning-sources/${sourceId}/sessions`);
      const data = (await response.json()) as LearningSessionsResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load learning chats.");
      }

      setLearningSessions(data.sessions ?? []);
      return data.sessions ?? [];
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      return [];
    } finally {
      setIsLoadingLearningSessions(false);
    }
  }, []);

  const startNewLearningDraft = useCallback((sourceId: string) => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setError(null);
    setLearningMessages([]);
    setLearningSessionId(null);
    setActiveLearningSourceId(sourceId);
    setInput("");
    setIsStartingSession(false);
  }, []);

  const openLearningSession = useCallback(async (nextSessionId: string) => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStartingSession(true);
    setIsStreaming(false);
    setError(null);
    setLearningMessages([]);

    try {
      const response = await fetch(`/api/learning-sessions/${nextSessionId}`);
      const data = (await response.json()) as LearningSessionsResponse;

      if (!response.ok || !data.session) {
        throw new Error(data.error ?? "Could not open learning chat.");
      }

      setActiveLearningSourceId(data.session.sourceId);
      setLearningSessionId(data.session.id);
      setLearningMessages(data.messages ?? []);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsStartingSession(false);
    }
  }, []);

  const createLearningSession = useCallback(async (sourceId: string) => {
    try {
      const response = await fetch(`/api/learning-sources/${sourceId}/sessions`, {
        method: "POST",
      });
      const data = (await response.json()) as LearningSessionsResponse;

      if (!response.ok || !data.session) {
        throw new Error(data.error ?? "Could not start learning chat.");
      }

      setLearningSessionId(data.session.id);
      setActiveLearningSourceId(sourceId);
      return data.session;
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      return null;
    }
  }, []);

  const openLatestLearningSessionForSource = useCallback(
    async (sourceId: string) => {
      setActiveLearningSourceId(sourceId);
      setActiveMode("learning");
      const loadedSessions = await loadLearningSessions(sourceId);
      const latestSession = loadedSessions[0];

      if (latestSession) {
        await openLearningSession(latestSession.id);
        return;
      }

      startNewLearningDraft(sourceId);
    },
    [loadLearningSessions, openLearningSession, startNewLearningDraft],
  );

  useEffect(() => {
    if (didInitRef.current) {
      return;
    }

    didInitRef.current = true;

    async function boot() {
      const loadedPersonas = await loadPersonas();
      const loadedSessions = await loadSessions();
      const loadedLearningSources = await loadLearningSources();
      const firstPersonaId = loadedPersonas[0]?.id ?? "hitesh";
      const latestSession = loadedSessions.find(
        (session) => session.personaId === firstPersonaId,
      );

      if (loadedLearningSources[0]) {
        setActiveLearningSourceId(loadedLearningSources[0].id);
        void loadLearningSessions(loadedLearningSources[0].id);
      }

      if (latestSession) {
        await openSession(latestSession.id);
      } else {
        startNewDraft(firstPersonaId);
      }
    }

    void boot();
  }, [loadLearningSessions, loadLearningSources, loadPersonas, loadSessions, openSession, startNewDraft]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextMessage = input.trim();

    if (!nextMessage || isStreaming || isStartingSession) {
      return;
    }

    if (activeMode === "learning") {
      await handleLearningSubmit(nextMessage);
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
          apiKey: apiKeyMode === "personal" ? personalApiKey.trim() || undefined : undefined,
          model: requestModel,
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

  async function handleLearningSubmit(nextMessage: string) {
    if (!currentLearningSource) {
      setError("Add a book or podcast transcript first.");
      return;
    }

    let nextSessionId = learningSessionId;

    if (!nextSessionId) {
      setIsStartingSession(true);
      const createdSession = await createLearningSession(currentLearningSource.id);
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
    setLearningMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/learning/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: nextSessionId,
          sourceId: currentLearningSource.id,
          message: nextMessage,
          apiKey: apiKeyMode === "personal" ? personalApiKey.trim() || undefined : undefined,
          model: requestModel,
        }),
        signal: controller.signal,
      });
      const citations = readLearningCitations(response.headers.get("X-Learning-Citations"));

      if (!response.ok || !response.body) {
        const data = await readJsonError(response);
        throw new Error(data ?? "Learning chat request failed.");
      }

      if (citations.length > 0) {
        setLearningMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === assistantId ? { ...message, citations } : message,
          ),
        );
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

        setLearningMessages((currentMessages) =>
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
        setLearningMessages((currentMessages) =>
          currentMessages.filter((message) => message.id !== assistantId),
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      await loadLearningSessions(currentLearningSource.id);
    }
  }

  function openCreatePersona() {
    setDialogMode("create");
    setPersonaBeingEdited(null);
    setIsPersonaDialogOpen(true);
  }

  function openLearningSourceDialog(kind: LearningSourceKind = "book_pdf") {
    setLearningSourceDialogKind(kind);
    setIsLearningSourceDialogOpen(true);
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

  async function handleLearningSourceSaved(source: LearningSource) {
    const loadedSources = await loadLearningSources();
    const nextSource = loadedSources.find((item) => item.id === source.id) ?? source;
    setIsLearningSourceDialogOpen(false);
    setActiveMode("learning");
    await openLatestLearningSessionForSource(nextSource.id);
  }

  async function handleDeleteLearningSource() {
    if (!learningSourceBeingDeleted) {
      return;
    }

    setIsDeletingLearningSource(true);

    try {
      const response = await fetch(`/api/learning-sources/${learningSourceBeingDeleted.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not delete source.");
      }

      toast.success("Learning source deleted.");
      const deletedSource = learningSourceBeingDeleted;
      const loadedSources = await loadLearningSources();
      setLearningSourceBeingDeleted(null);

      if (deletedSource.id === activeLearningSourceId) {
        const nextSource = loadedSources[0];

        if (nextSource) {
          await openLatestLearningSessionForSource(nextSource.id);
        } else {
          setActiveLearningSourceId(null);
          setLearningSessionId(null);
          setLearningMessages([]);
        }
      }
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
    } finally {
      setIsDeletingLearningSource(false);
    }
  }

  async function handleDeleteLearningSession() {
    if (!learningSessionBeingDeleted) {
      return;
    }

    setIsDeletingLearningSession(true);

    try {
      const response = await fetch(`/api/learning-sessions/${learningSessionBeingDeleted.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not delete learning chat.");
      }

      toast.success("Learning chat deleted.");
      const deletedSession = learningSessionBeingDeleted;
      setLearningSessionBeingDeleted(null);
      await loadLearningSessions(deletedSession.sourceId);

      if (deletedSession.id === learningSessionId) {
        startNewLearningDraft(deletedSession.sourceId);
      }
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
    } finally {
      setIsDeletingLearningSession(false);
    }
  }

  const canSend =
    Boolean(input.trim()) &&
    !isStreaming &&
    !isStartingSession &&
    (activeMode === "personas" || Boolean(currentLearningSource));
  const apiModeLabel = apiKeyMode === "personal" ? "Personal key" : "App key";
  const sessionStateLabel =
    activeMode === "learning"
      ? learningSessionId
        ? "Learning chat"
        : "Learning draft"
      : sessionId
        ? "Open chat"
        : "Draft";

  return (
    <div
      className={cn(
        "grid h-dvh max-h-dvh overflow-hidden bg-muted/25 text-foreground lg:grid-cols-[18rem_minmax(0,1fr)]",
        showProfileRail && "xl:grid-cols-[18rem_minmax(0,1fr)_20rem]",
      )}
    >
      <aside className="hidden min-h-0 min-w-0 overflow-hidden border-r bg-sidebar/95 text-sidebar-foreground lg:block">
        {activeMode === "personas" ? (
          <PersonaLibrary
            activeMode={activeMode}
            activePersonaId={activePersona}
            activeSessionId={sessionId}
            disabled={isStreaming || isStartingSession}
            isLoading={isLoadingPersonas || isLoadingSessions}
            personas={personas}
            sessions={sessions}
            onCreate={openCreatePersona}
            onDeleteSession={setSessionBeingDeleted}
            onModeChange={setActiveMode}
            onNewChat={startNewDraft}
            onSelectPersona={(personaId) => void openLatestSessionForPersona(personaId)}
            onSelectSession={(nextSessionId) => void openSession(nextSessionId)}
          />
        ) : (
          <LearningLibrary
            activeMode={activeMode}
            activeSessionId={learningSessionId}
            activeSourceId={activeLearningSourceId}
            disabled={isStreaming || isStartingSession}
            isLoading={isLoadingLearningSources || isLoadingLearningSessions}
            sessions={learningSessions}
            sources={learningSources}
            onCreate={() => openLearningSourceDialog("book_pdf")}
            onDeleteSession={setLearningSessionBeingDeleted}
            onDeleteSource={setLearningSourceBeingDeleted}
            onModeChange={setActiveMode}
            onNewChat={startNewLearningDraft}
            onSelectSession={(nextSessionId) => void openLearningSession(nextSessionId)}
            onSelectSource={(sourceId) => void openLatestLearningSessionForSource(sourceId)}
          />
        )}
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-background">
        <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={isMobileLibraryOpen} onOpenChange={setIsMobileLibraryOpen}>
              <SheetTrigger render={<Button variant="ghost" size="icon-sm" className="lg:hidden" />}>
                <MenuIcon />
                <span className="sr-only">Open personas</span>
              </SheetTrigger>
              <SheetContent side="left" className="w-[20rem] p-0">
                <SheetHeader className="border-b">
                  <SheetTitle>{activeMode === "learning" ? "Study Library" : "Personas"}</SheetTitle>
                </SheetHeader>
                {activeMode === "personas" ? (
                  <PersonaLibrary
                    activeMode={activeMode}
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
                    onModeChange={setActiveMode}
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
                ) : (
                  <LearningLibrary
                    activeMode={activeMode}
                    activeSessionId={learningSessionId}
                    activeSourceId={activeLearningSourceId}
                    disabled={isStreaming || isStartingSession}
                    isLoading={isLoadingLearningSources || isLoadingLearningSessions}
                    sessions={learningSessions}
                    sources={learningSources}
                    onCreate={() => {
                      setIsMobileLibraryOpen(false);
                      openLearningSourceDialog("book_pdf");
                    }}
                    onDeleteSession={(session) => {
                      setIsMobileLibraryOpen(false);
                      setLearningSessionBeingDeleted(session);
                    }}
                    onDeleteSource={(source) => {
                      setIsMobileLibraryOpen(false);
                      setLearningSourceBeingDeleted(source);
                    }}
                    onModeChange={setActiveMode}
                    onNewChat={(sourceId) => {
                      setIsMobileLibraryOpen(false);
                      startNewLearningDraft(sourceId);
                    }}
                    onSelectSession={(nextSessionId) => {
                      setIsMobileLibraryOpen(false);
                      void openLearningSession(nextSessionId);
                    }}
                    onSelectSource={(sourceId) => {
                      setIsMobileLibraryOpen(false);
                      void openLatestLearningSessionForSource(sourceId);
                    }}
                  />
                )}
              </SheetContent>
            </Sheet>
            {activeMode === "learning" ? (
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                {currentLearningSource?.sourceKind === "podcast_transcript" ? (
                  <HeadphonesIcon className="size-4" />
                ) : (
                  <BookOpenIcon className="size-4" />
                )}
              </div>
            ) : (
              <PersonaAvatar persona={currentPersona} />
            )}
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">
                {activeMode === "learning"
                  ? currentLearningSource?.title ?? "Study Library"
                  : currentPersona.name}
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                {activeMode === "learning"
                  ? currentLearningSource
                    ? sourceKindLabel(currentLearningSource.sourceKind)
                    : "Add a source to begin"
                  : sessionId
                    ? currentPersona.tagline ?? "Conversation open"
                    : "Draft chat ready"}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <div className="hidden min-w-0 items-center gap-1 rounded-2xl border bg-muted/40 px-2 py-1 text-xs text-muted-foreground md:flex">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  isStreaming ? "animate-soft-pulse bg-primary" : sessionId ? "bg-emerald-500" : "bg-amber-500",
                )}
              />
              <span className="truncate">{isStreaming ? "Streaming" : sessionStateLabel}</span>
              <span className="text-border">/</span>
              <span className="truncate">{preferredModel || "openai/gpt-4o"}</span>
              <span className="text-border">/</span>
              <span className="truncate">{apiModeLabel}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
              disabled={isStreaming || isStartingSession}
              onClick={() =>
                activeMode === "learning" && currentLearningSource
                  ? startNewLearningDraft(currentLearningSource.id)
                  : startNewDraft(activePersona)
              }
            >
              <PlusIcon />
              New chat
            </Button>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant={showProfileRail ? "secondary" : "ghost"}
                    size="icon-sm"
                    className="hidden xl:inline-flex"
                    aria-label={showProfileRail ? "Close inspector" : "Open inspector"}
                    onClick={() => setShowProfileRail(!showProfileRail)}
                  />
                }
              >
                <PanelRightIcon />
              </TooltipTrigger>
              <TooltipContent>{showProfileRail ? "Close inspector" : "Open inspector"}</TooltipContent>
            </Tooltip>
            <Sheet open={isMobileInspectorOpen} onOpenChange={setIsMobileInspectorOpen}>
              <SheetTrigger render={<Button type="button" variant="ghost" size="icon-sm" className="xl:hidden" />}>
                <PanelRightIcon />
                <span className="sr-only">Open inspector</span>
              </SheetTrigger>
              <SheetContent side="right" className="w-[21rem] p-0">
                <SheetHeader className="border-b">
                  <SheetTitle>Context Inspector</SheetTitle>
                </SheetHeader>
                <ContextInspectorContent
                  activeMode={activeMode}
                  compactMode={isCompactMode}
                  learningSessions={learningSessions}
                  persona={currentPersona}
                  source={currentLearningSource}
                  onCompactModeChange={setIsCompactMode}
                  onCreateLearningSource={() => {
                    setIsMobileInspectorOpen(false);
                    openLearningSourceDialog("book_pdf");
                  }}
                  onCreatePersona={() => {
                    setIsMobileInspectorOpen(false);
                    openCreatePersona();
                  }}
                  onDeleteLearningSource={(source) => {
                    setIsMobileInspectorOpen(false);
                    setLearningSourceBeingDeleted(source);
                  }}
                  onDeletePersona={(persona) => {
                    setIsMobileInspectorOpen(false);
                    setPersonaBeingDeleted(persona);
                  }}
                  onEditPersona={(persona) => {
                    setIsMobileInspectorOpen(false);
                    openEditPersona(persona);
                  }}
                  onPromptClick={(prompt) => {
                    setIsMobileInspectorOpen(false);
                    setInput(prompt);
                  }}
                />
              </SheetContent>
            </Sheet>
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
                    "mx-auto w-full max-w-4xl px-4 sm:px-6",
                    isCompactMode ? "gap-1.5 py-3" : "gap-4 py-6",
                  )}
                >
                  {visibleMessages.length === 0 ? (
                    activeMode === "learning" ? (
                      <EmptyLearningChat
                        isStartingSession={isStartingSession}
                        source={currentLearningSource}
                        onCreate={openLearningSourceDialog}
                        onPromptClick={setInput}
                      />
                    ) : (
                      <EmptyChat
                        isStartingSession={isStartingSession}
                        persona={currentPersona}
                        onPromptClick={setInput}
                      />
                    )
                  ) : (
                    <MessageGroup
                      className={cn("flex w-full", isCompactMode ? "gap-1.5" : "gap-4")}
                    >
                      {visibleMessages.map((message) => (
                        <MessageScrollerItem key={message.id} className="animate-message-in">
                          <Message
                            align={message.role === "user" ? "end" : "start"}
                            className="min-w-0"
                          >
                            <MessageContent
                              className={cn(
                                "min-w-0 max-w-[min(42rem,85%)]",
                                isCompactMode && "gap-1",
                              )}
                            >
                              <MessageHeader className={isCompactMode ? "px-2 text-[0.7rem]" : undefined}>
                                {message.role === "user"
                                  ? "You"
                                  : activeMode === "learning"
                                    ? "Study assistant"
                                    : currentPersona.name}
                              </MessageHeader>
                              <Bubble
                                align={message.role === "user" ? "end" : "start"}
                                variant={message.role === "user" ? "default" : "muted"}
                                className="transition-transform duration-200 hover:-translate-y-0.5"
                              >
                                <BubbleContent
                                  className={cn(
                                    "min-w-0 max-w-full whitespace-pre-wrap break-words shadow-sm transition-shadow duration-200 [overflow-wrap:anywhere] group-hover/message:shadow-md",
                                    isCompactMode && "rounded-2xl px-2.5 py-1.5 text-[0.8125rem] leading-5",
                                    !message.content && "min-h-10 min-w-16 animate-soft-shimmer",
                                  )}
                                >
                                  {message.content ? (
                                    <ChatMessageBody
                                      content={message.content}
                                      role={message.role}
                                    />
                                  ) : (
                                    <Spinner className="size-4 text-muted-foreground" />
                                  )}
                                </BubbleContent>
                              </Bubble>
                              {activeMode === "learning" &&
                              message.role === "assistant" &&
                              message.citations?.length ? (
                                <CitationRow citations={message.citations} />
                              ) : null}
                            </MessageContent>
                          </Message>
                        </MessageScrollerItem>
                      ))}
                    </MessageGroup>
                  )}
                  <MessageScrollerItem scrollAnchor>
                    <div ref={bottomRef} className="h-px" />
                  </MessageScrollerItem>
                </MessageScrollerContent>
                <MessageScrollerButton />
              </MessageScrollerViewport>
            </MessageScroller>
          </MessageScrollerProvider>

          <form onSubmit={handleSubmit} className="border-t bg-background/95 p-3 shadow-[0_-12px_30px_rgba(0,0,0,0.03)] backdrop-blur">
            <div className="mx-auto flex max-w-4xl items-center gap-2 rounded-3xl border bg-background p-2 shadow-sm transition-shadow focus-within:shadow-lg focus-within:ring-3 focus-within:ring-ring/20 sm:px-3">
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
                placeholder={
                  activeMode === "learning"
                    ? currentLearningSource
                      ? `Ask about ${currentLearningSource.title}...`
                      : "Add a source to begin..."
                    : `Message ${currentPersona.name}...`
                }
                className="max-h-36 min-h-10 flex-1 resize-none border-transparent bg-transparent py-2.5 shadow-none focus-visible:ring-0"
              />
              <Button
                type="submit"
                size="icon-lg"
                disabled={!canSend}
                aria-label="Send message"
                className="self-center"
              >
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
        <ContextInspectorContent
          activeMode={activeMode}
          compactMode={isCompactMode}
          learningSessions={learningSessions}
          persona={currentPersona}
          source={currentLearningSource}
          onCompactModeChange={setIsCompactMode}
          onCreateLearningSource={() => openLearningSourceDialog("book_pdf")}
          onCreatePersona={openCreatePersona}
          onDeleteLearningSource={setLearningSourceBeingDeleted}
          onDeletePersona={setPersonaBeingDeleted}
          onEditPersona={openEditPersona}
          onPromptClick={setInput}
        />
      </aside>

      <SettingsDialog
        key={`${authSession?.user?.email ?? "user"}-${authSession?.user?.name ?? ""}`}
        apiKeyMode={apiKeyMode}
        appApiKeyAvailable={appApiKeyAvailable}
        appDefaultModel={appDefaultModel}
        compactMode={isCompactMode}
        model={preferredModel}
        modelSelectionMode={modelSelectionMode}
        modelOptions={modelOptions}
        open={isSettingsOpen}
        personalApiKey={personalApiKey}
        user={authSession?.user ?? null}
        onApiKeyModeChange={setApiKeyMode}
        onCompactModeChange={setIsCompactMode}
        onModelChange={setPreferredModel}
        onModelSelectionModeChange={setModelSelectionMode}
        onOpenChange={setIsSettingsOpen}
        onPersonalApiKeyChange={setPersonalApiKey}
        onSessionRefresh={() => void refetchAuthSession()}
      />

      <PersonaEditorDialog
        key={`${dialogMode}-${personaBeingEdited?.id ?? "new"}-${isPersonaDialogOpen}`}
        apiKey={apiKeyMode === "personal" ? personalApiKey.trim() || undefined : undefined}
        mode={dialogMode}
        model={requestModel}
        open={isPersonaDialogOpen}
        persona={personaBeingEdited}
        onOpenChange={setIsPersonaDialogOpen}
        onSaved={(persona) => void handlePersonaSaved(persona)}
      />

      <LearningSourceDialog
        key={`${learningSourceDialogKind}-${isLearningSourceDialogOpen}`}
        apiKey={apiKeyMode === "personal" ? personalApiKey.trim() || undefined : undefined}
        initialKind={learningSourceDialogKind}
        open={isLearningSourceDialogOpen}
        onOpenChange={setIsLearningSourceDialogOpen}
        onSaved={(source) => void handleLearningSourceSaved(source)}
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

      <Dialog
        open={Boolean(learningSourceBeingDeleted)}
        onOpenChange={(open) => {
          if (!open) {
            setLearningSourceBeingDeleted(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete learning source?</DialogTitle>
            <DialogDescription>
              This removes the source, its chunks, and its learning chats.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLearningSourceBeingDeleted(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeletingLearningSource}
              onClick={() => void handleDeleteLearningSource()}
            >
              {isDeletingLearningSource ? <Spinner /> : <Trash2Icon />}
              Delete source
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(learningSessionBeingDeleted)}
        onOpenChange={(open) => {
          if (!open) {
            setLearningSessionBeingDeleted(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete learning chat?</DialogTitle>
            <DialogDescription>
              This removes the conversation and its messages.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLearningSessionBeingDeleted(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeletingLearningSession}
              onClick={() => void handleDeleteLearningSession()}
            >
              {isDeletingLearningSession ? <Spinner /> : <Trash2Icon />}
              Delete chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PersonaLibrary({
  activeMode,
  activeSessionId,
  activePersonaId,
  disabled,
  isLoading,
  personas,
  sessions,
  onCreate,
  onDeleteSession,
  onModeChange,
  onNewChat,
  onSelectPersona,
  onSelectSession,
}: {
  activeMode: AppMode;
  activeSessionId: string | null;
  activePersonaId: string;
  disabled: boolean;
  isLoading: boolean;
  personas: PersonaOption[];
  sessions: SessionSummary[];
  onCreate: () => void;
  onDeleteSession: (session: SessionSummary) => void;
  onModeChange: (mode: AppMode) => void;
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
      <AppModeSwitch activeMode={activeMode} onModeChange={onModeChange} />
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

type MessagePart =
  | { type: "code"; code: string; language: string }
  | { type: "text"; text: string };
type SyntaxTokenType =
  | "comment"
  | "function"
  | "keyword"
  | "number"
  | "operator"
  | "plain"
  | "punctuation"
  | "string"
  | "tag";
type SyntaxToken = {
  text: string;
  type: SyntaxTokenType;
};

const LANGUAGE_KEYWORDS: Record<string, Set<string>> = {
  bash: new Set([
    "case",
    "do",
    "done",
    "elif",
    "else",
    "esac",
    "fi",
    "for",
    "function",
    "if",
    "in",
    "then",
    "while",
  ]),
  css: new Set([
    "and",
    "from",
    "important",
    "in",
    "not",
    "only",
    "or",
    "screen",
    "to",
  ]),
  html: new Set([]),
  javascript: new Set([
    "async",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "default",
    "delete",
    "do",
    "else",
    "export",
    "extends",
    "finally",
    "for",
    "from",
    "function",
    "if",
    "import",
    "in",
    "let",
    "new",
    "return",
    "switch",
    "throw",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "yield",
  ]),
  json: new Set(["false", "null", "true"]),
  python: new Set([
    "and",
    "as",
    "assert",
    "async",
    "await",
    "break",
    "class",
    "continue",
    "def",
    "del",
    "elif",
    "else",
    "except",
    "False",
    "finally",
    "for",
    "from",
    "global",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "None",
    "nonlocal",
    "not",
    "or",
    "pass",
    "raise",
    "return",
    "True",
    "try",
    "while",
    "with",
    "yield",
  ]),
  sql: new Set([
    "and",
    "as",
    "by",
    "case",
    "create",
    "delete",
    "desc",
    "distinct",
    "drop",
    "else",
    "end",
    "from",
    "group",
    "having",
    "in",
    "insert",
    "into",
    "is",
    "join",
    "left",
    "like",
    "limit",
    "not",
    "null",
    "or",
    "order",
    "right",
    "select",
    "set",
    "table",
    "then",
    "update",
    "values",
    "when",
    "where",
  ]),
  typescript: new Set([
    "abstract",
    "as",
    "async",
    "await",
    "boolean",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "default",
    "delete",
    "do",
    "else",
    "enum",
    "export",
    "extends",
    "finally",
    "for",
    "from",
    "function",
    "if",
    "implements",
    "import",
    "in",
    "interface",
    "keyof",
    "let",
    "new",
    "number",
    "private",
    "protected",
    "public",
    "readonly",
    "return",
    "string",
    "switch",
    "throw",
    "try",
    "type",
    "typeof",
    "var",
    "void",
    "while",
    "yield",
  ]),
};

function ChatMessageBody({
  content,
  role,
}: {
  content: string;
  role: ChatMessage["role"];
}) {
  if (role === "user") {
    return <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{content}</span>;
  }

  const parts = parseMessageParts(content);

  return (
    <div className="min-w-0 space-y-3">
      {parts.map((part, index) =>
        part.type === "code" ? (
          <CodeBlock
            key={`${part.type}-${index}`}
            code={part.code}
            language={part.language}
          />
        ) : (
          <RichTextBlock key={`${part.type}-${index}`} text={part.text} />
        ),
      )}
    </div>
  );
}

function RichTextBlock({ text }: { text: string }) {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="space-y-2 leading-6">
      {blocks.map((block, index) => {
        const lines = block.split("\n").map((line) => line.trimEnd());
        const isList = lines.every((line) => /^(\s*[-*]\s+|\s*\d+[.)]\s+)/.test(line));

        if (isList) {
          return (
            <div key={index} className="space-y-1">
              {lines.map((line, lineIndex) => (
                <div key={`${index}-${lineIndex}`} className="flex min-w-0 gap-2">
                  <span className="shrink-0 text-muted-foreground">
                    {line.match(/^\s*(\d+[.)]|[-*])/)?.[1] ?? "-"}
                  </span>
                  <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
                    <InlineCodeText text={line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "")} />
                  </span>
                </div>
              ))}
            </div>
          );
        }

        return (
          <p key={index} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            <InlineCodeText text={block} />
          </p>
        );
      })}
    </div>
  );
}

function InlineCodeText({ text }: { text: string }) {
  const segments = text.split(/(`[^`\n]+`)/g);

  return (
    <>
      {segments.map((segment, index) =>
        segment.startsWith("`") && segment.endsWith("`") ? (
          <code
            key={index}
            className="rounded-md bg-background/70 px-1.5 py-0.5 font-mono text-[0.92em]"
          >
            {segment.slice(1, -1)}
          </code>
        ) : (
          <span key={index}>{segment}</span>
        ),
      )}
    </>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [didCopy, setDidCopy] = useState(false);
  const normalizedLanguage = normalizeCodeLanguage(language);
  const displayLanguage = normalizedLanguage || "code";
  const highlightedTokens = tokenizeCode(code.replace(/\n$/, ""), normalizedLanguage);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setDidCopy(true);
      window.setTimeout(() => setDidCopy(false), 1400);
    } catch {
      toast.error("Could not copy code.");
    }
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border bg-zinc-950 text-zinc-50 shadow-sm">
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-3 py-2">
        <span className="truncate font-mono text-xs text-zinc-300">{displayLanguage}</span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-7 shrink-0 px-2 text-zinc-300 hover:bg-white/10 hover:text-white"
          onClick={() => void handleCopy()}
        >
          {didCopy ? <CheckCircle2Icon /> : <CopyIcon />}
          {didCopy ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="max-h-[28rem] overflow-auto p-3 text-sm leading-6">
        <code className="font-mono">
          {highlightedTokens.map((token, index) => (
            <span key={index} className={getSyntaxTokenClassName(token.type)}>
              {token.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

function LearningLibrary({
  activeMode,
  activeSessionId,
  activeSourceId,
  disabled,
  isLoading,
  sessions,
  sources,
  onCreate,
  onDeleteSession,
  onDeleteSource,
  onModeChange,
  onNewChat,
  onSelectSession,
  onSelectSource,
}: {
  activeMode: AppMode;
  activeSessionId: string | null;
  activeSourceId: string | null;
  disabled: boolean;
  isLoading: boolean;
  sessions: LearningSessionSummary[];
  sources: LearningSource[];
  onCreate: () => void;
  onDeleteSession: (session: LearningSessionSummary) => void;
  onDeleteSource: (source: LearningSource) => void;
  onModeChange: (mode: AppMode) => void;
  onNewChat: (sourceId: string) => void;
  onSelectSession: (sessionId: string) => void;
  onSelectSource: (sourceId: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex min-w-0 items-center gap-2 font-semibold">
          <BookOpenIcon className="size-4 shrink-0" />
          <span className="truncate">Study Library</span>
        </div>
        <Button type="button" size="icon-sm" onClick={onCreate} aria-label="Add source">
          <PlusIcon />
        </Button>
      </div>
      <AppModeSwitch activeMode={activeMode} onModeChange={onModeChange} />
      <ScrollArea className="min-h-0 flex-1 p-2">
        <div className="grid min-w-0 gap-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-lg" />
            ))
          ) : sources.length > 0 ? (
            sources.map((source) => {
              const sourceSessions = sessions
                .filter((session) => session.sourceId === source.id)
                .slice(0, 6);
              const isActiveSource = source.id === activeSourceId;
              const hasActiveSession = sourceSessions.some(
                (session) => session.id === activeSessionId,
              );

              return (
                <Collapsible
                  key={source.id}
                  defaultOpen={isActiveSource || hasActiveSession}
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
                          aria-label={`Toggle ${source.title} chats`}
                        />
                      }
                    >
                      <ChevronDownIcon />
                    </CollapsibleTrigger>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onSelectSource(source.id)}
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-2 rounded-md p-2 text-left transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                        isActiveSource && "bg-muted",
                      )}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                        {source.sourceKind === "podcast_transcript" ? (
                          <HeadphonesIcon className="size-4" />
                        ) : (
                          <BookOpenIcon className="size-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{source.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {sourceKindLabel(source.sourceKind)} / {source.chunkCount} indexed chunks
                        </span>
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={disabled}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${source.title}`}
                      onClick={() => onDeleteSource(source)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>

                  <CollapsibleContent>
                    <div className="grid min-w-0 gap-1 px-1.5 pb-2 pl-8">
                      {sourceSessions.length > 0 ? (
                        sourceSessions.map((session) => (
                          <LearningChatHistoryRow
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
                          No saved learning chats yet.
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="mt-1 w-fit justify-start px-2"
                        disabled={disabled}
                        onClick={() => onNewChat(source.id)}
                      >
                        <PlusIcon />
                        New chat
                      </Button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed bg-background/70 p-4 text-sm text-muted-foreground">
              Upload a PDF or paste a transcript to build your study library.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function LearningChatHistoryRow({
  disabled,
  isActive,
  onDelete,
  onSelect,
  session,
}: {
  disabled: boolean;
  isActive: boolean;
  onDelete: (session: LearningSessionSummary) => void;
  onSelect: (sessionId: string) => void;
  session: LearningSessionSummary;
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
          {session.preview ?? "Saved learning conversation."}
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

function AppModeSwitch({
  activeMode,
  onModeChange,
}: {
  activeMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 border-b p-2">
      <Button
        type="button"
        variant={activeMode === "personas" ? "secondary" : "ghost"}
        size="sm"
        className="justify-center"
        onClick={() => onModeChange("personas")}
      >
        <BotIcon />
        Personas
      </Button>
      <Button
        type="button"
        variant={activeMode === "learning" ? "secondary" : "ghost"}
        size="sm"
        className="justify-center"
        onClick={() => onModeChange("learning")}
      >
        <BookOpenIcon />
        Study
      </Button>
    </div>
  );
}

function SettingsDialog({
  apiKeyMode,
  appApiKeyAvailable,
  appDefaultModel,
  compactMode,
  model,
  modelSelectionMode,
  modelOptions,
  onApiKeyModeChange,
  onCompactModeChange,
  onModelChange,
  onModelSelectionModeChange,
  onOpenChange,
  onPersonalApiKeyChange,
  onSessionRefresh,
  open,
  personalApiKey,
  user,
}: {
  apiKeyMode: ApiKeyMode;
  appApiKeyAvailable: boolean;
  appDefaultModel: string;
  compactMode: boolean;
  model: string;
  modelSelectionMode: ModelSelectionMode;
  modelOptions: ModelOptionGroup[];
  onApiKeyModeChange: (mode: ApiKeyMode) => void;
  onCompactModeChange: (enabled: boolean) => void;
  onModelChange: (model: string) => void;
  onModelSelectionModeChange: (mode: ModelSelectionMode) => void;
  onOpenChange: (open: boolean) => void;
  onPersonalApiKeyChange: (apiKey: string) => void;
  onSessionRefresh: () => void;
  open: boolean;
  personalApiKey: string;
  user: { email?: string | null; name?: string | null } | null;
}) {
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isRevokingSessions, setIsRevokingSessions] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const userEmail = user?.email ?? "";

  async function handleUpdateName() {
    const nextName = displayName.trim();

    if (!nextName) {
      toast.error("Enter a display name.");
      return;
    }

    setIsSavingName(true);

    try {
      await authApiRequest("/api/auth/update-user", { name: nextName });
      toast.success("Display name updated.");
      onSessionRefresh();
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
    } finally {
      setIsSavingName(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || newPassword.length < 8) {
      toast.error("Enter your current password and a new password with at least 8 characters.");
      return;
    }

    setIsChangingPassword(true);

    try {
      await authApiRequest("/api/auth/change-password", {
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      setCurrentPassword("");
      setNewPassword("");
      toast.success("Password changed.");
      onSessionRefresh();
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleRevokeSessions() {
    setIsRevokingSessions(true);

    try {
      await authApiRequest("/api/auth/revoke-sessions", {});
      clearLocalSettings();
      window.location.href = "/";
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
      setIsRevokingSessions(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmation.trim().toLowerCase() !== userEmail.toLowerCase()) {
      toast.error("Type your email address to confirm account deletion.");
      return;
    }

    if (!deletePassword) {
      toast.error("Enter your password to delete your account.");
      return;
    }

    setIsDeletingAccount(true);

    try {
      await authApiRequest("/api/auth/delete-user", {
        callbackURL: "/",
        password: deletePassword,
      });
      clearLocalSettings();
      window.location.href = "/";
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
      setIsDeletingAccount(false);
    }
  }

  const canDeleteAccount =
    Boolean(userEmail) &&
    deleteConfirmation.trim().toLowerCase() === userEmail.toLowerCase() &&
    Boolean(deletePassword);
  const flatModelOptions = modelOptions.flatMap((group) => group.options);
  const hasSelectedCuratedModel = flatModelOptions.some((option) => option.id === model);
  const selectedModelValue =
    modelSelectionMode === "custom" || !hasSelectedCuratedModel ? CUSTOM_MODEL_VALUE : model;
  const appModelLabel = getModelLabel(appDefaultModel, flatModelOptions);

  function handleModelSelect(nextValue: string) {
    if (nextValue === CUSTOM_MODEL_VALUE) {
      onModelSelectionModeChange("custom");
      return;
    }

    onModelSelectionModeChange("curated");
    onModelChange(nextValue);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] flex-col overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader>
          <div className="border-b p-6 pb-4">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage your account, API key source, and interface preferences.
            </DialogDescription>
          </div>
        </DialogHeader>

        <Tabs defaultValue="account" className="flex min-h-0 flex-1 flex-col">
          <div className="border-b px-6 py-3">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="ai">AI & API Key</TabsTrigger>
              <TabsTrigger value="interface">Interface</TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <TabsContent value="account" className="mt-0 grid gap-5">
              <section className="grid gap-3 rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <UserIcon className="size-4 text-muted-foreground" />
                  Profile
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="settings-email">Email</Label>
                  <Input
                    id="settings-email"
                    name="email"
                    type="email"
                    value={userEmail}
                    readOnly
                    spellCheck={false}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="settings-display-name">Display Name</Label>
                  <Input
                    id="settings-display-name"
                    name="display-name"
                    autoComplete="name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  className="w-fit"
                  disabled={isSavingName || !displayName.trim()}
                  onClick={() => void handleUpdateName()}
                >
                  {isSavingName ? <Spinner /> : <UserIcon />}
                  Save Profile
                </Button>
              </section>

              <section className="grid gap-3 rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldIcon className="size-4 text-muted-foreground" />
                  Security
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="settings-current-password">Current Password</Label>
                  <Input
                    id="settings-current-password"
                    name="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="settings-new-password">New Password</Label>
                  <Input
                    id="settings-new-password"
                    name="new-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  className="w-fit"
                  disabled={isChangingPassword}
                  onClick={() => void handleChangePassword()}
                >
                  {isChangingPassword ? <Spinner /> : <ShieldIcon />}
                  Change Password
                </Button>
              </section>

              <section className="grid gap-3 rounded-lg border border-destructive/30 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <Trash2Icon className="size-4" />
                  Danger Zone
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isRevokingSessions}
                    onClick={() => void handleRevokeSessions()}
                  >
                    {isRevokingSessions ? <Spinner /> : <LogOutIcon />}
                    Sign Out All Sessions
                  </Button>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="settings-delete-confirmation">Type Your Email</Label>
                  <Input
                    id="settings-delete-confirmation"
                    name="delete-confirmation"
                    autoComplete="off"
                    value={deleteConfirmation}
                    onChange={(event) => setDeleteConfirmation(event.target.value)}
                    placeholder={userEmail || "you@example.com"}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="settings-delete-password">Password</Label>
                  <Input
                    id="settings-delete-password"
                    name="delete-password"
                    type="password"
                    autoComplete="current-password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  className="w-fit"
                  disabled={!canDeleteAccount || isDeletingAccount}
                  onClick={() => void handleDeleteAccount()}
                >
                  {isDeletingAccount ? <Spinner /> : <Trash2Icon />}
                  Delete Account
                </Button>
              </section>
            </TabsContent>

            <TabsContent value="ai" className="mt-0 grid gap-5">
              <section className="grid gap-3 rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <KeyRoundIcon className="size-4 text-muted-foreground" />
                  API Key Source
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ApiModeButton
                    active={apiKeyMode === "app"}
                    description={
                      appApiKeyAvailable
                        ? `PersonaAI pays for requests and uses ${appModelLabel}.`
                        : "The app API key is not configured. Add your own OpenRouter key to chat."
                    }
                    disabled={!appApiKeyAvailable}
                    label="Use App API Key"
                    onClick={() => onApiKeyModeChange("app")}
                  />
                  <ApiModeButton
                    active={apiKeyMode === "personal"}
                    description="You pay OpenRouter directly and can choose a recommended model or enter any model ID."
                    label="Use My API Key"
                    onClick={() => onApiKeyModeChange("personal")}
                  />
                </div>
              </section>

              <section className="grid gap-3 rounded-lg border p-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="settings-openrouter-key">Personal API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      id="settings-openrouter-key"
                      name="openrouter-api-key"
                      type="password"
                      autoComplete="off"
                      value={personalApiKey}
                      onChange={(event) => onPersonalApiKeyChange(event.target.value)}
                      placeholder="sk-or-…"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!personalApiKey}
                      onClick={() => onPersonalApiKeyChange("")}
                    >
                      Clear Key
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Stored only in this browser and sent with AI requests only when “Use My API Key” is selected.
                  </p>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="settings-openrouter-model">Model</Label>
                  {apiKeyMode === "app" ? (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="text-sm font-medium">{appModelLabel}</div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        {appDefaultModel}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        App API key requests use the server-configured model. Switch to your own
                        API key to choose a different model.
                      </p>
                    </div>
                  ) : (
                    <>
                      <NativeSelect
                        id="settings-openrouter-model"
                        name="openrouter-model"
                        className="w-full"
                        value={selectedModelValue}
                        onChange={(event) => handleModelSelect(event.target.value)}
                      >
                        {modelOptions.map((group) => (
                          <NativeSelectOptGroup key={group.label} label={group.label}>
                            {group.options.map((option) => (
                              <NativeSelectOption key={option.id} value={option.id}>
                                {option.label} - {option.id}
                              </NativeSelectOption>
                            ))}
                          </NativeSelectOptGroup>
                        ))}
                        <NativeSelectOption value={CUSTOM_MODEL_VALUE}>
                          Advanced: custom OpenRouter model ID
                        </NativeSelectOption>
                      </NativeSelect>
                      {selectedModelValue === CUSTOM_MODEL_VALUE ? (
                        <Input
                          id="settings-openrouter-model-custom"
                          name="openrouter-model-custom"
                          autoComplete="off"
                          value={model}
                          onChange={(event) => onModelChange(event.target.value)}
                          placeholder="provider/model-name"
                        />
                      ) : null}
                      <p className="text-xs leading-5 text-muted-foreground">
                        This model is used for chat, learning chats, and persona generation when
                        your own API key is selected.
                      </p>
                    </>
                  )}
                </div>
              </section>
            </TabsContent>

            <TabsContent value="interface" className="mt-0 grid gap-5">
              <section className="grid gap-3 rounded-lg border p-4">
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
                <div className="rounded-lg border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
                  Open the Context Inspector from the header to view persona details or source intelligence.
                </div>
              </section>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ApiModeButton({
  active,
  description,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-28 rounded-lg border p-3 text-left transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
        active && "border-primary bg-muted",
      )}
    >
      <span className="block text-sm font-medium">{label}</span>
      <span className="mt-2 block text-xs leading-5 text-muted-foreground">
        {description}
      </span>
    </button>
  );
}

function getModelLabel(modelId: string, options: ModelOption[]) {
  return options.find((option) => option.id === modelId)?.label ?? modelId;
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

function ContextInspectorContent({
  activeMode,
  compactMode,
  learningSessions,
  persona,
  source,
  onCompactModeChange,
  onCreateLearningSource,
  onCreatePersona,
  onDeleteLearningSource,
  onDeletePersona,
  onEditPersona,
  onPromptClick,
}: {
  activeMode: AppMode;
  compactMode: boolean;
  learningSessions: LearningSessionSummary[];
  persona: PersonaOption;
  source: LearningSource | null;
  onCompactModeChange: (enabled: boolean) => void;
  onCreateLearningSource: () => void;
  onCreatePersona: () => void;
  onDeleteLearningSource: (source: LearningSource) => void;
  onDeletePersona: (persona: PersonaOption) => void;
  onEditPersona: (persona: PersonaOption) => void;
  onPromptClick: (prompt: string) => void;
}) {
  return activeMode === "learning" ? (
    <LearningDetails
      compactMode={compactMode}
      sessions={learningSessions}
      source={source}
      onCompactModeChange={onCompactModeChange}
      onCreate={onCreateLearningSource}
      onDelete={onDeleteLearningSource}
      onPromptClick={onPromptClick}
    />
  ) : (
    <PersonaDetails
      compactMode={compactMode}
      persona={persona}
      onCompactModeChange={onCompactModeChange}
      onCreate={onCreatePersona}
      onDelete={onDeletePersona}
      onEdit={onEditPersona}
      onPromptClick={onPromptClick}
    />
  );
}

function PersonaDetails({
  compactMode,
  persona,
  onCompactModeChange,
  onCreate,
  onDelete,
  onEdit,
  onPromptClick,
}: {
  compactMode: boolean;
  persona: PersonaOption;
  onCompactModeChange: (enabled: boolean) => void;
  onCreate: () => void;
  onDelete: (persona: PersonaOption) => void;
  onEdit: (persona: PersonaOption) => void;
  onPromptClick: (prompt: string) => void;
}) {
  const prompts = persona.starterPrompts?.length
    ? persona.starterPrompts
    : [
        "Give me a practical starter roadmap.",
        "Review this idea and suggest improvements.",
        "Explain your approach to learning this topic.",
      ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-background/80">
      <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">Persona</div>
          <div className="truncate text-xs text-muted-foreground">{persona.name}</div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onCreate}>
          <PlusIcon />
          New
        </Button>
      </div>

      <Tabs defaultValue="profile" className="min-h-0 flex-1 gap-0">
        <div className="border-b px-3 py-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="prompts">Prompts</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <TabsContent value="profile" className="animate-panel-in mt-0 space-y-5 p-4">
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
            <div className="rounded-lg border bg-background p-3 text-sm hover-lift">
              <div className="text-xs font-medium uppercase text-muted-foreground">
                Source count
              </div>
              <div className="mt-1 font-medium">{persona.sourceCount ?? 0}</div>
            </div>
            {persona.isBuiltIn ? (
              <Alert>
                <BotIcon />
                <AlertTitle>Example persona</AlertTitle>
                <AlertDescription>
                  Hitesh and Piyush are built-in examples. Create your own persona to edit or delete it.
                </AlertDescription>
              </Alert>
            ) : null}
          </TabsContent>

          <TabsContent value="prompts" className="animate-panel-in mt-0 space-y-4 p-4">
            <div>
              <h3 className="text-sm font-semibold">Starter prompts</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Click a prompt to place it in the composer.
              </p>
            </div>
            <div className="grid gap-2">
              {prompts.slice(0, 6).map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  variant="outline"
                  className="hover-lift h-auto justify-start whitespace-normal rounded-lg py-3 text-left text-wrap"
                  onClick={() => onPromptClick(prompt)}
                >
                  <SparklesIcon />
                  {prompt}
                </Button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="animate-panel-in mt-0 space-y-4 p-4">
            <SettingSwitch
              checked={compactMode}
              description="Reduce spacing between chat messages."
              label="Compact Chat"
              onCheckedChange={onCompactModeChange}
            />
            <div className="grid gap-2 pt-2">
              {persona.isBuiltIn ? (
                <Alert>
                  <BotIcon />
                  <AlertTitle>Example persona</AlertTitle>
                  <AlertDescription>
                    Create your own persona to unlock edit and delete controls.
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
          </TabsContent>
        </ScrollArea>
      </Tabs>
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

function EmptyLearningChat({
  isStartingSession,
  source,
  onCreate,
  onPromptClick,
}: {
  isStartingSession: boolean;
  source: LearningSource | null;
  onCreate: (kind?: LearningSourceKind) => void;
  onPromptClick: (prompt: string) => void;
}) {
  if (isStartingSession) {
    return (
      <div className="flex min-h-72 flex-1 items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    );
  }

  if (!source) {
    const examples = [
      ["Summaries", "Compress dense chapters into memorable ideas."],
      ["Practice", "Turn advice into weekly action plans."],
      ["Recall", "Ask grounded questions with source hints."],
    ];

    return (
      <div className="flex min-h-72 flex-1 items-center justify-center">
        <div className="w-full max-w-2xl overflow-hidden rounded-lg border bg-background shadow-sm">
          <div className="border-b bg-muted/35 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <LibraryIcon className="size-5" />
              </div>
              <div className="min-w-0">
                <Badge variant="secondary" className="mb-3 w-fit">
                  Source Studio
                </Badge>
                <h2 className="text-2xl font-semibold text-pretty">
                  Build a study workspace from one source.
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  Upload a text-based PDF or paste a transcript. PersonaAI extracts the text,
                  creates searchable chunks, and prepares citation-grounded study chat.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button type="button" onClick={() => onCreate("book_pdf")}>
                <UploadIcon />
                Upload PDF
              </Button>
              <Button type="button" variant="outline" onClick={() => onCreate("podcast_transcript")}>
                <ClipboardPasteIcon />
                Paste transcript
              </Button>
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            {examples.map(([title, description]) => (
              <div key={title} className="rounded-lg border bg-muted/20 p-3 text-left">
                <div className="text-sm font-medium">{title}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">{description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const prompts = [
    "What are the core ideas I should remember?",
    "Give me practical action steps from this source.",
    "What mental models does this teach?",
  ];

  return (
    <div className="flex min-h-72 flex-1 items-center justify-center">
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-lg bg-muted">
          {source.sourceKind === "podcast_transcript" ? (
            <HeadphonesIcon className="size-7 text-muted-foreground" />
          ) : (
            <BookOpenIcon className="size-7 text-muted-foreground" />
          )}
        </div>
        <Badge variant="outline" className="mb-3">
          {source.chunkCount} indexed chunks
        </Badge>
        <h2 className="text-xl font-semibold text-pretty">Ask about {source.title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Pull out lessons, frameworks, examples, and reflection questions grounded in this source.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {prompts.map((prompt) => (
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

function CitationRow({ citations }: { citations: LearningCitation[] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border bg-emerald-500/5 px-2.5 py-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-300">
        <SearchCheckIcon className="size-3.5" />
        Grounded in
      </span>
      {citations.slice(0, 4).map((citation) => (
        <Badge
          key={`${citation.sourceId}-${citation.chunkIndex}`}
          variant="outline"
          className="bg-background/80"
          title="Chunk preview is coming next."
        >
          {citation.label}
        </Badge>
      ))}
    </div>
  );
}

function LearningDetails({
  compactMode,
  sessions,
  source,
  onCompactModeChange,
  onCreate,
  onDelete,
  onPromptClick,
}: {
  compactMode: boolean;
  sessions: LearningSessionSummary[];
  source: LearningSource | null;
  onCompactModeChange: (enabled: boolean) => void;
  onCreate: () => void;
  onDelete: (source: LearningSource) => void;
  onPromptClick: (prompt: string) => void;
}) {
  const sourceSessions = source
    ? sessions.filter((session) => session.sourceId === source.id).slice(0, 4)
    : [];
  const prompts = [
    "Summarize this into a weekly practice plan.",
    "What assumptions does this source challenge?",
    "Give me reflection questions from this source.",
    "Extract the strongest examples and stories.",
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-background/80">
      <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">Source Inspector</div>
          <div className="truncate text-xs text-muted-foreground">
            {source?.title ?? "No source selected"}
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onCreate}>
          <PlusIcon />
          Add
        </Button>
      </div>

      <Tabs defaultValue="source" className="min-h-0 flex-1 gap-0">
        <div className="border-b px-3 py-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="source">Source</TabsTrigger>
            <TabsTrigger value="prompts">Prompts</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <TabsContent value="source" className="animate-panel-in mt-0 space-y-5 p-4">
            {source ? (
              <>
                <div className="rounded-lg border bg-muted/25 p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-background">
                      {source.sourceKind === "podcast_transcript" ? (
                        <HeadphonesIcon className="size-5 text-muted-foreground" />
                      ) : (
                        <BookOpenIcon className="size-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-semibold">{source.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        {sourceKindLabel(source.sourceKind)}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      Ready
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm">
                    <SummaryMetric label="Chunks" value={String(source.chunkCount)} />
                    <SummaryMetric label="Characters" value={source.sourceChars.toLocaleString()} />
                    {source.pageCount ? (
                      <SummaryMetric label="Pages" value={String(source.pageCount)} />
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-2">
                  <InspectorStep icon={FileTextIcon} label="Text extracted" value="Source is searchable" />
                  <InspectorStep icon={LayersIcon} label="Study chunks" value={`${source.chunkCount} retrieval units`} />
                  <InspectorStep icon={DatabaseIcon} label="Embeddings" value="Semantic lookup prepared" />
                  <InspectorStep icon={SearchCheckIcon} label="Citations" value="Answers include source hints" />
                </div>

                <Alert>
                  <SparklesIcon />
                  <AlertTitle>Grounded study mode</AlertTitle>
                  <AlertDescription>
                    Each answer retrieves relevant chunks from this source before responding.
                  </AlertDescription>
                </Alert>

                <div className="min-w-0 space-y-2">
                  <div className="text-xs font-medium uppercase text-muted-foreground">Recent chats</div>
                  {sourceSessions.length > 0 ? (
                    <div className="grid min-w-0 gap-2">
                      {sourceSessions.map((session) => (
                        <InspectorRecentChatRow key={session.id} session={session} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                      No saved chats for this source yet.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Alert>
                <BookOpenIcon />
                <AlertTitle>No source selected</AlertTitle>
                <AlertDescription>
                  Upload a PDF or paste a transcript to start.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="prompts" className="animate-panel-in mt-0 space-y-4 p-4">
            <div className="grid gap-2">
              {prompts.map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  variant="outline"
                  className="hover-lift h-auto justify-start whitespace-normal rounded-lg py-3 text-left text-wrap"
                  disabled={!source}
                  onClick={() => onPromptClick(prompt)}
                >
                  <SparklesIcon />
                  {prompt}
                </Button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="animate-panel-in mt-0 space-y-4 p-4">
            <SettingSwitch
              checked={compactMode}
              description="Reduce spacing between chat messages."
              label="Compact Chat"
              onCheckedChange={onCompactModeChange}
            />
            {source ? (
              <Button type="button" variant="destructive" onClick={() => onDelete(source)}>
                <Trash2Icon />
                Delete source
              </Button>
            ) : null}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

function InspectorRecentChatRow({ session }: { session: LearningSessionSummary }) {
  const title = session.title === "New chat" ? "Untitled chat" : session.title;
  const preview = session.preview ?? formatSessionDate(session.updatedAt ?? session.createdAt);

  return (
    <div className="flex min-w-0 max-w-full items-start gap-2 overflow-hidden rounded-lg border bg-background p-3 text-sm">
      <MessageSquareIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium leading-5">{title}</div>
        <div className="mt-1 truncate text-xs leading-5 text-muted-foreground" title={preview}>
          {preview}
        </div>
      </div>
    </div>
  );
}

type ImportStageId = "reading" | "extracting" | "chunking" | "embedding" | "indexing" | "ready";

const IMPORT_STAGES: Array<{
  description: string;
  icon: typeof FileTextIcon;
  id: ImportStageId;
  label: string;
}> = [
  { description: "Preparing the file or transcript.", icon: FileTextIcon, id: "reading", label: "Reading source" },
  { description: "Pulling clean text out of the source.", icon: SearchCheckIcon, id: "extracting", label: "Extracting text" },
  { description: "Splitting content into study-sized retrieval units.", icon: LayersIcon, id: "chunking", label: "Splitting into study chunks" },
  { description: "Creating vectors for semantic lookup.", icon: DatabaseIcon, id: "embedding", label: "Creating embeddings" },
  { description: "Preparing compact source hints for answers.", icon: SearchCheckIcon, id: "indexing", label: "Building citation map" },
  { description: "The source is indexed and ready for study chat.", icon: CheckCircle2Icon, id: "ready", label: "Ready to study" },
];

function LearningSourceDialog({
  apiKey,
  initialKind,
  open,
  onOpenChange,
  onSaved,
}: {
  apiKey?: string;
  initialKind: LearningSourceKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (source: LearningSource) => void;
}) {
  const [kind, setKind] = useState<LearningSourceKind>(initialKind);
  const [title, setTitle] = useState("");
  const [show, setShow] = useState("");
  const [episode, setEpisode] = useState("");
  const [transcript, setTranscript] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeStage, setActiveStage] = useState<ImportStageId>("reading");
  const [savedSource, setSavedSource] = useState<LearningSource | null>(null);

  async function handleSave() {
    setIsSaving(true);
    setSavedSource(null);
    setActiveStage("reading");

    const timer = window.setInterval(() => {
      setActiveStage((current) => {
        const currentIndex = IMPORT_STAGES.findIndex((stage) => stage.id === current);
        const nextStage = IMPORT_STAGES[Math.min(currentIndex + 1, IMPORT_STAGES.length - 2)];
        return nextStage?.id ?? current;
      });
    }, 900);

    try {
      const response =
        kind === "book_pdf"
          ? await saveBookPdf()
          : await savePodcastTranscript();
      const data = (await response.json()) as LearningSourcesResponse;

      if (!response.ok || !data.source) {
        throw new Error(data.error ?? "Could not add source.");
      }

      setActiveStage("ready");
      setSavedSource(data.source);
      toast.success("Learning source added.");
    } catch (caughtError) {
      toast.error(getErrorMessage(caughtError));
    } finally {
      window.clearInterval(timer);
      setIsSaving(false);
    }
  }

  async function saveBookPdf() {
    if (!file) {
      throw new Error("Upload a PDF file.");
    }

    const body = new FormData();
    body.set("file", file);

    if (title.trim()) {
      body.set("title", title.trim());
    }

    if (apiKey) {
      body.set("apiKey", apiKey);
    }

    return fetch("/api/learning-sources", {
      method: "POST",
      body,
    });
  }

  async function savePodcastTranscript() {
    return fetch("/api/learning-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        episode: episode.trim() || undefined,
        show: show.trim() || undefined,
        sourceKind: "podcast_transcript",
        title: title.trim() || episode.trim() || "Podcast transcript",
        transcript,
      }),
    });
  }

  function resetForm() {
    setTitle("");
    setShow("");
    setEpisode("");
    setTranscript("");
    setFile(null);
    setSavedSource(null);
    setActiveStage("reading");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !isSaving) {
      resetForm();
    }

    onOpenChange(nextOpen);
  }

  function handleFileSelect(nextFile: File | null) {
    setFile(nextFile);

    if (nextFile && !title.trim()) {
      setTitle(filenameToReadableTitle(nextFile.name));
    }
  }

  function handleStartStudying() {
    if (!savedSource) {
      return;
    }

    const source = savedSource;
    resetForm();
    onSaved(source);
  }

  const fileStatus = getPdfFileStatus(file);
  const inferredTitle = file ? filenameToReadableTitle(file.name) : "";
  const transcriptChars = transcript.trim().length;
  const readyPrompts = [
    "Summarize core ideas",
    "Create a practice plan",
    "Extract mental models",
    "Quiz me from this source",
  ];
  const canSave =
    kind === "book_pdf"
      ? Boolean(file) && fileStatus.valid
      : transcriptChars >= 200 && Boolean(title.trim() || episode.trim());

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[92dvh] flex-col overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b p-6 pb-4 pr-14">
          <DialogTitle>Source Import Studio</DialogTitle>
          <DialogDescription>
            Build a study-ready source with extraction, chunking, embeddings, and citation hints.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {savedSource ? (
            <SourceReadyPanel source={savedSource} prompts={readyPrompts} />
          ) : (
            <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,20rem)]">
              <Tabs
                value={kind}
                className="min-w-0"
                onValueChange={(value) => setKind(value as LearningSourceKind)}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="book_pdf">Book PDF</TabsTrigger>
                  <TabsTrigger value="podcast_transcript">Podcast Transcript</TabsTrigger>
                </TabsList>

                <TabsContent value="book_pdf" className="mt-5 grid gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="learning-book-title">Title</Label>
                    <Input
                      id="learning-book-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder={inferredTitle || "Optional; defaults to filename"}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="learning-book-file">PDF file</Label>
                    <label
                      htmlFor="learning-book-file"
                      className={cn(
                        "group grid cursor-pointer gap-3 rounded-lg border border-dashed bg-muted/20 p-6 text-center transition hover:border-primary/60 hover:bg-muted/35",
                        file && fileStatus.valid && "border-emerald-500/60 bg-emerald-500/5",
                        file && !fileStatus.valid && "border-destructive/70 bg-destructive/5",
                      )}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleFileSelect(event.dataTransfer.files?.[0] ?? null);
                      }}
                    >
                      <div className="mx-auto flex size-14 items-center justify-center rounded-lg bg-background shadow-sm">
                        <UploadIcon className="size-6 text-muted-foreground transition group-hover:text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          {file ? file.name : "Drop a text-based PDF here"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {file
                            ? `${formatBytes(file.size)} / ${fileStatus.message}`
                            : "PDF only, up to 25 MB. Scanned image PDFs need OCR first."}
                        </div>
                      </div>
                    </label>
                    <Input
                      id="learning-book-file"
                      type="file"
                      accept=".pdf,application/pdf"
                      className="sr-only"
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        handleFileSelect(event.target.files?.[0] ?? null)
                      }
                    />
                  </div>
                </TabsContent>

                <TabsContent value="podcast_transcript" className="mt-5 grid gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="learning-podcast-title">Title</Label>
                    <Input
                      id="learning-podcast-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Episode title"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="learning-podcast-show">Show</Label>
                      <Input
                        id="learning-podcast-show"
                        value={show}
                        onChange={(event) => setShow(event.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="learning-podcast-episode">Episode</Label>
                      <Input
                        id="learning-podcast-episode"
                        value={episode}
                        onChange={(event) => setEpisode(event.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="learning-transcript">Transcript</Label>
                    <Textarea
                      id="learning-transcript"
                      value={transcript}
                      onChange={(event) => setTranscript(event.target.value)}
                      placeholder="Paste the podcast transcript..."
                      className="min-h-56"
                    />
                    <p className="text-xs text-muted-foreground">
                      {transcriptChars.toLocaleString()} characters / minimum 200 / maximum 500k.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              <ImportTimeline activeStage={activeStage} isSaving={isSaving} />
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t bg-popover p-4">
          {savedSource ? (
            <Button type="button" onClick={handleStartStudying}>
              <SparklesIcon />
              Start studying
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={isSaving} onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={!canSave || isSaving} onClick={() => void handleSave()}>
                {isSaving ? <Spinner /> : kind === "book_pdf" ? <BookOpenIcon /> : <HeadphonesIcon />}
                {isSaving ? "Importing source" : "Build study source"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportTimeline({
  activeStage,
  isSaving,
}: {
  activeStage: ImportStageId;
  isSaving: boolean;
}) {
  const activeIndex = IMPORT_STAGES.findIndex((stage) => stage.id === activeStage);

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Import pipeline</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            See how a raw source becomes citation-grounded study chat.
          </p>
        </div>
        <Badge variant={isSaving ? "secondary" : "outline"}>
          {isSaving ? "Running" : "Preview"}
        </Badge>
      </div>
      <div className="mt-4 grid gap-2">
        {IMPORT_STAGES.map((stage, index) => {
          const Icon = stage.icon;
          const isDone = activeStage === "ready" || index < activeIndex;
          const isActive = index === activeIndex && activeStage !== "ready";

          return (
            <div
              key={stage.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 transition",
                isActive && "border-primary/50 bg-primary/5",
                isDone && "border-emerald-500/30 bg-emerald-500/5",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted",
                  isActive && "bg-primary text-primary-foreground",
                  isDone && "bg-emerald-500 text-white",
                )}
              >
                {isDone ? (
                  <CheckCircle2Icon className="size-4" />
                ) : isActive && isSaving ? (
                  <Spinner className="size-4" />
                ) : (
                  <Icon className="size-4" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">{stage.label}</div>
                <div className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {stage.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SourceReadyPanel({
  prompts,
  source,
}: {
  prompts: string[];
  source: LearningSource;
}) {
  const stats = [
    ["Type", sourceKindLabel(source.sourceKind)],
    ["Chunks", String(source.chunkCount)],
    ["Characters", source.sourceChars.toLocaleString()],
    ...(source.pageCount ? [["Pages", String(source.pageCount)]] : []),
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
      <div className="rounded-lg border bg-emerald-500/5 p-5">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
            <CheckCircle2Icon className="size-6" />
          </div>
          <div className="min-w-0">
            <Badge variant="secondary" className="mb-3">
              Ready to study
            </Badge>
            <h3 className="text-xl font-semibold text-pretty">{source.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The source is indexed, searchable, and ready for grounded study chat.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {prompts.map((prompt) => (
            <div key={prompt} className="rounded-lg border bg-background/80 p-3 text-sm">
              <SparklesIcon className="mb-2 size-4 text-muted-foreground" />
              {prompt}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border bg-background p-4">
        <div className="text-sm font-semibold">Source stats</div>
        <div className="mt-3 grid gap-3">
          {stats.map(([label, value]) => (
            <SummaryMetric key={label} label={label} value={value} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PersonaEditorDialog({
  apiKey,
  mode,
  model,
  open,
  persona,
  onOpenChange,
  onSaved,
}: {
  apiKey?: string;
  mode: PersonaDialogMode;
  model?: string;
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
  const [generationMode, setGenerationMode] = useState<GenerationMode>(
    initialDraft?.generation_mode ?? "detailed",
  );
  const [sourceText, setSourceText] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<PersonaData | null>(initialDraft);
  const [reviewForm, setReviewForm] = useState<PersonaReviewForm>(
    initialDraft ? personaToReviewForm(initialDraft) : createEmptyReviewForm(),
  );
  const [generationMeta, setGenerationMeta] = useState<GenerationMeta | null>(
    initialDraft?.generation_meta ?? null,
  );
  const [sourceMemory, setSourceMemory] = useState<SourceMemoryPayload | null>(null);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress>("idle");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleGenerate() {
    const progressTimers: Array<ReturnType<typeof setTimeout>> = [];
    setIsGenerating(true);
    setGenerationMeta(null);
    setSourceMemory(null);
    setGenerationProgress("reading");

    try {
      const body = new FormData();
      body.set("generationMode", generationMode);
      body.set("name", name.trim());
      body.set("sourceType", sourceType);

      if (apiKey) {
        body.set("apiKey", apiKey);
      }

      if (model) {
        body.set("model", model);
      }

      if (sourceFile) {
        body.set("file", sourceFile);
      } else {
        body.set("sourceText", sourceText);
      }

      if (generationMode === "high_fidelity") {
        progressTimers.push(
          setTimeout(() => setGenerationProgress("splitting"), 500),
          setTimeout(() => setGenerationProgress("analyzing"), 1300),
          setTimeout(() => setGenerationProgress("merging"), 3600),
          setTimeout(() => setGenerationProgress("examples"), 5200),
        );
      } else {
        progressTimers.push(setTimeout(() => setGenerationProgress("examples"), 800));
      }

      const response = await fetch("/api/persona/generate", {
        method: "POST",
        body,
      });
      const data = (await response.json()) as {
        meta?: GenerationMeta;
        persona?: PersonaData;
        sourceMemory?: SourceMemoryPayload;
        error?: string;
      };

      if (!response.ok || !data.persona) {
        throw new Error(data.error ?? "Could not generate persona.");
      }

      setDraft(data.persona);
      setGenerationMeta(data.meta ?? data.persona.generation_meta ?? null);
      setSourceMemory(data.sourceMemory ?? null);
      setReviewForm(personaToReviewForm(data.persona));
      setName(data.persona.name);
      setGenerationProgress("ready");
      setStep("review");
      toast.success("Draft generated. Review it, then save to your library.");
    } catch (caughtError) {
      setGenerationProgress("idle");
      toast.error(getErrorMessage(caughtError));
    } finally {
      progressTimers.forEach((timer) => clearTimeout(timer));
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
        body: JSON.stringify({
          persona: nextDraft,
          sourceMemory,
          apiKey: apiKey ? apiKey.trim() || undefined : undefined,
        }),
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
            Paste a transcript or upload a .txt file. The draft stores style rules, not raw source text.
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
            <div className="space-y-2">
              <Label>Capture depth</Label>
              <FidelityModeCards
                disabled={isGenerating}
                value={generationMode}
                onChange={setGenerationMode}
              />
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
            {isGenerating ? (
              <GenerationProgressPanel progress={generationProgress} mode={generationMode} />
            ) : null}
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
                    <Badge variant="secondary">
                      {reviewForm.generationMode.replace("_", " ")}
                    </Badge>
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
                <GenerationSummaryPanel
                  meta={generationMeta ?? draft.generation_meta ?? null}
                  persona={draft}
                />

                <Tabs defaultValue="overview" className="gap-4">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="voice">Voice</TabsTrigger>
                    <TabsTrigger value="behavior">Behavior</TabsTrigger>
                    <TabsTrigger value="examples">Examples</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="mt-0 grid gap-3">
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
                      rows={3}
                      onChange={(value) => setReviewField("bio", value)}
                    />
                    <DraftArea
                      name="review-identity"
                      label="Identity"
                      value={reviewForm.identity}
                      rows={5}
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
                  </TabsContent>

                  <TabsContent value="voice" className="mt-0 grid gap-3">
                    <DraftArea
                      name="review-voice-profile"
                      label="Voice profile"
                      value={reviewForm.voiceProfile}
                      rows={5}
                      onChange={(value) => setReviewField("voiceProfile", value)}
                    />
                    <DraftArea
                      name="review-language-profile"
                      label="Language profile"
                      value={reviewForm.languageProfile}
                      rows={4}
                      onChange={(value) => setReviewField("languageProfile", value)}
                    />
                    <DraftArea
                      name="review-phrase-bank"
                      label="Phrase bank"
                      value={reviewForm.phraseBank}
                      rows={6}
                      onChange={(value) => setReviewField("phraseBank", value)}
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
                  </TabsContent>

                  <TabsContent value="behavior" className="mt-0 grid gap-3">
                    <DraftArea
                      name="review-reasoning-profile"
                      label="Reasoning profile"
                      value={reviewForm.reasoningProfile}
                      rows={5}
                      onChange={(value) => setReviewField("reasoningProfile", value)}
                    />
                    <DraftArea
                      name="review-interaction-rules"
                      label="Interaction rules"
                      value={reviewForm.interactionRules}
                      rows={5}
                      onChange={(value) => setReviewField("interactionRules", value)}
                    />
                    <DraftArea
                      name="review-addressing-rules"
                      label="Addressing rules"
                      value={reviewForm.addressingRules}
                      rows={3}
                      onChange={(value) => setReviewField("addressingRules", value)}
                    />
                    <DraftField
                      name="review-teaching-pattern"
                      label="Response pattern"
                      value={reviewForm.teachingPattern}
                      onChange={(value) => setReviewField("teachingPattern", value)}
                    />
                    <DraftArea
                      name="review-do-rules"
                      label="Do rules"
                      value={reviewForm.doRules}
                      rows={4}
                      onChange={(value) => setReviewField("doRules", value)}
                    />
                    <DraftArea
                      name="review-dont-rules"
                      label="Don't rules"
                      value={reviewForm.dontRules}
                      rows={4}
                      onChange={(value) => setReviewField("dontRules", value)}
                    />
                  </TabsContent>

                  <TabsContent value="examples" className="mt-0 grid gap-3">
                    <Alert>
                      <SparklesIcon />
                      <AlertTitle>High-fidelity fields</AlertTitle>
                      <AlertDescription>
                        Use one line per example. Scenario examples use: scenario | question | answer.
                      </AlertDescription>
                    </Alert>
                    <DraftArea
                      name="review-scenario-examples"
                      label="Scenario examples"
                      value={reviewForm.scenarioExamples}
                      rows={7}
                      onChange={(value) => setReviewField("scenarioExamples", value)}
                    />
                    <DraftArea
                      name="review-few-shot"
                      label="Few-shot examples"
                      value={reviewForm.fewShot}
                      rows={6}
                      onChange={(value) => setReviewField("fewShot", value)}
                    />
                    <DraftArea
                      name="review-style-confidence"
                      label="Style confidence notes"
                      value={reviewForm.styleConfidence}
                      rows={4}
                      onChange={(value) => setReviewField("styleConfidence", value)}
                    />
                  </TabsContent>
                </Tabs>
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

function FidelityModeCards({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (mode: GenerationMode) => void;
  value: GenerationMode;
}) {
  const modes: Array<{
    description: string;
    mode: GenerationMode;
    title: string;
    stats: string;
  }> = [
    {
      description: "Fast one-pass extraction for a quick editable draft.",
      mode: "compact",
      stats: "Fast / low tokens / short notes",
      title: "Compact",
    },
    {
      description: "Richer voice, behavior, rules, and examples for most files.",
      mode: "detailed",
      stats: "Balanced / richer draft / 2k+ words",
      title: "Detailed",
    },
    {
      description: "Deep style capture plus searchable source memory for grounded replies.",
      mode: "high_fidelity",
      stats: "Slower / embeddings / remembers source",
      title: "High Fidelity",
    },
  ];

  return (
    <div className="grid gap-2 md:grid-cols-3">
      {modes.map((mode) => (
        <button
          key={mode.mode}
          type="button"
          disabled={disabled}
          onClick={() => onChange(mode.mode)}
          className={cn(
            "rounded-lg border bg-background p-3 text-left transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
            value === mode.mode && "border-primary bg-muted",
          )}
        >
          <span className="block text-sm font-semibold">{mode.title}</span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            {mode.description}
          </span>
          <span className="mt-3 block text-[11px] font-medium text-muted-foreground">
            {mode.stats}
          </span>
        </button>
      ))}
    </div>
  );
}

function GenerationProgressPanel({
  mode,
  progress,
}: {
  mode: GenerationMode;
  progress: GenerationProgress;
}) {
  const steps: Array<{ key: GenerationProgress; label: string }> = [
    { key: "reading", label: "Reading source" },
    { key: "splitting", label: "Splitting chunks" },
    { key: "analyzing", label: "Analyzing chunks" },
    { key: "merging", label: "Merging profile" },
    { key: "examples", label: "Building examples" },
    { key: "ready", label: "Ready to review" },
  ];
  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === progress),
  );
  const visibleSteps = mode === "high_fidelity"
    ? steps
    : steps.filter((step) => step.key === "reading" || step.key === "examples" || step.key === "ready");

  return (
    <div className="rounded-lg border bg-muted/35 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Spinner className="size-4" />
        Generating {mode.replace("_", " ")} persona
      </div>
      <div className="mt-3 grid gap-2">
        {visibleSteps.map((step) => {
          const index = steps.findIndex((item) => item.key === step.key);
          const isDone = index < activeIndex || progress === "ready";
          const isActive = step.key === progress;

          return (
            <div
              key={step.key}
              className={cn(
                "flex items-center gap-2 text-xs text-muted-foreground",
                (isActive || isDone) && "text-foreground",
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full bg-muted-foreground/40",
                  isDone && "bg-emerald-500",
                  isActive && "animate-soft-pulse bg-primary",
                )}
              />
              {step.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GenerationSummaryPanel({
  meta,
  persona,
}: {
  meta: GenerationMeta | null;
  persona: PersonaData;
}) {
  const scenarioCount = persona.scenario_examples?.length ?? 0;
  const confidenceCount = persona.style_confidence?.length ?? 0;

  return (
    <div className="mb-5 grid gap-2 rounded-lg border bg-background p-3 text-sm sm:grid-cols-5">
      <SummaryMetric label="Mode" value={(meta?.generationMode ?? persona.generation_mode ?? "compact").replace("_", " ")} />
      <SummaryMetric label="Chunks" value={String(meta?.chunkCount ?? 1)} />
      <SummaryMetric label="Memory" value={String(meta?.memoryChunkCount ?? 0)} />
      <SummaryMetric label="Confidence notes" value={String(confidenceCount)} />
      <SummaryMetric label="Scenarios" value={String(scenarioCount)} />
      {meta?.sourceTruncated ? (
        <div className="text-xs text-amber-600 sm:col-span-5">
          Source was truncated or chunk-limited for this draft.
        </div>
      ) : null}
    </div>
  );
}

function InspectorStep({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileTextIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background p-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{label}</div>
        <div className="truncate text-xs text-muted-foreground">{value}</div>
      </div>
      <CheckCircle2Icon className="size-4 shrink-0 text-emerald-500" />
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-medium capitalize">{value}</div>
    </div>
  );
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
    generationMode: "detailed",
    name: "",
    tagline: "",
    bio: "",
    identity: "",
    voiceProfile: "",
    languageProfile: "",
    reasoningProfile: "",
    interactionRules: "",
    addressingRules:
      "Speak directly to the signed-in user in a one-on-one conversation. Do not address them as chat, viewers, subscribers, or audience.",
    phraseBank: "",
    doRules: "",
    dontRules: "",
    topics: "",
    starterPrompts: "",
    toneTraits: "",
    catchphrases: "",
    teachingPattern:
      "understand the question -> answer in style -> give a practical next step",
    fewShot: "",
    scenarioExamples: "",
    styleConfidence: "",
  };
}

function personaToReviewForm(persona: PersonaData): PersonaReviewForm {
  return {
    generationMode: persona.generation_mode ?? "compact",
    name: persona.name,
    tagline: persona.tagline ?? "",
    bio: persona.bio ?? "",
    identity: persona.identity,
    voiceProfile: persona.voice_profile ?? "",
    languageProfile: persona.language_profile ?? "",
    reasoningProfile: persona.reasoning_profile ?? "",
    interactionRules: persona.interaction_rules ?? "",
    addressingRules: persona.addressing_rules ?? "",
    phraseBank: phraseBankToString(persona.phrase_bank),
    doRules: (persona.do_rules ?? []).join("\n"),
    dontRules: (persona.dont_rules ?? []).join("\n"),
    topics: (persona.topics ?? []).join("\n"),
    starterPrompts: (persona.starter_prompts ?? []).join("\n"),
    toneTraits: persona.tone_traits.join("\n"),
    catchphrases: persona.catchphrases.join("\n"),
    teachingPattern: persona.teaching_pattern,
    fewShot: persona.few_shot.map((item) => `${item.q} | ${item.a}`).join("\n"),
    scenarioExamples: (persona.scenario_examples ?? [])
      .map((item) => `${item.scenario} | ${item.q} | ${item.a}`)
      .join("\n"),
    styleConfidence: (persona.style_confidence ?? []).join("\n"),
  };
}

function reviewFormToPersonaData(
  form: PersonaReviewForm,
  previousDraft: PersonaData,
): PersonaData {
  return {
    ...previousDraft,
    generation_mode: form.generationMode,
    name: form.name.trim() || previousDraft.name,
    tagline: form.tagline.trim() || "Custom persona",
    bio: form.bio.trim() || previousDraft.bio || previousDraft.identity,
    identity: form.identity.trim() || previousDraft.identity,
    voice_profile: form.voiceProfile.trim() || undefined,
    language_profile: form.languageProfile.trim() || undefined,
    reasoning_profile: form.reasoningProfile.trim() || undefined,
    interaction_rules: form.interactionRules.trim() || undefined,
    addressing_rules: form.addressingRules.trim() || undefined,
    phrase_bank: stringToPhraseBank(form.phraseBank),
    do_rules: lineStringToArray(form.doRules, 16),
    dont_rules: lineStringToArray(form.dontRules, 16),
    topics: lineStringToArray(form.topics),
    starter_prompts: lineStringToArray(form.starterPrompts, 6),
    tone_traits: lineStringToArray(form.toneTraits),
    catchphrases: lineStringToArray(form.catchphrases),
    teaching_pattern: form.teachingPattern.trim() || previousDraft.teaching_pattern,
    few_shot: fewShotStringToArray(form.fewShot),
    scenario_examples: scenarioExamplesStringToArray(form.scenarioExamples),
    style_confidence: lineStringToArray(form.styleConfidence, 12),
  };
}

function lineStringToArray(value: string, maxItems = 12) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function fewShotStringToArray(value: string) {
  return value
    .split("\n")
    .map((line) => parseFewShotLine(line))
    .filter((item): item is { q: string; a: string } => Boolean(item))
    .slice(0, 8);
}

function scenarioExamplesStringToArray(value: string) {
  return value
    .split("\n")
    .map((line) => {
      const [scenario, q, ...answerParts] = line.split("|");
      const a = answerParts.join("|");

      return scenario?.trim() && q?.trim() && a?.trim()
        ? { scenario: scenario.trim(), q: q.trim(), a: a.trim() }
        : null;
    })
    .filter((item): item is { scenario: string; q: string; a: string } => Boolean(item))
    .slice(0, 10);
}

function phraseBankToString(phraseBank: PersonaData["phrase_bank"]) {
  if (!phraseBank) {
    return "";
  }

  return (["greetings", "transitions", "encouragement", "corrections", "closings"] as const)
    .map((key) => {
      const phrases = phraseBank[key] ?? [];

      return phrases.length ? `${key}: ${phrases.join(", ")}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function stringToPhraseBank(value: string): PersonaData["phrase_bank"] {
  const bank: NonNullable<PersonaData["phrase_bank"]> = {};

  for (const line of value.split("\n")) {
    const [rawKey, ...rawPhrases] = line.split(":");
    const key = rawKey.trim() as keyof NonNullable<PersonaData["phrase_bank"]>;

    if (!["greetings", "transitions", "encouragement", "corrections", "closings"].includes(key)) {
      continue;
    }

    const phrases = rawPhrases
      .join(":")
      .split(",")
      .map((phrase) => phrase.trim())
      .filter(Boolean)
      .slice(0, 14);

    if (phrases.length) {
      bank[key] = phrases;
    }
  }

  return Object.keys(bank).length ? bank : undefined;
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
    generation_mode: "compact",
    do_rules: [],
    dont_rules: [],
    scenario_examples: [],
    style_confidence: [],
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

function parseMessageParts(content: string): MessagePart[] {
  const parts: MessagePart[] = [];
  const codeFencePattern = /```([^\n`]*)\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = codeFencePattern.exec(content)) !== null) {
    if (match.index > cursor) {
      parts.push({ type: "text", text: content.slice(cursor, match.index) });
    }

    parts.push({
      type: "code",
      language: match[1]?.trim() ?? "",
      code: match[2] ?? "",
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < content.length) {
    parts.push({ type: "text", text: content.slice(cursor) });
  }

  return parts.filter((part) =>
    part.type === "code" ? part.code.length > 0 : part.text.trim().length > 0,
  );
}

function normalizeCodeLanguage(language: string) {
  const normalized = language.trim().toLowerCase();
  const aliases: Record<string, string> = {
    "c++": "cpp",
    htm: "html",
    js: "javascript",
    jsx: "typescript",
    md: "markdown",
    node: "javascript",
    py: "python",
    sh: "bash",
    shell: "bash",
    ts: "typescript",
    tsx: "typescript",
    yml: "yaml",
  };

  return aliases[normalized] ?? normalized;
}

function tokenizeCode(code: string, language: string): SyntaxToken[] {
  const tokens: SyntaxToken[] = [];
  const keywords = getKeywordsForLanguage(language);
  let index = 0;

  while (index < code.length) {
    const rest = code.slice(index);
    const current = code[index];

    if (rest.startsWith("//") || rest.startsWith("--")) {
      const end = findLineEnd(code, index);
      tokens.push({ text: code.slice(index, end), type: "comment" });
      index = end;
      continue;
    }

    if (rest.startsWith("/*")) {
      const end = code.indexOf("*/", index + 2);
      const nextIndex = end === -1 ? code.length : end + 2;
      tokens.push({ text: code.slice(index, nextIndex), type: "comment" });
      index = nextIndex;
      continue;
    }

    if (current === "#" && isLineCommentStart(code, index)) {
      const end = findLineEnd(code, index);
      tokens.push({ text: code.slice(index, end), type: "comment" });
      index = end;
      continue;
    }

    if (current === "\"" || current === "'" || current === "`") {
      const end = findStringEnd(code, index, current);
      tokens.push({ text: code.slice(index, end), type: "string" });
      index = end;
      continue;
    }

    if (current === "<" && /<\/?[A-Za-z]/.test(rest.slice(0, 3))) {
      const match = rest.match(/^<\/?[A-Za-z][\w:-]*/);
      if (match) {
        tokens.push({ text: match[0], type: "tag" });
        index += match[0].length;
        continue;
      }
    }

    if (/\d/.test(current)) {
      const match = rest.match(/^\d[\d._]*(?:[A-Za-z%]+)?/);
      if (match) {
        tokens.push({ text: match[0], type: "number" });
        index += match[0].length;
        continue;
      }
    }

    if (/[A-Za-z_$]/.test(current)) {
      const match = rest.match(/^[A-Za-z_$][\w$-]*/);
      if (match) {
        const word = match[0];
        const nextCharacter = code.slice(index + word.length).trimStart()[0];
        const tokenType =
          keywords.has(word) || keywords.has(word.toLowerCase())
            ? "keyword"
            : nextCharacter === "("
              ? "function"
              : "plain";

        tokens.push({ text: word, type: tokenType });
        index += word.length;
        continue;
      }
    }

    if (/[{}()[\],.;:]/.test(current)) {
      tokens.push({ text: current, type: "punctuation" });
      index += 1;
      continue;
    }

    if (/[=+\-*/%<>!&|?:]/.test(current)) {
      tokens.push({ text: current, type: "operator" });
      index += 1;
      continue;
    }

    tokens.push({ text: current, type: "plain" });
    index += 1;
  }

  return tokens;
}

function getKeywordsForLanguage(language: string) {
  if (language === "javascript" || language === "typescript") {
    return LANGUAGE_KEYWORDS[language];
  }

  if (language === "html" || language === "css" || language === "json") {
    return LANGUAGE_KEYWORDS[language];
  }

  return LANGUAGE_KEYWORDS[language] ?? LANGUAGE_KEYWORDS.typescript;
}

function findLineEnd(code: string, start: number) {
  const nextLine = code.indexOf("\n", start);
  return nextLine === -1 ? code.length : nextLine;
}

function isLineCommentStart(code: string, start: number) {
  const previousLine = code.lastIndexOf("\n", start - 1);
  return code.slice(previousLine + 1, start).trim().length === 0;
}

function findStringEnd(code: string, start: number, quote: string) {
  let index = start + 1;

  while (index < code.length) {
    if (code[index] === "\\") {
      index += 2;
      continue;
    }

    if (code[index] === quote) {
      return index + 1;
    }

    index += 1;
  }

  return code.length;
}

function getSyntaxTokenClassName(type: SyntaxTokenType) {
  switch (type) {
    case "comment":
      return "text-zinc-500";
    case "function":
      return "text-sky-300";
    case "keyword":
      return "text-fuchsia-300";
    case "number":
      return "text-amber-300";
    case "operator":
      return "text-zinc-300";
    case "punctuation":
      return "text-zinc-400";
    case "string":
      return "text-emerald-300";
    case "tag":
      return "text-rose-300";
    case "plain":
    default:
      return "text-zinc-100";
  }
}

function readLearningCitations(value: string | null): LearningCitation[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item): LearningCitation | null => {
        if (typeof item !== "object" || item === null) {
          return null;
        }

        const citation = item as Partial<LearningCitation>;

        return typeof citation.label === "string" &&
          typeof citation.sourceId === "string" &&
          typeof citation.chunkIndex === "number"
          ? {
              chunkIndex: citation.chunkIndex,
              label: citation.label,
              pageEnd: citation.pageEnd ?? null,
              pageStart: citation.pageStart ?? null,
              sourceId: citation.sourceId,
            }
          : null;
      })
      .filter((item): item is LearningCitation => Boolean(item));
  } catch {
    return [];
  }
}

function sourceKindLabel(kind: LearningSourceKind) {
  return kind === "book_pdf" ? "Book PDF" : "Podcast transcript";
}

function filenameToReadableTitle(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getPdfFileStatus(file: File | null) {
  if (!file) {
    return { message: "Waiting for PDF", valid: false };
  }

  const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";

  if (!isPdf) {
    return { message: "Choose a PDF file", valid: false };
  }

  if (file.size > 25 * 1024 * 1024) {
    return { message: "Over the 25 MB limit", valid: false };
  }

  return { message: "Ready for import", valid: true };
}

async function authApiRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readAuthError(response));
  }

  return response.json().catch(() => null);
}

async function readAuthError(response: Response) {
  try {
    const data = (await response.json()) as {
      code?: string;
      error?: string;
      message?: string;
    };

    return data.message ?? data.error ?? data.code ?? "Request failed.";
  } catch {
    return "Request failed.";
  }
}

function clearLocalSettings() {
  localStorage.removeItem("persona-ai-api-key-mode");
  localStorage.removeItem("persona-ai-openrouter-key");
  localStorage.removeItem("persona-ai-model");
  localStorage.removeItem("persona-ai-model-mode");
  localStorage.removeItem("persona-ai-compact-mode");
  localStorage.removeItem("persona-ai-show-profile-rail");
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
