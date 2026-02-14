import {
  createCallerFactory,
  createTRPCRouter,
} from "~/server/trpc/main";
import { login } from "~/server/trpc/procedures/login";
import { register } from "~/server/trpc/procedures/register";
import { getCurrentUser } from "~/server/trpc/procedures/getCurrentUser";
import { getUserPermissions } from "~/server/trpc/procedures/getUserPermissions";
import { setupUserEmail } from "~/server/trpc/procedures/setupUserEmail";
import { getUserEmailStatus } from "~/server/trpc/procedures/getUserEmailStatus";
import { testUserEmailConnection } from "~/server/trpc/procedures/testUserEmailConnection";
import { disconnectUserEmail } from "~/server/trpc/procedures/disconnectUserEmail";
import { createLead } from "~/server/trpc/procedures/createLead";
import { getLeads } from "~/server/trpc/procedures/getLeads";
import { updateLeadStatus } from "~/server/trpc/procedures/updateLeadStatus";
import { updateLeadDetails } from "~/server/trpc/procedures/updateLeadDetails";
import { getSalesPerformance } from "~/server/trpc/procedures/getSalesPerformance";
import { getEmployeeSalesPerformance } from "~/server/trpc/procedures/getEmployeeSalesPerformance";
import { createCampaign } from "~/server/trpc/procedures/createCampaign";
import { getCampaigns } from "~/server/trpc/procedures/getCampaigns";
import { updateCampaign } from "~/server/trpc/procedures/updateCampaign";
import { sendCampaign } from "~/server/trpc/procedures/sendCampaign";
import { deleteCampaign } from "~/server/trpc/procedures/deleteCampaign";
import { createOrder } from "~/server/trpc/procedures/createOrder";
import { getOrders } from "~/server/trpc/procedures/getOrders";
import { updateOrderStatus } from "~/server/trpc/procedures/updateOrderStatus";
import { updateCompletedOrderDetails } from "~/server/trpc/procedures/updateCompletedOrderDetails";
import { pauseJob } from "~/server/trpc/procedures/pauseJob";
import { resumeJob } from "~/server/trpc/procedures/resumeJob";
import { updateOrderDetails } from "~/server/trpc/procedures/updateOrderDetails";
import { updateOrderNotes } from "~/server/trpc/procedures/updateOrderNotes";
import { getMinioBaseUrl } from "~/server/trpc/procedures/getMinioBaseUrl";
import { getPresignedUploadUrl } from "~/server/trpc/procedures/getPresignedUploadUrl";
import { getPresignedDownloadUrl } from "~/server/trpc/procedures/getPresignedDownloadUrl";
import { getArtisans } from "~/server/trpc/procedures/getArtisans";
import { getAdmins } from "~/server/trpc/procedures/getAdmins";
import { getProjects } from "~/server/trpc/procedures/getProjects";
import { createProject } from "~/server/trpc/procedures/createProject";
import { updateProjectDetails } from "~/server/trpc/procedures/updateProjectDetails";
import { updateProjectStatus } from "~/server/trpc/procedures/updateProjectStatus";
import { getComprehensiveProjectReport } from "~/server/trpc/procedures/getComprehensiveProjectReport";
import { getQuotations } from "~/server/trpc/procedures/getQuotations";
import { createQuotation } from "~/server/trpc/procedures/createQuotation";
import { createQuotationFromPMRFQ } from "~/server/trpc/procedures/createQuotationFromPMRFQ";
import { updateQuotationStatus } from "~/server/trpc/procedures/updateQuotationStatus";
import { updateQuotationDetails } from "~/server/trpc/procedures/updateQuotationDetails";
import { deleteQuotation } from "~/server/trpc/procedures/deleteQuotation";
import { getInvoices } from "~/server/trpc/procedures/getInvoices";
import { createInvoice } from "~/server/trpc/procedures/createInvoice";
import { updateInvoiceStatus } from "~/server/trpc/procedures/updateInvoiceStatus";
import { updateInvoiceDetails } from "~/server/trpc/procedures/updateInvoiceDetails";
import { generateStatement } from "~/server/trpc/procedures/generateStatement";
import { submitCustomerPayment } from "~/server/trpc/procedures/submitCustomerPayment";
import { createCustomerPayfastCheckout } from "~/server/trpc/procedures/createCustomerPayfastCheckout";
import { setMyInvoiceDisputeStatus } from "~/server/trpc/procedures/setMyInvoiceDisputeStatus";
import { getCustomerPayments } from "~/server/trpc/procedures/getCustomerPayments";
import { getPropertyManagerPayments } from "~/server/trpc/procedures/getPropertyManagerPayments";
import { approveCustomerPayment } from "~/server/trpc/procedures/approveCustomerPayment";
import { rejectCustomerPayment } from "~/server/trpc/procedures/rejectCustomerPayment";
import { getPublicPaymentGatewayStatus } from "~/server/trpc/procedures/getPublicPaymentGatewayStatus";
import { getStatements } from "~/server/trpc/procedures/getStatements";
import { generateStatementPdf } from "~/server/trpc/procedures/generateStatementPdf";
import { updateStatementDetails } from "~/server/trpc/procedures/updateStatementDetails";
import { generateManagedCustomerStatements } from "~/server/trpc/procedures/generateManagedCustomerStatements";
import { sendStatementEmail } from "~/server/trpc/procedures/sendStatementEmail";
import { markStatementViewed } from "~/server/trpc/procedures/markStatementViewed";
import { getCustomerDetailsByEmail } from "~/server/trpc/procedures/getCustomerDetailsByEmail";
import { getAssets } from "~/server/trpc/procedures/getAssets";
import { createAsset } from "~/server/trpc/procedures/createAsset";
import { updateAsset } from "~/server/trpc/procedures/updateAsset";
import { getOperationalExpenses } from "~/server/trpc/procedures/getOperationalExpenses";
import { createOperationalExpense } from "~/server/trpc/procedures/createOperationalExpense";
import { updateOperationalExpense } from "~/server/trpc/procedures/updateOperationalExpense";
import { approveOperationalExpense } from "~/server/trpc/procedures/approveOperationalExpense";
import { getAlternativeRevenues } from "~/server/trpc/procedures/getAlternativeRevenues";
import { createAlternativeRevenue } from "~/server/trpc/procedures/createAlternativeRevenue";
import { updateAlternativeRevenue } from "~/server/trpc/procedures/updateAlternativeRevenue";
import { approveAlternativeRevenue } from "~/server/trpc/procedures/approveAlternativeRevenue";
import { getPaymentRequests } from "~/server/trpc/procedures/getPaymentRequests";
import { createPaymentRequest } from "~/server/trpc/procedures/createPaymentRequest";
import { updatePaymentRequestStatus } from "~/server/trpc/procedures/updatePaymentRequestStatus";
import { getConversations } from "~/server/trpc/procedures/getConversations";
import { getMessages } from "~/server/trpc/procedures/getMessages";
import { sendMessage } from "~/server/trpc/procedures/sendMessage";
import { markMessagesAsRead } from "~/server/trpc/procedures/markMessagesAsRead";
import { createConversation } from "~/server/trpc/procedures/createConversation";
import { messagesSubscription } from "~/server/trpc/procedures/messagesSubscription";
import { sendLeadEmail } from "~/server/trpc/procedures/sendLeadEmail";
import { sendBulkLeadEmail } from "~/server/trpc/procedures/sendBulkLeadEmail";
import { createNotification } from "~/server/trpc/procedures/createNotification";
import { getNotifications } from "~/server/trpc/procedures/getNotifications";
import { getUnreadNotificationCount } from "~/server/trpc/procedures/getUnreadNotificationCount";
import { markNotificationAsRead } from "~/server/trpc/procedures/markNotificationAsRead";
import { markAllNotificationsAsRead } from "~/server/trpc/procedures/markAllNotificationsAsRead";
import { notificationsSubscription } from "~/server/trpc/procedures/notificationsSubscription";
import { getUserNotificationPreferences } from "~/server/trpc/procedures/getUserNotificationPreferences";
import { updateUserNotificationPreferences } from "~/server/trpc/procedures/updateUserNotificationPreferences";
import { subscribeToPush } from "~/server/trpc/procedures/subscribeToPush";
import { unsubscribeFromPush } from "~/server/trpc/procedures/unsubscribeFromPush";
import { getVapidPublicKey } from "~/server/trpc/procedures/getVapidPublicKey";
import { generateOrderPdf } from "~/server/trpc/procedures/generateOrderPdf";
import { generateJobCardPdf } from "~/server/trpc/procedures/generateJobCardPdf";
import { generateQuotationPdf } from "~/server/trpc/procedures/generateQuotationPdf";
import { getQuotationsForRFQComparison } from "~/server/trpc/procedures/getQuotationsForRFQComparison";
import { selectQuotationForRFQ } from "~/server/trpc/procedures/selectQuotationForRFQ";
import { getPropertyManagerQuotationPdfCopies } from "~/server/trpc/procedures/getPropertyManagerQuotationPdfCopies";
import { downloadPropertyManagerQuotationPdfCopy } from "~/server/trpc/procedures/downloadPropertyManagerQuotationPdfCopy";
import { deletePropertyManagerQuotationPdfCopy } from "~/server/trpc/procedures/deletePropertyManagerQuotationPdfCopy";
import { generateRFQReportPdf } from "~/server/trpc/procedures/generateRFQReportPdf";
import { generateInvoicePdf } from "~/server/trpc/procedures/generateInvoicePdf";
import { generatePropertyManagerOrderPdfProcedure } from "~/server/trpc/procedures/generatePropertyManagerOrderPdf";
import { generatePropertyManagerInvoicePdf } from "~/server/trpc/procedures/generatePropertyManagerInvoicePdf";
import { generatePropertyManagerRFQPdfProcedure } from "~/server/trpc/procedures/generatePropertyManagerRFQPdf";
import { uploadOrderDocuments } from "~/server/trpc/procedures/uploadOrderDocuments";
import { getArtisanPerformanceMetrics } from "~/server/trpc/procedures/getArtisanPerformanceMetrics";
import { uploadCompanyLogo } from "~/server/trpc/procedures/uploadCompanyLogo";
import { deleteCompanyLogo } from "~/server/trpc/procedures/deleteCompanyLogo";
import { getCompanyLogoUrl } from "~/server/trpc/procedures/getCompanyLogoUrl";
import { getCompanyDetails } from "~/server/trpc/procedures/getCompanyDetails";
import { updateCompanyDetails } from "~/server/trpc/procedures/updateCompanyDetails";
import { getPropertyManagerCompanyDetails } from "~/server/trpc/procedures/getPropertyManagerCompanyDetails";
import { updatePropertyManagerCompanyDetails } from "~/server/trpc/procedures/updatePropertyManagerCompanyDetails";
import { getPropertyManagerBranding } from "~/server/trpc/procedures/getPropertyManagerBranding";
import { updatePropertyManagerBranding } from "~/server/trpc/procedures/updatePropertyManagerBranding";
import { getContractorBranding } from "~/server/trpc/procedures/getContractorBranding";
import { updateContractorBranding } from "~/server/trpc/procedures/updateContractorBranding";
import { updateContractorCompanyDetails } from "~/server/trpc/procedures/updateContractorCompanyDetails";
import { generateFinancialReport } from "~/server/trpc/procedures/generateFinancialReport";
import { getFinancialReports } from "~/server/trpc/procedures/getFinancialReports";
import { getFinancialReportById } from "~/server/trpc/procedures/getFinancialReportById";
import { suggestExpenseCategory } from "~/server/trpc/procedures/suggestExpenseCategory";
import { updateProjectActualCost } from "~/server/trpc/procedures/updateProjectActualCost";
import { scoreLeadWithAI } from "~/server/trpc/procedures/scoreLeadWithAI";
import { classifyServiceType } from "~/server/trpc/procedures/classifyServiceType";
import { generateQuotationLineItems } from "~/server/trpc/procedures/generateQuotationLineItems";
import { suggestArtisanForJob } from "~/server/trpc/procedures/suggestArtisanForJob";
import { sendAgentMessage } from "~/server/trpc/procedures/sendAgentMessage";
import { aiAgent } from "~/server/trpc/procedures/aiAgent";
import { getOrCreateAIAgentConversation } from "~/server/trpc/procedures/getOrCreateAIAgentConversation";
import { clearAIAgentConversation } from "~/server/trpc/procedures/clearAIAgentConversation";
import { generateEmailContent } from "~/server/trpc/procedures/generateEmailContent";
import { generateProjectSummary } from "~/server/trpc/procedures/generateProjectSummary";
import { extractActionItems } from "~/server/trpc/procedures/extractActionItems";
import { analyzeProjectRisks } from "~/server/trpc/procedures/analyzeProjectRisks";
import { generateInvoiceDescription } from "~/server/trpc/procedures/generateInvoiceDescription";
import { createReview } from "~/server/trpc/procedures/createReview";
import { getArtisanReviews } from "~/server/trpc/procedures/getArtisanReviews";
import { createLiability } from "~/server/trpc/procedures/createLiability";
import { getLiabilities } from "~/server/trpc/procedures/getLiabilities";
import { updateLiability } from "~/server/trpc/procedures/updateLiability";
import { captureMetricSnapshot } from "~/server/trpc/procedures/captureMetricSnapshot";
import { getMetricSnapshots } from "~/server/trpc/procedures/getMetricSnapshots";
import { getCustomers } from "~/server/trpc/procedures/getCustomers";
import { getProjectTypes } from "~/server/trpc/procedures/getProjectTypes";
import { saveDashboardConfig } from "~/server/trpc/procedures/saveDashboardConfig";
import { getDashboardConfig } from "~/server/trpc/procedures/getDashboardConfig";
import { getRevenueAnalytics } from "~/server/trpc/procedures/getRevenueAnalytics";
import { getServiceAnalytics } from "~/server/trpc/procedures/getServiceAnalytics";
import { getCustomerAnalytics } from "~/server/trpc/procedures/getCustomerAnalytics";
import { getProfitAnalytics } from "~/server/trpc/procedures/getProfitAnalytics";
import { createMilestone } from "~/server/trpc/procedures/createMilestone";
import { updateMilestone } from "~/server/trpc/procedures/updateMilestone";
import { getMilestonesByProject } from "~/server/trpc/procedures/getMilestonesByProject";
import { uploadMilestoneSupplierQuotation } from "~/server/trpc/procedures/uploadMilestoneSupplierQuotation";
import { deleteMilestoneSupplierQuotation } from "~/server/trpc/procedures/deleteMilestoneSupplierQuotation";
import { createWeeklyBudgetUpdate } from "~/server/trpc/procedures/createWeeklyBudgetUpdate";
import { getWeeklyBudgetUpdates } from "~/server/trpc/procedures/getWeeklyBudgetUpdates";
import { createMilestonePaymentRequest } from "~/server/trpc/procedures/createMilestonePaymentRequest";
import { createMilestoneRisk } from "~/server/trpc/procedures/createMilestoneRisk";
import { updateMilestoneRisk } from "~/server/trpc/procedures/updateMilestoneRisk";
import { deleteMilestoneRisk } from "~/server/trpc/procedures/deleteMilestoneRisk";
import { createChangeOrder } from "~/server/trpc/procedures/createChangeOrder";
import { createMilestoneDependency } from "~/server/trpc/procedures/createMilestoneDependency";
import { pauseMilestone } from "~/server/trpc/procedures/pauseMilestone";
import { resumeMilestone } from "~/server/trpc/procedures/resumeMilestone";
import { updateMilestoneStatus } from "~/server/trpc/procedures/updateMilestoneStatus";
import { getMilestonesForArtisan } from "~/server/trpc/procedures/getMilestonesForArtisan";
import { generateWeeklyUpdatePdf } from "~/server/trpc/procedures/generateWeeklyUpdatePdf";
import { generateProjectReportPdf } from "~/server/trpc/procedures/generateProjectReportPdf";
import { generateMilestoneReportPdf } from "~/server/trpc/procedures/generateMilestoneReportPdf";
import { sendTestEmail } from "~/server/trpc/procedures/sendTestEmail";
import { sendTestStatementEmail } from "~/server/trpc/procedures/sendTestStatementEmail";
import { sendTestInvoiceEmail } from "~/server/trpc/procedures/sendTestInvoiceEmail";
import { sendTestOrderNotificationEmail } from "~/server/trpc/procedures/sendTestOrderNotificationEmail";
import { getEmployees } from "~/server/trpc/procedures/getEmployees";
import { getDistinctRoles } from "~/server/trpc/procedures/getDistinctRoles";
import { createEmployee } from "~/server/trpc/procedures/createEmployee";
import { updateEmployeeDetails } from "~/server/trpc/procedures/updateEmployeeDetails";
import { uploadHRDocument } from "~/server/trpc/procedures/uploadHRDocument";
import { getHRDocuments } from "~/server/trpc/procedures/getHRDocuments";
import { deleteHRDocument } from "~/server/trpc/procedures/deleteHRDocument";
import { deleteEmployee } from "~/server/trpc/procedures/deleteEmployee";
import { createEmployeeKPI } from "~/server/trpc/procedures/createEmployeeKPI";
import { updateEmployeeKPI } from "~/server/trpc/procedures/updateEmployeeKPI";
import { getEmployeeKPIs } from "~/server/trpc/procedures/getEmployeeKPIs";
import { createLeaveRequest } from "~/server/trpc/procedures/createLeaveRequest";
import { updateLeaveRequestStatus } from "~/server/trpc/procedures/updateLeaveRequestStatus";
import { getLeaveRequests } from "~/server/trpc/procedures/getLeaveRequests";
import { getEmployeePerformanceHistory } from "~/server/trpc/procedures/getEmployeePerformanceHistory";
import { getLeadsForEmployee } from "~/server/trpc/procedures/getLeadsForEmployee";
import { generateCoachingRecommendation } from "~/server/trpc/procedures/generateCoachingRecommendation";
import { createPerformanceReview } from "~/server/trpc/procedures/createPerformanceReview";
import { updatePerformanceReview } from "~/server/trpc/procedures/updatePerformanceReview";
import { getPerformanceReviews } from "~/server/trpc/procedures/getPerformanceReviews";
import { getRolePermissionConfig } from "~/server/trpc/procedures/getRolePermissionConfig";
import { updateRolePermissionConfig } from "~/server/trpc/procedures/updateRolePermissionConfig";
import { resetRolePermissionConfig } from "~/server/trpc/procedures/resetRolePermissionConfig";
import { getCustomRolesProc } from "~/server/trpc/procedures/getCustomRoles";
import { createCustomRole } from "~/server/trpc/procedures/createCustomRole";
import { updateCustomRole } from "~/server/trpc/procedures/updateCustomRole";
import { deleteCustomRole } from "~/server/trpc/procedures/deleteCustomRole";
import { getPayslips } from "~/server/trpc/procedures/getPayslips";
import { createPayslip } from "~/server/trpc/procedures/createPayslip";
import { createBulkPayslips } from "~/server/trpc/procedures/createBulkPayslips";
import { updatePayslip } from "~/server/trpc/procedures/updatePayslip";
import { generatePayslipPdf } from "~/server/trpc/procedures/generatePayslipPdf";
import { getHRFinancialMetrics } from "~/server/trpc/procedures/getHRFinancialMetrics";
import { createPropertyManagerRFQ } from "~/server/trpc/procedures/createPropertyManagerRFQ";
import { getPropertyManagerRFQs } from "~/server/trpc/procedures/getPropertyManagerRFQs";
import { getPropertyManagerRFQsForAdmin } from "~/server/trpc/procedures/getPropertyManagerRFQsForAdmin";
import { updatePropertyManagerRFQStatus } from "~/server/trpc/procedures/updatePropertyManagerRFQStatus";
import { updatePropertyManagerRFQ } from "~/server/trpc/procedures/updatePropertyManagerRFQ";
import { createPropertyManagerOrder } from "~/server/trpc/procedures/createPropertyManagerOrder";
import { getPropertyManagerOrders } from "~/server/trpc/procedures/getPropertyManagerOrders";
import { acceptPMOrder } from "~/server/trpc/procedures/acceptPMOrder";
import { updatePropertyManagerOrder } from "~/server/trpc/procedures/updatePropertyManagerOrder";
import { getPropertyManagerInvoices } from "~/server/trpc/procedures/getPropertyManagerInvoices";
import { updatePropertyManagerInvoiceStatus } from "~/server/trpc/procedures/updatePropertyManagerInvoiceStatus";
import { updateContractorPMInvoiceStatus } from "~/server/trpc/procedures/updateContractorPMInvoiceStatus";
import { updatePropertyManagerOrderStatus } from "~/server/trpc/procedures/updatePropertyManagerOrderStatus";
import { getMaintenanceRequests } from "~/server/trpc/procedures/getMaintenanceRequests";
import { createMaintenanceRequest } from "~/server/trpc/procedures/createMaintenanceRequest";
import { updateMaintenanceRequestStatus } from "~/server/trpc/procedures/updateMaintenanceRequestStatus";
import { submitMaintenanceRequest } from "~/server/trpc/procedures/submitMaintenanceRequest";
import {
  getReceivedMaintenanceRequests,
  approveMaintenanceRequest,
  rejectMaintenanceRequest,
} from "~/server/trpc/procedures/maintenanceApprovalWorkflow";
import {
  convertMaintenanceToRFQ,
  convertMaintenanceToOrder,
} from "~/server/trpc/procedures/maintenanceConversion";
import { getBuildings } from "~/server/trpc/procedures/getBuildings";
import { createBuilding } from "~/server/trpc/procedures/createBuilding";
import { createBuildingBudget } from "~/server/trpc/procedures/createBuildingBudget";
import { getBuildingBudgets } from "~/server/trpc/procedures/getBuildingBudgets";
import { updateBuildingBudget } from "~/server/trpc/procedures/updateBuildingBudget";
import { createBudgetExpense } from "~/server/trpc/procedures/createBudgetExpense";
import { createBuildingMaintenanceSchedule } from "~/server/trpc/procedures/createBuildingMaintenanceSchedule";
import { getBuildingMaintenanceSchedules } from "~/server/trpc/procedures/getBuildingMaintenanceSchedules";

