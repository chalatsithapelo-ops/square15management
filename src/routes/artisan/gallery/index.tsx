import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import toast from "react-hot-toast";
import { useEffect, useMemo } from "react";
import { Briefcase, Loader2, Images, ArrowLeft, Camera } from "lucide-react";
import { JobProgressGallery } from "~/components/artisan/JobProgressGallery";

export const Route = createFileRoute("/artisan/gallery/")({
  component: ArtisanGallery,
});

function ArtisanGallery() {
  const { user, token } = useAuthStore();
  const trpc = useTRPC();
  const navigate = useNavigate();

  // Fetch all orders for the artisan
  const ordersQuery = useQuery(
    trpc.getOrders.queryOptions({
      token: token!,
    }, {
      refetchInterval: 30000, // Poll every 30 seconds
      refetchOnWindowFocus: true,
    })
  );

  // Redirect non-artisan users to their appropriate dashboard
  useEffect(() => {
    if (user && user.role !== "ARTISAN") {
      toast.error("Access denied. Only artisans can access this page.");
      
      if (user.role === "JUNIOR_ADMIN" || user.role === "SENIOR_ADMIN") {
        void navigate({ to: "/admin/dashboard" });
      } else if (user.role === "CUSTOMER") {
        void navigate({ to: "/customer/dashboard" });
      } else {
        void navigate({ to: "/" });
      }
    }
  }, [user, navigate]);

  // Show loading state while checking authentication
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 text-blue-600 mb-4 animate-spin" />
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show loading state while redirecting non-artisan users
  if (user.role !== "ARTISAN") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 text-blue-600 mb-4 animate-spin" />
          <p className="text-sm text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  const orders = ordersQuery.data || [];
  
  // Filter orders that have at least one picture (before or after)
  const ordersWithPictures = useMemo(() => 
    orders.filter((order) => 
      (order.beforePictures && order.beforePictures.length > 0) || 
      (order.afterPictures && order.afterPictures.length > 0)
    ),
    [orders]
  );

  const totalPictures = useMemo(() => 
    ordersWithPictures.reduce((sum, order) => 
      sum + (order.beforePictures?.length || 0) + (order.afterPictures?.length || 0), 
      0
    ),
    [ordersWithPictures]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link
                to="/artisan/dashboard"
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="bg-gradient-to-br from-purple-600 to-purple-700 p-2 rounded-xl shadow-md">
                <Images className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Work Gallery</h1>
                <p className="text-sm text-gray-600">Your portfolio of completed work</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/"
                onClick={() => useAuthStore.getState().clearAuth()}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Logout
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
          <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-200">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-purple-100 rounded-xl p-3">
                  <Briefcase className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Jobs with Pictures
                    </dt>
                    <dd className="text-2xl font-bold text-gray-900">
                      {ordersWithPictures.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-200">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-100 rounded-xl p-3">
                  <Camera className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Pictures
                    </dt>
                    <dd className="text-2xl font-bold text-gray-900">
                      {totalPictures}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-200">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-green-100 rounded-xl p-3">
                  <Images className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Average per Job
                    </dt>
                    <dd className="text-2xl font-bold text-gray-900">
                      {ordersWithPictures.length > 0 
                        ? Math.round(totalPictures / ordersWithPictures.length)
                        : 0
                      }
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {ordersQuery.isLoading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Loader2 className="mx-auto h-12 w-12 text-gray-400 mb-4 animate-spin" />
            <p className="text-sm text-gray-600">Loading your work gallery...</p>
          </div>
        )}

        {/* Error State */}
        {ordersQuery.isError && (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-12 text-center">
            <div className="text-red-600 mb-4">
              <Images className="mx-auto h-12 w-12" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load gallery</h3>
            <p className="text-sm text-gray-600">Please try refreshing the page</p>
          </div>
        )}

        {/* Gallery Content */}
        {!ordersQuery.isLoading && !ordersQuery.isError && (
          <>
            {ordersWithPictures.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <Images className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No pictures yet</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Your work pictures will appear here as you complete jobs
                </p>
                <Link
                  to="/artisan/dashboard"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  <Briefcase className="h-5 w-5 mr-2" />
                  Go to Dashboard
                </Link>
              </div>
            ) : (
              <JobProgressGallery orders={ordersWithPictures} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
