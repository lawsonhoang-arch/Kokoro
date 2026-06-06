import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { login } from "@/lib/auth-actions";
import { AuthForm } from "../AuthForm";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/home");
  return <AuthForm mode="login" action={login} />;
}
