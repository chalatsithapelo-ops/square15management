import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  ClipboardList,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  Pause,
  Eye,
  Send,
  Camera,
  MessageSquare,
  FileText,
  X,
  Building2,
  Calendar,
  Users,
  Filter,
  Search,
  Plus,
  Loader2,
  RefreshCw,
  BarChart3,
  Wrench,
  Shield,
  Sparkles,
  Leaf,
  Paintbrush,
  Tag,
  UserPlus,
} from "lucide-react";
import { useState, useMemo } from "react";
import { NotificationDropdown } from "~/components/NotificationDropdown";
import { TaskManagement } from "~/components/property-manager/TaskManagement";
import toast from "react-hot-toast";

export const Route = createFileRoute("/property-manager/dashboard/tasks")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;
    const { user } = useAuthStore.getState();
    if (!user || user.role !== "PROPERTY_MANAGER") {
      throw redirect({
        to: "/",
        search: { redirect: location.href },
      });
    }
  },
  component: TaskManagementPage,
});

function TaskManagementPage() {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-blue-50/30">
      {/* Header */}
      <header className="bg-gradient-to-r from-teal-600 via-teal-500 to-cyan-500 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/property-manager/dashboard"
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Task Management</h1>
                  <p className="text-teal-100 text-sm">Manage and track all staff tasks</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <NotificationDropdown />
              <Link
                to="/property-manager/dashboard"
                className="hidden sm:flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm"
              >
                <Building2 className="h-4 w-4" />
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TaskManagement />
      </main>
    </div>
  );
}
