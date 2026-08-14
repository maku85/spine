import { AuthBrandingPanel } from "@/components/auth-branding-panel";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="grid min-h-svh md:grid-cols-2 bg-background">
      <AuthBrandingPanel />
      <div className="flex items-center justify-center p-6 sm:p-12">
        <LoginForm />
      </div>
    </div>
  );
}
