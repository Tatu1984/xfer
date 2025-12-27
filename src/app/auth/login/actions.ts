"use server";

import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

export async function login(email: string, password: string): Promise<{ error?: string }> {
  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    // Success - redirect will happen client-side
    return {};
  } catch (error: unknown) {
    // Check if it's a redirect (which is expected on success in some cases)
    if (isRedirectError(error)) {
      throw error;
    }

    // Any other error means login failed
    return { error: "Invalid email or password" };
  }
}

export async function loginAndRedirect(email: string, password: string) {
  const result = await login(email, password);
  if (!result.error) {
    redirect("/");
  }
  return result;
}
