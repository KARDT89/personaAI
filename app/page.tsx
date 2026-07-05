import Image from "next/image";
import Link from "next/link";
import {
  ArrowRightIcon,
  FileTextIcon,
  LockKeyholeIcon,
  MessageSquareTextIcon,
  SparklesIcon,
  UploadIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { ThemeToggle } from "./components/ThemeToggle";

const examples = [
  {
    name: "Hitesh",
    image: "/hitesh.jpg",
    tagline: "Practical web dev mentor",
  },
  {
    name: "Piyush",
    image: "/piyush.jpg",
    tagline: "Systems-minded coding guide",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b bg-background/90">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <SparklesIcon className="size-4" />
            </span>
            PersonaAI
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/app"
              className={cn(buttonVariants({ variant: "outline" }), "hidden sm:inline-flex")}
            >
              Sign in
            </Link>
            <Link href="/app" className={buttonVariants()}>
              Open app
              <ArrowRightIcon />
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_0.86fr]">
        <div className="space-y-7">
          <Badge variant="secondary" className="w-fit">
            Private persona builder for chat
          </Badge>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-balance sm:text-6xl">
              Turn transcripts and chats into personal AI personas.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Start with example coding mentors, then create your own private
              personas from YouTube transcripts, WhatsApp exports, or pasted text.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/app" className={cn(buttonVariants({ size: "lg" }), "h-11")}>
              Create your persona
              <ArrowRightIcon />
            </Link>
            <Link
              href="/app"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}
            >
              Try examples
            </Link>
          </div>

          <div className="grid gap-3 pt-4 sm:grid-cols-3">
            {[
              ["Upload .txt", UploadIcon],
              ["Paste transcript", FileTextIcon],
              ["Chat privately", LockKeyholeIcon],
            ].map(([label, Icon]) => (
              <div
                key={label as string}
                className="flex items-center gap-2 rounded-2xl border bg-card px-3 py-2 text-sm"
              >
                <Icon className="size-4 text-muted-foreground" />
                {label as string}
              </div>
            ))}
          </div>
        </div>

        <Card className="overflow-hidden rounded-3xl border bg-card shadow-sm">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquareTextIcon className="size-4" />
              Persona workspace
            </CardTitle>
            <CardDescription>
              Example personas are included; custom personas stay scoped to you.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-4">
            <div className="grid gap-3">
              {examples.map((persona) => (
                <div
                  key={persona.name}
                  className="flex items-center gap-3 rounded-2xl border bg-background p-3"
                >
                  <Avatar className="size-12">
                    <AvatarImage src={persona.image} alt={persona.name} />
                    <AvatarFallback>{persona.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{persona.name}</div>
                    <div className="truncate text-sm text-muted-foreground">
                      {persona.tagline}
                    </div>
                  </div>
                  <Badge variant="outline">Example</Badge>
                </div>
              ))}
            </div>

            <div className="rounded-3xl border bg-muted/40 p-3">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-background">
                <Image
                  src="/window.svg"
                  alt=""
                  fill
                  className="p-16 opacity-10 dark:invert"
                  priority
                />
                <div className="absolute inset-0 grid content-end gap-2 p-4">
                  <div className="w-3/4 rounded-2xl bg-muted p-3 text-sm">
                    Explain this like you would in your videos.
                  </div>
                  <div className="ml-auto w-4/5 rounded-2xl bg-primary p-3 text-sm text-primary-foreground">
                    Sure. First let&apos;s simplify the problem, then we&apos;ll
                    build it step by step.
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
