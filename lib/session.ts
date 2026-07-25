import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function getCurrentSession() {
  if (!process.env.DATABASE_URL) return null;

  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireCurrentSession(nextPath = "/meshy") {
  const session = await getCurrentSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return session;
}
