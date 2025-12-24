import { RegisterForm } from "@/components/auth/register-form";

export const metadata = {
  title: "Create Account | Xfer",
  description: "Create your Xfer account",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Xfer</h1>
          <p className="text-muted-foreground mt-2">
            Create your account
          </p>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
}
