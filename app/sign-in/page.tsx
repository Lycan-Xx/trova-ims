import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";

export default async function SignInPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) redirect("/dashboard");

  return (
    <AuthLayout
      title="Welcome Back"
      description="Securely manage inventory, monitor stock levels, and collaborate with your team from anywhere."
    >
      <AuthForm mode="sign-in" />
    </AuthLayout>
  );
}