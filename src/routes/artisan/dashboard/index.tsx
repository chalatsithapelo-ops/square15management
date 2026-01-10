import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import toast from "react-hot-toast";
import { useState, useEffect, useMemo } from "react";
import {
  Briefcase,
  Clock,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  PlayCircle,
  StopCircle,
  MessageSquare,
  X,
  Upload,
  FileCheck,
  Loader2,
  Download,
  TrendingUp,
  FileText,
  Star,
  Pause,
  Play,
  FolderKanban,
  Target,
  Images,
  Trash2,
  Wrench,
} from "lucide-react";
import { PhotoUpload } from "~/components/PhotoUpload";
import { FileAttachment } from "~/components/FileAttachment";
import { ExpenseSlipUpload, ExpenseSlip } from "~/components/ExpenseSlipUpload";
import { EarningsSummaryCards } from "~/components/artisan/EarningsSummaryCards";
import { EarningsHistoryTable } from "~/components/artisan/EarningsHistoryTable";
import { PendingPaymentsSection } from "~/components/artisan/PendingPaymentsSection";
import { PerformanceMetricsSection } from "~/components/artisan/PerformanceMetricsSection";
import { ReviewsSection } from "~/components/artisan/ReviewsSection";
import { Tab } from "@headlessui/react";
import { SupportChatWidget } from "~/components/SupportChatWidget";
import { SignatureCapture } from "~/components/SignatureCapture";
import { MetricCard } from "~/components/MetricCard";
import { NotificationDropdown } from "~/components/NotificationDropdown";
import ItemizedExpenseTracker from "~/components/projects/ItemizedExpenseTracker";

