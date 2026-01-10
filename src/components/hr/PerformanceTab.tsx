import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  Plus,
  Award,
  Edit,
  X,
  Star,
  TrendingUp,
  Target,
  FileText,
  CheckCircle,
  Clock,
  User,
} from "lucide-react";
import { Dialog } from "@headlessui/react";
import { Link } from "@tanstack/react-router";

const createReviewSchema = z.object({
  employeeId: z.number().min(1, "Please select an employee"),
  reviewPeriodStart: z.string().min(1, "Start date is required"),
  reviewPeriodEnd: z.string().min(1, "End date is required"),
  reviewDate: z.string().optional(),
  notes: z.string().optional(),
});

type CreateReviewForm = z.infer<typeof createReviewSchema>;

const updateReviewSchema = z.object({
  status: z.enum(["DRAFT", "PENDING_EMPLOYEE_ACKNOWLEDGMENT", "COMPLETED", "ARCHIVED"]).optional(),
  qualityOfWork: z.number().min(1).max(5).optional(),
  productivity: z.number().min(1).max(5).optional(),
  communication: z.number().min(1).max(5).optional(),
  teamwork: z.number().min(1).max(5).optional(),
  initiative: z.number().min(1).max(5).optional(),
  problemSolving: z.number().min(1).max(5).optional(),
  reliability: z.number().min(1).max(5).optional(),
  customerService: z.number().min(1).max(5).optional(),
  technicalSkills: z.number().min(1).max(5).optional(),
  leadership: z.number().min(1).max(5).optional(),
  keyAchievements: z.string().optional(),
  strengths: z.string().optional(),
  areasForImprovement: z.string().optional(),
  improvementActions: z.string().optional(),
  goalsForNextPeriod: z.string().optional(),
  trainingNeeds: z.string().optional(),
  careerDevelopment: z.string().optional(),
  reviewerComments: z.string().optional(),
  employeeComments: z.string().optional(),
  notes: z.string().optional(),
  markAsAcknowledged: z.boolean().optional(),
});

type UpdateReviewForm = z.infer<typeof updateReviewSchema>;

