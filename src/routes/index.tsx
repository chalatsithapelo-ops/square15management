import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import toast from "react-hot-toast";
import { Lock, Mail } from "lucide-react";
import { useEffect } from "react";
import { getDefaultRoute } from "~/utils/roles";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginPage() {
  const navigate = useNavigate();
  const trpc = useTRPC();
  const { setAuth, user } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const loginMutation = useMutation(
    trpc.login.mutationOptions({
      onSuccess: (data) => {
        setAuth(data.token, data.user);
        toast.success(`Welcome back, ${data.user.firstName}!`);
        
        // Navigate to the route provided by the server (supports custom roles)
        void navigate({ to: data.defaultRoute });
      },
      onError: (error) => {
        toast.error(error.message || "Login failed. Please try again.");
      },
      retry: (failureCount, error) => {
        // If it's a startup/service unavailable error (503), retry up to 5 times
        if (error instanceof Error && error.message.includes("Service temporarily unavailable")) {
          return failureCount < 5;
        }
        // For other errors (like authentication errors), don't retry
        return false;
      },
      retryDelay: (attemptIndex) => {
        // Exponential backoff: 2s, 4s, 8s, 16s, 32s
        return Math.min(1000 * Math.pow(2, attemptIndex), 32000);
      },
    })
  );

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      // Use client-side fallback for already-logged-in users
      const defaultRoute = getDefaultRoute(user.role);
      void navigate({ to: defaultRoute });
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex">
      {/* Left side - Login Form */}
      <div className="flex-1 flex items-start justify-center px-4 sm:px-6 lg:px-8 py-6 bg-white">
        <div className="max-w-md w-full space-y-4">
          <div>
            <div className="flex justify-center">
              <div className="bg-gradient-to-br from-brand-primary-600 to-brand-primary-800 p-3 rounded-2xl shadow-lg">
                <div className="bg-white rounded-full p-2 shadow-inner">
                  <img 
                    src="/square15-logo-design.png" 
                    alt="Square 15 Facility Solutions" 
                    className="h-16 w-16 object-contain"
                  />
                </div>
              </div>
            </div>
            <h2 className="mt-3 text-center text-3xl font-extrabold text-gray-900">
              Square 15 Management System
            </h2>
            <p className="mt-1 text-center text-sm text-gray-600">
              Sign in to your account to continue
            </p>
          </div>

          <form className="mt-4 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    {...register("email")}
                    className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary-500 focus:border-transparent transition duration-150 ease-in-out sm:text-sm"
                    placeholder="you@example.com"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    {...register("password")}
                    className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary-500 focus:border-transparent transition duration-150 ease-in-out sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loginMutation.isPending}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-brand-primary-600 to-brand-accent-600 hover:from-brand-primary-700 hover:to-brand-accent-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
              >
                {loginMutation.isPending ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {loginMutation.failureCount > 0 ? `Retrying (${loginMutation.failureCount + 1}/5)...` : "Signing in..."}
                  </span>
                ) : (
                  "Sign in"
                )}
              </button>
            </div>

            <div className="text-center text-sm text-gray-600">
              <span>New here?</span>{" "}
              <Link
                to="/register"
                className="font-medium text-brand-primary-700 hover:underline"
              >
                Create an account
              </Link>
            </div>

            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Demo Credentials</span>
                </div>
              </div>

              <div className="mt-2 space-y-1 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">
                <p className="font-semibold text-gray-700 mb-1">Test Accounts:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  <p><span className="font-medium">Junior Admin:</span> junior@propmanagement.com (junior123)</p>
                  <p><span className="font-medium">Senior Admin:</span> admin@propmanagement.com (admin123)</p>
                  <p><span className="font-medium">Property Manager:</span> pm@propmanagement.com (pm123)</p>
                  <p><span className="font-medium">Contractor:</span> contractor@propmanagement.com (contractor123)</p>
                  <p><span className="font-medium">Artisan:</span> artisan@propmanagement.com (artisan123)</p>
                  <p><span className="font-medium">Tenant:</span> customer@example.com (customer123)</p>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Right side - Hero Image */}
      <div className="hidden lg:block relative flex-1">
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1973&q=80"
          alt="Modern property"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-primary-900/90 via-brand-primary-900/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-12 text-white">
          <h1 className="text-4xl font-bold mb-4">
            Manage Your Properties and Property Services with Ease
          </h1>
          <p className="text-xl text-brand-primary-100 max-w-lg">
            Streamline operations, track projects, manage teams, and grow your property services business all in one place.
          </p>
        </div>
      </div>
    </div>
  );
}
