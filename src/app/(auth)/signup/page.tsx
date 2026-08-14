import { AuthBrandingPanel } from "@/components/auth-branding-panel";
import { SignupForm } from "@/components/signup-form";

export default function SignupPage() {
  return (
    <div className="grid min-h-svh md:grid-cols-2 bg-background">
      <AuthBrandingPanel />
      <div className="flex items-center justify-center p-6 sm:p-12">
        <SignupForm />
      </div>
    </div>
  );
}
