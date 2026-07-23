import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getCurrentSession } from "@/lib/session";

function safeNextPath(value: string | string[] | undefined) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/meshy";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  if (await getCurrentSession()) redirect(nextPath);

  return <AuthForm mode="login" nextPath={nextPath} />;
}
