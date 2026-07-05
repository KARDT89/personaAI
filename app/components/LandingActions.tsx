"use client";

import Link from "next/link";
import { ArrowRightIcon, GitBranchIcon, LogOutIcon, UserRoundIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const GITHUB_URL = "https://github.com/KARDT89/personaAI";

export function LandingHeaderActions() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="hidden h-8 w-20 rounded-2xl sm:block" />
        <Skeleton className="h-8 w-24 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={GITHUB_URL}
        target="_blank"
        rel="noreferrer"
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "hidden sm:inline-flex")}
        aria-label="Open Mindprint on GitHub"
      >
        <GitBranchIcon />
      </Link>
      {session?.user ? (
        <>
          <Link
            href="/app"
            className={cn(buttonVariants({ variant: "outline" }), "hidden sm:inline-flex")}
          >
            <UserRoundIcon />
            Dashboard
          </Link>
          <Link href="/app" className={buttonVariants()}>
            Continue
            <ArrowRightIcon />
          </Link>
        </>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

export function LandingHeroActions() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-11 w-44 rounded-2xl" />
        <Skeleton className="h-11 w-36 rounded-2xl" />
      </div>
    );
  }

  if (session?.user) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
      <Link href="/app" className={cn(buttonVariants({ size: "lg" }), "h-11")}>
        Open app
        <ArrowRightIcon />
      </Link>
      <Link
        href="/app"
        className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}
      >
        Build study library
        </Link>
        <button
          type="button"
          className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-11")}
          onClick={() => {
            void authClient.signOut({
              fetchOptions: {
                onSuccess: () => {
                  window.location.reload();
                },
              },
            });
          }}
        >
          <LogOutIcon />
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link href="/app" className={cn(buttonVariants({ size: "lg" }), "h-11")}>
        Open app
        <ArrowRightIcon />
      </Link>
      <Link
        href="/app"
        className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")}
      >
        Create persona
      </Link>
      <Link
        href={GITHUB_URL}
        target="_blank"
        rel="noreferrer"
        className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-11")}
      >
        <GitBranchIcon />
        GitHub
      </Link>
    </div>
  );
}