export function PerformanceTab() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingReview, setEditingReview] = useState<any>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const employeesQuery = useQuery(
    trpc.getEmployees.queryOptions({
      token: token!,
    })
  );

  const reviewsQuery = useQuery(
    trpc.getPerformanceReviews.queryOptions({
      token: token!,
      employeeId: selectedEmployee || undefined,
      status: statusFilter as any,
    })
  );

  const createForm = useForm<CreateReviewForm>({
    resolver: zodResolver(createReviewSchema),
  });

  const updateForm = useForm<UpdateReviewForm>({
    resolver: zodResolver(updateReviewSchema),
  });

  const createReviewMutation = useMutation(
    trpc.createPerformanceReview.mutationOptions({
      onSuccess: () => {
        toast.success("Performance review created successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getPerformanceReviews.queryKey() });
        setShowCreateForm(false);
        createForm.reset();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create performance review");
      },
    })
  );

  const updateReviewMutation = useMutation(
    trpc.updatePerformanceReview.mutationOptions({
      onSuccess: () => {
        toast.success("Performance review updated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getPerformanceReviews.queryKey() });
        setEditingReview(null);
        updateForm.reset();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update performance review");
      },
    })
  );

  const employees = employeesQuery.data || [];
  const reviews = reviewsQuery.data || [];

  const onCreateSubmit = (data: CreateReviewForm) => {
    createReviewMutation.mutate({
      token: token!,
      ...data,
    });
  };

  const onUpdateSubmit = (data: UpdateReviewForm) => {
    if (!editingReview) return;
    
    updateReviewMutation.mutate({
      token: token!,
      reviewId: editingReview.id,
      ...data,
    });
  };

  const handleEditClick = (review: any) => {
    setEditingReview(review);
    updateForm.reset({
      status: review.status,
      qualityOfWork: review.qualityOfWork || undefined,
      productivity: review.productivity || undefined,
      communication: review.communication || undefined,
      teamwork: review.teamwork || undefined,
      initiative: review.initiative || undefined,
      problemSolving: review.problemSolving || undefined,
      reliability: review.reliability || undefined,
      customerService: review.customerService || undefined,
      technicalSkills: review.technicalSkills || undefined,
      leadership: review.leadership || undefined,
      keyAchievements: review.keyAchievements || "",
      strengths: review.strengths || "",
      areasForImprovement: review.areasForImprovement || "",
      improvementActions: review.improvementActions || "",
      goalsForNextPeriod: review.goalsForNextPeriod || "",
      trainingNeeds: review.trainingNeeds || "",
      careerDevelopment: review.careerDevelopment || "",
      reviewerComments: review.reviewerComments || "",
      employeeComments: review.employeeComments || "",
      notes: review.notes || "",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-800";
      case "PENDING_EMPLOYEE_ACKNOWLEDGMENT":
        return "bg-yellow-100 text-yellow-800";
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "ARCHIVED":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "Draft";
      case "PENDING_EMPLOYEE_ACKNOWLEDGMENT":
        return "Pending Acknowledgment";
      case "COMPLETED":
        return "Completed";
      case "ARCHIVED":
        return "Archived";
      default:
        return status;
    }
  };

  const statusStats = [
    { status: "DRAFT", count: reviews.filter(r => r.status === "DRAFT").length, color: "bg-gray-100 text-gray-800" },
    { status: "PENDING_EMPLOYEE_ACKNOWLEDGMENT", count: reviews.filter(r => r.status === "PENDING_EMPLOYEE_ACKNOWLEDGMENT").length, color: "bg-yellow-100 text-yellow-800" },
    { status: "COMPLETED", count: reviews.filter(r => r.status === "COMPLETED").length, color: "bg-green-100 text-green-800" },
    { status: "ARCHIVED", count: reviews.filter(r => r.status === "ARCHIVED").length, color: "bg-blue-100 text-blue-800" },
  ];

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <select
            value={selectedEmployee || ""}
            onChange={(e) => setSelectedEmployee(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Employees</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName} ({emp.role})
              </option>
            ))}
          </select>

          <div className="flex items-center space-x-2">
            {statusStats.map((stat) => (
              <button
                key={stat.status}
                onClick={() => setStatusFilter(statusFilter === stat.status ? null : stat.status)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === stat.status
                    ? "ring-2 ring-purple-600 " + stat.color
                    : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {getStatusLabel(stat.status)} ({stat.count})
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Review
        </button>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <Link
                    to="/admin/hr/employees/$employeeId"
                    params={{ employeeId: review.employee.id.toString() }}
                    className="text-lg font-semibold text-gray-900 hover:text-purple-600 transition-colors"
                  >
                    {review.employee.firstName} {review.employee.lastName}
                  </Link>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(review.status)}`}>
                    {getStatusLabel(review.status)}
                  </span>
                  {review.overallRating && (
                    <div className="flex items-center text-yellow-500">
                      <Star className="h-4 w-4 fill-current mr-1" />
                      <span className="text-sm font-semibold text-gray-900">{review.overallRating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span className="flex items-center">
                    <User className="h-4 w-4 mr-1" />
                    Reviewed by {review.reviewer.firstName} {review.reviewer.lastName}
                  </span>
                  <span className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {new Date(review.reviewPeriodStart).toLocaleDateString()} - {new Date(review.reviewPeriodEnd).toLocaleDateString()}
                  </span>
                  {review.employeeAcknowledgedAt && (
                    <span className="flex items-center text-green-600">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Acknowledged
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleEditClick(review)}
                className="ml-4 p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              >
                <Edit className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Summary */}
            {(review.keyAchievements || review.strengths || review.areasForImprovement) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                {review.keyAchievements && (
                  <div>
                    <div className="flex items-center text-gray-700 font-medium mb-1">
                      <Award className="h-4 w-4 mr-1" />
                      Key Achievements
                    </div>
                    <p className="text-gray-600 line-clamp-2">{review.keyAchievements}</p>
                  </div>
                )}
                {review.strengths && (
                  <div>
                    <div className="flex items-center text-gray-700 font-medium mb-1">
                      <TrendingUp className="h-4 w-4 mr-1" />
                      Strengths
                    </div>
                    <p className="text-gray-600 line-clamp-2">{review.strengths}</p>
                  </div>
                )}
                {review.areasForImprovement && (
                  <div>
                    <div className="flex items-center text-gray-700 font-medium mb-1">
                      <Target className="h-4 w-4 mr-1" />
                      Areas for Improvement
                    </div>
                    <p className="text-gray-600 line-clamp-2">{review.areasForImprovement}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {reviews.length === 0 && (
          <div className="p-12 text-center bg-white rounded-xl border border-gray-200">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">No performance reviews found</p>
          </div>
        )}
      </div>

      {/* Create Review Modal */}
      <Dialog
        open={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-xl shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Create Performance Review
              </Dialog.Title>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee *
                </label>
                <select
                  {...createForm.register("employeeId", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select an employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} - {emp.role}
                    </option>
                  ))}
                </select>
                {createForm.formState.errors.employeeId && (
                  <p className="mt-1 text-sm text-red-600">{createForm.formState.errors.employeeId.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Review Period Start *
                  </label>
                  <input
                    type="date"
                    {...createForm.register("reviewPeriodStart")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {createForm.formState.errors.reviewPeriodStart && (
                    <p className="mt-1 text-sm text-red-600">{createForm.formState.errors.reviewPeriodStart.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Review Period End *
                  </label>
                  <input
                    type="date"
                    {...createForm.register("reviewPeriodEnd")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {createForm.formState.errors.reviewPeriodEnd && (
                    <p className="mt-1 text-sm text-red-600">{createForm.formState.errors.reviewPeriodEnd.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Review Date (optional)
                </label>
                <input
                  type="date"
                  {...createForm.register("reviewDate")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  {...createForm.register("notes")}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createReviewMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {createReviewMutation.isPending ? "Creating..." : "Create Review"}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Edit Review Modal */}
      <Dialog
        open={editingReview !== null}
        onClose={() => setEditingReview(null)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-4xl w-full bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Edit Performance Review
              </Dialog.Title>
              <button
                onClick={() => setEditingReview(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editingReview && (
              <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} className="flex flex-col flex-1 min-h-0">
                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                  {/* Employee Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-1">
                      {editingReview.employee.firstName} {editingReview.employee.lastName}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Review Period: {new Date(editingReview.reviewPeriodStart).toLocaleDateString()} - {new Date(editingReview.reviewPeriodEnd).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Review Status
                    </label>
                    <select
                      {...updateForm.register("status")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="PENDING_EMPLOYEE_ACKNOWLEDGMENT">Pending Employee Acknowledgment</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </div>

                  {/* Performance Ratings */}
                  <div>
                    <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                      <Star className="h-5 w-5 mr-2 text-yellow-500" />
                      Performance Ratings (1-5 scale)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { name: "qualityOfWork", label: "Quality of Work" },
                        { name: "productivity", label: "Productivity" },
                        { name: "communication", label: "Communication" },
                        { name: "teamwork", label: "Teamwork" },
                        { name: "initiative", label: "Initiative" },
                        { name: "problemSolving", label: "Problem Solving" },
                        { name: "reliability", label: "Reliability" },
                        { name: "customerService", label: "Customer Service" },
                        { name: "technicalSkills", label: "Technical Skills" },
                        { name: "leadership", label: "Leadership" },
                      ].map((field) => (
                        <div key={field.name}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {field.label}
                          </label>
                          <select
                            {...updateForm.register(field.name as any, { valueAsNumber: true })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">Not rated</option>
                            <option value="1">1 - Needs Improvement</option>
                            <option value="2">2 - Below Expectations</option>
                            <option value="3">3 - Meets Expectations</option>
                            <option value="4">4 - Exceeds Expectations</option>
                            <option value="5">5 - Outstanding</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Achievements and Strengths */}
                  <div>
                    <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                      <Award className="h-5 w-5 mr-2 text-green-500" />
                      Achievements & Strengths
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Key Achievements
                        </label>
                        <textarea
                          {...updateForm.register("keyAchievements")}
                          rows={3}
                          placeholder="List major accomplishments during the review period..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Strengths
                        </label>
                        <textarea
                          {...updateForm.register("strengths")}
                          rows={3}
                          placeholder="Describe the employee's key strengths..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Areas for Improvement */}
                  <div>
                    <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                      <Target className="h-5 w-5 mr-2 text-blue-500" />
                      Development Areas
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Areas for Improvement
                        </label>
                        <textarea
                          {...updateForm.register("areasForImprovement")}
                          rows={3}
                          placeholder="Identify specific areas needing development..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Improvement Actions
                        </label>
                        <textarea
                          {...updateForm.register("improvementActions")}
                          rows={3}
                          placeholder="Outline concrete actions for improvement..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Goals and Development */}
                  <div>
                    <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                      <TrendingUp className="h-5 w-5 mr-2 text-purple-500" />
                      Goals & Development
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Goals for Next Period
                        </label>
                        <textarea
                          {...updateForm.register("goalsForNextPeriod")}
                          rows={3}
                          placeholder="Set goals for the next review period..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Training Needs
                        </label>
                        <textarea
                          {...updateForm.register("trainingNeeds")}
                          rows={2}
                          placeholder="Identify training or development needs..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Career Development
                        </label>
                        <textarea
                          {...updateForm.register("careerDevelopment")}
                          rows={2}
                          placeholder="Discuss career development plans..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Feedback */}
                  <div>
                    <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                      <FileText className="h-5 w-5 mr-2 text-indigo-500" />
                      Feedback
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Reviewer Comments
                        </label>
                        <textarea
                          {...updateForm.register("reviewerComments")}
                          rows={4}
                          placeholder="Provide overall feedback and comments..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Employee Comments / Self-Assessment
                        </label>
                        <textarea
                          {...updateForm.register("employeeComments")}
                          rows={4}
                          placeholder="Employee's response or self-assessment..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Additional Notes
                    </label>
                    <textarea
                      {...updateForm.register("notes")}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {/* Acknowledgment */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      {...updateForm.register("markAsAcknowledged")}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-700">
                      Mark as acknowledged by employee
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingReview(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateReviewMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {updateReviewMutation.isPending ? "Saving..." : "Save Review"}
                  </button>
                </div>
              </form>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
