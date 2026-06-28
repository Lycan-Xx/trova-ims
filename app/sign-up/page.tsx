import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";

export default async function SignUpPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) redirect("/dashboard");

  return (
    <AuthLayout
      title="Create Your Workspace"
      description="Start managing inventory with a secure platform built for modern businesses and growing teams."
    >
      <AuthForm mode="sign-up" />
    </AuthLayout>
  );
}