export const Route = createFileRoute("/artisan/dashboard/")({
  beforeLoad: ({ location }) => {
    const { user } = useAuthStore.getState();
    if (!user || user.role !== "ARTISAN") {
      throw redirect({
        to: "/",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: ArtisanDashboard,
});

const orderStatuses = [
  { value: "ASSIGNED", label: "Assigned", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-blue-100 text-blue-800", icon: PlayCircle },
  { value: "COMPLETED", label: "Completed", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
];

function ArtisanDashboard() {
  const { user, token, clearAuth } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(0);
  const [startJobOrderId, setStartJobOrderId] = useState<number | null>(null);
  const [completeJobOrderId, setCompleteJobOrderId] = useState<number | null>(null);
  const [beforePictures, setBeforePictures] = useState<string[]>([]);
  const [afterPictures, setAfterPictures] = useState<string[]>([]);
  const [signedJobCardUrl, setSignedJobCardUrl] = useState<string | null>(null);
  const [clientRepName, setClientRepName] = useState<string>("");
  const [clientRepSignDate, setClientRepSignDate] = useState<string>("");
  const [materialCost, setMaterialCost] = useState<string>("");
  const [expenseSlips, setExpenseSlips] = useState<ExpenseSlip[]>([]);

  // Payment request state
  const [paymentType, setPaymentType] = useState<"hourly" | "daily">("hourly");
  const [hoursWorked, setHoursWorked] = useState<string>("");
  const [daysWorked, setDaysWorked] = useState<string>("");
  const [hourlyRateInput, setHourlyRateInput] = useState<string>("");
  const [dailyRateInput, setDailyRateInput] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");

  // Quotation workflow state
  const [startQuotationId, setStartQuotationId] = useState<number | null>(null);
  const [completeQuotationId, setCompleteQuotationId] = useState<number | null>(null);
  const [quotationBeforePictures, setQuotationBeforePictures] = useState<string[]>([]);
  const [quotationMaterialCost, setQuotationMaterialCost] = useState<string>("");
  const [quotationExpenseSlips, setQuotationExpenseSlips] = useState<ExpenseSlip[]>([]);
  const [quotationLineItems, setQuotationLineItems] = useState<Array<{
    description: string;
    category: string;
    quantity: string;
    notes: string;
  }>>([{ description: "", category: "Material", quantity: "", notes: "" }]);
  const [numPeopleNeeded, setNumPeopleNeeded] = useState<string>("1");
  const [estimatedDuration, setEstimatedDuration] = useState<string>("");
  const [durationUnit, setDurationUnit] = useState<"HOURLY" | "DAILY">("HOURLY");
  const [quotationRateAmount, setQuotationRateAmount] = useState<string>("");

  // Job notes state
  const [editingNotesOrderId, setEditingNotesOrderId] = useState<number | null>(null);
  const [notesInput, setNotesInput] = useState<string>("");

  // Review/Edit completed job state
  const [reviewJobOrderId, setReviewJobOrderId] = useState<number | null>(null);
  const [reviewAfterPictures, setReviewAfterPictures] = useState<string[]>([]);
  const [reviewSignedJobCardUrl, setReviewSignedJobCardUrl] = useState<string | null>(null);
  const [reviewClientRepName, setReviewClientRepName] = useState<string>("");
  const [reviewClientRepSignDate, setReviewClientRepSignDate] = useState<string>("");
  const [reviewMaterialCost, setReviewMaterialCost] = useState<string>("");
  const [reviewExpenseSlips, setReviewExpenseSlips] = useState<ExpenseSlip[]>([]);
  const [reviewPaymentRequestId, setReviewPaymentRequestId] = useState<number | null>(null);
  const [reviewPaymentType, setReviewPaymentType] = useState<"hourly" | "daily">("hourly");
  const [reviewHoursWorked, setReviewHoursWorked] = useState<string>("");
  const [reviewDaysWorked, setReviewDaysWorked] = useState<string>("");
  const [reviewHourlyRateInput, setReviewHourlyRateInput] = useState<string>("");
  const [reviewDailyRateInput, setReviewDailyRateInput] = useState<string>("");
  const [reviewPaymentNotes, setReviewPaymentNotes] = useState<string>("");

  // Milestone state
  const [startMilestoneId, setStartMilestoneId] = useState<number | null>(null);
  const [completeMilestoneId, setCompleteMilestoneId] = useState<number | null>(null);
  const [milestoneExpenseSlips, setMilestoneExpenseSlips] = useState<ExpenseSlip[]>([]);
  const [milestonePaymentType, setMilestonePaymentType] = useState<"hourly" | "daily">("hourly");
  const [milestoneHoursWorked, setMilestoneHoursWorked] = useState<string>("");
  const [milestoneDaysWorked, setMilestoneDaysWorked] = useState<string>("");
  const [milestoneHourlyRateInput, setMilestoneHourlyRateInput] = useState<string>("");
  const [milestoneDailyRateInput, setMilestoneDailyRateInput] = useState<string>("");
  const [milestonePaymentNotes, setMilestonePaymentNotes] = useState<string>("");

  // Milestone notes state
  const [editingMilestoneNotesId, setEditingMilestoneNotesId] = useState<number | null>(null);
  const [milestoneNotesInput, setMilestoneNotesInput] = useState<string>("");

  // Milestone progress update state
  const [updateProgressMilestoneId, setUpdateProgressMilestoneId] = useState<number | null>(null);
  const [progressPercentageInput, setProgressPercentageInput] = useState<string>("");
  const [progressWorkDone, setProgressWorkDone] = useState<string>("");
  const [progressChallenges, setProgressChallenges] = useState<string>("");
  const [progressSuccesses, setProgressSuccesses] = useState<string>("");
  const [progressImagesDone, setProgressImagesDone] = useState<string[]>([]);
  const [progressItemizedExpenses, setProgressItemizedExpenses] = useState<Array<{
    itemDescription: string;
    quotedAmount: number;
    actualSpent: number;
    supplierInvoiceUrl?: string;
    reasonForOverspend?: string;
  }>>([]);
  const [progressNextWeekPlan, setProgressNextWeekPlan] = useState<string>("");

  // Milestone supplier quotation state
  const [uploadQuotationMilestoneId, setUploadQuotationMilestoneId] = useState<number | null>(null);
  const [quotationFile, setQuotationFile] = useState<File | null>(null);
  const [quotationPreviewUrl, setQuotationPreviewUrl] = useState<string | null>(null);
  const [quotationSupplierName, setQuotationSupplierName] = useState<string>("");
  const [quotationAmount, setQuotationAmount] = useState<string>("");
  const [quotationDescription, setQuotationDescription] = useState<string>("");
  const [quotationCategory, setQuotationCategory] = useState<string>("MATERIALS");

  // Check if any modal is open to prevent auto-refresh during form filling
  const isAnyModalOpen = !!(
    startJobOrderId ||
    completeJobOrderId ||
    startQuotationId ||
    completeQuotationId ||
    completeMilestoneId ||
    updateProgressMilestoneId ||
    uploadQuotationMilestoneId
  );

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  // This ensures hooks are called in the same order on every render
  const currentUserQuery = useQuery(
    trpc.getCurrentUser.queryOptions({
      token: token!,
    }, {
      enabled: !!token,
      refetchInterval: isAnyModalOpen ? false : 60000, // Disable polling while modal is open
      refetchOnWindowFocus: !isAnyModalOpen, // Disable refetch on focus while modal is open
    })
  );

  const ordersQuery = useQuery(
    trpc.getOrders.queryOptions({
      token: token!,
    }, {
      enabled: !!token,
      refetchInterval: isAnyModalOpen ? false : 15000, // Disable polling while modal is open
      refetchOnWindowFocus: !isAnyModalOpen, // Disable refetch on focus while modal is open
    })
  );

  const conversationsQuery = useQuery(
    trpc.getConversations.queryOptions({
      token: token!,
    }, {
      enabled: !!token,
      refetchInterval: isAnyModalOpen ? false : 10000, // Disable polling while modal is open
      refetchOnWindowFocus: !isAnyModalOpen, // Disable refetch on focus while modal is open
    })
  );

  const paymentRequestsQuery = useQuery(
    trpc.getPaymentRequests.queryOptions({
      token: token!,
    }, {
      enabled: !!token,
      refetchInterval: isAnyModalOpen ? false : 30000, // Disable polling while modal is open
      refetchOnWindowFocus: !isAnyModalOpen, // Disable refetch on focus while modal is open
    })
  );

  const performanceMetricsQuery = useQuery(
    trpc.getArtisanPerformanceMetrics.queryOptions({
      token: token!,
    }, {
      enabled: !!token,
      refetchInterval: isAnyModalOpen ? false : 30000, // Disable polling while modal is open
      refetchOnWindowFocus: !isAnyModalOpen, // Disable refetch on focus while modal is open
    })
  );

  const quotationsQuery = useQuery(
    trpc.getQuotations.queryOptions({
      token: token!,
    }, {
      enabled: !!token,
      refetchInterval: isAnyModalOpen ? false : 30000, // Disable polling while modal is open
      refetchOnWindowFocus: !isAnyModalOpen, // Disable refetch on focus while modal is open
    })
  );

  const reviewsQuery = useQuery(
    trpc.getArtisanReviews.queryOptions({
      token: token!,
      artisanId: user?.id || 0,
    }, {
      enabled: !!token,
      refetchInterval: isAnyModalOpen ? false : 30000, // Disable polling while modal is open
      refetchOnWindowFocus: !isAnyModalOpen, // Disable refetch on focus while modal is open
    })
  );

  const milestonesQuery = useQuery(
    trpc.getMilestonesForArtisan.queryOptions({
      token: token!,
    }, {
      enabled: !!token,
      refetchInterval: isAnyModalOpen ? false : 30000, // Disable polling while modal is open
      refetchOnWindowFocus: !isAnyModalOpen, // Disable refetch on focus while modal is open
    })
  );

  const updateOrderStatusMutation = useMutation(
    trpc.updateOrderStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Job status updated!");
        queryClient.invalidateQueries({ queryKey: trpc.getOrders.queryKey() });
      },
      onError: (error) => {
        console.error("Update order status error:", error);
        // Make error toast persistent with longer duration
        toast.error(error.message || "Failed to update job status", {
          duration: 10000, // Show for 10 seconds
        });
      },
    })
  );

  const pauseJobMutation = useMutation(
    trpc.pauseJob.mutationOptions({
      onSuccess: () => {
        toast.success("Job paused successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getOrders.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to pause job");
      },
    })
  );

  const resumeJobMutation = useMutation(
    trpc.resumeJob.mutationOptions({
      onSuccess: () => {
        toast.success("Job resumed successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getOrders.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to resume job");
      },
    })
  );

  const updateQuotationStatusMutation = useMutation(
    trpc.updateQuotationStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Quotation status updated!");
        queryClient.invalidateQueries({ queryKey: trpc.getQuotations.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update quotation status");
      },
    })
  );

  const generateJobCardMutation = useMutation(
    trpc.generateJobCardPdf.mutationOptions({
      onError: (error) => {
        console.error("Generate job card error:", error);
        toast.error(error.message || "Failed to generate job card", {
          duration: 10000,
        });
      },
    })
  );

  const getPresignedUrlMutation = useMutation(
    trpc.getPresignedUploadUrl.mutationOptions()
  );

  const createPaymentRequestMutation = useMutation(
    trpc.createPaymentRequest.mutationOptions({
      onSuccess: () => {
        toast.success("Payment request submitted!");
        queryClient.invalidateQueries({ queryKey: trpc.getPaymentRequests.queryKey() });
      },
      onError: (error) => {
        console.error("Create payment request error:", error);
        toast.error(error.message || "Failed to create payment request", {
          duration: 10000,
        });
      },
    })
  );

  const updateOrderNotesMutation = useMutation(
    trpc.updateOrderNotes.mutationOptions({
      onSuccess: () => {
        toast.success("Notes updated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getOrders.queryKey() });
        setEditingNotesOrderId(null);
        setNotesInput("");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update notes");
      },
    })
  );

  const updateCompletedOrderMutation = useMutation(
    trpc.updateCompletedOrderDetails.mutationOptions({
      onSuccess: () => {
        toast.success("Job details updated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getOrders.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getPaymentRequests.queryKey() });
        setReviewJobOrderId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update job details");
      },
    })
  );

  const generateOrderPdfMutation = useMutation(
    trpc.generateOrderPdf.mutationOptions({
      onError: (error) => {
        toast.error(error.message || "Failed to generate order summary");
      },
    })
  );

  const updateMilestoneStatusMutation = useMutation(
    trpc.updateMilestoneStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Milestone status updated!");
        queryClient.invalidateQueries({ queryKey: trpc.getMilestonesForArtisan.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getArtisanPerformanceMetrics.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update milestone status");
      },
    })
  );

  const pauseMilestoneMutation = useMutation(
    trpc.pauseMilestone.mutationOptions({
      onSuccess: () => {
        toast.success("Milestone paused successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getMilestonesForArtisan.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to pause milestone");
      },
    })
  );

  const resumeMilestoneMutation = useMutation(
    trpc.resumeMilestone.mutationOptions({
      onSuccess: () => {
        toast.success("Milestone resumed successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getMilestonesForArtisan.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to resume milestone");
      },
    })
  );

  const createMilestonePaymentRequestMutation = useMutation(
    trpc.createMilestonePaymentRequest.mutationOptions({
      onSuccess: () => {
        toast.success("Payment request submitted!");
        queryClient.invalidateQueries({ queryKey: trpc.getPaymentRequests.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getArtisanPerformanceMetrics.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create payment request");
      },
    })
  );

  const updateMilestoneNotesMutation = useMutation(
    trpc.updateMilestoneStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Notes updated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getMilestonesForArtisan.queryKey() });
        setEditingMilestoneNotesId(null);
        setMilestoneNotesInput("");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update notes");
      },
    })
  );

  const updateMilestoneProgressMutation = useMutation(
    trpc.updateMilestoneStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Progress updated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getMilestonesForArtisan.queryKey() });
        setUpdateProgressMilestoneId(null);
        setProgressPercentageInput("");
        setProgressWorkDone("");
        setProgressChallenges("");
        setProgressSuccesses("");
        setProgressImagesDone([]);
        setProgressItemizedExpenses([]);
        setProgressNextWeekPlan("");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update progress");
      },
    })
  );

  const uploadMilestoneSupplierQuotationMutation = useMutation(
    trpc.uploadMilestoneSupplierQuotation.mutationOptions({
      onSuccess: () => {
        toast.success("Supplier quotation uploaded successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getMilestonesForArtisan.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to upload supplier quotation");
      },
    })
  );

  const deleteMilestoneSupplierQuotationMutation = useMutation(
    trpc.deleteMilestoneSupplierQuotation.mutationOptions({
      onSuccess: () => {
        toast.success("Supplier quotation deleted successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getMilestonesForArtisan.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete quotation");
      },
    })
  );

  const currentUser = currentUserQuery.data;
  const conversations = conversationsQuery.data || [];
  const unreadConversations = conversations.filter((c) => c.unreadCount > 0);
  const paymentRequests = paymentRequestsQuery.data || [];
  const performanceMetrics = performanceMetricsQuery.data;
  const reviewsData = reviewsQuery.data;

  // Role guard: ensure only Artisan can access this dashboard
  if (user && user.role !== "ARTISAN") {
    toast.error(`You are logged in as ${user.role}. Please log in as Artisan.`);
    clearAuth();
    navigate({ to: "/" });
    return null;
  }

  // Token validation check - must be after all hooks
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-teal-500 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Authentication required...</p>
          <button
            onClick={() => navigate({ to: "/" })}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  const orders = ordersQuery.data || [];
  
  const assignedOrders = useMemo(() => 
    orders.filter((o) => o.status === "ASSIGNED"),
    [orders]
  );
  
  const inProgressOrders = useMemo(() => 
    orders.filter((o) => o.status === "IN_PROGRESS"),
    [orders]
  );
  
  const completedOrders = useMemo(() => 
    orders.filter((o) => o.status === "COMPLETED"),
    [orders]
  );

  const quotations = quotationsQuery.data || [];
  
  const pendingReviewQuotations = useMemo(() => 
    quotations.filter((q) => q.status === "DRAFT" || q.status === "PENDING_ARTISAN_REVIEW"),
    [quotations]
  );
  
  const inProgressQuotations = useMemo(() => 
    quotations.filter((q) => q.status === "IN_PROGRESS"),
    [quotations]
  );
  
  const completedQuotations = useMemo(() => 
    quotations.filter((q) => q.status === "READY_FOR_REVIEW" || q.status === "APPROVED"),
    [quotations]
  );

  const milestones = milestonesQuery.data || [];
  
  const planningMilestones = useMemo(() => 
    milestones.filter((m) => m.status === "PLANNING"),
    [milestones]
  );
  
  const notStartedMilestones = useMemo(() => 
    milestones.filter((m) => m.status === "NOT_STARTED"),
    [milestones]
  );
  
  const inProgressMilestones = useMemo(() => 
    milestones.filter((m) => m.status === "IN_PROGRESS"),
    [milestones]
  );
  
  const onHoldMilestones = useMemo(() => 
    milestones.filter((m) => m.status === "ON_HOLD"),
    [milestones]
  );
  
  const completedMilestones = useMemo(() => 
    milestones.filter((m) => m.status === "COMPLETED"),
    [milestones]
  );

  const calculatePaymentAmount = () => {
    if (!currentUser) return 0;
    
    if (paymentType === "hourly") {
      const hours = parseFloat(hoursWorked) || 0;
      const rate = parseFloat(hourlyRateInput) || currentUser.hourlyRate || 0;
      return hours * rate;
    } else {
      const days = parseFloat(daysWorked) || 0;
      const rate = parseFloat(dailyRateInput) || currentUser.dailyRate || 0;
      return days * rate;
    }
  };

  const addQuotationLineItem = () => {
    setQuotationLineItems([...quotationLineItems, { description: "", category: "Material", quantity: "", notes: "" }]);
  };

  const removeQuotationLineItem = (index: number) => {
    if (quotationLineItems.length > 1) {
      setQuotationLineItems(quotationLineItems.filter((_, i) => i !== index));
    }
  };

  const updateQuotationLineItem = (index: number, field: string, value: string) => {
    const newItems = [...quotationLineItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setQuotationLineItems(newItems);
  };

  const calculateEstimatedLabourCost = () => {
    const people = parseFloat(numPeopleNeeded) || 0;
    const duration = parseFloat(estimatedDuration) || 0;
    const rate = parseFloat(quotationRateAmount) || 0;
    return people * duration * rate;
  };

  const calculateTotalMaterialCost = () => {
    return quotationExpenseSlips.reduce((sum, slip) => sum + (slip.amount || 0), 0);
  };

  const handleStartJob = (orderId: number) => {
    setStartJobOrderId(orderId);
    setBeforePictures([]);
  };

  const handleBeforePicturesUploaded = (urls: string[]) => {
    setBeforePictures(urls);
  };

  const handleConfirmStartJob = () => {
    console.log('=== START JOB DEBUG ===');
    console.log('beforePictures count:', beforePictures.length);
    console.log('token exists:', !!token);
    console.log('token value:', token);
    console.log('startJobOrderId:', startJobOrderId);
    
    if (beforePictures.length < 3) {
      toast.error("Please upload at least 3 before pictures");
      return;
    }

    if (!token) {
      toast.error("Authentication token missing. Please log in again.");
      navigate({ to: "/" });
      return;
    }

    // Find the order to check if it's a PM order
    const order = orders.find((o) => o.id === startJobOrderId);

    const mutationInput = {
      token,
      orderId: startJobOrderId!,
      isPMOrder: order?.isPMOrder || false,
      status: "IN_PROGRESS" as const,
      beforePictures: beforePictures,
    };
    
    console.log('mutation input:', mutationInput);
    
    updateOrderStatusMutation.mutate(mutationInput);

    setStartJobOrderId(null);
    setBeforePictures([]);
  };

  const handleCompleteJob = (orderId: number) => {
    setCompleteJobOrderId(orderId);
    setAfterPictures([]);
    setSignedJobCardUrl(null);
    setClientRepName("");
    setClientRepSignDate("");
    setMaterialCost("");
    setExpenseSlips([]);
    setPaymentType("hourly");
    setHoursWorked("");
    setDaysWorked("");
    setHourlyRateInput(currentUser?.hourlyRate?.toString() || "");
    setDailyRateInput(currentUser?.dailyRate?.toString() || "");
    setPaymentNotes("");
  };

  const handleAfterPicturesUploaded = (urls: string[]) => {
    setAfterPictures(urls);
  };

  const handleExpenseSlipsUploaded = (slips: ExpenseSlip[]) => {
    setExpenseSlips(slips);
  };

  const handleSignatureCaptured = (url: string) => {
    setSignedJobCardUrl(url);
  };

  const handleConfirmCompleteJob = async () => {
    if (afterPictures.length < 3) {
      toast.error("Please upload at least 3 after pictures");
      return;
    }

    if (!signedJobCardUrl) {
      toast.error("Please capture the customer's signature");
      return;
    }

    if (!clientRepName.trim()) {
      toast.error("Please enter the client representative's name");
      return;
    }

    if (!clientRepSignDate) {
      toast.error("Please select the date");
      return;
    }

    if (expenseSlips.length === 0) {
      toast.error("Please upload at least one expense slip");
      return;
    }

    // Validate payment request fields
    if (paymentType === "hourly" && (!hoursWorked || parseFloat(hoursWorked) <= 0)) {
      toast.error("Please enter hours worked for payment request");
      return;
    }

    if (paymentType === "daily" && (!daysWorked || parseFloat(daysWorked) <= 0)) {
      toast.error("Please enter days worked for payment request");
      return;
    }

    if (paymentType === "hourly" && (!hourlyRateInput || parseFloat(hourlyRateInput) <= 0)) {
      toast.error("Please enter your hourly rate for payment request");
      return;
    }

    if (paymentType === "daily" && (!dailyRateInput || parseFloat(dailyRateInput) <= 0)) {
      toast.error("Please enter your daily rate for payment request");
      return;
    }

    // Material cost calculation:
    // - If manual materialCost is provided, it takes precedence
    // - Otherwise, sum the amounts from expense slips
    // - Validate that we have valid amounts
    const calculatedMaterialCost = expenseSlips.reduce(
      (sum, slip) => sum + (slip.amount || 0),
      0
    );

    // Use manual material cost if provided, otherwise use calculated cost
    const finalMaterialCost = materialCost
      ? parseFloat(materialCost)
      : calculatedMaterialCost;

    if (finalMaterialCost <= 0) {
      toast.error("Material cost must be greater than 0. Please enter a manual material cost or ensure all expense slips have amounts specified.");
      return;
    }

    // Warn if some slips are missing amounts but we have a manual cost
    const slipsWithoutAmounts = expenseSlips.filter(slip => !slip.amount || slip.amount <= 0);
    if (slipsWithoutAmounts.length > 0 && materialCost && parseFloat(materialCost) > 0) {
      const proceed = window.confirm(
        `Warning: ${slipsWithoutAmounts.length} expense slip(s) do not have amounts specified. ` +
        `The manual material cost of R${parseFloat(materialCost).toFixed(2)} will be used. Continue?`
      );
      if (!proceed) {
        return;
      }
    }

    try {
      // Find the order to check if it's a PM order
      const order = orders.find((o) => o.id === completeJobOrderId);
      
      // First, complete the order
      await updateOrderStatusMutation.mutateAsync({
        token: token!,
        orderId: completeJobOrderId!,
        isPMOrder: order?.isPMOrder || false,
        status: "COMPLETED",
        afterPictures: afterPictures,
        signedJobCardUrl: signedJobCardUrl,
        clientRepName: clientRepName.trim(),
        clientRepSignDate: new Date(clientRepSignDate).toISOString(),
        expenseSlips: expenseSlips,
        materialCost: finalMaterialCost,
        hoursWorked: paymentType === "hourly" ? parseFloat(hoursWorked) : undefined,
        daysWorked: paymentType === "daily" ? parseFloat(daysWorked) : undefined,
        hourlyRate: paymentType === "hourly" ? parseFloat(hourlyRateInput) : undefined,
        dailyRate: paymentType === "daily" ? parseFloat(dailyRateInput) : undefined,
      });

      // Then, create the payment request
      await createPaymentRequestMutation.mutateAsync({
        token: token!,
        artisanId: currentUser!.id,
        orderIds: [completeJobOrderId!],
        hoursWorked: paymentType === "hourly" ? parseFloat(hoursWorked) : undefined,
        daysWorked: paymentType === "daily" ? parseFloat(daysWorked) : undefined,
        hourlyRate: paymentType === "hourly" ? parseFloat(hourlyRateInput) : undefined,
        dailyRate: paymentType === "daily" ? parseFloat(dailyRateInput) : undefined,
        calculatedAmount: calculatePaymentAmount(),
        notes: paymentNotes || undefined,
      });

      // Finally, generate and download the job card with all the data
      toast.loading("Generating job card...");
      const jobCardData = await generateJobCardMutation.mutateAsync({
        token: token!,
        orderId: completeJobOrderId!,
      });

      // Convert base64 to blob and download
      const byteCharacters = atob(jobCardData.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `job-card-${completeJobOrderId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success("Job completed and job card downloaded!");

      // Reset form
      setCompleteJobOrderId(null);
      setAfterPictures([]);
      setSignedJobCardUrl(null);
      setClientRepName("");
      setClientRepSignDate("");
      setMaterialCost("");
      setExpenseSlips([]);
      setPaymentType("hourly");
      setHoursWorked("");
      setDaysWorked("");
      setHourlyRateInput("");
      setDailyRateInput("");
      setPaymentNotes("");
    } catch (error) {
      // Error handling is done by the mutation's onError callbacks
      console.error("Error completing job:", error);
      toast.dismiss();
      toast.error(
        error instanceof Error ? error.message : "Failed to complete job. Please check the console for details.",
        { duration: 10000 }
      );
    }
  };

  const handleStartQuotation = (quotationId: number) => {
    setStartQuotationId(quotationId);
    setQuotationBeforePictures([]);
  };

  const handleQuotationBeforePicturesUploaded = (urls: string[]) => {
    setQuotationBeforePictures(urls);
  };

  const handleConfirmStartQuotation = () => {
    if (quotationBeforePictures.length < 3) {
      toast.error("Please upload at least 3 before pictures");
      return;
    }

    updateQuotationStatusMutation.mutate({
      token: token!,
      quotationId: startQuotationId!,
      status: "IN_PROGRESS",
      beforePictures: quotationBeforePictures,
    });

    setStartQuotationId(null);
    setQuotationBeforePictures([]);
  };

  const handleCompleteQuotation = (quotationId: number) => {
    setCompleteQuotationId(quotationId);
    const quotation: any = quotations.find((q: any) => q.id === quotationId);

    const existingSlips: ExpenseSlip[] = Array.isArray(quotation?.expenseSlips)
      ? quotation.expenseSlips.map((slip: any) => ({
          url: slip.url,
          category: slip.category,
          description: slip.description || undefined,
          amount: slip.amount || undefined,
        }))
      : [];

    const existingLineItems: Array<{ description: string; category: string; quantity: string; notes: string }> =
      Array.isArray(quotation?.quotationLineItems) && quotation.quotationLineItems.length > 0
        ? quotation.quotationLineItems.map((item: any) => ({
            description: item.description || "",
            category: item.category || "Material",
            quantity: item.quantity !== undefined && item.quantity !== null ? String(item.quantity) : "",
            notes: item.notes || "",
          }))
        : [{ description: "", category: "Material", quantity: "", notes: "" }];

    setQuotationMaterialCost("");
    setQuotationExpenseSlips(existingSlips);
    setQuotationLineItems(existingLineItems);
    setNumPeopleNeeded(quotation?.numPeopleNeeded ? String(quotation.numPeopleNeeded) : "1");
    setEstimatedDuration(quotation?.estimatedDuration ? String(quotation.estimatedDuration) : "");
    setDurationUnit(quotation?.durationUnit === "DAILY" ? "DAILY" : "HOURLY");
    setQuotationRateAmount(quotation?.labourRate ? String(quotation.labourRate) : "");
  };

  const handleQuotationExpenseSlipsUploaded = (slips: ExpenseSlip[]) => {
    setQuotationExpenseSlips(slips);
  };

  const handleConfirmCompleteQuotation = () => {
    if (quotationExpenseSlips.length === 0) {
      toast.error("Please upload at least one supplier quotation/expense slip");
      return;
    }

    if (!numPeopleNeeded || parseFloat(numPeopleNeeded) <= 0) {
      toast.error("Please specify the number of people needed");
      return;
    }

    if (!estimatedDuration || parseFloat(estimatedDuration) <= 0) {
      toast.error("Please specify the estimated work duration");
      return;
    }

    if (!quotationRateAmount || parseFloat(quotationRateAmount) <= 0) {
      toast.error("Please specify the rate amount");
      return;
    }

    // Validate that at least one line item has a description
    const hasValidLineItems = quotationLineItems.some(item => item.description.trim().length > 0);
    if (!hasValidLineItems) {
      toast.error("Please add at least one line item describing the scope of work");
      return;
    }

    // Calculate total material cost from expense slips
    const totalMaterialCost = calculateTotalMaterialCost();

    // Prepare line items (filter out empty ones)
    const validLineItems = quotationLineItems
      .filter(item => item.description.trim().length > 0)
      .map(item => ({
        description: item.description,
        category: item.category,
        quantity: item.quantity ? parseFloat(item.quantity) : undefined,
        notes: item.notes || undefined,
      }));

    updateQuotationStatusMutation.mutate({
      token: token!,
      quotationId: completeQuotationId!,
      status: "READY_FOR_REVIEW",
      expenseSlips: quotationExpenseSlips,
      materialCost: totalMaterialCost,
      numPeopleNeeded: parseFloat(numPeopleNeeded),
      estimatedDuration: parseFloat(estimatedDuration),
      durationUnit: durationUnit,
      labourRate: parseFloat(quotationRateAmount),
      quotationLineItems: validLineItems,
    });

    setCompleteQuotationId(null);
    setQuotationMaterialCost("");
    setQuotationExpenseSlips([]);
    setQuotationLineItems([{ description: "", category: "Material", quantity: "", notes: "" }]);
    setNumPeopleNeeded("1");
    setEstimatedDuration("");
    setDurationUnit("HOURLY");
    setQuotationRateAmount("");
  };

  const handlePauseJob = (orderId: number) => {
    if (window.confirm("Are you sure you want to pause this job? The timer will stop until you resume.")) {
      pauseJobMutation.mutate({
        token: token!,
        orderId,
      });
    }
  };

  const handleResumeJob = (orderId: number) => {
    resumeJobMutation.mutate({
      token: token!,
      orderId,
    });
  };

  const handleEditNotes = (orderId: number, currentNotes: string | null) => {
    setEditingNotesOrderId(orderId);
    setNotesInput(currentNotes || "");
  };

  const handleSaveNotes = () => {
    if (editingNotesOrderId === null) return;
    
    updateOrderNotesMutation.mutate({
      token: token!,
      orderId: editingNotesOrderId,
      notes: notesInput,
    });
  };

  const handleReviewJob = (order: any) => {
    setReviewJobOrderId(order.id);
    setReviewAfterPictures(order.afterPictures || []);
    setReviewSignedJobCardUrl(order.signedJobCardUrl || null);
    setReviewClientRepName(order.clientRepName || "");
    setReviewClientRepSignDate(
      order.clientRepSignDate 
        ? new Date(order.clientRepSignDate).toISOString().slice(0, 16)
        : ""
    );
    setReviewMaterialCost(order.materialCost?.toString() || "");
    
    // Load expense slips
    const slips: ExpenseSlip[] = (order.expenseSlips || []).map((slip: any) => ({
      url: slip.url,
      category: slip.category,
      description: slip.description || undefined,
      amount: slip.amount || undefined,
    }));
    setReviewExpenseSlips(slips);

    // Find associated payment request
    const paymentRequest = paymentRequests.find((pr) => 
      pr.orderIds.includes(order.id) && pr.artisanId === user?.id
    );

    if (paymentRequest) {
      setReviewPaymentRequestId(paymentRequest.id);
      
      if (paymentRequest.hoursWorked) {
        setReviewPaymentType("hourly");
        setReviewHoursWorked(paymentRequest.hoursWorked.toString());
        setReviewHourlyRateInput(paymentRequest.hourlyRate?.toString() || "");
      } else if (paymentRequest.daysWorked) {
        setReviewPaymentType("daily");
        setReviewDaysWorked(paymentRequest.daysWorked.toString());
        setReviewDailyRateInput(paymentRequest.dailyRate?.toString() || "");
      }
      
      setReviewPaymentNotes(paymentRequest.notes || "");
    } else {
      setReviewPaymentRequestId(null);
      setReviewPaymentType("hourly");
      setReviewHoursWorked("");
      setReviewDaysWorked("");
      setReviewHourlyRateInput(currentUser?.hourlyRate?.toString() || "");
      setReviewDailyRateInput(currentUser?.dailyRate?.toString() || "");
      setReviewPaymentNotes("");
    }
  };

  const handleReviewAfterPicturesUploaded = (urls: string[]) => {
    setReviewAfterPictures(urls);
  };

  const handleReviewExpenseSlipsUploaded = (slips: ExpenseSlip[]) => {
    setReviewExpenseSlips(slips);
  };

  const handleReviewSignatureCaptured = (url: string) => {
    setReviewSignedJobCardUrl(url);
  };

  const calculateReviewPaymentAmount = () => {
    if (!currentUser) return 0;
    
    if (reviewPaymentType === "hourly") {
      const hours = parseFloat(reviewHoursWorked) || 0;
      const rate = parseFloat(reviewHourlyRateInput) || currentUser.hourlyRate || 0;
      return hours * rate;
    } else {
      const days = parseFloat(reviewDaysWorked) || 0;
      const rate = parseFloat(reviewDailyRateInput) || currentUser.dailyRate || 0;
      return days * rate;
    }
  };

  const handleConfirmReviewJob = async () => {
    if (reviewAfterPictures.length < 3) {
      toast.error("Please upload at least 3 after pictures");
      return;
    }

    if (!reviewSignedJobCardUrl) {
      toast.error("Please capture the customer's signature");
      return;
    }

    if (!reviewClientRepName.trim()) {
      toast.error("Please enter the client representative's name");
      return;
    }

    if (!reviewClientRepSignDate) {
      toast.error("Please select the date");
      return;
    }

    if (reviewExpenseSlips.length === 0) {
      toast.error("Please upload at least one expense slip");
      return;
    }

    // Calculate material cost
    const calculatedMaterialCost = reviewExpenseSlips.reduce(
      (sum, slip) => sum + (slip.amount || 0),
      0
    );

    const finalMaterialCost = reviewMaterialCost
      ? parseFloat(reviewMaterialCost)
      : calculatedMaterialCost;

    if (finalMaterialCost <= 0) {
      toast.error("Please enter material cost or specify amounts in expense slips");
      return;
    }

    try {
      await updateCompletedOrderMutation.mutateAsync({
        token: token!,
        orderId: reviewJobOrderId!,
        afterPictures: reviewAfterPictures,
        signedJobCardUrl: reviewSignedJobCardUrl,
        clientRepName: reviewClientRepName.trim(),
        clientRepSignDate: new Date(reviewClientRepSignDate).toISOString(),
        expenseSlips: reviewExpenseSlips,
        materialCost: finalMaterialCost,
        paymentRequestId: reviewPaymentRequestId || undefined,
        hoursWorked: reviewPaymentType === "hourly" ? parseFloat(reviewHoursWorked) || undefined : undefined,
        daysWorked: reviewPaymentType === "daily" ? parseFloat(reviewDaysWorked) || undefined : undefined,
        hourlyRate: reviewPaymentType === "hourly" ? parseFloat(reviewHourlyRateInput) || undefined : undefined,
        dailyRate: reviewPaymentType === "daily" ? parseFloat(reviewDailyRateInput) || undefined : undefined,
        paymentNotes: reviewPaymentNotes || undefined,
      });

      // Reset form
      setReviewJobOrderId(null);
      setReviewAfterPictures([]);
      setReviewSignedJobCardUrl(null);
      setReviewClientRepName("");
      setReviewClientRepSignDate("");
      setReviewMaterialCost("");
      setReviewExpenseSlips([]);
      setReviewPaymentRequestId(null);
      setReviewPaymentType("hourly");
      setReviewHoursWorked("");
      setReviewDaysWorked("");
      setReviewHourlyRateInput("");
      setReviewDailyRateInput("");
      setReviewPaymentNotes("");
    } catch (error) {
      console.error("Error updating completed job:", error);
    }
  };

  const handleDownloadOrderSummary = async (orderId: number, orderNumber: string) => {
    try {
      toast.loading("Generating order summary...");
      
      // Find the order to check if it's a PM order
      const order = orders.find((o) => o.id === orderId);
      
      const pdfData = await generateOrderPdfMutation.mutateAsync({
        token: token!,
        orderId: orderId,
        isPMOrder: order?.isPMOrder || false,
      });

      // Convert base64 to blob and download
      const byteCharacters = atob(pdfData.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `order-summary-${orderNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success("Order summary downloaded!");
    } catch (error) {
      console.error("Error downloading order summary:", error);
      toast.dismiss();
      toast.error(
        error instanceof Error ? error.message : "Failed to download order summary",
        { duration: 10000 }
      );
    }
  };

  const handleStartMilestone = (milestoneId: number) => {
    setStartMilestoneId(milestoneId);
  };

  const handleConfirmStartMilestone = () => {
    if (!startMilestoneId) return;

    updateMilestoneStatusMutation.mutate({
      token: token!,
      milestoneId: startMilestoneId,
      status: "IN_PROGRESS",
    });

    setStartMilestoneId(null);
  };

  const handleCompleteMilestone = (milestoneId: number) => {
    setCompleteMilestoneId(milestoneId);
    setMilestoneExpenseSlips([]);
    setMilestonePaymentType("hourly");
    setMilestoneHoursWorked("");
    setMilestoneDaysWorked("");
    setMilestoneHourlyRateInput(currentUser?.hourlyRate?.toString() || "");
    setMilestoneDailyRateInput(currentUser?.dailyRate?.toString() || "");
    setMilestonePaymentNotes("");
  };

  const handleMilestoneExpenseSlipsUploaded = (slips: ExpenseSlip[]) => {
    setMilestoneExpenseSlips(slips);
  };

  const calculateMilestonePaymentAmount = () => {
    if (!currentUser) return 0;
    
    if (milestonePaymentType === "hourly") {
      const hours = parseFloat(milestoneHoursWorked) || 0;
      const rate = parseFloat(milestoneHourlyRateInput) || currentUser.hourlyRate || 0;
      return hours * rate;
    } else {
      const days = parseFloat(milestoneDaysWorked) || 0;
      const rate = parseFloat(milestoneDailyRateInput) || currentUser.dailyRate || 0;
      return days * rate;
    }
  };

  const handleConfirmCompleteMilestone = async () => {
    if (milestoneExpenseSlips.length === 0) {
      toast.error("Please upload at least one expense slip");
      return;
    }

    // Validate payment request fields
    if (milestonePaymentType === "hourly" && (!milestoneHoursWorked || parseFloat(milestoneHoursWorked) <= 0)) {
      toast.error("Please enter hours worked for payment request");
      return;
    }

    if (milestonePaymentType === "daily" && (!milestoneDaysWorked || parseFloat(milestoneDaysWorked) <= 0)) {
      toast.error("Please enter days worked for payment request");
      return;
    }

    if (milestonePaymentType === "hourly" && (!milestoneHourlyRateInput || parseFloat(milestoneHourlyRateInput) <= 0)) {
      toast.error("Please enter your hourly rate for payment request");
      return;
    }

    if (milestonePaymentType === "daily" && (!milestoneDailyRateInput || parseFloat(milestoneDailyRateInput) <= 0)) {
      toast.error("Please enter your daily rate for payment request");
      return;
    }

    try {
      // First, complete the milestone with expense slips
      await updateMilestoneStatusMutation.mutateAsync({
        token: token!,
        milestoneId: completeMilestoneId!,
        status: "COMPLETED",
        progressPercentage: 100,
        expenseSlips: milestoneExpenseSlips,
      });

      // Then, create the payment request
      await createMilestonePaymentRequestMutation.mutateAsync({
        token: token!,
        milestoneId: completeMilestoneId!,
        artisanId: currentUser!.id,
        hoursWorked: milestonePaymentType === "hourly" ? parseFloat(milestoneHoursWorked) : undefined,
        daysWorked: milestonePaymentType === "daily" ? parseFloat(milestoneDaysWorked) : undefined,
        hourlyRate: milestonePaymentType === "hourly" ? parseFloat(milestoneHourlyRateInput) : undefined,
        dailyRate: milestonePaymentType === "daily" ? parseFloat(milestoneDailyRateInput) : undefined,
        calculatedAmount: calculateMilestonePaymentAmount(),
        notes: milestonePaymentNotes || undefined,
      });

      toast.success("Milestone completed and payment request submitted!");

      // Reset form
      setCompleteMilestoneId(null);
      setMilestoneExpenseSlips([]);
      setMilestonePaymentType("hourly");
      setMilestoneHoursWorked("");
      setMilestoneDaysWorked("");
      setMilestoneHourlyRateInput("");
      setMilestoneDailyRateInput("");
      setMilestonePaymentNotes("");
    } catch (error) {
      console.error("Error completing milestone:", error);
    }
  };

  const handlePauseMilestone = (milestoneId: number) => {
    if (window.confirm("Are you sure you want to pause this milestone?")) {
      pauseMilestoneMutation.mutate({
        token: token!,
        milestoneId,
      });
    }
  };

  const handleResumeMilestone = (milestoneId: number) => {
    resumeMilestoneMutation.mutate({
      token: token!,
      milestoneId,
    });
  };

  const handleEditMilestoneNotes = (milestoneId: number, currentNotes: string | null) => {
    setEditingMilestoneNotesId(milestoneId);
    setMilestoneNotesInput(currentNotes || "");
  };

  const handleSaveMilestoneNotes = () => {
    if (editingMilestoneNotesId === null) return;
    
    updateMilestoneNotesMutation.mutate({
      token: token!,
      milestoneId: editingMilestoneNotesId,
      status: "IN_PROGRESS", // Keep current status
      notes: milestoneNotesInput,
    });
  };

  const handleUpdateProgress = (milestoneId: number, currentProgress: number) => {
    setUpdateProgressMilestoneId(milestoneId);
    setProgressPercentageInput(currentProgress.toString());
    setProgressWorkDone("");
    setProgressChallenges("");
    setProgressSuccesses("");
    setProgressImagesDone([]);
    setProgressItemizedExpenses([]);
    setProgressNextWeekPlan("");
  };

  const handleProgressImagesUploaded = (urls: string[]) => {
    setProgressImagesDone(urls);
  };

  const handleSaveProgress = () => {
    if (updateProgressMilestoneId === null) return;
    
    const progress = parseFloat(progressPercentageInput);
    if (isNaN(progress) || progress < 0 || progress > 100) {
      toast.error("Please enter a valid progress percentage (0-100)");
      return;
    }

    // Validate itemized expenses if provided
    if (progressItemizedExpenses.length > 0) {
      for (const expense of progressItemizedExpenses) {
        if (!expense.itemDescription.trim()) {
          toast.error("Please fill in all item descriptions for expenses");
          return;
        }
        if (expense.actualSpent > expense.quotedAmount && !expense.reasonForOverspend?.trim()) {
          toast.error("Please provide a reason for all expenses that exceed the quoted amount");
          return;
        }
      }
    }

    // Calculate week dates (current week)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStartDate = new Date(now);
    weekStartDate.setDate(now.getDate() - dayOfWeek); // Start of week (Sunday)
    weekStartDate.setHours(0, 0, 0, 0);
    
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6); // End of week (Saturday)
    weekEndDate.setHours(23, 59, 59, 999);

    updateMilestoneProgressMutation.mutate({
      token: token!,
      milestoneId: updateProgressMilestoneId,
      status: "IN_PROGRESS",
      progressPercentage: progress,
      workDone: progressWorkDone.trim() || undefined,
      challenges: progressChallenges.trim() || undefined,
      successes: progressSuccesses.trim() || undefined,
      imagesDone: progressImagesDone.length > 0 ? progressImagesDone : undefined,
      itemizedExpenses: progressItemizedExpenses.length > 0 ? progressItemizedExpenses : undefined,
      nextWeekPlan: progressNextWeekPlan.trim() || undefined,
      weekStartDate: weekStartDate.toISOString(),
      weekEndDate: weekEndDate.toISOString(),
    });
  };

  const handleUploadSupplierQuotation = (milestoneId: number) => {
    setUploadQuotationMilestoneId(milestoneId);
    setQuotationFile(null);
    setQuotationPreviewUrl(null);
    setQuotationSupplierName("");
    setQuotationAmount("");
    setQuotationDescription("");
    setQuotationCategory("MATERIALS");
  };

  const handleQuotationFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setQuotationFile(file);
      if (file.type.startsWith("image/")) {
        setQuotationPreviewUrl(URL.createObjectURL(file));
      } else {
        setQuotationPreviewUrl(null);
      }
    }
  };

  const handleConfirmUploadQuotation = async () => {
    if (!quotationFile) {
      toast.error("Please select a file to upload");
      return;
    }

    try {
      // Get presigned URL
      const { presignedUrl, fileUrl } = await getPresignedUrlMutation.mutateAsync({
        token: token!,
        fileName: quotationFile.name,
        fileType: quotationFile.type,
        isPublic: false,
      });

      // Upload file to MinIO
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        body: quotationFile,
        headers: {
          "Content-Type": quotationFile.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      // Create supplier quotation record
      await uploadMilestoneSupplierQuotationMutation.mutateAsync({
        token: token!,
        milestoneId: uploadQuotationMilestoneId!,
        url: fileUrl,
        supplierName: quotationSupplierName || undefined,
        amount: quotationAmount ? parseFloat(quotationAmount) : undefined,
        description: quotationDescription || undefined,
        category: quotationCategory,
      });

      // Reset form
      setUploadQuotationMilestoneId(null);
      setQuotationFile(null);
      if (quotationPreviewUrl) {
        URL.revokeObjectURL(quotationPreviewUrl);
      }
      setQuotationPreviewUrl(null);
      setQuotationSupplierName("");
      setQuotationAmount("");
      setQuotationDescription("");
      setQuotationCategory("MATERIALS");
    } catch (error) {
      console.error("Error uploading supplier quotation:", error);
    }
  };

  const handleDeleteSupplierQuotation = (quotationId: number) => {
    if (window.confirm("Are you sure you want to delete this supplier quotation? This action cannot be undone.")) {
      deleteMilestoneSupplierQuotationMutation.mutate({
        token: token!,
        quotationId,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 text-white shadow-2xl relative z-50">
        {/* Decorative Background Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-3 rounded-2xl shadow-lg backdrop-blur-md border border-white/30">
                <Wrench className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">My Jobs</h1>
                <p className="text-blue-100 text-sm sm:text-base mt-1 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  Welcome, {user?.firstName}!
                </p>
              </div>
            </div>
            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <Link
                  to="/messages"
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 rounded-xl transition-all shadow-md hover:shadow-lg inline-flex items-center justify-center"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Messages
                  {unreadConversations.length > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">
                      {unreadConversations.length}
                    </span>
                  )}
                </Link>
                <Link
                  to="/artisan/gallery"
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl transition-all border border-white/30 inline-flex items-center justify-center"
                >
                  <Images className="h-4 w-4 mr-2" />
                  Gallery
                </Link>
              </div>
              <div className="flex items-center gap-3">
                <NotificationDropdown />
                <Link
                  to="/"
                  onClick={() => useAuthStore.getState().clearAuth()}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 rounded-xl transition-all border border-white/30 text-center"
                >
                  Logout
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10" style={{ isolation: 'isolate' }}>
        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 mb-8">
          <MetricCard
            name="Assigned"
            value={assignedOrders.length}
            icon={Clock}
            color="yellow"
            gradient={true}
          />
          <MetricCard
            name="In Progress"
            value={inProgressOrders.length}
            icon={PlayCircle}
            color="blue"
            gradient={true}
          />
          <MetricCard
            name="Completed"
            value={completedOrders.length}
            icon={CheckCircle2}
            color="green"
            gradient={true}
          />
          <MetricCard
            name="Quotations"
            value={pendingReviewQuotations.length + inProgressQuotations.length}
            icon={FileText}
            color="purple"
          />
          <MetricCard
            name="Milestones"
            value={planningMilestones.length + notStartedMilestones.length + inProgressMilestones.length}
            icon={Target}
            color="orange"
          />
          <MetricCard
            name="Unread Messages"
            value={unreadConversations.length}
            icon={MessageSquare}
            color="indigo"
          />
        </div>

        {/* Tabbed Interface */}
        <Tab.Group selectedIndex={activeTab} onChange={setActiveTab}>
          <Tab.List className="flex gap-2 rounded-2xl bg-white p-2 shadow-lg border border-gray-100 mb-6 overflow-x-auto">
            <Tab
              className={({ selected }) =>
                `w-full sm:w-auto flex-1 sm:flex-none rounded-xl py-3 px-5 text-sm font-medium leading-5 transition-all transform whitespace-nowrap ${
                  selected
                    ? "bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-md scale-105"
                    : "text-gray-600 hover:bg-gray-50 hover:text-blue-600"
                }`
              }
            >
              <div className="flex items-center justify-center gap-2">
                <Briefcase className="h-4 w-4" />
                Jobs
              </div>
            </Tab>
            <Tab
              className={({ selected }) =>
                `w-full sm:w-auto flex-1 sm:flex-none rounded-xl py-3 px-5 text-sm font-medium leading-5 transition-all transform whitespace-nowrap ${
                  selected
                    ? "bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-md scale-105"
                    : "text-gray-600 hover:bg-gray-50 hover:text-blue-600"
                }`
              }
            >
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-4 w-4" />
                Quotations
              </div>
            </Tab>
            <Tab
              className={({ selected }) =>
                `w-full sm:w-auto flex-1 sm:flex-none rounded-xl py-3 px-5 text-sm font-medium leading-5 transition-all transform whitespace-nowrap ${
                  selected
                    ? "bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-md scale-105"
                    : "text-gray-600 hover:bg-gray-50 hover:text-blue-600"
                }`
              }
            >
              <div className="flex items-center justify-center gap-2">
                <FolderKanban className="h-4 w-4" />
                Projects/Milestones
              </div>
            </Tab>
            <Tab
              className={({ selected }) =>
                `w-full sm:w-auto flex-1 sm:flex-none rounded-xl py-3 px-5 text-sm font-medium leading-5 transition-all transform whitespace-nowrap ${
                  selected
                    ? "bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-md scale-105"
                    : "text-gray-600 hover:bg-gray-50 hover:text-blue-600"
                }`
              }
            >
              <div className="flex items-center justify-center gap-2">
                <DollarSign className="h-4 w-4" />
                Earnings
              </div>
            </Tab>
            <Tab
              className={({ selected }) =>
                `w-full sm:w-auto flex-1 sm:flex-none rounded-xl py-3 px-5 text-sm font-medium leading-5 transition-all transform whitespace-nowrap ${
                  selected
                    ? "bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-md scale-105"
                    : "text-gray-600 hover:bg-gray-50 hover:text-blue-600"
                }`
              }
            >
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Performance
              </div>
            </Tab>
            <Tab
              className={({ selected }) =>
                `w-full sm:w-auto flex-1 sm:flex-none rounded-xl py-3 px-5 text-sm font-medium leading-5 transition-all transform whitespace-nowrap ${
                  selected
                    ? "bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-md scale-105"
                    : "text-gray-600 hover:bg-gray-50 hover:text-blue-600"
                }`
              }
            >
              <div className="flex items-center justify-center gap-2">
                <Star className="h-4 w-4" />
                Reviews
              </div>
            </Tab>
          </Tab.List>

          <Tab.Panels>
            {/* Jobs Tab */}
            <Tab.Panel>
              {/* Assigned Jobs */}
              {assignedOrders.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Assigned Jobs</h2>
                  <div className="space-y-4">
                    {assignedOrders.map((order) => (
                      <div
                        key={order.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                      >
                        <div className="flex flex-col sm:flex-row items-start justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{order.orderNumber}</h3>
                            <p className="text-sm text-gray-600 mt-1">{order.customerName}</p>
                          </div>
                          <span className="mt-2 sm:mt-0 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Assigned
                          </span>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center text-sm text-gray-600">
                            <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                            {order.address}
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <Phone className="h-4 w-4 mr-2 text-gray-400" />
                            {order.customerPhone}
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <Mail className="h-4 w-4 mr-2 text-gray-400" />
                            {order.customerEmail}
                          </div>
                        </div>

                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-700 mb-1">Service Type:</p>
                          <p className="text-sm text-gray-600">{order.serviceType}</p>
                        </div>

                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-700 mb-1">Description:</p>
                          <p className="text-sm text-gray-600">{order.description}</p>
                        </div>

                        {/* Budget Information */}
                        {(order.totalMaterialBudget || order.numLabourersNeeded || order.totalLabourCostBudget) && (
                          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm font-semibold text-blue-900 mb-2">Budget Information</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                              {order.totalMaterialBudget && (
                                <div>
                                  <p className="text-xs text-blue-700 mb-1">Material Budget</p>
                                  <p className="font-semibold text-blue-900">R{(order.totalMaterialBudget || 0).toLocaleString()}</p>
                                </div>
                              )}
                              {order.numLabourersNeeded && (
                                <div>
                                  <p className="text-xs text-blue-700 mb-1">Labourers Needed</p>
                                  <p className="font-semibold text-blue-900">{order.numLabourersNeeded}</p>
                                </div>
                              )}
                              {order.totalLabourCostBudget && (
                                <div>
                                  <p className="text-xs text-blue-700 mb-1">Labour Budget</p>
                                  <p className="font-semibold text-blue-900">R{(order.totalLabourCostBudget || 0).toLocaleString()}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Display order documents */}
                        {order.documents && order.documents.length > 0 && (
                          <div className="mb-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">Order Documents:</p>
                            <div className="space-y-1">
                              {order.documents.map((docUrl, idx) => (
                                <FileAttachment key={idx} url={docUrl} isOwnMessage={false} />
                              ))}
                            </div>
                          </div>
                        )}

                        {order.notes && (
                          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <p className="text-sm font-medium text-amber-900 mb-1">Job Notes:</p>
                            <p className="text-sm text-amber-800 whitespace-pre-wrap">{order.notes}</p>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => handleEditNotes(order.id, order.notes)}
                            className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                          >
                            <FileText className="h-5 w-5 mr-2" />
                            {order.notes ? "Edit Notes" : "Add Notes"}
                          </button>
                          <button
                            onClick={() => handleStartJob(order.id)}
                            disabled={updateOrderStatusMutation.isPending}
                            className="flex-1 flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                          >
                            <PlayCircle className="h-5 w-5 mr-2" />
                            Start Job
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* In Progress Jobs */}
              {inProgressOrders.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Jobs In Progress</h2>
                  <div className="space-y-4">
                    {inProgressOrders.map((order) => (
                      <div
                        key={order.id}
                        className={`bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow ${
                          order.isPaused ? "border-orange-300 bg-orange-50" : "border-blue-200"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row items-start justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{order.orderNumber}</h3>
                            <p className="text-sm text-gray-600 mt-1">{order.customerName}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-2 sm:mt-0">
                            {order.isPaused && (
                              <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 flex items-center">
                                <Pause className="h-3 w-3 mr-1" />
                                Paused
                              </span>
                            )}
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              In Progress
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center text-sm text-gray-600">
                            <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                            {order.address}
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <Phone className="h-4 w-4 mr-2 text-gray-400" />
                            {order.customerPhone}
                          </div>
                        </div>

                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-700 mb-1">Service Type:</p>
                          <p className="text-sm text-gray-600">{order.serviceType}</p>
                        </div>

                        {/* Budget Information */}
                        {(order.totalMaterialBudget || order.numLabourersNeeded || order.totalLabourCostBudget) && (
                          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm font-semibold text-blue-900 mb-2">Budget Information</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                              {order.totalMaterialBudget && (
                                <div>
                                  <p className="text-xs text-blue-700 mb-1">Material Budget</p>
                                  <p className="font-semibold text-blue-900">R{(order.totalMaterialBudget || 0).toLocaleString()}</p>
                                </div>
                              )}
                              {order.numLabourersNeeded && (
                                <div>
                                  <p className="text-xs text-blue-700 mb-1">Labourers Needed</p>
                                  <p className="font-semibold text-blue-900">{order.numLabourersNeeded}</p>
                                </div>
                              )}
                              {order.totalLabourCostBudget && (
                                <div>
                                  <p className="text-xs text-blue-700 mb-1">Labour Budget</p>
                                  <p className="font-semibold text-blue-900">R{(order.totalLabourCostBudget || 0).toLocaleString()}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Display order documents */}
                        {order.documents && order.documents.length > 0 && (
                          <div className="mb-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">Order Documents:</p>
                            <div className="space-y-1">
                              {order.documents.map((docUrl, idx) => (
                                <FileAttachment key={idx} url={docUrl} isOwnMessage={false} />
                              ))}
                            </div>
                          </div>
                        )}

                        {order.startTime && (
                          <div className="mb-4 flex items-center text-sm text-gray-600">
                            <Clock className="h-4 w-4 mr-2 text-gray-400" />
                            Started: {new Date(order.startTime).toLocaleString()}
                          </div>
                        )}

                        {order.isPaused && order.pausedAt && (
                          <div className="mb-4 flex items-center text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg p-3">
                            <Pause className="h-4 w-4 mr-2" />
                            Paused at: {new Date(order.pausedAt).toLocaleString()}
                          </div>
                        )}

                        {/* Display before pictures */}
                        {order.beforePictures && order.beforePictures.length > 0 && (
                          <div className="mb-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">Before Pictures:</p>
                            <div className="grid grid-cols-3 gap-2">
                              {order.beforePictures.map((url, idx) => (
                                <img
                                  key={idx}
                                  src={url}
                                  alt={`Before ${idx + 1}`}
                                  className="w-full h-24 object-cover rounded-lg border border-gray-200"
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {order.notes && (
                          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <p className="text-sm font-medium text-amber-900 mb-1">Job Notes:</p>
                            <p className="text-sm text-amber-800 whitespace-pre-wrap">{order.notes}</p>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => order.isPaused ? handleResumeJob(order.id) : handlePauseJob(order.id)}
                            disabled={order.isPaused ? resumeJobMutation.isPending : pauseJobMutation.isPending}
                            className={`flex-1 flex items-center justify-center px-4 py-2 border text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-colors ${
                              order.isPaused
                                ? "border-transparent text-white bg-green-600 hover:bg-green-700 focus:ring-green-500"
                                : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-orange-500"
                            }`}
                          >
                            {order.isPaused ? (
                              <>
                                <Play className="h-5 w-5 mr-2" />
                                Resume Job
                              </>
                            ) : (
                              <>
                                <Pause className="h-5 w-5 mr-2" />
                                Pause Job
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleCompleteJob(order.id)}
                            disabled={order.isPaused || updateOrderStatusMutation.isPending}
                            className="flex-1 flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title={order.isPaused ? "Resume the job before marking it as complete" : "Mark this job as complete"}
                          >
                            <CheckCircle2 className="h-5 w-5 mr-2" />
                            Mark as Complete
                          </button>
                        </div>
                        {order.isPaused && (
                          <p className="text-xs text-orange-600 mt-2 text-center">
                            Resume the job before you can mark it as complete
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Jobs */}
              {completedOrders.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Recently Completed</h2>
                  <div className="space-y-4">
                    {completedOrders.slice(0, 5).map((order) => (
                      <div
                        key={order.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                      >
                        <div className="flex flex-col sm:flex-row items-start justify-between mb-3">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{order.orderNumber}</h3>
                            <p className="text-sm text-gray-600 mt-1">{order.customerName}</p>
                          </div>
                          <span className="mt-2 sm:mt-0 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Completed
                          </span>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-start justify-between text-sm mb-4 gap-2">
                          <div className="text-gray-600">
                            {order.serviceType}
                          </div>
                          {order.endTime && (
                            <div className="text-gray-500">
                              Completed: {new Date(order.endTime).toLocaleDateString()}
                            </div>
                          )}
                        </div>

                        {/* Display order documents */}
                        {order.documents && order.documents.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs font-medium text-gray-700 mb-2">Order Documents:</p>
                            <div className="space-y-1">
                              {order.documents.map((docUrl, idx) => (
                                <FileAttachment key={idx} url={docUrl} isOwnMessage={false} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => handleReviewJob(order)}
                            className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                          >
                            <FileCheck className="h-5 w-5 mr-2" />
                            Review/Edit Job
                          </button>
                          <button
                            onClick={() => handleDownloadOrderSummary(order.id, order.orderNumber)}
                            disabled={generateOrderPdfMutation.isPending}
                            className="flex-1 flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                          >
                            {generateOrderPdfMutation.isPending ? (
                              <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Download className="h-5 w-5 mr-2" />
                                Download Summary
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {orders.length === 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <Briefcase className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs assigned yet</h3>
                  <p className="text-sm text-gray-600">Check back later for new assignments</p>
                </div>
              )}
            </Tab.Panel>

            {/* Quotations Tab */}
            <Tab.Panel>
              {/* Pending Review Quotations */}
              {pendingReviewQuotations.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Review</h2>
                  <div className="space-y-4">
                    {pendingReviewQuotations.map((quotation) => {
                      const items = Array.isArray(quotation.items) ? quotation.items : [];
                      return (
                        <div
                          key={quotation.id}
                          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                        >
                          <div className="flex flex-col sm:flex-row items-start justify-between mb-4">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">{quotation.quoteNumber}</h3>
                              <p className="text-sm text-gray-600 mt-1">{quotation.customerName}</p>
                            </div>
                            <span className="mt-2 sm:mt-0 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Pending Review
                            </span>
                          </div>
                          
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center text-sm text-gray-600">
                              <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                              {quotation.address}
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                              <Phone className="h-4 w-4 mr-2 text-gray-400" />
                              {quotation.customerPhone}
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                              <Mail className="h-4 w-4 mr-2 text-gray-400" />
                              {quotation.customerEmail}
                            </div>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">Items</h4>
                            <div className="space-y-2">
                              {items.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-sm">
                                  <div>
                                    <span className="text-gray-900">{item.description}</span>
                                    <span className="text-gray-500 ml-2">
                                      (Qty: {item.quantity} @ R{item.unitPrice})
                                    </span>
                                  </div>
                                  <span className="font-medium text-gray-900">
                                    R{(item.total || 0).toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="border-t border-gray-200 mt-3 pt-3">
                              <div className="flex justify-between text-base font-bold">
                                <span>Total:</span>
                                <span>R{(quotation.total || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          {quotation.notes && (
                            <div className="mb-4">
                              <p className="text-sm font-medium text-gray-700 mb-1">Notes:</p>
                              <p className="text-sm text-gray-600">{quotation.notes}</p>
                            </div>
                          )}

                          <button
                            onClick={() => handleStartQuotation(quotation.id)}
                            disabled={updateQuotationStatusMutation.isPending}
                            className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                          >
                            <PlayCircle className="h-5 w-5 mr-2" />
                            Start Working
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* In Progress Quotations */}
              {inProgressQuotations.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">In Progress</h2>
                  <div className="space-y-4">
                    {inProgressQuotations.map((quotation) => {
                      const items = Array.isArray(quotation.items) ? quotation.items : [];
                      return (
                        <div
                          key={quotation.id}
                          className="bg-white rounded-xl shadow-sm border border-blue-200 p-6 hover:shadow-md transition-shadow"
                        >
                          <div className="flex flex-col sm:flex-row items-start justify-between mb-4">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">{quotation.quoteNumber}</h3>
                              <p className="text-sm text-gray-600 mt-1">{quotation.customerName}</p>
                            </div>
                            <span className="mt-2 sm:mt-0 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              In Progress
                            </span>
                          </div>
                          
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center text-sm text-gray-600">
                              <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                              {quotation.address}
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                              <Phone className="h-4 w-4 mr-2 text-gray-400" />
                              {quotation.customerPhone}
                            </div>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">Items</h4>
                            <div className="space-y-2">
                              {items.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-sm">
                                  <div>
                                    <span className="text-gray-900">{item.description}</span>
                                    <span className="text-gray-500 ml-2">
                                      (Qty: {item.quantity})
                                    </span>
                                  </div>
                                  <span className="font-medium text-gray-900">
                                    R{(item.total || 0).toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="border-t border-gray-200 mt-3 pt-3">
                              <div className="flex justify-between text-base font-bold">
                                <span>Total:</span>
                                <span>R{(quotation.total || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleCompleteQuotation(quotation.id)}
                            disabled={updateQuotationStatusMutation.isPending}
                            className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transition-colors"
                          >
                            <CheckCircle2 className="h-5 w-5 mr-2" />
                            Submit for Review
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Completed Quotations */}
              {completedQuotations.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Completed</h2>
                  <div className="space-y-4">
                    {completedQuotations.slice(0, 5).map((quotation) => (
                      <div
                        key={quotation.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                      >
                        <div className="flex flex-col sm:flex-row items-start justify-between mb-3">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{quotation.quoteNumber}</h3>
                            <p className="text-sm text-gray-600 mt-1">{quotation.customerName}</p>
                          </div>
                          <span className={`mt-2 sm:mt-0 px-3 py-1 rounded-full text-xs font-medium ${
                            quotation.status === "APPROVED" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-blue-100 text-blue-800"
                          }`}>
                            {quotation.status === "APPROVED" ? "Approved" : "Ready for Review"}
                          </span>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-start justify-between text-sm gap-2">
                          <div className="text-gray-600">
                            {quotation.customerName}
                          </div>
                          <div className="flex items-center font-semibold text-gray-900">
                            <DollarSign className="h-4 w-4 mr-1" />
                            R{(quotation.total || 0).toLocaleString()}
                          </div>
                        </div>

                        <div className="mt-4">
                          <button
                            onClick={() => handleCompleteQuotation(quotation.id)}
                            disabled={updateQuotationStatusMutation.isPending}
                            className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transition-colors"
                          >
                            <CheckCircle2 className="h-5 w-5 mr-2" />
                            Edit & Resubmit
                          </button>
                          <p className="mt-2 text-xs text-gray-500">
                            Resubmitting sends it back to review.
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {quotations.length === 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <FileText className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No quotations assigned yet</h3>
                  <p className="text-sm text-gray-600">Check back later for new assignments</p>
                </div>
              )}
            </Tab.Panel>

            {/* Projects/Milestones Tab */}
            <Tab.Panel>
              {/* Planning Milestones */}
              {planningMilestones.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Planning Phase</h2>
                  <div className="space-y-4">
                    {planningMilestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="bg-white rounded-xl shadow-sm border border-purple-200 bg-purple-50 p-6 hover:shadow-md transition-shadow"
                      >
                        <div className="flex flex-col sm:flex-row items-start justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{milestone.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">
                              Project: {milestone.project.name} ({milestone.project.projectNumber})
                            </p>
                          </div>
                          <span className="mt-2 sm:mt-0 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Planning
                          </span>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center text-sm text-gray-600">
                            <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                            {milestone.project.address}
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <Phone className="h-4 w-4 mr-2 text-gray-400" />
                            {milestone.project.customerPhone}
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <Mail className="h-4 w-4 mr-2 text-gray-400" />
                            {milestone.project.customerEmail}
                          </div>
                        </div>

                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-700 mb-1">Description:</p>
                          <p className="text-sm text-gray-600">{milestone.description}</p>
                        </div>

                        {/* Budget Information */}
                        {(milestone.budgetAllocated > 0 || milestone.labourCost > 0 || milestone.materialCost > 0) && (
                          <div className="mb-4 bg-purple-100 border border-purple-300 rounded-lg p-4">
                            <p className="text-sm font-semibold text-purple-900 mb-2">Budget Information</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                              {milestone.budgetAllocated > 0 && (
                                <div>
                                  <p className="text-xs text-purple-700 mb-1">Budget Allocated</p>
                                  <p className="font-semibold text-purple-900">R{(milestone.budgetAllocated || 0).toLocaleString()}</p>
                                </div>
                              )}
                              {milestone.labourCost > 0 && (
                                <div>
                                  <p className="text-xs text-purple-700 mb-1">Labour Budget</p>
                                  <p className="font-semibold text-purple-900">R{(milestone.labourCost || 0).toLocaleString()}</p>
                                </div>
                              )}
                              {milestone.materialCost > 0 && (
                                <div>
                                  <p className="text-xs text-purple-700 mb-1">Material Budget</p>
                                  <p className="font-semibold text-purple-900">R{(milestone.materialCost || 0).toLocaleString()}</p>
                                </div>
                              )}
                            </div>
                            {milestone.expectedProfit > 0 && (
                              <div className="mt-3 pt-3 border-t border-purple-300">
                                <div className="flex justify-between items-center">
                                  <p className="text-xs text-purple-700">Expected Profit</p>
                                  <p className="font-semibold text-purple-900">R{(milestone.expectedProfit || 0).toLocaleString()}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Timeline */}
                        {(milestone.startDate || milestone.endDate) && (
                          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <p className="text-sm font-medium text-gray-700 mb-2">Planned Timeline</p>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-sm text-gray-600 gap-2">
                              {milestone.startDate && (
                                <div>
                                  <span className="text-xs text-gray-500">Start: </span>
                                  {new Date(milestone.startDate).toLocaleDateString()}
                                </div>
                              )}
                              {milestone.endDate && (
                                <div>
                                  <span className="text-xs text-gray-500">End: </span>
                                  {new Date(milestone.endDate).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Materials */}
                        {milestone.materials && milestone.materials.length > 0 && (
                          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <p className="text-sm font-medium text-gray-700 mb-2">Materials Needed ({milestone.materials.length})</p>
                            <div className="space-y-2">
                              {milestone.materials.map((material: any, idx: number) => (
                                <div key={idx} className="text-xs text-gray-600 flex justify-between">
                                  <span>{material.name} (Qty: {material.quantity})</span>
                                  <span className="font-medium">R{material.totalCost.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {milestone.notes && (
                          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <p className="text-sm font-medium text-amber-900 mb-1">Notes:</p>
                            <p className="text-sm text-amber-800 whitespace-pre-wrap">{milestone.notes}</p>
                          </div>
                        )}

                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                          <p className="text-sm text-purple-800">
                            This milestone is currently in the planning phase. You will be notified when it's ready to start.
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Not Started Milestones */}
              {notStartedMilestones.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Ready to Start</h2>
                  <div className="space-y-4">
                    {notStartedMilestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                      >
                        <div className="flex flex-col sm:flex-row items-start justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{milestone.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">
                              Project: {milestone.project.name} ({milestone.project.projectNumber})
                            </p>
                          </div>
                          <span className="mt-2 sm:mt-0 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Not Started
                          </span>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center text-sm text-gray-600">
                            <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                            {milestone.project.address}
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <Phone className="h-4 w-4 mr-2 text-gray-400" />
                            {milestone.project.customerPhone}
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <Mail className="h-4 w-4 mr-2 text-gray-400" />
                            {milestone.project.customerEmail}
                          </div>
                        </div>

                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-700 mb-1">Description:</p>
                          <p className="text-sm text-gray-600">{milestone.description}</p>
                        </div>

                        {/* Budget Information */}
                        {(milestone.budgetAllocated > 0 || milestone.labourCost > 0 || milestone.materialCost > 0) && (
                          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm font-semibold text-blue-900 mb-2">Budget Information</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                              {milestone.budgetAllocated > 0 && (
                                <div>
                                  <p className="text-xs text-blue-700 mb-1">Budget Allocated</p>
                                  <p className="font-semibold text-blue-900">R{(milestone.budgetAllocated || 0).toLocaleString()}</p>
                                </div>
                              )}
                              {milestone.labourCost > 0 && (
                                <div>
                                  <p className="text-xs text-blue-700 mb-1">Labour Budget</p>
                                  <p className="font-semibold text-blue-900">R{(milestone.labourCost || 0).toLocaleString()}</p>
                                </div>
                              )}
                              {milestone.materialCost > 0 && (
                                <div>
                                  <p className="text-xs text-blue-700 mb-1">Material Budget</p>
                                  <p className="font-semibold text-blue-900">R{(milestone.materialCost || 0).toLocaleString()}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Timeline */}
                        {(milestone.startDate || milestone.endDate) && (
                          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <p className="text-sm font-medium text-gray-700 mb-2">Planned Timeline</p>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-sm text-gray-600 gap-2">
                              {milestone.startDate && (
                                <div>
                                  <span className="text-xs text-gray-500">Start: </span>
                                  {new Date(milestone.startDate).toLocaleDateString()}
                                </div>
                              )}
                              {milestone.endDate && (
                                <div>
                                  <span className="text-xs text-gray-500">End: </span>
                                  {new Date(milestone.endDate).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {milestone.notes && (
                          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <p className="text-sm font-medium text-amber-900 mb-1">Notes:</p>
                            <p className="text-sm text-amber-800 whitespace-pre-wrap">{milestone.notes}</p>
                          </div>
                        )}

                        <button
                          onClick={() => handleStartMilestone(milestone.id)}
                          disabled={updateMilestoneStatusMutation.isPending}
                          className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                        >
                          <PlayCircle className="h-5 w-5 mr-2" />
                          Start Milestone
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* In Progress Milestones */}
              {inProgressMilestones.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">In Progress</h2>
                  <div className="space-y-4">
                    {inProgressMilestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="bg-white rounded-xl shadow-sm border border-blue-200 p-6 hover:shadow-md transition-shadow"
                      >
                        <div className="flex flex-col sm:flex-row items-start justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{milestone.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">
                              Project: {milestone.project.name} ({milestone.project.projectNumber})
                            </p>
                          </div>
                          <span className="mt-2 sm:mt-0 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            In Progress
                          </span>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center text-sm text-gray-600">
                            <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                            {milestone.project.address}
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <Phone className="h-4 w-4 mr-2 text-gray-400" />
                            {milestone.project.customerPhone}
                          </div>
                        </div>

                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-700 mb-1">Description:</p>
                          <p className="text-sm text-gray-600">{milestone.description}</p>
                        </div>

                        {/* Progress */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="font-medium text-gray-700">Progress</span>
                            <span className="font-semibold text-blue-600">{milestone.progressPercentage}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${milestone.progressPercentage}%` }}
                            />
                          </div>
                        </div>

                        {/* Budget vs Actual */}
                        {milestone.budgetAllocated > 0 && (
                          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm font-semibold text-blue-900 mb-2">Budget Tracking</p>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-xs text-blue-700 mb-1">Budget</p>
                                <p className="font-semibold text-blue-900">R{(milestone.budgetAllocated || 0).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-xs text-blue-700 mb-1">Actual Cost</p>
                                <p className="font-semibold text-blue-900">R{(milestone.actualCost || 0).toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Supplier Quotations */}
                        {milestone.supplierQuotations && milestone.supplierQuotations.length > 0 && (
                          <div className="mb-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">Supplier Quotations:</p>
                            <div className="space-y-2">
                              {milestone.supplierQuotations.map((quotation: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3">
                                  <div className="flex-1">
                                    <a
                                      href={quotation.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center"
                                    >
                                      <FileText className="h-4 w-4 mr-2" />
                                      {quotation.supplierName || `Quotation ${idx + 1}`}
                                    </a>
                                    {quotation.description && (
                                      <p className="text-xs text-gray-600 mt-1">{quotation.description}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-2 ml-4">
                                    {quotation.amount && (
                                      <span className="text-sm font-semibold text-gray-900">
                                        R{(quotation.amount || 0).toLocaleString()}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => handleDeleteSupplierQuotation(quotation.id)}
                                      disabled={deleteMilestoneSupplierQuotationMutation.isPending}
                                      className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                      title="Delete quotation"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {milestone.actualStartDate && (
                          <div className="mb-4 flex items-center text-sm text-gray-600">
                            <Clock className="h-4 w-4 mr-2 text-gray-400" />
                            Started: {new Date(milestone.actualStartDate).toLocaleString()}
                          </div>
                        )}

                        {milestone.notes && (
                          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <p className="text-sm font-medium text-amber-900 mb-1">Notes:</p>
                            <p className="text-sm text-amber-800 whitespace-pre-wrap">{milestone.notes}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleEditMilestoneNotes(milestone.id, milestone.notes)}
                            className="flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            {milestone.notes ? "Edit Notes" : "Add Notes"}
                          </button>
                          <button
                            onClick={() => handleUpdateProgress(milestone.id, milestone.progressPercentage)}
                            className="flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                          >
                            <TrendingUp className="h-4 w-4 mr-2" />
                            Update Progress
                          </button>
                          <button
                            onClick={() => handleUploadSupplierQuotation(milestone.id)}
                            className="flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Quote
                          </button>
                          <button
                            onClick={() => handlePauseMilestone(milestone.id)}
                            disabled={pauseMilestoneMutation.isPending}
                            className="flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 transition-colors"
                          >
                            <Pause className="h-4 w-4 mr-2" />
                            Pause
                          </button>
                        </div>
                        <button
                          onClick={() => handleCompleteMilestone(milestone.id)}
                          disabled={updateMilestoneStatusMutation.isPending}
                          className="w-full mt-2 flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transition-colors"
                        >
                          <CheckCircle2 className="h-5 w-5 mr-2" />
                          Complete Milestone
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* On Hold Milestones */}
              {onHoldMilestones.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">On Hold</h2>
                  <div className="space-y-4">
                    {onHoldMilestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="bg-white rounded-xl shadow-sm border border-orange-300 bg-orange-50 p-6 hover:shadow-md transition-shadow"
                      >
                        <div className="flex flex-col sm:flex-row items-start justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{milestone.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">
                              Project: {milestone.project.name} ({milestone.project.projectNumber})
                            </p>
                          </div>
                          <span className="mt-2 sm:mt-0 px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 flex items-center">
                            <Pause className="h-3 w-3 mr-1" />
                            On Hold
                          </span>
                        </div>
                        
                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-700 mb-1">Description:</p>
                          <p className="text-sm text-gray-600">{milestone.description}</p>
                        </div>

                        {/* Progress */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="font-medium text-gray-700">Progress</span>
                            <span className="font-semibold text-orange-600">{milestone.progressPercentage}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${milestone.progressPercentage}%` }}
                            />
                          </div>
                        </div>

                        {milestone.notes && (
                          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <p className="text-sm font-medium text-amber-900 mb-1">Notes:</p>
                            <p className="text-sm text-amber-800 whitespace-pre-wrap">{milestone.notes}</p>
                          </div>
                        )}

                        <button
                          onClick={() => handleResumeMilestone(milestone.id)}
                          disabled={resumeMilestoneMutation.isPending}
                          className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transition-colors"
                        >
                          <Play className="h-5 w-5 mr-2" />
                          Resume Milestone
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Milestones */}
              {completedMilestones.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Recently Completed</h2>
                  <div className="space-y-4">
                    {completedMilestones.slice(0, 5).map((milestone) => (
                      <div
                        key={milestone.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                      >
                        <div className="flex flex-col sm:flex-row items-start justify-between mb-3">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{milestone.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">
                              Project: {milestone.project.name}
                            </p>
                          </div>
                          <span className="mt-2 sm:mt-0 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Completed
                          </span>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-start justify-between text-sm mb-4 gap-2">
                          <div className="text-gray-600">
                            Progress: {milestone.progressPercentage}%
                          </div>
                          {milestone.actualEndDate && (
                            <div className="text-gray-500">
                              Completed: {new Date(milestone.actualEndDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>

                        {/* Budget summary */}
                        {milestone.budgetAllocated > 0 && (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Budget</p>
                                <p className="font-semibold text-gray-900">R{(milestone.budgetAllocated || 0).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Actual Cost</p>
                                <p className="font-semibold text-gray-900">R{(milestone.actualCost || 0).toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {milestones.length === 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <FolderKanban className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No milestones assigned yet</h3>
                  <p className="text-sm text-gray-600">Check back later for project milestone assignments</p>
                </div>
              )}
            </Tab.Panel>

            {/* Earnings Tab */}
            <Tab.Panel>
              {performanceMetrics && (
                <div className="space-y-6">
                  {/* Earnings Summary Cards */}
                  <EarningsSummaryCards
                    totalEarnings={performanceMetrics.totalEarnings}
                    pendingEarnings={performanceMetrics.pendingEarnings}
                    thisMonthEarnings={performanceMetrics.thisMonthEarnings}
                    totalCompletedJobs={performanceMetrics.totalCompletedJobs}
                  />

                  {/* Pending Payments */}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Payments</h2>
                    <PendingPaymentsSection paymentRequests={paymentRequests} />
                  </div>

                  {/* Earnings History */}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Earnings History</h2>
                    <EarningsHistoryTable paymentRequests={paymentRequests} />
                  </div>
                </div>
              )}

              {!performanceMetrics && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <Loader2 className="mx-auto h-12 w-12 text-gray-400 mb-4 animate-spin" />
                  <p className="text-sm text-gray-600">Loading earnings data...</p>
                </div>
              )}
            </Tab.Panel>

            {/* Performance Tab */}
            <Tab.Panel>
              {performanceMetrics && (
                <PerformanceMetricsSection metrics={performanceMetrics} />
              )}

              {!performanceMetrics && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <Loader2 className="mx-auto h-12 w-12 text-gray-400 mb-4 animate-spin" />
                  <p className="text-sm text-gray-600">Loading performance metrics...</p>
                </div>
              )}
            </Tab.Panel>

            {/* Reviews Tab */}
            <Tab.Panel>
              {reviewsData ? (
                <ReviewsSection reviews={reviewsData.reviews} stats={reviewsData.stats} />
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <Loader2 className="mx-auto h-12 w-12 text-gray-400 mb-4 animate-spin" />
                  <p className="text-sm text-gray-600">Loading reviews...</p>
                </div>
              )}
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </main>

      {/* Start Job Modal */}
      {startJobOrderId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Start Job - Before Pictures</h2>
                <button
                  onClick={() => {
                    setStartJobOrderId(null);
                    setBeforePictures([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                Please take at least 3 pictures of the work area before starting the job.
              </p>

              <PhotoUpload
                onPhotosUploaded={handleBeforePicturesUploaded}
                minimumPhotos={3}
                title="Before Pictures"
                description="Take pictures showing the current state of the work area"
                isPublic={false}
              />

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setStartJobOrderId(null);
                    setBeforePictures([]);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmStartJob}
                  disabled={beforePictures.length < 3 || updateOrderStatusMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {updateOrderStatusMutation.isPending ? "Starting..." : "Start Job"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete Job Modal */}
      {completeJobOrderId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Complete Job</h2>
                <button
                  onClick={() => {
                    setCompleteJobOrderId(null);
                    setAfterPictures([]);
                    setSignedJobCardUrl(null);
                    setClientRepName("");
                    setClientRepSignDate("");
                    setMaterialCost("");
                    setExpenseSlips([]);
                    setPaymentType("hourly");
                    setHoursWorked("");
                    setDaysWorked("");
                    setHourlyRateInput("");
                    setDailyRateInput("");
                    setPaymentNotes("");
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Step 1: Upload After Pictures */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    1
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">After Pictures</h3>
                </div>
                <PhotoUpload
                  onPhotosUploaded={handleAfterPicturesUploaded}
                  minimumPhotos={3}
                  title="After Pictures"
                  description="Take pictures showing the completed work"
                  isPublic={false}
                />
              </div>

              {/* Step 2: Client Representative Information */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    2
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Client Representative Information</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Please enter the name of the client representative who will be signing and the date.
                </p>
                
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Representative Name *
                    </label>
                    <input
                      type="text"
                      value={clientRepName}
                      onChange={(e) => setClientRepName(e.target.value)}
                      placeholder="Enter full name of person signing"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date *
                    </label>
                    <input
                      type="datetime-local"
                      value={clientRepSignDate}
                      onChange={(e) => setClientRepSignDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Step 3: Capture Customer Signature */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    3
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Capture Customer Signature</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Have the customer sign digitally to confirm job completion.
                </p>
                <SignatureCapture
                  onSignatureCaptured={handleSignatureCaptured}
                  label="Customer Signature"
                  description="Please have the customer draw their signature below to confirm the work has been completed to their satisfaction"
                />
              </div>

              {/* Step 4: Upload Expense Slips and Enter Material Cost */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    4
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Expense Documentation</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Upload expense slips and categorize them (materials, tools, transportation, etc.)
                </p>
                
                {/* Expense Slip Upload */}
                <div className="mb-4">
                  <ExpenseSlipUpload
                    onSlipsUploaded={handleExpenseSlipsUploaded}
                    minimumSlips={1}
                    title="Expense Slips"
                    description="Upload and categorize each expense slip"
                    isPublic={false}
                  />
                </div>

                {/* Material Cost Input - Optional if amounts are specified in slips */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Material Cost (R) - Optional if amounts specified above
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={materialCost}
                    onChange={(e) => setMaterialCost(e.target.value)}
                    placeholder="Leave blank to auto-calculate from slip amounts"
                    disabled={!signedJobCardUrl}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {expenseSlips.length > 0 && expenseSlips.some(s => s.amount) && (
                      <>
                        Calculated from slips: R
                        {expenseSlips.reduce((sum, slip) => sum + (slip.amount || 0), 0).toFixed(2)}
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Step 5: Payment Request */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    5
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Payment Request</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Submit a payment request for the work completed on this job.
                </p>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  {/* Payment Type Selection */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Type *
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="hourly"
                          checked={paymentType === "hourly"}
                          onChange={(e) => setPaymentType(e.target.value as "hourly" | "daily")}
                          disabled={!signedJobCardUrl}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          Hourly
                        </span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="daily"
                          checked={paymentType === "daily"}
                          onChange={(e) => setPaymentType(e.target.value as "hourly" | "daily")}
                          disabled={!signedJobCardUrl}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          Daily
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Hours/Days Input */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {paymentType === "hourly" ? "Hours Worked *" : "Days Worked *"}
                    </label>
                    {paymentType === "hourly" ? (
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={hoursWorked}
                        onChange={(e) => setHoursWorked(e.target.value)}
                        placeholder="e.g., 8"
                        disabled={!signedJobCardUrl}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                      />
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={daysWorked}
                        onChange={(e) => setDaysWorked(e.target.value)}
                        placeholder="e.g., 1"
                        disabled={!signedJobCardUrl}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                      />
                    )}
                  </div>

                  {/* Rate Input */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {paymentType === "hourly" ? "Hourly Rate (R) *" : "Daily Rate (R) *"}
                    </label>
                    {paymentType === "hourly" ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={hourlyRateInput}
                        onChange={(e) => setHourlyRateInput(e.target.value)}
                        placeholder={currentUser?.hourlyRate?.toString() || "Enter rate"}
                        disabled={!signedJobCardUrl}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                      />
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={dailyRateInput}
                        onChange={(e) => setDailyRateInput(e.target.value)}
                        placeholder={currentUser?.dailyRate?.toString() || "Enter rate"}
                        disabled={!signedJobCardUrl}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                      />
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {paymentType === "hourly" 
                        ? `Your profile rate: R${currentUser?.hourlyRate || 0}/hr`
                        : `Your profile rate: R${currentUser?.dailyRate || 0}/day`
                      }
                    </p>
                  </div>

                  {/* Calculated Amount Display */}
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Payment Amount:</span>
                      <span className="text-xl font-bold text-blue-600">
                        R{calculatePaymentAmount().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {paymentType === "hourly" 
                        ? `${hoursWorked || 0} hours × R${parseFloat(hourlyRateInput) || 0}/hr`
                        : `${daysWorked || 0} days × R${parseFloat(dailyRateInput) || 0}/day`
                      }
                    </p>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="Add any additional notes about this payment request..."
                      rows={3}
                      disabled={!signedJobCardUrl}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> When you click "Complete Job", the system will:
                </p>
                <ul className="list-disc list-inside text-sm text-blue-700 mt-2 space-y-1">
                  <li>Save all job completion data</li>
                  <li>Submit your payment request</li>
                  <li>Generate a job card PDF with all photos and the customer's signature</li>
                  <li>Automatically download the job card for your records</li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setCompleteJobOrderId(null);
                    setAfterPictures([]);
                    setSignedJobCardUrl(null);
                    setClientRepName("");
                    setClientRepSignDate("");
                    setMaterialCost("");
                    setExpenseSlips([]);
                    setPaymentType("hourly");
                    setHoursWorked("");
                    setDaysWorked("");
                    setHourlyRateInput("");
                    setDailyRateInput("");
                    setPaymentNotes("");
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmCompleteJob}
                  disabled={
                    afterPictures.length < 3 ||
                    !signedJobCardUrl ||
                    expenseSlips.length === 0 ||
                    updateOrderStatusMutation.isPending ||
                    createPaymentRequestMutation.isPending ||
                    generateJobCardMutation.isPending
                  }
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {updateOrderStatusMutation.isPending || createPaymentRequestMutation.isPending || generateJobCardMutation.isPending
                    ? "Processing..." 
                    : "Complete Job & Generate Job Card"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Start Quotation Modal */}
      {startQuotationId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Start Quotation Work - Before Pictures</h2>
                <button
                  onClick={() => {
                    setStartQuotationId(null);
                    setQuotationBeforePictures([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                Please take at least 3 pictures of the work area before starting.
              </p>

              <PhotoUpload
                onPhotosUploaded={handleQuotationBeforePicturesUploaded}
                minimumPhotos={3}
                title="Before Pictures"
                description="Take pictures showing the current state of the work area"
                isPublic={false}
              />

              <div className="mt-6 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={() => {
                    setStartQuotationId(null);
                    setQuotationBeforePictures([]);
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmStartQuotation}
                  disabled={quotationBeforePictures.length < 3 || updateQuotationStatusMutation.isPending}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {updateQuotationStatusMutation.isPending ? "Starting..." : "Start Work"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete Quotation Modal */}
      {completeQuotationId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Complete Quotation Assessment</h2>
                <button
                  onClick={() => {
                    setCompleteQuotationId(null);
                    setQuotationMaterialCost("");
                    setQuotationExpenseSlips([]);
                    setQuotationLineItems([{ description: "", category: "Material", quantity: "", notes: "" }]);
                    setNumPeopleNeeded("1");
                    setEstimatedDuration("");
                    setDurationUnit("HOURLY");
                    setQuotationRateAmount("");
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                Assess the work needed and provide detailed information for the quotation.
              </p>

              {/* Step 1: Quotation Line Items - Scope of Work */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    1
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Scope of Work & Materials</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Detail the full scope of work and materials needed for this quotation.
                </p>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Line Items</span>
                    <button
                      type="button"
                      onClick={addQuotationLineItem}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + Add Item
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {quotationLineItems.map((item, index) => (
                      <div key={index} className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Description *
                            </label>
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateQuotationLineItem(index, "description", e.target.value)}
                              placeholder="e.g., Install new plumbing fixtures"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Category
                            </label>
                            <select
                              value={item.category}
                              onChange={(e) => updateQuotationLineItem(index, "category", e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="Material">Material</option>
                              <option value="Labour">Labour</option>
                              <option value="Equipment">Equipment</option>
                              <option value="Transport">Transport</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Quantity (Optional)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => updateQuotationLineItem(index, "quantity", e.target.value)}
                              placeholder="e.g., 5"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Notes (Optional)
                            </label>
                            <input
                              type="text"
                              value={item.notes}
                              onChange={(e) => updateQuotationLineItem(index, "notes", e.target.value)}
                              placeholder="Additional details"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                        
                        {quotationLineItems.length > 1 && (
                          <div className="mt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => removeQuotationLineItem(index)}
                              className="text-xs text-red-600 hover:text-red-700 font-medium"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 2: Upload Supplier Quotations */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    2
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Supplier Quotations</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Upload documents/pictures of quotations received from suppliers and categorize them.
                </p>
                
                <ExpenseSlipUpload
                  onSlipsUploaded={handleQuotationExpenseSlipsUploaded}
                  minimumSlips={1}
                  title="Supplier Quotations"
                  description="Upload and categorize each supplier quotation (materials, tools, transport, equipment, other)"
                  isPublic={false}
                />
                
                {quotationExpenseSlips.length > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-900">
                      Total Material Cost: R{calculateTotalMaterialCost().toFixed(2)}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      This will be automatically set as the company material cost
                    </p>
                  </div>
                )}
              </div>

              {/* Step 3: Labour Estimation */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    3
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Labour Estimation</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Specify the number of people, time required, and your rate for this work.
                </p>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Number of People *
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={numPeopleNeeded}
                        onChange={(e) => setNumPeopleNeeded(e.target.value)}
                        placeholder="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Estimated Duration *
                      </label>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={estimatedDuration}
                        onChange={(e) => setEstimatedDuration(e.target.value)}
                        placeholder="e.g., 8"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {durationUnit === "HOURLY" ? "Number of hours" : "Number of days"}
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rate Type *
                      </label>
                      <select
                        value={durationUnit}
                        onChange={(e) => setDurationUnit(e.target.value as "HOURLY" | "DAILY")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="HOURLY">Hourly</option>
                        <option value="DAILY">Daily</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rate Amount (R) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={quotationRateAmount}
                        onChange={(e) => setQuotationRateAmount(e.target.value)}
                        placeholder="e.g., 250.00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Your rate per {durationUnit === "HOURLY" ? "hour" : "day"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Rate Amount:</span>
                      <span className="font-medium text-gray-900">
                        R{(parseFloat(quotationRateAmount) || 0).toFixed(2)} / {durationUnit === "HOURLY" ? "hour" : "day"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">People × Duration × Rate:</span>
                      <span className="font-medium text-gray-900">
                        {numPeopleNeeded || 0} × {estimatedDuration || 0} × R{(parseFloat(quotationRateAmount) || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-base font-bold border-t pt-2">
                      <span className="text-gray-900">Estimated Total Labour Cost:</span>
                      <span className="text-blue-600">
                        R{calculateEstimatedLabourCost().toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      This will be automatically set as the company labour cost for admin review
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setCompleteQuotationId(null);
                    setQuotationMaterialCost("");
                    setQuotationExpenseSlips([]);
                    setQuotationLineItems([{ description: "", category: "Material", quantity: "", notes: "" }]);
                    setNumPeopleNeeded("1");
                    setEstimatedDuration("");
                    setDurationUnit("HOURLY");
                    setQuotationRateAmount("");
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmCompleteQuotation}
                  disabled={
                    quotationExpenseSlips.length === 0 ||
                    !numPeopleNeeded ||
                    !estimatedDuration ||
                    !quotationRateAmount ||
                    updateQuotationStatusMutation.isPending
                  }
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {updateQuotationStatusMutation.isPending ? "Submitting..." : "Submit for Review"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Notes Modal */}
      {editingNotesOrderId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <FileText className="h-6 w-6 mr-2 text-blue-600" />
                  Job Notes
                </h2>
                <button
                  onClick={() => {
                    setEditingNotesOrderId(null);
                    setNotesInput("");
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Add notes about job progress, issues encountered, materials needed, or any other relevant information.
              </p>

              <textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                rows={8}
                placeholder="Enter job notes here..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />

              <div className="mt-6 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={() => {
                    setEditingNotesOrderId(null);
                    setNotesInput("");
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNotes}
                  disabled={updateOrderNotesMutation.isPending}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {updateOrderNotesMutation.isPending ? "Saving..." : "Save Notes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review/Edit Job Modal */}
      {reviewJobOrderId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Review/Edit Completed Job</h2>
                <button
                  onClick={() => {
                    setReviewJobOrderId(null);
                    setReviewAfterPictures([]);
                    setReviewSignedJobCardUrl(null);
                    setReviewClientRepName("");
                    setReviewClientRepSignDate("");
                    setReviewMaterialCost("");
                    setReviewExpenseSlips([]);
                    setReviewPaymentRequestId(null);
                    setReviewPaymentType("hourly");
                    setReviewHoursWorked("");
                    setReviewDaysWorked("");
                    setReviewHourlyRateInput("");
                    setReviewDailyRateInput("");
                    setReviewPaymentNotes("");
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                Review and update the completed job details if any corrections are needed.
              </p>

              {/* Step 1: After Pictures */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    1
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">After Pictures</h3>
                </div>
                <PhotoUpload
                  onPhotosUploaded={handleReviewAfterPicturesUploaded}
                  minimumPhotos={3}
                  title="After Pictures"
                  description="Update pictures showing the completed work"
                  isPublic={false}
                />
              </div>

              {/* Step 2: Client Representative Information */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    2
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Client Representative Information</h3>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Representative Name *
                    </label>
                    <input
                      type="text"
                      value={reviewClientRepName}
                      onChange={(e) => setReviewClientRepName(e.target.value)}
                      placeholder="Enter full name of person signing"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date *
                    </label>
                    <input
                      type="datetime-local"
                      value={reviewClientRepSignDate}
                      onChange={(e) => setReviewClientRepSignDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Step 3: Customer Signature */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    3
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Customer Signature</h3>
                </div>
                <SignatureCapture
                  onSignatureCaptured={handleReviewSignatureCaptured}
                  label="Customer Signature"
                  description="Update the customer's signature if needed"
                />
              </div>

              {/* Step 4: Expense Documentation */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    4
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Expense Documentation</h3>
                </div>
                
                <div className="mb-4">
                  <ExpenseSlipUpload
                    onSlipsUploaded={handleReviewExpenseSlipsUploaded}
                    minimumSlips={1}
                    title="Expense Slips"
                    description="Update expense slips and categorize them"
                    isPublic={false}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Material Cost (R) - Optional if amounts specified above
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={reviewMaterialCost}
                    onChange={(e) => setReviewMaterialCost(e.target.value)}
                    placeholder="Leave blank to auto-calculate from slip amounts"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {reviewExpenseSlips.length > 0 && reviewExpenseSlips.some(s => s.amount) && (
                      <>
                        Calculated from slips: R
                        {reviewExpenseSlips.reduce((sum, slip) => sum + (slip.amount || 0), 0).toFixed(2)}
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Step 5: Payment Request Details */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    5
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Payment Request Details</h3>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  {/* Payment Type Selection */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Type *
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="hourly"
                          checked={reviewPaymentType === "hourly"}
                          onChange={(e) => setReviewPaymentType(e.target.value as "hourly" | "daily")}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          Hourly
                        </span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="daily"
                          checked={reviewPaymentType === "daily"}
                          onChange={(e) => setReviewPaymentType(e.target.value as "hourly" | "daily")}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          Daily
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Hours/Days Input */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {reviewPaymentType === "hourly" ? "Hours Worked" : "Days Worked"}
                    </label>
                    {reviewPaymentType === "hourly" ? (
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={reviewHoursWorked}
                        onChange={(e) => setReviewHoursWorked(e.target.value)}
                        placeholder="e.g., 8"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={reviewDaysWorked}
                        onChange={(e) => setReviewDaysWorked(e.target.value)}
                        placeholder="e.g., 1"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    )}
                  </div>

                  {/* Rate Input */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {reviewPaymentType === "hourly" ? "Hourly Rate (R)" : "Daily Rate (R)"}
                    </label>
                    {reviewPaymentType === "hourly" ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={reviewHourlyRateInput}
                        onChange={(e) => setReviewHourlyRateInput(e.target.value)}
                        placeholder={currentUser?.hourlyRate?.toString() || "Enter rate"}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={reviewDailyRateInput}
                        onChange={(e) => setReviewDailyRateInput(e.target.value)}
                        placeholder={currentUser?.dailyRate?.toString() || "Enter rate"}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    )}
                  </div>

                  {/* Calculated Amount Display */}
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Payment Amount:</span>
                      <span className="text-xl font-bold text-blue-600">
                        R{calculateReviewPaymentAmount().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={reviewPaymentNotes}
                      onChange={(e) => setReviewPaymentNotes(e.target.value)}
                      placeholder="Add any additional notes..."
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setReviewJobOrderId(null);
                    setReviewAfterPictures([]);
                    setReviewSignedJobCardUrl(null);
                    setReviewClientRepName("");
                    setReviewClientRepSignDate("");
                    setReviewMaterialCost("");
                    setReviewExpenseSlips([]);
                    setReviewPaymentRequestId(null);
                    setReviewPaymentType("hourly");
                    setReviewHoursWorked("");
                    setReviewDaysWorked("");
                    setReviewHourlyRateInput("");
                    setReviewDailyRateInput("");
                    setReviewPaymentNotes("");
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReviewJob}
                  disabled={
                    reviewAfterPictures.length < 3 ||
                    !reviewSignedJobCardUrl ||
                    reviewExpenseSlips.length === 0 ||
                    updateCompletedOrderMutation.isPending
                  }
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {updateCompletedOrderMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Start Milestone Modal */}
      {startMilestoneId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Start Milestone</h2>
                <button
                  onClick={() => setStartMilestoneId(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                Are you ready to start working on this milestone? This will mark it as in progress and record the start time.
              </p>

              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={() => setStartMilestoneId(null)}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmStartMilestone}
                  disabled={updateMilestoneStatusMutation.isPending}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {updateMilestoneStatusMutation.isPending ? "Starting..." : "Start Milestone"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete Milestone Modal */}
      {completeMilestoneId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Complete Milestone</h2>
                <button
                  onClick={() => {
                    setCompleteMilestoneId(null);
                    setMilestoneExpenseSlips([]);
                    setMilestonePaymentType("hourly");
                    setMilestoneHoursWorked("");
                    setMilestoneDaysWorked("");
                    setMilestoneHourlyRateInput("");
                    setMilestoneDailyRateInput("");
                    setMilestonePaymentNotes("");
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Step 1: Upload Expense Documentation */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    1
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Expense Documentation</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Upload expense slips and categorize them (materials, tools, transportation, etc.)
                </p>
                
                <ExpenseSlipUpload
                  onSlipsUploaded={handleMilestoneExpenseSlipsUploaded}
                  minimumSlips={1}
                  title="Expense Slips"
                  description="Upload and categorize each expense slip for this milestone"
                  isPublic={false}
                />
              </div>

              {/* Step 2: Payment Request */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    2
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Payment Request</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Submit a payment request for the work completed on this milestone.
                </p>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  {/* Payment Type Selection */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Type *
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="hourly"
                          checked={milestonePaymentType === "hourly"}
                          onChange={(e) => setMilestonePaymentType(e.target.value as "hourly" | "daily")}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          Hourly
                        </span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="daily"
                          checked={milestonePaymentType === "daily"}
                          onChange={(e) => setMilestonePaymentType(e.target.value as "hourly" | "daily")}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          Daily
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Hours/Days Input */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {milestonePaymentType === "hourly" ? "Hours Worked *" : "Days Worked *"}
                    </label>
                    {milestonePaymentType === "hourly" ? (
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={milestoneHoursWorked}
                        onChange={(e) => setMilestoneHoursWorked(e.target.value)}
                        placeholder="e.g., 8"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={milestoneDaysWorked}
                        onChange={(e) => setMilestoneDaysWorked(e.target.value)}
                        placeholder="e.g., 1"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    )}
                  </div>

                  {/* Rate Input */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {milestonePaymentType === "hourly" ? "Hourly Rate (R) *" : "Daily Rate (R) *"}
                    </label>
                    {milestonePaymentType === "hourly" ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={milestoneHourlyRateInput}
                        onChange={(e) => setMilestoneHourlyRateInput(e.target.value)}
                        placeholder={currentUser?.hourlyRate?.toString() || "Enter rate"}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={milestoneDailyRateInput}
                        onChange={(e) => setMilestoneDailyRateInput(e.target.value)}
                        placeholder={currentUser?.dailyRate?.toString() || "Enter rate"}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {milestonePaymentType === "hourly" 
                        ? `Your profile rate: R${currentUser?.hourlyRate || 0}/hr`
                        : `Your profile rate: R${currentUser?.dailyRate || 0}/day`
                      }
                    </p>
                  </div>

                  {/* Calculated Amount Display */}
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Payment Amount:</span>
                      <span className="text-xl font-bold text-blue-600">
                        R{calculateMilestonePaymentAmount().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {milestonePaymentType === "hourly" 
                        ? `${milestoneHoursWorked || 0} hours × R${parseFloat(milestoneHourlyRateInput) || 0}/hr`
                        : `${milestoneDaysWorked || 0} days × R${parseFloat(milestoneDailyRateInput) || 0}/day`
                      }
                    </p>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={milestonePaymentNotes}
                      onChange={(e) => setMilestonePaymentNotes(e.target.value)}
                      placeholder="Add any additional notes about this payment request..."
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setCompleteMilestoneId(null);
                    setMilestoneExpenseSlips([]);
                    setMilestonePaymentType("hourly");
                    setMilestoneHoursWorked("");
                    setMilestoneDaysWorked("");
                    setMilestoneHourlyRateInput("");
                    setMilestoneDailyRateInput("");
                    setMilestonePaymentNotes("");
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmCompleteMilestone}
                  disabled={
                    milestoneExpenseSlips.length === 0 ||
                    updateMilestoneStatusMutation.isPending ||
                    createMilestonePaymentRequestMutation.isPending
                  }
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {updateMilestoneStatusMutation.isPending || createMilestonePaymentRequestMutation.isPending
                    ? "Processing..." 
                    : "Complete Milestone"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Milestone Notes Modal */}
      {editingMilestoneNotesId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <FileText className="h-6 w-6 mr-2 text-blue-600" />
                  Milestone Notes
                </h2>
                <button
                  onClick={() => {
                    setEditingMilestoneNotesId(null);
                    setMilestoneNotesInput("");
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Add notes about milestone progress, issues encountered, materials needed, or any other relevant information.
              </p>

              <textarea
                value={milestoneNotesInput}
                onChange={(e) => setMilestoneNotesInput(e.target.value)}
                rows={8}
                placeholder="Enter milestone notes here..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />

              <div className="mt-6 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={() => {
                    setEditingMilestoneNotesId(null);
                    setMilestoneNotesInput("");
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMilestoneNotes}
                  disabled={updateMilestoneNotesMutation.isPending}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {updateMilestoneNotesMutation.isPending ? "Saving..." : "Save Notes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Progress Modal */}
      {updateProgressMilestoneId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <TrendingUp className="h-6 w-6 mr-2 text-blue-600" />
                  Update Progress & Weekly Report
                </h2>
                <button
                  onClick={() => {
                    setUpdateProgressMilestoneId(null);
                    setProgressPercentageInput("");
                    setProgressWorkDone("");
                    setProgressChallenges("");
                    setProgressSuccesses("");
                    setProgressImagesDone([]);
                    setProgressItemizedExpenses([]);
                    setProgressNextWeekPlan("");
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                Provide a comprehensive update on the milestone progress, including work completed, challenges faced, and expenses incurred.
              </p>

              {/* Step 1: Progress Percentage */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    1
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Progress Percentage</h3>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Progress (0-100%) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={progressPercentageInput}
                    onChange={(e) => setProgressPercentageInput(e.target.value)}
                    placeholder="e.g., 75"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Step 2: Work Done */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    2
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Work Completed</h3>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Describe the work completed this week
                  </label>
                  <textarea
                    value={progressWorkDone}
                    onChange={(e) => setProgressWorkDone(e.target.value)}
                    placeholder="Detail what work was accomplished during this period..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Step 3: Progress Images */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    3
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Progress Photos</h3>
                </div>
                <PhotoUpload
                  onPhotosUploaded={handleProgressImagesUploaded}
                  minimumPhotos={0}
                  title="Progress Images"
                  description="Upload photos showing the work completed (optional)"
                  isPublic={false}
                />
              </div>

              {/* Step 4: Itemized Expenses */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    4
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Itemized Expenses</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Track expenses with quoted vs actual amounts. Provide reasons for any overspending.
                </p>
                <ItemizedExpenseTracker
                  expenses={progressItemizedExpenses}
                  onExpensesChange={setProgressItemizedExpenses}
                />
              </div>

              {/* Step 5: Challenges */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    5
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Challenges Faced</h3>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Describe any challenges or issues encountered
                  </label>
                  <textarea
                    value={progressChallenges}
                    onChange={(e) => setProgressChallenges(e.target.value)}
                    placeholder="List any obstacles, delays, or problems that arose..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Step 6: Successes */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    6
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Successes & Achievements</h3>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Highlight any successes or milestones achieved
                  </label>
                  <textarea
                    value={progressSuccesses}
                    onChange={(e) => setProgressSuccesses(e.target.value)}
                    placeholder="Note any accomplishments, completed tasks, or positive outcomes..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Step 7: Next Week Plan */}
              <div className="mb-6">
                <div className="flex items-center mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold text-sm mr-3">
                    7
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Plan for Next Week</h3>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Outline the planned work for the upcoming week
                  </label>
                  <textarea
                    value={progressNextWeekPlan}
                    onChange={(e) => setProgressNextWeekPlan(e.target.value)}
                    placeholder="Describe what work is planned for the next period..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This comprehensive report will be saved as a weekly budget update and will help track the milestone's progress and costs over time.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setUpdateProgressMilestoneId(null);
                    setProgressPercentageInput("");
                    setProgressWorkDone("");
                    setProgressChallenges("");
                    setProgressSuccesses("");
                    setProgressImagesDone([]);
                    setProgressItemizedExpenses([]);
                    setProgressNextWeekPlan("");
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProgress}
                  disabled={updateMilestoneProgressMutation.isPending}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {updateMilestoneProgressMutation.isPending ? "Updating..." : "Save Progress Report"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Supplier Quotation Modal */}
      {uploadQuotationMilestoneId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <Upload className="h-6 w-6 mr-2 text-blue-600" />
                  Upload Supplier Quotation
                </h2>
                <button
                  onClick={() => {
                    setUploadQuotationMilestoneId(null);
                    setQuotationFile(null);
                    if (quotationPreviewUrl) {
                      URL.revokeObjectURL(quotationPreviewUrl);
                    }
                    setQuotationPreviewUrl(null);
                    setQuotationSupplierName("");
                    setQuotationAmount("");
                    setQuotationDescription("");
                    setQuotationCategory("MATERIALS");
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                Upload a quotation or invoice from a supplier for materials, equipment, or services needed for this milestone.
              </p>

              {/* File Upload */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select File *
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleQuotationFileSelect}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Preview */}
              {quotationFile && (
                <div className="mb-4">
                  {quotationPreviewUrl ? (
                    <img
                      src={quotationPreviewUrl}
                      alt="Quotation preview"
                      className="w-full h-48 object-contain rounded-lg border border-gray-200 bg-gray-50"
                    />
                  ) : (
                    <div className="w-full h-48 flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200">
                      <div className="text-center">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">{quotationFile.name}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Metadata */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Supplier Name
                  </label>
                  <input
                    type="text"
                    value={quotationSupplierName}
                    onChange={(e) => setQuotationSupplierName(e.target.value)}
                    placeholder="e.g., ABC Building Supplies"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={quotationCategory}
                    onChange={(e) => setQuotationCategory(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="MATERIALS">Materials</option>
                    <option value="LABOUR">Labour</option>
                    <option value="EQUIPMENT">Equipment</option>
                    <option value="TRANSPORT">Transport</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount (R)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={quotationAmount}
                    onChange={(e) => setQuotationAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={quotationDescription}
                    onChange={(e) => setQuotationDescription(e.target.value)}
                    placeholder="Brief description of what this quotation is for..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={() => {
                    setUploadQuotationMilestoneId(null);
                    setQuotationFile(null);
                    if (quotationPreviewUrl) {
                      URL.revokeObjectURL(quotationPreviewUrl);
                    }
                    setQuotationPreviewUrl(null);
                    setQuotationSupplierName("");
                    setQuotationAmount("");
                    setQuotationDescription("");
                    setQuotationCategory("MATERIALS");
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmUploadQuotation}
                  disabled={!quotationFile || uploadMilestoneSupplierQuotationMutation.isPending || getPresignedUrlMutation.isPending}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {uploadMilestoneSupplierQuotationMutation.isPending || getPresignedUrlMutation.isPending
                    ? "Uploading..."
                    : "Upload Quotation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Support Chat Widget */}
      <SupportChatWidget />
    </div>
  );
}
