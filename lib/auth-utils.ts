import { auth } from "@/lib/auth";

export async function getAuthSession(request: Request) {
  return auth.api.getSession({
    headers: request.headers,
  });
}

export async function requireUser(request: Request) {
  const session = await getAuthSession(request);

  if (!session?.user) {
    return null;
  }

  return session.user;
}