// Tenant Management
import { getBuildings as getBuildingsForOnboarding } from "~/server/trpc/routers/property-manager/getBuildings";
import { addTenant } from "~/server/trpc/routers/property-manager/addTenant";
import { submitTenantOnboarding } from "~/server/trpc/routers/property-manager/submitTenantOnboarding";
import { getPendingOnboardings } from "~/server/trpc/routers/property-manager/getPendingOnboardings";
import { approveTenantOnboarding } from "~/server/trpc/routers/property-manager/approveTenantOnboarding";
import { rejectTenantOnboarding } from "~/server/trpc/routers/property-manager/rejectTenantOnboarding";
import { getTenantsOverview } from "~/server/trpc/routers/property-manager/getTenantsOverview";
import { getTenantDetails } from "~/server/trpc/routers/property-manager/getTenantDetails";
import { getTenantMaintenanceRequests } from "~/server/trpc/routers/property-manager/getTenantMaintenanceRequests";
import { recordRentPayment } from "~/server/trpc/routers/property-manager/recordRentPayment";
import { getTenantRentHistory } from "~/server/trpc/routers/property-manager/getTenantRentHistory";
import { getTenantRentInvoiceTracking } from "~/server/trpc/routers/property-manager/getTenantRentInvoiceTracking";
import { getTenantInvoicesIssued } from "~/server/trpc/routers/property-manager/getTenantInvoicesIssued";
import { setTenantInvoiceDisputeStatus } from "~/server/trpc/routers/property-manager/setTenantInvoiceDisputeStatus";
import { updateRentPayment } from "~/server/trpc/routers/property-manager/updateRentPayment";
import { recordUtilityReading } from "~/server/trpc/routers/property-manager/recordUtilityReading";
import { getTenantUtilityHistory } from "~/server/trpc/routers/property-manager/getTenantUtilityHistory";

