import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Shown to an authenticated user who has no role assigned yet. Prevents the
 * old behaviour where a role-less user silently passed every RoleGuard.
 */
const AccessPending = () => {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-md text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Account pending access</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Your account doesn&apos;t have a role assigned yet, so there&apos;s nothing to show.
          If you just signed up, please confirm your email and wait a moment. Otherwise,
          ask an administrator to grant you access.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/" className="text-sm text-primary font-medium hover:underline">
            Back to home
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccessPending;
