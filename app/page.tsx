import Image from "next/image";
import Link from "next/link";
import {
  BookOpenIcon,
  BrainCircuitIcon,
  FileTextIcon,
  LibraryIcon,
  MessageSquareTextIcon,
  QuoteIcon,
  SearchCheckIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UploadIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { LandingHeaderActions, LandingHeroActions } from "./components/LandingActions";
import { ThemeToggle } from "./components/ThemeToggle";

const workflows = [
  ["Import source", UploadIcon],
  ["Generate persona or study index", BrainCircuitIcon],
  ["Chat with memory and citations", SearchCheckIcon],
];

const productPillars = [
  {
    description: "Create custom AI personas from transcripts, WhatsApp chats, YouTube exports, or pasted text.",
    icon: SparklesIcon,
    title: "Persona Studio",
  },
  {
    description: "Upload PDFs or paste podcast transcripts, then ask for summaries, practice plans, and recall prompts.",
    icon: LibraryIcon,
    title: "Study Library",
  },
  {
    description: "Keep retrieval visible with chunks, source memory, and compact citations attached to answers.",
    icon: QuoteIcon,
    title: "Source-grounded chat",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <SparklesIcon className="size-4" />
            </span>
            Mindprint
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LandingHeaderActions />
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-6xl flex-col justify-center gap-8 px-4 py-8 sm:px-6 lg:py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(20rem,0.55fr)] lg:items-end">
          <div className="space-y-6">
            <Badge variant="secondary" className="w-fit">
              Persona Studio + Study Library
            </Badge>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-normal text-balance sm:text-6xl">
                Build AI personas and study libraries from real sources.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Turn transcripts, chats, PDFs, and podcasts into private AI workspaces with
                source memory, grounded study chat, and visible citations.
              </p>
            </div>
            <LandingHeroActions />
          </div>

          <div className="grid gap-3">
            {workflows.map(([label, Icon]) => (
              <div key={label as string} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-3 text-sm shadow-sm">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Icon className="size-4 text-muted-foreground" />
                </span>
                {label as string}
              </div>
            ))}
          </div>
        </div>

        <ProductWorkspacePreview />
      </section>

      <section className="border-t bg-muted/25 px-4 py-10 sm:px-6">
        <div className="mx-auto grid w-full max-w-6xl gap-4 md:grid-cols-3">
          {productPillars.map((pillar) => (
            <div key={pillar.title} className="rounded-lg border bg-background p-5 shadow-sm">
              <div className="flex size-10 items-center justify-center rounded-md bg-muted">
                <pillar.icon className="size-5 text-muted-foreground" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">{pillar.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{pillar.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t bg-background/90 px-4 py-5 text-center text-sm text-muted-foreground sm:px-6">
        Made with ❤️ by DT89
      </footer>
    </main>
  );
}

function ProductWorkspacePreview() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageSquareTextIcon className="size-4 text-muted-foreground" />
          Unified workspace
        </div>
        <Badge variant="outline">Private by default</Badge>
      </div>
      <div className="grid min-h-[28rem] bg-background lg:grid-cols-[15rem_minmax(0,1fr)_17rem]">
        <aside className="hidden border-r bg-muted/30 p-3 lg:block">
          <div className="grid gap-2">
            <PreviewNavItem active icon={SparklesIcon} label="Personas" meta="2 mentors" />
            <PreviewNavItem icon={LibraryIcon} label="Study Library" meta="PDFs + podcasts" />
          </div>
          <div className="mt-5 grid gap-2">
            <PreviewSource icon={FileTextIcon} label="Atomic Habits.pdf" meta="48 chunks" />
            <PreviewSource icon={BookOpenIcon} label="Podcast transcript" meta="23 chunks" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-3 border-b p-4">
            <Image
              src="/hitesh.jpg"
              alt="Example persona"
              width={40}
              height={40}
              className="size-10 rounded-full object-cover"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Study assistant</div>
              <div className="truncate text-xs text-muted-foreground">
                Grounded in selected source
              </div>
            </div>
          </div>
          <div className="grid flex-1 content-end gap-3 p-4">
            <div className="max-w-[75%] rounded-lg bg-muted p-3 text-sm">
              Pull the strongest mental models from this chapter and make them practical.
            </div>
            <div className="ml-auto max-w-[82%] rounded-lg bg-primary p-3 text-sm text-primary-foreground">
              Here are three useful models, each tied to a concrete next step.
            </div>
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-emerald-500/5 px-2.5 py-2 text-xs text-muted-foreground">
              <SearchCheckIcon className="size-3.5 text-emerald-600" />
              Grounded in
              <Badge variant="outline" className="bg-background">Pages 12-14</Badge>
              <Badge variant="outline" className="bg-background">Chunk 8</Badge>
            </div>
          </div>
        </div>

        <aside className="hidden border-l bg-muted/20 p-4 lg:block">
          <div className="text-sm font-semibold">Context Inspector</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Switches between persona profile and source intelligence.
          </p>
          <div className="mt-4 grid gap-2 text-sm">
            <PreviewMetric label="Source status" value="Ready" />
            <PreviewMetric label="Chunks" value="48 indexed" />
            <PreviewMetric label="Citations" value="Visible" />
          </div>
          <div className="mt-4 rounded-lg border bg-background p-3 text-xs leading-5 text-muted-foreground">
            Answers retrieve relevant chunks before responding, then show compact source hints.
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg border bg-background p-2 text-xs">
            <ShieldCheckIcon className="size-4 text-muted-foreground" />
            Private workspace
          </div>
        </aside>
      </div>
    </div>
  );
}

function PreviewNavItem({
  active,
  icon: Icon,
  label,
  meta,
}: {
  active?: boolean;
  icon: typeof SparklesIcon;
  label: string;
  meta: string;
}) {
  return (
    <div className={`rounded-lg border p-3 ${active ? "bg-background" : "bg-background/60"}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{meta}</div>
    </div>
  );
}

function PreviewSource({
  icon: Icon,
  label,
  meta,
}: {
  icon: typeof FileTextIcon;
  label: string;
  meta: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-background/70 p-2 text-sm">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="truncate">{label}</div>
        <div className="text-xs text-muted-foreground">{meta}</div>
      </div>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