// Contractor Management
import { createContractor } from "~/server/trpc/procedures/createContractor";
import { getContractors } from "~/server/trpc/procedures/getContractors";
import { updateContractor } from "~/server/trpc/procedures/updateContractor";
import { deleteContractor } from "~/server/trpc/procedures/deleteContractor";
import { uploadContractorDocument } from "~/server/trpc/procedures/uploadContractorDocument";
import { getContractorDocuments } from "~/server/trpc/procedures/getContractorDocuments";
import { createContractorKPI } from "~/server/trpc/procedures/createContractorKPI";
import { getContractorPerformance } from "~/server/trpc/procedures/getContractorPerformance";
import { getContractorSpending } from "~/server/trpc/procedures/getContractorSpending";
import { rateCompletedWork } from "~/server/trpc/procedures/rateCompletedWork";

// External contractor submission links (email-based)
import { getExternalSubmissionInfo } from "~/server/trpc/procedures/getExternalSubmissionInfo";
import { getPresignedUploadUrlForSubmission } from "~/server/trpc/procedures/getPresignedUploadUrlForSubmission";
import { submitExternalRFQQuotation } from "~/server/trpc/procedures/submitExternalRFQQuotation";
import { acceptExternalOrder } from "~/server/trpc/procedures/acceptExternalOrder";
import { submitExternalOrderInvoice } from "~/server/trpc/procedures/submitExternalOrderInvoice";

