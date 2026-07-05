"use client";

import { FormEvent, useEffect, useState } from "react";
import { GitBranchIcon, LogInIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";

type AuthGateProps = {
  children: React.ReactNode;
};

type AppConfigResponse = {
  auth?: {
    githubEnabled?: boolean;
  };
};

export function AuthGate({ children }: AuthGateProps) {
  const { data: session, isPending, refetch } = authClient.useSession();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [githubEnabled, setGithubEnabled] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch("/api/app-config");
        const data = (await response.json()) as AppConfigResponse;

        setGithubEnabled(Boolean(data.auth?.githubEnabled));
      } catch {
        setGithubEnabled(false);
      }
    }

    void loadConfig();
  }, []);

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (session?.user) {
    return children;
  }

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result =
        mode === "sign-up"
          ? await authClient.signUp.email({
              name,
              email,
              password,
              callbackURL: "/app",
            })
          : await authClient.signIn.email({
              email,
              password,
              callbackURL: "/app",
            });

      const authError = getAuthResponseError(result);

      if (authError) {
        throw new Error(authError);
      }

      await refetch();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGithubSignIn() {
    setError(null);
    await authClient.signIn.social({
      provider: "github",
      callbackURL: "/app",
    });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>PersonaAI</CardTitle>
          <CardDescription>
            Sign in to keep chats and custom personas separate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={mode}
            onValueChange={(value) => {
              if (value === "sign-in" || value === "sign-up") {
                setMode(value);
                setError(null);
              }
            }}
          >
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="sign-in" className="flex-1">
                Sign in
              </TabsTrigger>
              <TabsTrigger value="sign-up" className="flex-1">
                Sign up
              </TabsTrigger>
            </TabsList>

            <TabsContent value={mode}>
              <form onSubmit={handleEmailAuth} className="space-y-3">
                {mode === "sign-up" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                    />
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                {error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : null}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  <LogInIcon />
                  {mode === "sign-up" ? "Create account" : "Sign in"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {githubEnabled ? (
            <>
              <div className="my-4 h-px bg-border" />

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void handleGithubSignIn()}
              >
                <GitBranchIcon />
                Continue with GitHub
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Authentication failed.";
}

function getAuthResponseError(result: unknown) {
  if (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof result.error === "object" &&
    result.error !== null &&
    "message" in result.error &&
    typeof result.error.message === "string"
  ) {
    return result.error.message;
  }

  return null;
}