// Property Manager Admin Management
import { getPropertyManagers } from "~/server/trpc/procedures/getPropertyManagers";
import { createPropertyManager } from "~/server/trpc/procedures/createPropertyManager";
import { updatePropertyManager } from "~/server/trpc/procedures/updatePropertyManager";
import { deletePropertyManager } from "~/server/trpc/procedures/deletePropertyManager";

// Financial Reporting - Property & Property Manager
import { createPropertyFinancialMetrics } from "~/server/trpc/procedures/createPropertyFinancialMetrics";
import { getPropertyFinancialReport } from "~/server/trpc/procedures/getPropertyFinancialReport";
import { createPMFinancialMetrics } from "~/server/trpc/procedures/createPMFinancialMetrics";
import { getPMFinancialReport } from "~/server/trpc/procedures/getPMFinancialReport";
import { getPMDashboardFinancials } from "~/server/trpc/procedures/getPMDashboardFinancials";
import { generateFinancialInsights } from "~/server/trpc/procedures/generateFinancialInsights";
import { generateProjectInsights } from "~/server/trpc/procedures/generateProjectInsights";
import { generateAccountsInsights } from "~/server/trpc/procedures/generateAccountsInsights";

// Subscriptions
import { getPackages, getUserSubscription, createSubscription, updateSubscriptionPackage, updatePackagePricing, activateSubscription, suspendSubscription, getAllSubscriptions, getSubscriptionRoster } from "~/server/trpc/procedures/subscriptions";
import {
  createPendingRegistration,
  createPendingRegistrationPayfastCheckout,
  getPendingRegistrations,
  getAllRegistrations,
  approvePendingRegistration,
  rejectPendingRegistration,
  markRegistrationAsPaid,
  approveContractorPackageRequest,
  rejectContractorPackageRequest,
} from "~/server/trpc/procedures/registration";

// Tenant Feedback (Complaints & Complements)
import {
  submitTenantFeedback,
  getMyTenantFeedback,
  getTenantFeedbackForPM,
  updateTenantFeedbackStatus,
  getTenantFeedbackAnalyticsForPM,
} from "~/server/trpc/procedures/tenantFeedback";

// Task Management
import { createStaffMember } from "~/server/trpc/procedures/createStaffMember";
import { getStaffMembers } from "~/server/trpc/procedures/getStaffMembers";
import { updateStaffMember } from "~/server/trpc/procedures/updateStaffMember";
import { createPMTask } from "~/server/trpc/procedures/createPMTask";
import { getPMTasks } from "~/server/trpc/procedures/getPMTasks";
import { getPMTaskDetail } from "~/server/trpc/procedures/getPMTaskDetail";
import { updatePMTask } from "~/server/trpc/procedures/updatePMTask";
import { updatePMTaskStatus } from "~/server/trpc/procedures/updatePMTaskStatus";
import { addPMTaskComment } from "~/server/trpc/procedures/addPMTaskComment";
import { addPMTaskMaterial } from "~/server/trpc/procedures/addPMTaskMaterial";
import { getPMTaskStats } from "~/server/trpc/procedures/getPMTaskStats";
import { deletePMTask } from "~/server/trpc/procedures/deletePMTask";

// Staff Self-Service Portal
import { activateStaffAccount } from "~/server/trpc/procedures/activateStaffAccount";
import { getStaffProfile } from "~/server/trpc/procedures/getStaffProfile";
import { getStaffTasks } from "~/server/trpc/procedures/getStaffTasks";
import { getStaffTaskDetail } from "~/server/trpc/procedures/getStaffTaskDetail";
import { updateStaffTaskStatus } from "~/server/trpc/procedures/updateStaffTaskStatus";
import { addStaffTaskComment } from "~/server/trpc/procedures/addStaffTaskComment";
import { updateStaffTaskChecklist } from "~/server/trpc/procedures/updateStaffTaskChecklist";

export const appRouter = createTRPCRouter({
  // Auth
  login,
  register,
  getCurrentUser,
  getUserPermissions,
  setupUserEmail,
  getUserEmailStatus,
  testUserEmailConnection,
  disconnectUserEmail,
  
  // Access Control
  getRolePermissionConfig,
  updateRolePermissionConfig,
  resetRolePermissionConfig,
  getCustomRoles: getCustomRolesProc,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
  
  // CRM
  createLead,
  getLeads,
  updateLeadStatus,
  updateLeadDetails,
  getSalesPerformance,
  getEmployeeSalesPerformance,
  
  // Campaigns
  createCampaign,
  getCampaigns,
  updateCampaign,
  sendCampaign,
  deleteCampaign,
  
  // Operations
  createOrder,
  getOrders,
  updateOrderStatus,
  updateCompletedOrderDetails,
  pauseJob,
  resumeJob,
  updateOrderDetails,
  updateOrderNotes,
  getArtisans,
  getAdmins,
  generateOrderPdf,
  generateJobCardPdf,
  generateQuotationPdf,
  getQuotationsForRFQComparison,
  selectQuotationForRFQ,
  getPropertyManagerQuotationPdfCopies,
  downloadPropertyManagerQuotationPdfCopy,
  deletePropertyManagerQuotationPdfCopy,
  generateRFQReportPdf,
  generateInvoicePdf,
  generatePropertyManagerOrderPdf: generatePropertyManagerOrderPdfProcedure,
  generatePropertyManagerInvoicePdf,
  generatePropertyManagerRFQPdf: generatePropertyManagerRFQPdfProcedure,
  uploadOrderDocuments,
  getArtisanPerformanceMetrics,
  
  // Projects
  getProjects,
  createProject,
  updateProjectDetails,
  updateProjectStatus,
  generateProjectReportPdf,
  getComprehensiveProjectReport,
  
  // Milestones & Advanced Project Management
  createMilestone,
  updateMilestone,
  updateMilestoneStatus,
  getMilestonesByProject,
  getMilestonesForArtisan,
  pauseMilestone,
  resumeMilestone,
  uploadMilestoneSupplierQuotation,
  deleteMilestoneSupplierQuotation,
  createWeeklyBudgetUpdate,
  getWeeklyBudgetUpdates,
  generateWeeklyUpdatePdf,
  generateMilestoneReportPdf,
  createMilestonePaymentRequest,
  createMilestoneRisk,
  updateMilestoneRisk,
  deleteMilestoneRisk,
  createChangeOrder,
  createMilestoneDependency,
  
  // Quotations
  getQuotations,
  createQuotation,
  createQuotationFromPMRFQ,
  updateQuotationStatus,
  updateQuotationDetails,
  deleteQuotation,
  
  // Invoices
  getInvoices,
  createInvoice,
  updateInvoiceStatus,
  updateInvoiceDetails,
  
  // Statements
  generateStatement,
  getStatements,
  generateStatementPdf,
  updateStatementDetails,
  generateManagedCustomerStatements,
  sendStatementEmail,
  markStatementViewed,
  getCustomerDetailsByEmail,
  
  // Assets
  getAssets,
  createAsset,
  updateAsset,
  
  // Operational Expenses & Alternative Revenue
  getOperationalExpenses,
  createOperationalExpense,
  updateOperationalExpense,
  approveOperationalExpense,
  getAlternativeRevenues,
  createAlternativeRevenue,
  updateAlternativeRevenue,
  approveAlternativeRevenue,
  
  // Payment Requests
  getPaymentRequests,
  createPaymentRequest,
  updatePaymentRequestStatus,
  
  // Messaging
  getConversations,
  getMessages,
  sendMessage,
  markMessagesAsRead,
  createConversation,
  messagesSubscription,
  sendLeadEmail,
  sendBulkLeadEmail,
  
  // Notifications
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  notificationsSubscription,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  
  // Push Notifications
  subscribeToPush,
  unsubscribeFromPush,
  getVapidPublicKey,
  
  // Reviews
  createReview,
  getArtisanReviews,
  
  // HR Management
  getEmployees,
  getDistinctRoles,
  createEmployee,
  updateEmployeeDetails,
  deleteEmployee,
  uploadHRDocument,
  getHRDocuments,
  deleteHRDocument,
  createEmployeeKPI,
  updateEmployeeKPI,
  getEmployeeKPIs,
  createLeaveRequest,
  updateLeaveRequestStatus,
  getLeaveRequests,
  getEmployeePerformanceHistory,
  getLeadsForEmployee,
  generateCoachingRecommendation,
  createPerformanceReview,
  updatePerformanceReview,
  getPerformanceReviews,
  getHRFinancialMetrics,
  
  // Payslips
  getPayslips,
  createPayslip,
  createBulkPayslips,
  updatePayslip,
  generatePayslipPdf,
  
  // Liabilities
  createLiabilities: createLiability,
  getLiabilities,
  updateLiability,
  
  // Property Manager Module
  createPropertyManagerRFQ,
  getPropertyManagerRFQs,
  getPropertyManagerRFQsForAdmin,
  updatePropertyManagerRFQStatus,
  updatePropertyManagerRFQ,
  createPropertyManagerOrder,
  getPropertyManagerOrders,
  acceptPMOrder,
  updatePropertyManagerOrder,
  getPropertyManagerInvoices,
  updatePropertyManagerInvoiceStatus,
  updateContractorPMInvoiceStatus,
  updatePropertyManagerOrderStatus,
  getMaintenanceRequests,
  createMaintenanceRequest,
  updateMaintenanceRequestStatus,
  submitMaintenanceRequest,
  getReceivedMaintenanceRequests,
  approveMaintenanceRequest,
  rejectMaintenanceRequest,
  convertMaintenanceToRFQ,
  convertMaintenanceToOrder,
  getBuildings,
  createBuilding,
  createBuildingBudget,
  getBuildingBudgets,
  updateBuildingBudget,
  createBudgetExpense,
  createBuildingMaintenanceSchedule,
  getBuildingMaintenanceSchedules,
  
  // Tenant Management
  getBuildingsForOnboarding,
  addTenant,
  submitTenantOnboarding,
  getPendingOnboardings,
  approveTenantOnboarding,
  rejectTenantOnboarding,
  getTenantsOverview,
  getTenantDetails,
  getTenantMaintenanceRequests,
  recordRentPayment,
  getTenantRentHistory,
  getTenantRentInvoiceTracking,
  getTenantInvoicesIssued,
  setTenantInvoiceDisputeStatus,
  updateRentPayment,
  recordUtilityReading,
  getTenantUtilityHistory,
  
  // Contractor Management
  createContractor,
  getContractors,
  updateContractor,
  deleteContractor,
  uploadContractorDocument,
  getContractorDocuments,
  createContractorKPI,
  getContractorPerformance,
  getContractorSpending,
  rateCompletedWork,

  // Property Manager Admin Management
  getPropertyManagers,
  createPropertyManager,
  updatePropertyManager,
  deletePropertyManager,
  
  // Financial Reporting - Property Level
  createPropertyFinancialMetrics,
  getPropertyFinancialReport,
  
  // Financial Reporting - Property Manager Level
  createPMFinancialMetrics,
  getPMFinancialReport,
  getPMDashboardFinancials,
  generateFinancialInsights,
  
  // AI Insights
  generateProjectInsights,
  generateAccountsInsights,
  
  // Metric Snapshots
  captureMetricSnapshot,
  getMetricSnapshots,
  
  // Financial Reports (Management Accounts)
  generateFinancialReport,
  getFinancialReports,
  getFinancialReportById,
  
  // AI-powered features
  suggestExpenseCategory,
  scoreLeadWithAI,
  classifyServiceType,
  generateQuotationLineItems,
  suggestArtisanForJob,
  updateProjectActualCost,
  aiAgent,
  getOrCreateAIAgentConversation,
  clearAIAgentConversation,
  sendAgentMessage,
  generateEmailContent,
  generateProjectSummary,
  extractActionItems,
  analyzeProjectRisks,
  generateInvoiceDescription,
  
  // Utils
  getMinioBaseUrl,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  getPresignedUploadUrlForSubmission,
  uploadCompanyLogo,
  deleteCompanyLogo,
  getCompanyLogoUrl,
  getCompanyDetails,
  updateCompanyDetails,
  getPropertyManagerCompanyDetails,
  updatePropertyManagerCompanyDetails,
  getPropertyManagerBranding,
  updatePropertyManagerBranding,
  getContractorBranding,
  updateContractorBranding,
  updateContractorCompanyDetails,
  sendTestEmail,
  sendTestStatementEmail,
  sendTestInvoiceEmail,
  sendTestOrderNotificationEmail,

  // External contractor submissions (public)
  getExternalSubmissionInfo,
  submitExternalRFQQuotation,
  acceptExternalOrder,
  submitExternalOrderInvoice,
  
  // Dashboard
  getDashboardConfig,
  saveDashboardConfig,
  
  // Analytics
  getRevenueAnalytics,
  getServiceAnalytics,
  getCustomerAnalytics,
  getProfitAnalytics,
  
  // Filters
  getCustomers,
  getProjectTypes,
  
  // Customer Payments
  submitCustomerPayment,
  createCustomerPayfastCheckout,
  setMyInvoiceDisputeStatus,
  getCustomerPayments,
  getPropertyManagerPayments,
  approveCustomerPayment,
  rejectCustomerPayment,
  getPublicPaymentGatewayStatus,
  
  // Subscriptions & Billing
  getPackages,
  getUserSubscription,
  createSubscription,
  updateSubscriptionPackage,
  updatePackagePricing,
  activateSubscription,
  suspendSubscription,
  getAllSubscriptions,
  getSubscriptionRoster,
  
  // Self-Registration
  createPendingRegistration,
  createPendingRegistrationPayfastCheckout,
  getPendingRegistrations,
  getAllRegistrations,
  approvePendingRegistration,
  rejectPendingRegistration,
  markRegistrationAsPaid,
  approveContractorPackageRequest,
  rejectContractorPackageRequest,

  // Tenant Feedback (Complaints & Complements)
  submitTenantFeedback,
  getMyTenantFeedback,
  getTenantFeedbackForPM,
  updateTenantFeedbackStatus,
  getTenantFeedbackAnalyticsForPM,

  // Task Management
  createStaffMember,
  getStaffMembers,
  updateStaffMember,
  createPMTask,
  getPMTasks,
  getPMTaskDetail,
  updatePMTask,
  updatePMTaskStatus,
  addPMTaskComment,
  addPMTaskMaterial,
  getPMTaskStats,
  deletePMTask,

  // Staff Self-Service Portal
  activateStaffAccount,
  getStaffProfile,
  getStaffTasks,
  getStaffTaskDetail,
  updateStaffTaskStatus,
  addStaffTaskComment,
  updateStaffTaskChecklist,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
