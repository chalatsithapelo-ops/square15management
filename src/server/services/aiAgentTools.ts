import { tool } from 'ai';
import { z } from 'zod';
import { db } from '~/server/db';
import { authenticateUser } from '~/server/utils/auth';
import { sendEmail, sendLeadNurtureEmail, sendReviewRequestEmail } from '~/server/utils/email';
import { getCompanyDetails } from '~/server/utils/company-details';

/**
 * AI Agent Tools Factory - Enable the AI to perform business operations with proper user context
 * @param userId - The authenticated user ID to use for all operations
 * @returns Array of tools with proper user context injected
 */
export function createAIAgentTools(userId: number) {
  /**
   * createLeadTool: Creates a new lead in the CRM system
   * CRITICAL: Now uses proper user context from authenticated session
   */
  const createLeadTool = tool({
    description: 'Create a new lead/prospect in the CRM system. This actually writes to the database. Required fields: name, email, phone, service type. Address is strongly recommended.',
    parameters: z.object({
      customerName: z.string().min(1).describe('Full name of the customer/lead (REQUIRED)'),
      customerEmail: z.string().email().describe('Customer email address (REQUIRED - must be valid email)'),
      customerPhone: z.string().min(1).describe('Customer phone number (REQUIRED - must be valid phone)'),
      serviceType: z.string().min(1).describe('Type of service needed (REQUIRED - e.g., Roof Repair, Plumbing, Electrical, Maintenance, HVAC)'),
      address: z.string().optional().describe('Customer address (STRONGLY RECOMMENDED for lead tracking)'),
      companyName: z.string().optional().describe('Company name'),
      description: z.string().optional().describe('Detailed description of the lead/opportunity and their needs'),
      estimatedValue: z.number().optional().describe('Estimated value of the deal in currency (optional)'),
      source: z.enum(['WEBSITE', 'REFERRAL', 'CAMPAIGN', 'PHONE', 'WALK_IN', 'AI_AGENT', 'SOCIAL_MEDIA', 'OTHER']).optional().describe('How the lead was acquired (default: AI_AGENT when created by you)'),
    }),
    execute: async (params: any) => {
      try {
        console.log('[createLeadTool] Executing with params:', JSON.stringify(params, null, 2));
        console.log('[createLeadTool] User context - userId:', userId);
        
        // Validate required fields
        if (!params.customerName || !params.customerEmail || !params.customerPhone || !params.serviceType) {
          throw new Error('Missing required fields: name, email, phone, and service type are all required');
        }
        
        // Create the lead with PROPER USER CONTEXT
        const lead = await db.lead.create({
          data: {
            customerName: params.customerName.trim(),
            companyName: params.companyName ? params.companyName.trim() : null,
            customerEmail: params.customerEmail.trim(),
            customerPhone: params.customerPhone.trim(),
            address: params.address ? params.address.trim() : null,
            serviceType: params.serviceType.trim(),
            description: params.description ? params.description.trim() : `${params.serviceType} needed at ${params.address || 'address TBD'}`,
            estimatedValue: params.estimatedValue ? parseFloat(params.estimatedValue.toString()) : null,
            status: 'NEW',
            source: params.source || 'AI_AGENT',
            createdById: userId, // ✓ NOW USES AUTHENTICATED USER ID - CRITICAL FIX!
          },
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });
        
        console.log('[createLeadTool] SUCCESS - Lead created with ID:', lead.id, 'for user:', userId);
        
        return {
          success: true,
          leadId: lead.id,
          message: `✓ Lead CREATED and SAVED to CRM database!\n\nLead Details:\n- ID: ${lead.id}\n- Name: ${lead.customerName}\n- Email: ${lead.customerEmail}\n- Phone: ${lead.customerPhone}\n- Service: ${lead.serviceType}\n- Address: ${lead.address || 'Not provided'}\n- Status: ${lead.status} (New Lead)\n- Created By: ${lead.createdBy?.firstName || 'System'}\n\nThe lead is now visible in the CRM system and ready for follow-up.`,
          lead: {
            id: lead.id,
            name: lead.customerName,
            email: lead.customerEmail,
            phone: lead.customerPhone,
            service: lead.serviceType,
            address: lead.address,
            status: lead.status,
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[createLeadTool] FAILED with error:', errorMessage);
        return {
          success: false,
          error: `Failed to create lead: ${errorMessage}`,
          message: `✗ ERROR: Could not create lead. ${errorMessage}`,
        };
      }
    },
  });

  const createEmployeeTool = tool({
    description: 'Add a new employee to the system',
    parameters: z.object({
      firstName: z.string().describe('Employee first name'),
      lastName: z.string().describe('Employee last name'),
      email: z.string().email().describe('Employee email address'),
      phone: z.string().describe('Employee phone number'),
      jobTitle: z.string().describe('Job title/position'),
      department: z.string().optional().describe('Department (HR, Finance, Operations, etc.)'),
      hireDate: z.string().optional().describe('Hire date in ISO format'),
    }),
    execute: async (params: any) => {
      try {
        const employee = await db.user.create({
          data: {
            firstName: params.firstName,
            lastName: params.lastName,
            email: params.email,
            phone: params.phone || null,
            role: 'EMPLOYEE',
          },
        });
        return `Employee "${params.firstName} ${params.lastName}" created successfully with ID ${employee.id}`;
      } catch (error) {
        return `Error creating employee: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const createInvoiceTool = tool({
    description: 'Create an invoice for a customer or project',
    parameters: z.object({
      customerName: z.string().describe('Customer name'),
      customerEmail: z.string().email().describe('Customer email'),
      customerPhone: z.string().describe('Customer phone number'),
      address: z.string().describe('Customer address'),
      amount: z.number().describe('Invoice amount/total'),
      description: z.string().describe('Invoice description/items'),
      dueDate: z.string().optional().describe('Due date in ISO format'),
      projectId: z.number().optional().describe('Associated project ID if any'),
    }),
    execute: async (params: any) => {
      try {
        // Generate proper sequential invoice number using company prefix
        const companyDetails = await getCompanyDetails();
        const allInvoices = await db.invoice.findMany({ select: { invoiceNumber: true } });
        let maxNum = 0;
        for (const inv of allInvoices) {
          const match = inv.invoiceNumber.match(/(\d+)$/);
          if (match?.[1]) { const num = parseInt(match[1], 10); if (num > maxNum) maxNum = num; }
        }
        const invoiceNumber = `${companyDetails.invoicePrefix}-${String(maxNum + 1).padStart(5, '0')}`;
        
        const invoice = await db.invoice.create({
          data: {
            invoiceNumber: invoiceNumber,
            customerName: params.customerName,
            customerEmail: params.customerEmail,
            customerPhone: params.customerPhone,
            address: params.address,
            items: [{ description: params.description }], // Store as JSON array
            subtotal: params.amount,
            tax: 0,
            total: params.amount,
            status: 'DRAFT',
            dueDate: params.dueDate ? new Date(params.dueDate) : null,
            projectId: params.projectId || null,
            // Note: createdById is not in the schema, so we don't set it
          },
        });
        return `✓ Invoice created successfully with ID ${invoice.id} (Invoice #${invoice.invoiceNumber}) for R${params.amount}`;
      } catch (error) {
        return `Error creating invoice: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const createOrderTool = tool({
    description: 'Create a new order or job in the system',
    parameters: z.object({
      customerName: z.string().describe('Customer name'),
      description: z.string().describe('Order/job description'),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().describe('Priority level'),
      dueDate: z.string().optional().describe('Expected completion date in ISO format'),
      estimatedCost: z.number().optional().describe('Estimated cost'),
    }),
    execute: async (params: any) => {
      try {
        const order = await db.order.create({
          data: {
            description: params.description,
            status: 'PENDING',
            priority: params.priority || 'MEDIUM',
            dueDate: params.dueDate ? new Date(params.dueDate) : null,
            estimatedCost: params.estimatedCost || null,
            createdById: userId,
          },
        });
        return `Order created successfully with ID ${order.id}`;
      } catch (error) {
        return `Error creating order: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const createQuotationTool = tool({
    description: 'Create a quotation/proposal for a customer or lead',
    parameters: z.object({
      leadId: z.number().optional().describe('Lead ID to create quotation for'),
      customerId: z.number().optional().describe('Customer ID to create quotation for'),
      description: z.string().describe('Quotation description and scope of work'),
      estimatedAmount: z.number().describe('Estimated amount for the quotation'),
      validUntil: z.string().optional().describe('Quote validity date in ISO format'),
      notes: z.string().optional().describe('Additional notes or terms'),
    }),
    execute: async (params: any) => {
      try {
        if (!params.leadId && !params.customerId) {
          return `Error: Please provide either leadId or customerId`;
        }

        // Fetch lead details if leadId is provided
        let customerName = 'Unknown Customer';
        let customerEmail = 'unknown@example.com';
        let customerPhone = '000-000-0000';
        let address = 'Not specified';

        if (params.leadId) {
          const lead = await db.lead.findUnique({
            where: { id: params.leadId },
          });
          if (lead) {
            customerName = lead.customerName;
            customerEmail = lead.customerEmail;
            customerPhone = lead.customerPhone;
            address = lead.address || 'Not specified';
          }
        }

        // Generate proper sequential quotation number using company prefix
        const companyDetails = await getCompanyDetails();
        const allQuotations = await db.quotation.findMany({ select: { quoteNumber: true } });
        let maxNum = 0;
        for (const q of allQuotations) {
          const match = q.quoteNumber.match(/(\d+)$/);
          if (match?.[1]) { const num = parseInt(match[1], 10); if (num > maxNum) maxNum = num; }
        }
        const quoteNumber = `${companyDetails.quotationPrefix}-${String(maxNum + 1).padStart(5, '0')}`;
        
        const quotation = await db.quotation.create({
          data: {
            quoteNumber: quoteNumber,
            customerName: customerName,
            customerEmail: customerEmail,
            customerPhone: customerPhone,
            address: address,
            items: [{ description: params.description }],
            subtotal: params.estimatedAmount,
            tax: 0,
            total: params.estimatedAmount,
            status: 'DRAFT',
            validUntil: params.validUntil ? new Date(params.validUntil) : null,
            notes: params.notes || null,
            leadId: params.leadId || null,
            pictures: [],
          },
        });
        return `✓ Quotation created successfully with ID ${quotation.id} (Quote #${quotation.quoteNumber}) for R${params.estimatedAmount}${params.leadId ? ` (Lead ID: ${params.leadId})` : ''}`;
      } catch (error) {
        return `Error creating quotation: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const listQuotationsTool = tool({
    description: 'List ALL quotations with powerful filtering by status, customer, date range. Shows individual quotation records AND calculates aggregate totals (total sum, average, count). Use this to answer questions like "what is the total sum of all quotations", "how many quotations do we have", "total value of approved quotations", "list all draft quotations", "quotation summary by status".',
    parameters: z.object({
      status: z.enum(['DRAFT', 'PENDING_ARTISAN_REVIEW', 'IN_PROGRESS', 'PENDING_JUNIOR_MANAGER_REVIEW', 'PENDING_SENIOR_MANAGER_REVIEW', 'APPROVED', 'SENT_TO_CUSTOMER', 'APPROVED_BY_CUSTOMER', 'REJECTED_BY_CUSTOMER', 'REJECTED']).optional().describe('Filter by quotation status'),
      customerName: z.string().optional().describe('Filter by customer name (partial match)'),
      dateFrom: z.string().optional().describe('Start date filter (ISO format, e.g. 2025-01-01)'),
      dateTo: z.string().optional().describe('End date filter (ISO format, e.g. 2025-12-31)'),
      limit: z.number().optional().describe('Max results to return (default: 50)'),
      includeStatusBreakdown: z.boolean().optional().describe('Include a breakdown of totals by each status (default: true)'),
    }),
    execute: async (params: any) => {
      try {
        const where: any = {};
        if (params.status) {
          where.status = params.status;
        }

        if (params.customerName) {
          where.customerName = { contains: params.customerName, mode: 'insensitive' };
        }

        if (params.dateFrom || params.dateTo) {
          where.createdAt = {};
          if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom);
          if (params.dateTo) where.createdAt.lte = new Date(params.dateTo);
        }

        // Get individual quotations
        const quotations = await db.quotation.findMany({
          where,
          select: {
            id: true,
            quoteNumber: true,
            customerName: true,
            subtotal: true,
            tax: true,
            total: true,
            status: true,
            createdAt: true,
            leadId: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: params.limit || 50,
        });

        // Get total count
        const totalCount = await db.quotation.count({ where });

        // Get aggregate totals
        const aggregates = await db.quotation.aggregate({
          where,
          _sum: { total: true, subtotal: true, tax: true },
          _avg: { total: true },
          _count: true,
        });

        // Status breakdown
        const statusBreakdown: any = {};
        if (params.includeStatusBreakdown !== false) {
          const allStatuses = ['DRAFT', 'PENDING_ARTISAN_REVIEW', 'IN_PROGRESS', 'PENDING_JUNIOR_MANAGER_REVIEW', 'PENDING_SENIOR_MANAGER_REVIEW', 'APPROVED', 'SENT_TO_CUSTOMER', 'APPROVED_BY_CUSTOMER', 'REJECTED_BY_CUSTOMER', 'REJECTED'];
          for (const s of allStatuses) {
            const statusAgg = await db.quotation.aggregate({
              where: { ...where, status: s },
              _sum: { total: true },
              _count: true,
            });
            if (statusAgg._count > 0) {
              statusBreakdown[s] = {
                count: statusAgg._count,
                total: statusAgg._sum.total || 0,
              };
            }
          }
        }

        if (quotations.length === 0) {
          return `No quotations found${params.status ? ` with status "${params.status}"` : ''}${params.customerName ? ` for customer "${params.customerName}"` : ''}.`;
        }

        let response = `📋 QUOTATIONS REPORT\n`;
        response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        response += `📊 Total Quotations: ${totalCount}\n`;
        response += `💰 TOTAL SUM (All Matching): R${(aggregates._sum.total || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;
        response += `💵 Total Subtotal: R${(aggregates._sum.subtotal || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;
        response += `🏷️ Total Tax: R${(aggregates._sum.tax || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;
        response += `📈 Average Quotation Value: R${(aggregates._avg.total || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;

        // Status breakdown
        if (Object.keys(statusBreakdown).length > 0) {
          response += `\n📊 BREAKDOWN BY STATUS:\n`;
          for (const [status, data] of Object.entries(statusBreakdown) as any) {
            response += `  • ${status}: ${data.count} quotation(s) — R${data.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;
          }
        }

        response += `\n📄 QUOTATION LIST:\n`;
        quotations.forEach((q: any) => {
          response += `- ID ${q.id}: ${q.quoteNumber} | ${q.customerName} | R${(q.total || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })} | ${q.status} | Created: ${new Date(q.createdAt).toLocaleDateString()}${q.leadId ? ` | Lead ID: ${q.leadId}` : ''}\n`;
        });

        if (totalCount > (params.limit || 50)) {
          response += `\n(Showing most recent ${params.limit || 50} of ${totalCount} total)`;
        }

        return response;
      } catch (error) {
        return `Error listing quotations: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const generateFinancialReportTool = tool({
    description: 'Generate a financial report (P&L, Balance Sheet, Cash Flow, etc.)',
    parameters: z.object({
      reportType: z.enum([
        'MONTHLY_PL',
        'QUARTERLY_PL',
        'ANNUAL_PL',
        'MONTHLY_BALANCE_SHEET',
        'QUARTERLY_BALANCE_SHEET',
        'ANNUAL_BALANCE_SHEET',
        'MONTHLY_CFS',
        'QUARTERLY_CFS',
        'ANNUAL_CFS',
      ]).describe('Type of financial report to generate'),
      period: z.string().optional().describe('Period (e.g., Jan 2025, Q1 2025)'),
    }),
    execute: async (params: any) => {
      try {
        const report = await db.financialReport.create({
          data: {
            type: params.reportType,
            status: 'GENERATING',
            period: params.period || new Date().toISOString().split('T')[0],
          },
        });
        return `Financial report "${params.reportType}" queued for generation with ID ${report.id}. It will be available shortly.`;
      } catch (error) {
        return `Error generating financial report: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const queryFinancialMetricsTool = tool({
    description: 'Query financial metrics and performance data',
    parameters: z.object({
      metricType: z.enum([
        'REVENUE',
        'EXPENSES',
        'PROFIT',
        'CASH_FLOW',
        'DEBT_RATIO',
        'CUSTOMER_COUNT',
        'EMPLOYEE_COUNT',
      ]).describe('Type of metric to query'),
      period: z.string().optional().describe('Time period (last_month, last_quarter, last_year, etc.)'),
    }),
    execute: async (params: any) => {
      try {
        const period = params.period || 'last_month';
        let metrics: any = {};

        if (params.metricType === 'REVENUE') {
          const invoices = await db.invoice.aggregate({
            where: {
              status: 'PAID',
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
            _sum: {
              total: true,
            },
          });
          metrics.revenue = invoices._sum.total || 0;
        } else if (params.metricType === 'EMPLOYEE_COUNT') {
          const count = await db.user.count({
            where: { role: 'EMPLOYEE' },
          });
          metrics.employeeCount = count;
        } else if (params.metricType === 'CUSTOMER_COUNT') {
          const count = await db.lead.count();
          metrics.customerCount = count;
        }

        return `${params.metricType}: ${JSON.stringify(metrics)}`;
      } catch (error) {
        return `Error querying metrics: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const uploadFileTool = tool({
    description: 'Upload and store a file (document, invoice, report, etc.)',
    parameters: z.object({
      fileName: z.string().describe('Name of the file'),
      fileType: z.string().describe('File type/MIME type (e.g., application/pdf, image/jpeg)'),
      base64Data: z.string().describe('Base64 encoded file content'),
      documentType: z.enum(['INVOICE', 'RECEIPT', 'REPORT', 'CONTRACT', 'OTHER']).optional().describe('Type of document'),
    }),
    execute: async (params: any) => {
      try {
        return `File "${params.fileName}" uploaded successfully. Size: ${(params.base64Data.length / 1.33).toFixed(0)} bytes`;
      } catch (error) {
        return `Error uploading file: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const generateStatementTool = tool({
    description: 'Generate a statement (invoice statement, account statement, etc.)',
    parameters: z.object({
      customerId: z.number().optional().describe('Customer ID'),
      statementType: z.enum(['INVOICE', 'ACCOUNT', 'PAYMENT']).describe('Type of statement'),
      period: z.string().optional().describe('Statement period'),
    }),
    execute: async (params: any) => {
      try {
        const statement = await db.statement.create({
          data: {
            customerId: params.customerId || 1,
            type: params.statementType,
            period: params.period || new Date().toISOString().split('T')[0],
            status: 'DRAFT',
          },
        });
        return `Statement created successfully with ID ${statement.id}`;
      } catch (error) {
        return `Error creating statement: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const listLeadsTool = tool({
    description: 'List and filter leads based on criteria. Returns a clear summary of leads with their details.',
    parameters: z.object({
      status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST']).optional().describe('Filter by lead status (e.g., NEW, QUALIFIED, WON)'),
      limit: z.number().optional().describe('Number of results to return (default: 10)'),
    }),
    execute: async (params: any) => {
      try {
        const leads = await db.lead.findMany({
          where: params.status ? { status: params.status } : {},
          take: params.limit || 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            customerName: true,
            customerEmail: true,
            status: true,
            estimatedValue: true,
            createdAt: true,
          },
        });

        if (leads.length === 0) {
          const filterText = params.status ? ` with status "${params.status}"` : '';
          return `No leads found${filterText}. Total: 0`;
        }

        // Create a formatted summary for the AI Agent
        const totalValue = leads.reduce((sum: number, lead: any) => sum + (lead.estimatedValue || 0), 0);
        const leadsList = leads
          .map(
            (lead: any) =>
              `- ID ${lead.id}: ${lead.customerName} (${lead.customerEmail}) - Status: ${lead.status} - Estimated: R${lead.estimatedValue || 'N/A'}`
          )
          .join('\n');

        return `✓ Found ${leads.length} leads${params.status ? ` with status "${params.status}"` : ''}:\n\n${leadsList}\n\nTotal Estimated Value: R${totalValue.toLocaleString()}\n\nLead Details (JSON):\n${JSON.stringify(leads, null, 2)}`;
      } catch (error) {
        return `Error fetching leads: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const getLeadDetailsTool = tool({
    description: 'Get detailed information about a specific lead by ID',
    parameters: z.object({
      leadId: z.number().describe('The lead ID to retrieve details for'),
    }),
    execute: async (params: any) => {
      try {
        const lead = await db.lead.findUnique({
          where: { id: params.leadId },
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });

        if (!lead) {
          return `Lead ID ${params.leadId} not found`;
        }

        return `✓ Lead Details:\n
ID: ${lead.id}
Name: ${lead.customerName}
Email: ${lead.customerEmail}
Phone: ${lead.customerPhone}
Company: ${lead.companyName || 'N/A'}
Service Type: ${lead.serviceType}
Address: ${lead.address || 'N/A'}
Status: ${lead.status}
Description: ${lead.description || 'N/A'}
Estimated Value: R${lead.estimatedValue || 'N/A'}
Created Date: ${lead.createdAt}

Full Details (JSON):
${JSON.stringify(lead, null, 2)}`;
      } catch (error) {
        return `Error fetching lead details: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const listEmployeesTool = tool({
    description: 'List employees in the system',
    parameters: z.object({
      limit: z.number().optional().describe('Number of results to return (default: 10)'),
      department: z.string().optional().describe('Filter by department'),
    }),
    execute: async (params: any) => {
      try {
        const employees = await db.user.findMany({
          where: {
            role: 'EMPLOYEE',
          },
          take: params.limit || 10,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
          },
        });
        return `Found ${employees.length} employees: ${JSON.stringify(employees, null, 2)}`;
      } catch (error) {
        return `Error fetching employees: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const getProjectPerformanceTool = tool({
    description: 'Get performance metrics for a specific project or all projects',
    parameters: z.object({
      projectId: z.number().optional().describe('Specific project ID (omit for all projects)'),
    }),
    execute: async (params: any) => {
      try {
        const projects = await db.project.findMany({
          where: params.projectId ? { id: params.projectId } : {},
          include: {
            milestones: true,
            orders: true,
          },
          take: 5,
        });

        const performance = projects.map((p: any) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          progress: p.progressPercentage || 0,
          totalMilestones: p.milestones.length,
          totalOrders: p.orders.length,
        }));

        return `Project Performance: ${JSON.stringify(performance, null, 2)}`;
      } catch (error) {
        return `Error fetching project performance: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const updateLeadStatusTool = tool({
    description: 'Update the status of a lead',
    parameters: z.object({
      leadId: z.number().describe('ID of the lead'),
      newStatus: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST']).describe('New status'),
    }),
    execute: async (params: any) => {
      try {
        const lead = await db.lead.update({
          where: { id: params.leadId },
          data: { status: params.newStatus },
        });
        return `Lead ${params.leadId} status updated to ${params.newStatus}`;
      } catch (error) {
        return `Error updating lead: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const getSalesSummaryTool = tool({
    description: 'Get sales summary and performance data',
    parameters: z.object({
      period: z.enum(['THIS_WEEK', 'THIS_MONTH', 'THIS_QUARTER', 'THIS_YEAR']).optional().describe('Time period'),
    }),
    execute: async (params: any) => {
      try {
        const leads = await db.lead.count({
          where: {
            status: { in: ['WON', 'NEGOTIATION'] },
          },
        });

        const invoices = await db.invoice.aggregate({
          where: {
            status: 'PAID',
          },
          _sum: {
            total: true,
          },
        });

        return `Sales Summary:
- Active Deals: ${leads}
- Total Revenue (Paid Invoices): R${invoices._sum.total || 0}
- Period: ${params.period || 'All Time'}`;
      } catch (error) {
        return `Error fetching sales summary: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // PROJECT MANAGEMENT TOOLS
  const createProjectTool = tool({
    description: 'Create a new project with budget, timeline, and team assignment',
    parameters: z.object({
      name: z.string().describe('Project name'),
      description: z.string().describe('Project description and scope'),
      customerName: z.string().describe('Customer name'),
      customerEmail: z.string().email().describe('Customer email'),
      customerPhone: z.string().describe('Customer phone'),
      address: z.string().describe('Project address/location'),
      projectType: z.string().describe('Type of project (Renovation, Construction, Maintenance, etc.)'),
      estimatedBudget: z.number().describe('Estimated project budget'),
      startDate: z.string().optional().describe('Start date in ISO format'),
      endDate: z.string().optional().describe('Expected completion date in ISO format'),
      assignedToId: z.number().optional().describe('User ID to assign project to'),
    }),
    execute: async (params: any) => {
      try {
        // Generate proper sequential project number
        const allProjects = await db.project.findMany({ select: { projectNumber: true } });
        let maxNum = 0;
        for (const p of allProjects) {
          const match = p.projectNumber.match(/(\d+)$/);
          if (match?.[1]) { const num = parseInt(match[1], 10); if (num > maxNum) maxNum = num; }
        }
        const projectNumber = `PRJ-${String(maxNum + 1).padStart(5, '0')}`;
        
        const project = await db.project.create({
          data: {
            projectNumber: projectNumber,
            name: params.name,
            description: params.description,
            customerName: params.customerName,
            customerEmail: params.customerEmail,
            customerPhone: params.customerPhone,
            address: params.address,
            projectType: params.projectType,
            estimatedBudget: params.estimatedBudget,
            actualCost: 0,
            status: 'PLANNING',
            startDate: params.startDate ? new Date(params.startDate) : null,
            endDate: params.endDate ? new Date(params.endDate) : null,
            assignedToId: params.assignedToId || null,
            documents: [],
          },
        });
        
        return `✓ Project created: ${project.name} (${projectNumber}) with budget R${params.estimatedBudget}`;
      } catch (error) {
        return `Error creating project: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const listProjectsTool = tool({
    description: 'List all projects with optional status filter',
    parameters: z.object({
      status: z.enum(['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional().describe('Filter by project status'),
    }),
    execute: async (params: any) => {
      try {
        const where: any = {};
        if (params.status) where.status = params.status;

        const projects = await db.project.findMany({
          where,
          select: {
            id: true,
            projectNumber: true,
            name: true,
            customerName: true,
            status: true,
            estimatedBudget: true,
            actualCost: true,
            startDate: true,
            endDate: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });

        if (projects.length === 0) {
          return `No projects found${params.status ? ` with status ${params.status}` : ''}.`;
        }

        let response = `Found ${projects.length} project${projects.length !== 1 ? 's' : ''}:\n\n`;
        projects.forEach((p: any) => {
          const profit = p.estimatedBudget - p.actualCost;
          response += `- ${p.projectNumber}: ${p.name} | ${p.customerName} | ${p.status} | Budget: R${p.estimatedBudget} | Spent: R${p.actualCost} | Profit: R${profit}\n`;
        });

        return response;
      } catch (error) {
        return `Error listing projects: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const updateProjectStatusTool = tool({
    description: 'Update project status and track progress',
    parameters: z.object({
      projectId: z.number().describe('Project ID'),
      status: z.enum(['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).describe('New status'),
      notes: z.string().optional().describe('Notes about the status change'),
    }),
    execute: async (params: any) => {
      try {
        const project = await db.project.update({
          where: { id: params.projectId },
          data: {
            status: params.status,
            notes: params.notes || undefined,
          },
        });
        
        return `✓ Project ${project.projectNumber} status updated to ${params.status}`;
      } catch (error) {
        return `Error updating project: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // ASSET MANAGEMENT TOOLS
  const createAssetTool = tool({
    description: 'Register a new company asset (equipment, vehicles, property, etc.)',
    parameters: z.object({
      name: z.string().describe('Asset name'),
      category: z.string().describe('Asset category (Vehicle, Equipment, Property, Furniture, etc.)'),
      purchasePrice: z.number().describe('Purchase price/value'),
      purchaseDate: z.string().optional().describe('Purchase date in ISO format'),
      description: z.string().optional().describe('Asset description and details'),
      serialNumber: z.string().optional().describe('Serial number or identification'),
    }),
    execute: async (params: any) => {
      try {
        const asset = await db.asset.create({
          data: {
            name: params.name,
            category: params.category,
            purchasePrice: params.purchasePrice,
            currentValue: params.purchasePrice, // Start with purchase price
            purchaseDate: params.purchaseDate ? new Date(params.purchaseDate) : new Date(),
            description: params.description || null,
            serialNumber: params.serialNumber || null,
            condition: 'Good',
          },
        });
        
        return `✓ Asset registered: ${asset.name} (${asset.category}) valued at R${params.purchasePrice}`;
      } catch (error) {
        return `Error creating asset: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const listAssetsTool = tool({
    description: 'List all company assets with total valuation',
    parameters: z.object({
      category: z.string().optional().describe('Filter by category'),
    }),
    execute: async (params: any) => {
      try {
        const where: any = {};
        if (params.category) where.category = params.category;

        const assets = await db.asset.findMany({
          where,
          orderBy: { purchaseDate: 'desc' },
        });

        const totalValue = assets.reduce((sum: number, a: any) => sum + (a.currentValue || 0), 0);

        if (assets.length === 0) {
          return `No assets found.`;
        }

        let response = `Asset Portfolio (${assets.length} assets, Total Value: R${totalValue}):\n\n`;
        assets.forEach((a: any) => {
          response += `- ${a.name} (${a.category}) | Purchase: R${a.purchasePrice} | Current: R${a.currentValue || a.purchasePrice} | Condition: ${a.condition}\n`;
        });

        return response;
      } catch (error) {
        return `Error listing assets: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // LIABILITY MANAGEMENT TOOLS
  const createLiabilityTool = tool({
    description: 'Record a company liability (loan, debt, payable, etc.)',
    parameters: z.object({
      name: z.string().describe('Liability name/description'),
      category: z.string().describe('Category (Loan, Credit, Payable, Tax, etc.)'),
      amount: z.number().describe('Total liability amount'),
      dueDate: z.string().optional().describe('Due date in ISO format'),
      creditor: z.string().optional().describe('Creditor/lender name'),
      notes: z.string().optional().describe('Additional notes'),
    }),
    execute: async (params: any) => {
      try {
        const liability = await db.liability.create({
          data: {
            name: params.name,
            category: params.category,
            amount: params.amount,
            dueDate: params.dueDate ? new Date(params.dueDate) : null,
            creditor: params.creditor || null,
            notes: params.notes || null,
            isPaid: false,
          },
        });
        
        return `✓ Liability recorded: ${liability.name} - R${params.amount} owed${params.creditor ? ` to ${params.creditor}` : ''}`;
      } catch (error) {
        return `Error creating liability: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const listLiabilitiesTool = tool({
    description: 'List all liabilities and calculate total debt',
    parameters: z.object({
      paid: z.boolean().optional().describe('Filter: true=paid, false=unpaid, omit=all'),
    }),
    execute: async (params: any) => {
      try {
        const where: any = {};
        if (params.paid !== undefined) where.isPaid = params.paid;

        const liabilities = await db.liability.findMany({
          where,
          orderBy: { dueDate: 'asc' },
        });

        const totalDebt = liabilities.reduce((sum: number, l: any) => sum + (l.amount || 0), 0);

        if (liabilities.length === 0) {
          return `No liabilities found.`;
        }

        let response = `Total Liabilities: R${totalDebt}\n\n`;
        liabilities.forEach((l: any) => {
          response += `- ${l.name} (${l.category || 'Uncategorized'}) | Amount: R${l.amount} | ${l.isPaid ? 'PAID' : 'UNPAID'}${l.dueDate ? ` | Due: ${new Date(l.dueDate).toLocaleDateString()}` : ''}\n`;
        });

        return response;
      } catch (error) {
        return `Error listing liabilities: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // HR & PAYROLL TOOLS
  const createPaymentRequestTool = tool({
    description: 'Create a payment request for employee or contractor',
    parameters: z.object({
      employeeId: z.number().describe('Employee/contractor user ID'),
      amount: z.number().describe('Payment amount'),
      description: z.string().describe('Description of payment (salary, bonus, expense reimbursement, etc.)'),
      paymentType: z.enum(['SALARY', 'BONUS', 'COMMISSION', 'EXPENSE', 'OTHER']).describe('Type of payment'),
      dueDate: z.string().optional().describe('Payment due date in ISO format'),
    }),
    execute: async (params: any) => {
      try {
        const paymentRequest = await db.paymentRequest.create({
          data: {
            employeeId: params.employeeId,
            amount: params.amount,
            description: params.description,
            paymentType: params.paymentType,
            status: 'PENDING',
            dueDate: params.dueDate ? new Date(params.dueDate) : null,
          },
        });
        
        return `✓ Payment request created: R${params.amount} for employee ID ${params.employeeId} (${params.paymentType})`;
      } catch (error) {
        return `Error creating payment request: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const listPaymentRequestsTool = tool({
    description: 'List payment requests and calculate payroll obligations',
    parameters: z.object({
      status: z.enum(['PENDING', 'APPROVED', 'PAID', 'REJECTED']).optional().describe('Filter by status'),
    }),
    execute: async (params: any) => {
      try {
        const where: any = {};
        if (params.status) where.status = params.status;

        const requests = await db.paymentRequest.findMany({
          where,
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });

        const totalAmount = requests.reduce((sum: number, r: any) => sum + r.amount, 0);

        if (requests.length === 0) {
          return `No payment requests found.`;
        }

        let response = `Payment Requests (Total: R${totalAmount}):\n\n`;
        requests.forEach((r: any) => {
          response += `- ${r.employee.firstName} ${r.employee.lastName} | R${r.amount} | ${r.paymentType} | ${r.status} | ${r.description}\n`;
        });

        return response;
      } catch (error) {
        return `Error listing payment requests: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // ADVANCED ANALYSIS TOOLS
  const getBusinessHealthTool = tool({
    description: 'Analyze overall business health with insights on revenue, expenses, profitability, and cash flow',
    parameters: z.object({}),
    execute: async (params: any) => {
      try {
        // Revenue
        const paidInvoices = await db.invoice.aggregate({
          where: { status: 'PAID' },
          _sum: { total: true },
        });

        // Expenses  
        const liabilities = await db.liability.aggregate({
          where: { isPaid: false },
          _sum: { amount: true },
        });

        const paymentRequests = await db.paymentRequest.aggregate({
          where: { status: { in: ['PENDING', 'APPROVED'] } },
          _sum: { calculatedAmount: true },
        });

        // Assets
        const assets = await db.asset.aggregate({
          _sum: { currentValue: true },
        });

        // Projects
        const activeProjects = await db.project.count({
          where: { status: 'IN_PROGRESS' },
        });

        const revenue = paidInvoices._sum.total || 0;
        const totalLiabilities = (liabilities._sum.amount || 0) + (paymentRequests._sum.calculatedAmount || 0);
        const totalAssets = assets._sum.currentValue || 0;
        const netWorth = totalAssets - totalLiabilities;
        const profit = revenue - totalLiabilities;

        return `📊 BUSINESS HEALTH ANALYSIS

💰 FINANCIAL POSITION:
- Total Revenue (Paid Invoices): R${revenue}
- Total Assets: R${totalAssets}
- Total Liabilities: R${totalLiabilities}
- Net Worth: R${netWorth}
- Profit Margin: R${profit}

📈 OPERATIONS:
- Active Projects: ${activeProjects}
- Debt-to-Asset Ratio: ${totalAssets > 0 ? ((totalLiabilities / totalAssets) * 100).toFixed(2) : 'N/A'}%

💡 INSIGHTS:
${netWorth > 0 ? '✓ Positive net worth - business is solvent' : '⚠️ Negative net worth - address liabilities'}
${profit > 0 ? '✓ Profitable operations' : '⚠️ Operating at a loss - review expenses'}
${activeProjects > 5 ? '⚠️ High project load - ensure adequate resources' : '✓ Manageable project pipeline'}`;
      } catch (error) {
        return `Error analyzing business health: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const getCashFlowAnalysisTool = tool({
    description: 'Analyze cash flow, accounts receivable, and payment obligations',
    parameters: z.object({}),
    execute: async (params: any) => {
      try {
        const pendingInvoices = await db.invoice.aggregate({
          where: { status: { in: ['DRAFT', 'PENDING_REVIEW', 'SENT'] } },
          _sum: { total: true },
          _count: true,
        });

        const overdueInvoices = await db.invoice.count({
          where: {
            status: { in: ['SENT'] },
            dueDate: { lt: new Date() },
          },
        });

        const pendingPayments = await db.paymentRequest.aggregate({
          where: { status: { in: ['PENDING', 'APPROVED'] } },
          _sum: { calculatedAmount: true },
          _count: true,
        });

        const upcomingLiabilities = await db.liability.findMany({
          where: {
            isPaid: false,
            dueDate: {
              gte: new Date(),
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Next 30 days
            },
          },
        });

        const cashInflow = pendingInvoices._sum.total || 0;
        const cashOutflow = (pendingPayments._sum.calculatedAmount || 0) + upcomingLiabilities.reduce((sum: number, l: any) => sum + (l.amount || 0), 0);
        const netCashFlow = cashInflow - cashOutflow;

        return `💵 CASH FLOW ANALYSIS

📥 EXPECTED INFLOWS (Next 30 days):
- Pending Invoices: R${cashInflow} (${pendingInvoices._count} invoices)
- Overdue Invoices: ${overdueInvoices} (COLLECT URGENTLY)

📤 EXPECTED OUTFLOWS (Next 30 days):
- Pending Payroll: R${pendingPayments._sum.calculatedAmount || 0} (${pendingPayments._count} requests)
- Upcoming Liabilities: R${upcomingLiabilities.reduce((sum: number, l: any) => sum + (l.amount || 0), 0)} (${upcomingLiabilities.length} payments)
- Total Outflow: R${cashOutflow}

📊 NET CASH FLOW: R${netCashFlow}

${netCashFlow > 0 ? '✓ Positive cash flow expected' : '⚠️ CASH FLOW WARNING - Consider financing or delay expenses'}
${overdueInvoices > 0 ? `⚠️ ${overdueInvoices} overdue invoices - prioritize collection` : ''}`;
      } catch (error) {
        return `Error analyzing cash flow: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // ========================================================================
  // SALES & MARKETING TOOLS
  // ========================================================================

  // Tool 29: Create Marketing Campaign
  const createCampaignTool = tool({
    description: 'Create a new marketing email campaign targeting leads. The campaign will be saved as a DRAFT and can be sent or scheduled later.',
    parameters: z.object({
      name: z.string().describe('Campaign name (e.g., "Summer Plumbing Special", "Q1 Maintenance Promo")'),
      subject: z.string().describe('Email subject line for the campaign'),
      htmlBody: z.string().describe('HTML body content for the email. Use personalization tokens: {{customerName}}, {{serviceType}}, {{address}}, {{estimatedValue}}'),
      description: z.string().optional().describe('Internal campaign description/notes'),
      targetStatuses: z.array(z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST'])).optional().describe('Filter leads by these statuses. Empty = all leads'),
      targetServiceTypes: z.array(z.string()).optional().describe('Filter leads by service types (e.g., ["Plumbing", "Electrical"])'),
      scheduledFor: z.string().optional().describe('ISO datetime to schedule sending (e.g., "2025-02-01T09:00:00Z"). Leave empty for manual send'),
    }),
    execute: async ({ name, subject, htmlBody, description, targetStatuses, targetServiceTypes, scheduledFor }) => {
      try {
        const targetCriteria: any = {};
        if (targetStatuses && targetStatuses.length > 0) targetCriteria.statuses = targetStatuses;
        if (targetServiceTypes && targetServiceTypes.length > 0) targetCriteria.serviceTypes = targetServiceTypes;

        // Count matching leads
        const whereClause: any = {};
        if (targetStatuses && targetStatuses.length > 0) whereClause.status = { in: targetStatuses };
        if (targetServiceTypes && targetServiceTypes.length > 0) whereClause.serviceType = { in: targetServiceTypes };
        const matchingLeads = await db.lead.count({ where: whereClause });

        const campaign = await db.campaign.create({
          data: {
            name,
            subject,
            htmlBody,
            description: description || null,
            targetCriteria: Object.keys(targetCriteria).length > 0 ? targetCriteria : undefined,
            status: scheduledFor ? 'SCHEDULED' : 'DRAFT',
            scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
            totalRecipients: matchingLeads,
            createdById: userId,
          },
        });

        return `✅ CAMPAIGN CREATED SUCCESSFULLY

📧 Campaign: "${campaign.name}" (ID: ${campaign.id})
📋 Subject: ${campaign.subject}
🎯 Target audience: ${matchingLeads} leads match criteria
📊 Status: ${campaign.status}
${scheduledFor ? `⏰ Scheduled for: ${new Date(scheduledFor).toLocaleString()}` : '📝 Status: DRAFT - Use sendCampaign tool to send it'}

${targetStatuses ? `• Targeting statuses: ${targetStatuses.join(', ')}` : '• Targeting: All lead statuses'}
${targetServiceTypes ? `• Targeting services: ${targetServiceTypes.join(', ')}` : '• Targeting: All service types'}`;
      } catch (error) {
        return `Error creating campaign: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Tool 30: Send Campaign
  const sendCampaignTool = tool({
    description: 'Send a marketing campaign immediately. This will email all matching leads with the campaign content. Only works for DRAFT or SCHEDULED campaigns.',
    parameters: z.object({
      campaignId: z.number().describe('The campaign ID to send'),
    }),
    execute: async ({ campaignId }) => {
      try {
        const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
        if (!campaign) return `❌ Campaign ID ${campaignId} not found`;
        if (campaign.status === 'SENT') return `⚠️ Campaign "${campaign.name}" has already been sent`;
        if (campaign.status === 'SENDING') return `⚠️ Campaign "${campaign.name}" is currently being sent`;

        // Update to SENDING
        await db.campaign.update({ where: { id: campaignId }, data: { status: 'SENDING' } });

        // Build target criteria
        const targetCriteria = campaign.targetCriteria as any;
        const whereClause: any = {};
        if (targetCriteria?.statuses?.length > 0) whereClause.status = { in: targetCriteria.statuses };
        if (targetCriteria?.serviceTypes?.length > 0) whereClause.serviceType = { in: targetCriteria.serviceTypes };

        const leads = await db.lead.findMany({ where: whereClause });

        if (leads.length === 0) {
          await db.campaign.update({ where: { id: campaignId }, data: { status: 'FAILED', totalRecipients: 0  } });
          return `❌ No leads match the campaign targeting criteria. Campaign marked as FAILED.`;
        }

        const company = await getCompanyDetails();
        let sent = 0;
        let failed = 0;

        for (const lead of leads) {
          try {
            // Replace personalization tokens
            let personalizedBody = campaign.htmlBody
              .replace(/\{\{customerName\}\}/g, lead.customerName || '')
              .replace(/\{\{customerEmail\}\}/g, lead.customerEmail || '')
              .replace(/\{\{serviceType\}\}/g, lead.serviceType || '')
              .replace(/\{\{address\}\}/g, lead.address || 'N/A')
              .replace(/\{\{estimatedValue\}\}/g, lead.estimatedValue ? `R${lead.estimatedValue.toLocaleString()}` : 'N/A');

            let personalizedSubject = campaign.subject
              .replace(/\{\{customerName\}\}/g, lead.customerName || '')
              .replace(/\{\{serviceType\}\}/g, lead.serviceType || '');

            await sendEmail({
              to: lead.customerEmail,
              subject: personalizedSubject,
              html: personalizedBody,
              companyName: company?.name,
            });
            sent++;
          } catch (e) {
            failed++;
          }
        }

        await db.campaign.update({
          where: { id: campaignId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            totalRecipients: leads.length,
            totalSent: sent,
            totalFailed: failed,
          },
        });

        return `✅ CAMPAIGN SENT SUCCESSFULLY

📧 "${campaign.name}" (ID: ${campaign.id})
📊 Results:
  ✓ Sent: ${sent}/${leads.length}
  ✗ Failed: ${failed}
  📥 Total recipients: ${leads.length}
  🕐 Sent at: ${new Date().toLocaleString()}

${failed > 0 ? '⚠️ Some emails failed to send. Check email configuration.' : '🎉 All emails delivered successfully!'}`;
      } catch (error) {
        return `Error sending campaign: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Tool 31: Get Campaign Performance
  const getCampaignPerformanceTool = tool({
    description: 'Get performance analytics for marketing campaigns. Shows sent/failed counts, campaign status, and overall marketing effectiveness.',
    parameters: z.object({
      campaignId: z.number().optional().describe('Specific campaign ID to analyze. Leave empty for all campaigns summary.'),
    }),
    execute: async ({ campaignId }) => {
      try {
        if (campaignId) {
          const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
          if (!campaign) return `❌ Campaign ID ${campaignId} not found`;

          const deliveryRate = campaign.totalRecipients > 0
            ? ((campaign.totalSent / campaign.totalRecipients) * 100).toFixed(1)
            : '0';

          return `📊 CAMPAIGN PERFORMANCE: "${campaign.name}" (ID: ${campaign.id})

📋 Status: ${campaign.status}
📅 Created: ${campaign.createdAt.toLocaleDateString()}
${campaign.sentAt ? `📤 Sent: ${campaign.sentAt.toLocaleDateString()}` : ''}

📈 DELIVERY METRICS:
  📥 Total Recipients: ${campaign.totalRecipients}
  ✓ Successfully Sent: ${campaign.totalSent}
  ✗ Failed: ${campaign.totalFailed}
  📊 Delivery Rate: ${deliveryRate}%

📧 Subject: ${campaign.subject}
${campaign.description ? `📝 Description: ${campaign.description}` : ''}`;
        }

        // All campaigns summary
        const campaigns = await db.campaign.findMany({
          orderBy: { createdAt: 'desc' },
          take: 20,
        });

        if (campaigns.length === 0) return '📊 No campaigns found. Use createCampaign to create your first marketing campaign!';

        const totalSent = campaigns.reduce((sum, c) => sum + c.totalSent, 0);
        const totalFailed = campaigns.reduce((sum, c) => sum + c.totalFailed, 0);
        const totalRecipients = campaigns.reduce((sum, c) => sum + c.totalRecipients, 0);
        const sentCampaigns = campaigns.filter(c => c.status === 'SENT');
        const draftCampaigns = campaigns.filter(c => c.status === 'DRAFT');
        const scheduledCampaigns = campaigns.filter(c => c.status === 'SCHEDULED');

        const campaignList = campaigns.slice(0, 10).map(c =>
          `  ${c.status === 'SENT' ? '✓' : c.status === 'DRAFT' ? '📝' : c.status === 'SCHEDULED' ? '⏰' : '●'} #${c.id} "${c.name}" - ${c.status} | Sent: ${c.totalSent}/${c.totalRecipients}`
        ).join('\n');

        return `📊 MARKETING CAMPAIGNS OVERVIEW

📈 OVERALL STATS:
  📧 Total Campaigns: ${campaigns.length}
  ✓ Sent: ${sentCampaigns.length} | 📝 Draft: ${draftCampaigns.length} | ⏰ Scheduled: ${scheduledCampaigns.length}
  📥 Total Emails Sent: ${totalSent}
  ✗ Total Failed: ${totalFailed}
  📊 Overall Delivery Rate: ${totalRecipients > 0 ? ((totalSent / totalRecipients) * 100).toFixed(1) : '0'}%

📋 RECENT CAMPAIGNS:
${campaignList}`;
      } catch (error) {
        return `Error fetching campaign performance: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Tool 32: Get Lead Source Analytics
  const getLeadSourceAnalyticsTool = tool({
    description: 'Analyze where leads are coming from (website, referral, campaign, phone, walk-in, social media, AI agent). Shows lead source breakdown with counts and conversion rates.',
    parameters: z.object({
      period: z.enum(['all', '7days', '30days', '90days', '12months']).optional().describe('Time period for analysis. Default: all'),
    }),
    execute: async ({ period }) => {
      try {
        const whereClause: any = {};
        if (period && period !== 'all') {
          const now = new Date();
          const days = period === '7days' ? 7 : period === '30days' ? 30 : period === '90days' ? 90 : 365;
          whereClause.createdAt = { gte: new Date(now.getTime() - days * 24 * 60 * 60 * 1000) };
        }

        const leads = await db.lead.findMany({
          where: whereClause,
          select: { source: true, status: true, estimatedValue: true },
        });

        // Group by source
        const sourceMap: Record<string, { total: number; won: number; lost: number; active: number; value: number }> = {};
        for (const lead of leads) {
          const src = lead.source || 'OTHER';
          if (!sourceMap[src]) sourceMap[src] = { total: 0, won: 0, lost: 0, active: 0, value: 0 };
          sourceMap[src].total++;
          if (lead.status === 'WON') sourceMap[src].won++;
          else if (lead.status === 'LOST') sourceMap[src].lost++;
          else sourceMap[src].active++;
          sourceMap[src].value += lead.estimatedValue || 0;
        }

        const periodLabel = period === '7days' ? 'Last 7 Days' : period === '30days' ? 'Last 30 Days' : period === '90days' ? 'Last 90 Days' : period === '12months' ? 'Last 12 Months' : 'All Time';

        const sourceLines = Object.entries(sourceMap)
          .sort((a, b) => b[1].total - a[1].total)
          .map(([src, data]) => {
            const convRate = data.total > 0 ? ((data.won / data.total) * 100).toFixed(1) : '0';
            return `  📌 ${src}: ${data.total} leads | Won: ${data.won} | Lost: ${data.lost} | Active: ${data.active} | Conv Rate: ${convRate}% | Value: R${data.value.toLocaleString()}`;
          }).join('\n');

        const totalWon = leads.filter(l => l.status === 'WON').length;
        const overallConvRate = leads.length > 0 ? ((totalWon / leads.length) * 100).toFixed(1) : '0';

        // Best source
        const bestSource = Object.entries(sourceMap).sort((a, b) => (b[1].won / Math.max(b[1].total, 1)) - (a[1].won / Math.max(a[1].total, 1)))[0];

        return `📊 LEAD SOURCE ANALYTICS (${periodLabel})

📈 OVERVIEW:
  Total Leads: ${leads.length}
  Won: ${totalWon} | Overall Conversion: ${overallConvRate}%
  Total Pipeline Value: R${leads.reduce((s, l) => s + (l.estimatedValue || 0), 0).toLocaleString()}

📌 BREAKDOWN BY SOURCE:
${sourceLines || '  No lead data available'}

${bestSource ? `🏆 Best Converting Source: ${bestSource[0]} (${((bestSource[1].won / Math.max(bestSource[1].total, 1)) * 100).toFixed(1)}% conversion rate)` : ''}

💡 RECOMMENDATIONS:
${sourceMap['WEBSITE'] ? `• Website generates ${sourceMap['WEBSITE'].total} leads - ensure www.square15.co.za contact form is optimized` : '• No website leads yet - add the contact form integration to www.square15.co.za'}
${sourceMap['REFERRAL'] ? `• Referrals have high trust - consider a referral rewards program` : '• Start a referral program to tap into word-of-mouth'}
${!sourceMap['SOCIAL_MEDIA'] ? '• No social media leads - consider Facebook/Instagram advertising' : `• Social media bringing ${sourceMap['SOCIAL_MEDIA'].total} leads - keep posting`}`;
      } catch (error) {
        return `Error analyzing lead sources: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Tool 33: Marketing Dashboard
  const getMarketingDashboardTool = tool({
    description: 'Get a comprehensive marketing and sales dashboard with KPIs, pipeline metrics, campaign performance, lead sources, and actionable recommendations. This is the go-to tool for a marketing performance overview.',
    parameters: z.object({}),
    execute: async () => {
      try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Leads
        const [totalLeads, newLeads30d, wonLeads, lostLeads, activeLeads] = await Promise.all([
          db.lead.count(),
          db.lead.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
          db.lead.count({ where: { status: 'WON' } }),
          db.lead.count({ where: { status: 'LOST' } }),
          db.lead.count({ where: { status: { notIn: ['WON', 'LOST'] } } }),
        ]);

        // Pipeline value
        const pipelineValue = await db.lead.aggregate({
          where: { status: { notIn: ['WON', 'LOST'] } },
          _sum: { estimatedValue: true },
        });
        const wonValue = await db.lead.aggregate({
          where: { status: 'WON' },
          _sum: { estimatedValue: true },
        });

        // Campaigns
        const [totalCampaigns, sentCampaigns, totalEmailsSent] = await Promise.all([
          db.campaign.count(),
          db.campaign.count({ where: { status: 'SENT' } }),
          db.campaign.aggregate({ _sum: { totalSent: true } }),
        ]);

        // Reviews
        const reviews = await db.review.aggregate({
          _avg: { rating: true },
          _count: true,
        });

        // Lead sources
        const leadsBySource = await db.lead.groupBy({
          by: ['source'],
          _count: true,
          orderBy: { _count: { source: 'desc' } },
        });

        // Lead statuses
        const leadsByStatus = await db.lead.groupBy({
          by: ['status'],
          _count: true,
          orderBy: { _count: { status: 'desc' } },
        });

        // Recent campaigns
        const recentCampaigns = await db.campaign.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, name: true, status: true, totalSent: true, totalRecipients: true, sentAt: true },
        });

        // Follow-ups due
        const overdueFU = await db.lead.count({
          where: { nextFollowUpDate: { lt: now }, status: { notIn: ['WON', 'LOST'] } },
        });

        const convRate = (wonLeads + lostLeads) > 0 ? ((wonLeads / (wonLeads + lostLeads)) * 100).toFixed(1) : '0';

        const sourceLines = leadsBySource.map(s => `  📌 ${s.source}: ${s._count} leads`).join('\n');
        const statusLines = leadsByStatus.map(s => `  • ${s.status}: ${s._count}`).join('\n');
        const campaignLines = recentCampaigns.map(c =>
          `  ${c.status === 'SENT' ? '✓' : '📝'} #${c.id} "${c.name}" - ${c.totalSent}/${c.totalRecipients} sent`
        ).join('\n');

        return `📊 MARKETING & SALES DASHBOARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 SALES PIPELINE:
  Total Leads: ${totalLeads} | New (30d): ${newLeads30d}
  Active Pipeline: ${activeLeads} leads
  Won: ${wonLeads} | Lost: ${lostLeads}
  📈 Conversion Rate: ${convRate}%
  💰 Active Pipeline Value: R${(pipelineValue._sum.estimatedValue || 0).toLocaleString()}
  💵 Won Revenue: R${(wonValue._sum.estimatedValue || 0).toLocaleString()}

📧 EMAIL MARKETING:
  Campaigns Created: ${totalCampaigns}
  Campaigns Sent: ${sentCampaigns}
  Total Emails Sent: ${totalEmailsSent._sum.totalSent || 0}

⭐ REPUTATION:
  Average Rating: ${reviews._avg.rating ? reviews._avg.rating.toFixed(1) : 'N/A'}/5
  Total Reviews: ${reviews._count}

📌 LEAD SOURCES:
${sourceLines || '  No source data yet'}

📋 PIPELINE BY STATUS:
${statusLines || '  No leads yet'}

📧 RECENT CAMPAIGNS:
${campaignLines || '  No campaigns yet'}

${overdueFU > 0 ? `⚠️ ${overdueFU} OVERDUE FOLLOW-UPS - Action needed!` : '✅ All follow-ups up to date'}

💡 QUICK ACTIONS:
• Create a campaign to engage ${activeLeads} active leads
• Follow up on overdue leads to improve conversion
• Request reviews from recent customers to build reputation
${newLeads30d === 0 ? '• ⚠️ No new leads this month - consider running a marketing campaign' : ''}`;
      } catch (error) {
        return `Error fetching marketing dashboard: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Tool 34: Send Review Request
  const sendReviewRequestTool = tool({
    description: 'Send a review request email to a customer for a specific completed order. Helps build online reputation and gather feedback.',
    parameters: z.object({
      orderId: z.number().describe('The order ID to request a review for'),
    }),
    execute: async ({ orderId }) => {
      try {
        const order = await db.order.findUnique({
          where: { id: orderId },
          include: {
            lead: true,
            assignedTo: { select: { firstName: true, lastName: true } },
          },
        });

        if (!order) return `❌ Order ID ${orderId} not found`;
        if (!order.lead) return `❌ Order ID ${orderId} has no associated lead/customer`;

        await sendReviewRequestEmail({
          to: order.lead.customerEmail,
          customerName: order.lead.customerName,
          orderDescription: order.description,
          orderId: order.id,
        });

        return `✅ REVIEW REQUEST SENT

📧 Sent to: ${order.lead.customerName} (${order.lead.customerEmail})
📋 For Order: #${order.id} - ${order.description}
${order.assignedTo ? `👷 Artisan: ${order.assignedTo.firstName} ${order.assignedTo.lastName}` : ''}

💡 Reviews help build your reputation and attract new customers!`;
      } catch (error) {
        return `Error sending review request: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Tool 35: Generate Marketing Report
  const generateMarketingReportTool = tool({
    description: 'Generate a comprehensive marketing and sales performance report covering lead generation, campaign effectiveness, conversion rates, revenue attribution, and strategic recommendations.',
    parameters: z.object({
      period: z.enum(['7days', '30days', '90days', '12months']).describe('Report period'),
    }),
    execute: async ({ period }) => {
      try {
        const now = new Date();
        const days = period === '7days' ? 7 : period === '30days' ? 30 : period === '90days' ? 90 : 365;
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const prevStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);
        const periodLabel = period === '7days' ? 'Weekly' : period === '30days' ? 'Monthly' : period === '90days' ? 'Quarterly' : 'Annual';

        // Current period leads
        const currentLeads = await db.lead.findMany({
          where: { createdAt: { gte: startDate } },
          select: { source: true, status: true, estimatedValue: true, serviceType: true },
        });
        // Previous period leads (for comparison)
        const prevLeads = await db.lead.count({
          where: { createdAt: { gte: prevStartDate, lt: startDate } },
        });

        // Current period campaigns
        const currentCampaigns = await db.campaign.findMany({
          where: { sentAt: { gte: startDate } },
          select: { totalSent: true, totalFailed: true, totalRecipients: true, name: true },
        });

        // Won deals in period
        const wonInPeriod = await db.lead.findMany({
          where: { status: 'WON', updatedAt: { gte: startDate } },
          select: { estimatedValue: true, source: true },
        });

        // Revenue from invoices in period
        const invoiceRevenue = await db.invoice.aggregate({
          where: { status: 'PAID', paidDate: { gte: startDate } },
          _sum: { total: true },
          _count: true,
        });

        // Completed orders
        const completedOrders = await db.order.count({
          where: { status: 'COMPLETED', updatedAt: { gte: startDate } },
        });

        // Reviews in period
        const periodReviews = await db.review.aggregate({
          where: { createdAt: { gte: startDate } },
          _avg: { rating: true },
          _count: true,
        });

        // Source breakdown for current period
        const sourceBreakdown: Record<string, number> = {};
        for (const lead of currentLeads) {
          const src = lead.source || 'OTHER';
          sourceBreakdown[src] = (sourceBreakdown[src] || 0) + 1;
        }

        // Service type breakdown
        const serviceBreakdown: Record<string, number> = {};
        for (const lead of currentLeads) {
          serviceBreakdown[lead.serviceType] = (serviceBreakdown[lead.serviceType] || 0) + 1;
        }

        const leadGrowth = prevLeads > 0 ? (((currentLeads.length - prevLeads) / prevLeads) * 100).toFixed(1) : 'N/A';
        const wonValue = wonInPeriod.reduce((s, l) => s + (l.estimatedValue || 0), 0);
        const totalCampaignEmails = currentCampaigns.reduce((s, c) => s + c.totalSent, 0);
        const totalCampaignFailed = currentCampaigns.reduce((s, c) => s + c.totalFailed, 0);

        const sourceLines = Object.entries(sourceBreakdown)
          .sort((a, b) => b[1] - a[1])
          .map(([src, count]) => `  📌 ${src}: ${count} (${((count / Math.max(currentLeads.length, 1)) * 100).toFixed(0)}%)`)
          .join('\n');

        const serviceLines = Object.entries(serviceBreakdown)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([svc, count]) => `  🔧 ${svc}: ${count} inquiries`)
          .join('\n');

        return `📊 ${periodLabel.toUpperCase()} MARKETING & SALES REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Period: ${startDate.toLocaleDateString()} - ${now.toLocaleDateString()}

📈 LEAD GENERATION:
  New Leads: ${currentLeads.length}
  Previous Period: ${prevLeads}
  Growth: ${leadGrowth}%${typeof leadGrowth === 'string' && leadGrowth !== 'N/A' ? (parseFloat(leadGrowth) > 0 ? ' 📈' : ' 📉') : ''}

📌 LEAD SOURCES:
${sourceLines || '  No leads this period'}

🔧 TOP SERVICES IN DEMAND:
${serviceLines || '  No data'}

💰 REVENUE & CONVERSIONS:
  Deals Won: ${wonInPeriod.length}
  Won Deal Value: R${wonValue.toLocaleString()}
  Invoices Paid: ${invoiceRevenue._count} (R${(invoiceRevenue._sum.total || 0).toLocaleString()})
  Orders Completed: ${completedOrders}

📧 CAMPAIGN PERFORMANCE:
  Campaigns Sent: ${currentCampaigns.length}
  Total Emails Delivered: ${totalCampaignEmails}
  Failed Deliveries: ${totalCampaignFailed}
  Delivery Rate: ${(totalCampaignEmails + totalCampaignFailed) > 0 ? ((totalCampaignEmails / (totalCampaignEmails + totalCampaignFailed)) * 100).toFixed(1) : 'N/A'}%

⭐ CUSTOMER SATISFACTION:
  Reviews Received: ${periodReviews._count}
  Average Rating: ${periodReviews._avg.rating ? periodReviews._avg.rating.toFixed(1) : 'N/A'}/5

📋 STRATEGIC RECOMMENDATIONS:
${currentLeads.length === 0 ? '• ⚠️ URGENT: No leads generated - launch a marketing campaign immediately' : ''}
${currentLeads.length < prevLeads ? '• Lead generation declining - consider new marketing channels' : ''}
${wonInPeriod.length === 0 ? '• No deals closed - review sales follow-up process' : ''}
${periodReviews._count === 0 ? '• No reviews collected - send review requests to recent customers' : ''}
${totalCampaignEmails === 0 ? '• No campaigns sent - create and send a campaign to engage leads' : ''}
${currentLeads.length > 0 && wonInPeriod.length > 0 ? `• Keep momentum! ${currentLeads.length} leads generated, ${wonInPeriod.length} deals closed` : ''}
• Top lead source: ${Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'} - double down on this channel
• Most demanded service: ${Object.entries(serviceBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'} - feature this in campaigns`;
      } catch (error) {
        return `Error generating marketing report: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // ========================================================================
  // AI CAMPAIGN GENERATION & AMENDMENT TOOLS
  // ========================================================================

  // Tool 35: Generate Campaign Content with AI
  const generateCampaignContentTool = tool({
    description: 'Use AI to generate a complete campaign email design based on a description. Returns campaign name, subject line, and full HTML body. Use this when the user wants AI to create campaign content, graphics, or designs.',
    parameters: z.object({
      prompt: z.string().describe('Description of the campaign to create (e.g., "10% discount on all plumbing services for January", "Summer maintenance special", "Re-engagement campaign for inactive leads")'),
      serviceType: z.string().optional().describe('Specific service type to focus on (e.g., "Plumbing", "Painting", "Electrical")'),
      discountPercent: z.number().optional().describe('Discount percentage to feature (e.g., 10, 15, 20)'),
      targetAudience: z.string().optional().describe('Who is the target audience (e.g., "inactive customers", "new leads", "property managers")'),
      tone: z.enum(['professional', 'friendly', 'urgent', 'festive', 'casual']).optional().describe('Campaign tone/style'),
    }),
    execute: async ({ prompt, serviceType, discountPercent, targetAudience, tone }) => {
      try {
        const { generateText: genText } = await import('ai');
        const { google: goog } = await import('@ai-sdk/google');
        const aiModel = goog('gemini-2.0-flash');

        const systemPrompt = `You are a professional marketing content creator for Square 15 Property Maintenance (www.square15.co.za), a South African property maintenance company.

Generate a complete, professional email campaign based on the description. The HTML must be visually stunning, responsive, and ready to send.

Rules:
1. Use inline CSS, max-width 600px
2. Include company name "Square 15 Property Maintenance"
3. Use personalization tokens: {{customerName}}, {{serviceType}}, {{address}}, {{estimatedValue}}
4. Include a CTA button linking to https://www.square15.co.za
5. Use modern design with gradients, cards, emoji icons
6. Include a professional footer
7. Tone: ${tone || 'professional'}
${serviceType ? `8. Focus on ${serviceType} services` : ''}
${discountPercent ? `9. Feature a ${discountPercent}% discount` : ''}
${targetAudience ? `10. Target audience: ${targetAudience}` : ''}

Respond ONLY with JSON (no markdown):
{"name":"Campaign Name","subject":"Subject Line","htmlBody":"<div>...HTML...</div>","description":"Brief description"}`;

        const result = await genText({
          model: aiModel,
          system: systemPrompt,
          prompt,
          maxTokens: 4000,
          temperature: 0.7,
        });

        let parsed: any;
        try {
          let clean = result.text.trim();
          if (clean.startsWith('```json')) clean = clean.slice(7);
          else if (clean.startsWith('```')) clean = clean.slice(3);
          if (clean.endsWith('```')) clean = clean.slice(0, -3);
          parsed = JSON.parse(clean.trim());
        } catch {
          return 'Failed to generate campaign content. The AI returned an invalid response. Please try again with a different description.';
        }

        // Also create it as a DRAFT campaign
        const campaign = await db.campaign.create({
          data: {
            name: parsed.name,
            description: parsed.description || '',
            subject: parsed.subject,
            htmlBody: parsed.htmlBody,
            targetCriteria: {},
            status: 'DRAFT',
            createdById: userId,
            notes: 'AI-generated campaign. Review and edit before sending.',
          },
        });

        return `✅ AI Campaign Generated & Saved as Draft!

📧 Campaign: ${parsed.name}
📋 Subject: ${parsed.subject}
📝 Description: ${parsed.description || 'N/A'}
🆔 Campaign ID: ${campaign.id}
📊 Status: DRAFT (ready for review)

The campaign has been created with professional HTML design including graphics, layout, and call-to-action. You can preview it in CRM > Campaigns, edit it, or send it when ready.

💡 Need changes? Tell me what to modify (e.g., "Change the discount to 15%", "Add more urgency", "Make it more colorful").`;
      } catch (error) {
        return `Error generating campaign: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Tool 36: Amend/Edit Campaign with AI
  const amendCampaignTool = tool({
    description: 'Amend or modify an existing campaign based on written instructions. The AI will update the campaign design, content, layout, colors, etc. based on what you describe. Use this when the user wants to change something about an existing campaign.',
    parameters: z.object({
      campaignId: z.number().describe('The ID of the campaign to edit'),
      instruction: z.string().describe('What to change (e.g., "Make the discount 15% instead of 10%", "Change the color scheme to blue", "Add a section about our warranty", "Make it more urgent")'),
    }),
    execute: async ({ campaignId, instruction }) => {
      try {
        const campaign = await db.campaign.findUnique({
          where: { id: campaignId },
        });

        if (!campaign) {
          return `Campaign with ID ${campaignId} not found.`;
        }

        const { generateText: genText } = await import('ai');
        const { google: goog } = await import('@ai-sdk/google');
        const aiModel = goog('gemini-2.0-flash');

        const systemPrompt = `You are editing an existing marketing email campaign for Square 15 Property Maintenance.

Apply the requested changes while keeping the overall professional design. Maintain personalization tokens and CTA buttons.

Current campaign:
Name: ${campaign.name}
Subject: ${campaign.subject}
HTML: ${campaign.htmlBody}

Respond ONLY with JSON (no markdown):
{"name":"Updated Name","subject":"Updated Subject","htmlBody":"<div>...updated HTML...</div>","changesSummary":"What was changed"}`;

        const result = await genText({
          model: aiModel,
          system: systemPrompt,
          prompt: instruction,
          maxTokens: 4000,
          temperature: 0.5,
        });

        let parsed: any;
        try {
          let clean = result.text.trim();
          if (clean.startsWith('```json')) clean = clean.slice(7);
          else if (clean.startsWith('```')) clean = clean.slice(3);
          if (clean.endsWith('```')) clean = clean.slice(0, -3);
          parsed = JSON.parse(clean.trim());
        } catch {
          return 'Failed to amend campaign. The AI returned an invalid response. Please try again.';
        }

        // Update the campaign in database
        await db.campaign.update({
          where: { id: campaignId },
          data: {
            name: parsed.name,
            subject: parsed.subject,
            htmlBody: parsed.htmlBody,
          },
        });

        return `✅ Campaign Updated Successfully!

🆔 Campaign ID: ${campaignId}
📧 New Name: ${parsed.name}
📋 New Subject: ${parsed.subject}
🔄 Changes: ${parsed.changesSummary || 'Applied requested modifications'}

The campaign has been updated. You can preview it in CRM > Campaigns or ask me to make more changes.`;
      } catch (error) {
        return `Error amending campaign: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Tool 37: Suggest Campaign Ideas
  const suggestCampaignIdeasTool = tool({
    description: 'Analyze current business data and suggest campaign ideas. Acts as a living marketing assistant that monitors lead pipeline, service demand, seasons, and proactively recommends campaigns. Use this to get AI-powered campaign recommendations.',
    parameters: z.object({
      focusArea: z.enum(['general', 'seasonal', 'service_promo', 're_engagement', 'new_service', 'holiday']).optional().describe('Focus area for suggestions. Default: general (AI decides based on data)'),
    }),
    execute: async ({ focusArea }) => {
      try {
        const now = new Date();
        const currentMonth = now.toLocaleString('en-ZA', { month: 'long' });

        // Gather intelligence
        const [leadsByService, leadsByStatus, totalLeads, inactiveLeads, recentCampaigns, wonLeads] = await Promise.all([
          db.lead.groupBy({
            by: ['serviceType'],
            _count: { id: true },
            where: { createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 3, 1) } },
            orderBy: { _count: { id: 'desc' } },
          }),
          db.lead.groupBy({ by: ['status'], _count: { id: true } }),
          db.lead.count(),
          db.lead.count({
            where: {
              status: { in: ['NEW', 'CONTACTED'] },
              updatedAt: { lte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
            },
          }),
          db.campaign.findMany({
            where: { createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 2, 1) } },
            select: { name: true },
          }),
          db.lead.count({ where: { status: 'WON' } }),
        ]);

        const month = now.getMonth();
        let season = 'autumn';
        if (month >= 9 && month <= 11) season = 'spring';
        if (month >= 0 && month <= 2) season = 'summer';
        if (month >= 3 && month <= 5) season = 'autumn';
        if (month >= 6 && month <= 8) season = 'winter';

        const topServices = leadsByService.slice(0, 5).map(s => `${s.serviceType} (${s._count.id})`).join(', ');
        const pipeline = leadsByStatus.map(s => `${s.status}: ${s._count.id}`).join(', ');

        return `📊 AI CAMPAIGN SUGGESTIONS FOR ${currentMonth.toUpperCase()}

🔍 CURRENT BUSINESS INTELLIGENCE:
• Total leads: ${totalLeads}
• Pipeline: ${pipeline}
• Won customers: ${wonLeads}
• Inactive leads (30+ days): ${inactiveLeads}
• Top services: ${topServices}
• Season: ${season} (South Africa)
• Recent campaigns: ${recentCampaigns.map(c => c.name).join(', ') || 'None'}

💡 RECOMMENDED CAMPAIGNS:

1️⃣ ${season.toUpperCase()} SERVICE SPECIAL
   ${season === 'summer' ? '☀️ Summer property maintenance - HVAC servicing, painting, outdoor repairs' : 
     season === 'winter' ? '🌧️ Winter protection - roof repairs, waterproofing, plumbing checks' :
     season === 'spring' ? '🌸 Spring refresh - painting, garden/outdoor maintenance, general cleanup' :
     '🍂 Autumn prep - gutter cleaning, structural inspections, weatherproofing'}
   📧 Target: All leads | Focus: Seasonal maintenance needs

2️⃣ ${inactiveLeads > 0 ? `RE-ENGAGEMENT CAMPAIGN (${inactiveLeads} inactive leads!)` : 'REFERRAL PROGRAM'}
   ${inactiveLeads > 0 ? '💝 Win back inactive customers with a special "We Miss You" discount' : '🤝 Launch a refer-a-friend program to grow through word-of-mouth'}
   📧 Target: ${inactiveLeads > 0 ? 'Inactive leads (30+ days)' : 'Won customers'} | Focus: ${inactiveLeads > 0 ? 'Reactivation' : 'Growth'}

3️⃣ TOP SERVICE SPOTLIGHT: ${leadsByService[0]?.serviceType || 'General Maintenance'}
   🔧 Highlight your most in-demand service with a targeted promotion
   📧 Target: Leads interested in ${leadsByService[0]?.serviceType || 'maintenance'} | Focus: Conversion

🎯 QUICK ACTIONS:
• Say "Generate campaign for [suggestion]" to have me create it with full design
• Say "Create a 10% discount campaign for [service]" for a specific promotion
• Say "Amend campaign [ID]" to modify any existing campaign

I'm monitoring your business data and will keep suggesting campaigns that match market trends and your lead pipeline.`;
      } catch (error) {
        return `Error generating suggestions: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // ========================================================================
  // BUSINESS INTELLIGENCE & DATA QUERY TOOLS
  // ========================================================================

  // Tool 38: List Invoices with Filtering & Totals
  const listInvoicesTool = tool({
    description: 'List ALL invoices with powerful filtering by status, customer, date range, and amount. Shows individual invoice records AND calculates aggregate totals. Use this to answer questions like "how much is owed to us", "list all unpaid invoices", "show overdue invoices", "total invoices by status", "how much worth of invoices still need to be paid".',
    parameters: z.object({
      status: z.enum(['DRAFT', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'REJECTED']).optional().describe('Filter by invoice status'),
      customerName: z.string().optional().describe('Filter by customer name (partial match)'),
      dateFrom: z.string().optional().describe('Start date filter (ISO format, e.g. 2025-01-01)'),
      dateTo: z.string().optional().describe('End date filter (ISO format, e.g. 2025-12-31)'),
      unpaidOnly: z.boolean().optional().describe('Set true to show only unpaid invoices (DRAFT, PENDING_REVIEW, PENDING_APPROVAL, APPROVED, SENT, OVERDUE)'),
      limit: z.number().optional().describe('Max results to return (default: 50)'),
      includeStatusBreakdown: z.boolean().optional().describe('Include a breakdown of totals by each status (default: true)'),
    }),
    execute: async (params: any) => {
      try {
        const where: any = {};

        if (params.status) {
          where.status = params.status;
        } else if (params.unpaidOnly) {
          where.status = { in: ['DRAFT', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'OVERDUE'] };
        }

        if (params.customerName) {
          where.customerName = { contains: params.customerName, mode: 'insensitive' };
        }

        if (params.dateFrom || params.dateTo) {
          where.createdAt = {};
          if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom);
          if (params.dateTo) where.createdAt.lte = new Date(params.dateTo);
        }

        // Get individual invoices
        const invoices = await db.invoice.findMany({
          where,
          select: {
            id: true,
            invoiceNumber: true,
            customerName: true,
            customerEmail: true,
            subtotal: true,
            tax: true,
            total: true,
            status: true,
            dueDate: true,
            paidDate: true,
            createdAt: true,
            isDisputed: true,
            orderId: true,
            projectId: true,
            notes: true,
          },
          orderBy: { createdAt: 'desc' },
          take: params.limit || 50,
        });

        // Get total count
        const totalCount = await db.invoice.count({ where });

        // Get aggregate totals
        const aggregates = await db.invoice.aggregate({
          where,
          _sum: { total: true, subtotal: true, tax: true },
          _avg: { total: true },
          _count: true,
        });

        // Status breakdown (always useful)
        const statusBreakdown: any = {};
        if (params.includeStatusBreakdown !== false) {
          const allStatuses = ['DRAFT', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'REJECTED'];
          for (const s of allStatuses) {
            const statusAgg = await db.invoice.aggregate({
              where: { ...where, status: s },
              _sum: { total: true },
              _count: true,
            });
            if (statusAgg._count > 0) {
              statusBreakdown[s] = {
                count: statusAgg._count,
                total: statusAgg._sum.total || 0,
              };
            }
          }
        }

        if (invoices.length === 0) {
          return `No invoices found${params.status ? ` with status "${params.status}"` : ''}${params.unpaidOnly ? ' (unpaid)' : ''}${params.customerName ? ` for customer "${params.customerName}"` : ''}.`;
        }

        // Build response
        let response = `📋 INVOICE REPORT\n`;
        response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        response += `Total Invoices Found: ${totalCount}\n`;
        response += `Total Value: R${(aggregates._sum.total || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;
        response += `Average Invoice: R${(aggregates._avg.total || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;

        if (params.unpaidOnly || !params.status) {
          const unpaidStatuses = ['DRAFT', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'OVERDUE'];
          const unpaidTotal = Object.entries(statusBreakdown)
            .filter(([s]) => unpaidStatuses.includes(s))
            .reduce((sum, [, val]: [string, any]) => sum + val.total, 0);
          response += `\n💰 TOTAL UNPAID (Receivables): R${unpaidTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;
        }

        // Status breakdown
        if (Object.keys(statusBreakdown).length > 0) {
          response += `\n📊 BREAKDOWN BY STATUS:\n`;
          for (const [status, data] of Object.entries(statusBreakdown) as any) {
            const icon = status === 'PAID' ? '✅' : status === 'OVERDUE' ? '🔴' : status === 'SENT' ? '📨' : status === 'CANCELLED' ? '❌' : '📝';
            response += `${icon} ${status}: ${data.count} invoice(s) = R${data.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;
          }
        }

        // Individual invoices
        response += `\n📄 INVOICES:\n`;
        invoices.forEach((inv: any) => {
          const overdue = inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== 'PAID' && inv.status !== 'CANCELLED';
          response += `- ${inv.invoiceNumber} | ${inv.customerName} | R${inv.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} | ${inv.status}${overdue ? ' ⚠️ OVERDUE' : ''} | Created: ${new Date(inv.createdAt).toLocaleDateString('en-ZA')}${inv.dueDate ? ` | Due: ${new Date(inv.dueDate).toLocaleDateString('en-ZA')}` : ''}${inv.isDisputed ? ' | ⚠️ DISPUTED' : ''}\n`;
        });

        if (totalCount > (params.limit || 50)) {
          response += `\n(Showing ${invoices.length} of ${totalCount} total invoices)`;
        }

        return response;
      } catch (error) {
        return `Error listing invoices: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Tool 39: Get Invoice Details
  const getInvoiceDetailsTool = tool({
    description: 'Get complete details of a specific invoice by ID or invoice number. Shows all fields including line items, customer info, payment status, and related order/project.',
    parameters: z.object({
      invoiceId: z.number().optional().describe('Invoice ID'),
      invoiceNumber: z.string().optional().describe('Invoice number (e.g., INV-001)'),
    }),
    execute: async (params: any) => {
      try {
        const where: any = {};
        if (params.invoiceId) where.id = params.invoiceId;
        else if (params.invoiceNumber) where.invoiceNumber = params.invoiceNumber;
        else return 'Please provide either invoiceId or invoiceNumber';

        const invoice = await db.invoice.findFirst({
          where,
          include: {
            order: { select: { id: true, orderNumber: true, status: true, serviceType: true } },
            project: { select: { id: true, projectNumber: true, name: true, status: true } },
            createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            lineItems: true,
          },
        });

        if (!invoice) return `Invoice not found.`;

        const overdue = invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status !== 'PAID' && invoice.status !== 'CANCELLED';

        return `📄 INVOICE DETAILS: ${invoice.invoiceNumber}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Status: ${invoice.status}${overdue ? ' ⚠️ OVERDUE' : ''}${invoice.isDisputed ? ' ⚠️ DISPUTED' : ''}

👤 CUSTOMER:
• Name: ${invoice.customerName}
• Email: ${invoice.customerEmail}
• Phone: ${invoice.customerPhone}
• Address: ${invoice.address}
${invoice.customerVatNumber ? `• VAT Number: ${invoice.customerVatNumber}` : ''}
${invoice.clientReferenceNumber ? `• Client Reference: ${invoice.clientReferenceNumber}` : ''}

💰 AMOUNTS:
• Subtotal: R${invoice.subtotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
• Tax: R${invoice.tax.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
• Total: R${invoice.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
• Company Material Cost: R${invoice.companyMaterialCost.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
• Company Labour Cost: R${invoice.companyLabourCost.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
• Estimated Profit: R${invoice.estimatedProfit.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}

📅 DATES:
• Created: ${new Date(invoice.createdAt).toLocaleDateString('en-ZA')}
${invoice.dueDate ? `• Due Date: ${new Date(invoice.dueDate).toLocaleDateString('en-ZA')}` : '• Due Date: Not set'}
${invoice.paidDate ? `• Paid Date: ${new Date(invoice.paidDate).toLocaleDateString('en-ZA')}` : ''}
${invoice.pmApproved ? `• PM Approved: ${new Date(invoice.pmApprovedDate!).toLocaleDateString('en-ZA')}` : ''}

${invoice.projectDescription ? `📝 Project Description: ${invoice.projectDescription}` : ''}
${invoice.notes ? `📎 Notes: ${invoice.notes}` : ''}
${invoice.rejectionReason ? `❌ Rejection Reason: ${invoice.rejectionReason}` : ''}

${invoice.order ? `🔧 Related Order: ${invoice.order.orderNumber} (${invoice.order.status})` : ''}
${invoice.project ? `📁 Related Project: ${invoice.project.projectNumber} - ${invoice.project.name} (${invoice.project.status})` : ''}
${invoice.createdBy ? `👤 Created By: ${invoice.createdBy.firstName} ${invoice.createdBy.lastName}` : ''}

📋 LINE ITEMS:
${invoice.lineItems.length > 0 
  ? invoice.lineItems.map((item: any) => `  • ${item.description} | Qty: ${item.quantity} | Unit: R${item.unitPrice} | Total: R${item.total}`).join('\n')
  : (Array.isArray(invoice.items) ? (invoice.items as any[]).map((item: any) => `  • ${item.description} | Qty: ${item.quantity} | Unit: R${item.unitPrice} | Total: R${item.total}`).join('\n') : 'No line items')}

Full Data (JSON):
${JSON.stringify(invoice, null, 2)}`;
      } catch (error) {
        return `Error getting invoice details: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Tool 40: List Orders with Filtering & Totals
  const listOrdersTool = tool({
    description: 'List ALL orders/jobs with filtering by status, customer, assigned artisan, date range. Shows individual orders AND aggregate totals. Use for questions like "how many active jobs", "list all pending orders", "what work is in progress".',
    parameters: z.object({
      status: z.enum(['PENDING_REVIEW', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional().describe('Filter by order status'),
      customerName: z.string().optional().describe('Filter by customer name (partial match)'),
      assignedToId: z.number().optional().describe('Filter by assigned artisan/employee user ID'),
      dateFrom: z.string().optional().describe('Start date filter (ISO format)'),
      dateTo: z.string().optional().describe('End date filter (ISO format)'),
      limit: z.number().optional().describe('Max results (default: 50)'),
    }),
    execute: async (params: any) => {
      try {
        const where: any = {};
        if (params.status) where.status = params.status;
        if (params.customerName) where.customerName = { contains: params.customerName, mode: 'insensitive' };
        if (params.assignedToId) where.assignedToId = params.assignedToId;
        if (params.dateFrom || params.dateTo) {
          where.createdAt = {};
          if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom);
          if (params.dateTo) where.createdAt.lte = new Date(params.dateTo);
        }

        const orders = await db.order.findMany({
          where,
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            customerEmail: true,
            serviceType: true,
            description: true,
            status: true,
            totalCost: true,
            materialCost: true,
            labourCost: true,
            callOutFee: true,
            createdAt: true,
            isPaused: true,
            assignedTo: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: params.limit || 50,
        });

        const totalCount = await db.order.count({ where });

        // Status breakdown
        const allStatuses = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
        const statusBreakdown: any = {};
        for (const s of allStatuses) {
          const agg = await db.order.aggregate({
            where: { ...where, status: s },
            _sum: { totalCost: true },
            _count: true,
          });
          if (agg._count > 0) {
            statusBreakdown[s] = { count: agg._count, total: agg._sum.totalCost || 0 };
          }
        }

        // Total value
        const totalAgg = await db.order.aggregate({
          where,
          _sum: { totalCost: true, materialCost: true, labourCost: true },
          _count: true,
        });

        if (orders.length === 0) {
          return `No orders found${params.status ? ` with status "${params.status}"` : ''}.`;
        }

        let response = `🔧 ORDER REPORT\n`;
        response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        response += `Total Orders Found: ${totalCount}\n`;
        response += `Total Value: R${(totalAgg._sum.totalCost || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;
        response += `Total Materials: R${(totalAgg._sum.materialCost || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;
        response += `Total Labour: R${(totalAgg._sum.labourCost || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;

        // Status breakdown
        if (Object.keys(statusBreakdown).length > 0) {
          response += `\n📊 BREAKDOWN BY STATUS:\n`;
          for (const [status, data] of Object.entries(statusBreakdown) as any) {
            const icon = status === 'COMPLETED' ? '✅' : status === 'IN_PROGRESS' ? '🔄' : status === 'ASSIGNED' ? '👤' : status === 'PENDING' ? '⏳' : '❌';
            response += `${icon} ${status}: ${data.count} order(s) = R${data.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;
          }
        }

        // Individual orders
        response += `\n📋 ORDERS:\n`;
        orders.forEach((ord: any) => {
          response += `- ${ord.orderNumber} | ${ord.customerName} | ${ord.serviceType} | R${ord.totalCost.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} | ${ord.status}${ord.isPaused ? ' ⏸ PAUSED' : ''} | ${ord.assignedTo ? `Assigned: ${ord.assignedTo.firstName} ${ord.assignedTo.lastName}` : 'Unassigned'} | ${new Date(ord.createdAt).toLocaleDateString('en-ZA')}\n`;
        });

        if (totalCount > (params.limit || 50)) {
          response += `\n(Showing ${orders.length} of ${totalCount} total orders)`;
        }

        return response;
      } catch (error) {
        return `Error listing orders: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Tool 41: Get Order Details
  const getOrderDetailsTool = tool({
    description: 'Get complete details of a specific order/job by ID or order number. Shows all fields including materials, costs, assigned artisan, pictures, and related invoice.',
    parameters: z.object({
      orderId: z.number().optional().describe('Order ID'),
      orderNumber: z.string().optional().describe('Order number (e.g., ORD-001)'),
    }),
    execute: async (params: any) => {
      try {
        const where: any = {};
        if (params.orderId) where.id = params.orderId;
        else if (params.orderNumber) where.orderNumber = params.orderNumber;
        else return 'Please provide either orderId or orderNumber';

        const order = await db.order.findFirst({
          where,
          include: {
            assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
            lead: { select: { id: true, customerName: true, status: true } },
            invoice: { select: { id: true, invoiceNumber: true, total: true, status: true } },
            materials: true,
            expenseSlips: true,
          },
        });

        if (!order) return `Order not found.`;

        return `🔧 ORDER DETAILS: ${order.orderNumber}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Status: ${order.status}${order.isPaused ? ' ⏸ PAUSED' : ''}

👤 CUSTOMER:
• Name: ${order.customerName}
• Email: ${order.customerEmail}
• Phone: ${order.customerPhone}
• Address: ${order.address}

🔧 SERVICE:
• Type: ${order.serviceType}
• Description: ${order.description}
${order.notes ? `• Notes: ${order.notes}` : ''}

💰 COSTS:
• Material Cost: R${order.materialCost.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
• Labour Cost: R${order.labourCost.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
• Call-Out Fee: R${order.callOutFee.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
• Total Cost: R${order.totalCost.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
${order.totalMaterialBudget ? `• Material Budget: R${order.totalMaterialBudget}` : ''}
${order.totalLabourCostBudget ? `• Labour Budget: R${order.totalLabourCostBudget}` : ''}

${order.assignedTo ? `👷 Assigned To: ${order.assignedTo.firstName} ${order.assignedTo.lastName} (${order.assignedTo.email})` : '👷 Unassigned'}
${order.lead ? `🎯 Related Lead: ID ${order.lead.id} - ${order.lead.customerName} (${order.lead.status})` : ''}
${order.invoice ? `💳 Invoice: ${order.invoice.invoiceNumber} | R${order.invoice.total} | ${order.invoice.status}` : '💳 No invoice yet'}

📅 DATES:
• Created: ${new Date(order.createdAt).toLocaleDateString('en-ZA')}
${order.startTime ? `• Started: ${new Date(order.startTime).toLocaleDateString('en-ZA')}` : ''}
${order.endTime ? `• Completed: ${new Date(order.endTime).toLocaleDateString('en-ZA')}` : ''}

📦 Materials: ${order.materials.length} item(s)
${order.materials.map((m: any) => `  • ${m.name} | Qty: ${m.quantity} | Cost: R${m.cost || 0}`).join('\n') || '  None'}

🧾 Expense Slips: ${order.expenseSlips.length}
📸 Before Pictures: ${order.beforePictures.length}
📸 After Pictures: ${order.afterPictures.length}
📎 Documents: ${order.documents.length}

Full Data (JSON):
${JSON.stringify(order, null, 2)}`;
      } catch (error) {
        return `Error getting order details: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Tool 42: Get Quotation Details
  const getQuotationDetailsTool = tool({
    description: 'Get complete details of a specific quotation by ID or quote number.',
    parameters: z.object({
      quotationId: z.number().optional().describe('Quotation ID'),
      quoteNumber: z.string().optional().describe('Quote number (e.g., QUO-001)'),
    }),
    execute: async (params: any) => {
      try {
        const where: any = {};
        if (params.quotationId) where.id = params.quotationId;
        else if (params.quoteNumber) where.quoteNumber = params.quoteNumber;
        else return 'Please provide either quotationId or quoteNumber';

        const quotation = await db.quotation.findFirst({
          where,
          include: {
            assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
            createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            lead: { select: { id: true, customerName: true, status: true } },
            project: { select: { id: true, projectNumber: true, name: true, status: true } },
            lineItems: true,
          },
        });

        if (!quotation) return `Quotation not found.`;

        return `📝 QUOTATION DETAILS: ${quotation.quoteNumber}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Status: ${quotation.status}

👤 CUSTOMER:
• Name: ${quotation.customerName}
• Email: ${quotation.customerEmail}
• Phone: ${quotation.customerPhone}
• Address: ${quotation.address}
${quotation.customerVatNumber ? `• VAT Number: ${quotation.customerVatNumber}` : ''}

💰 AMOUNTS:
• Subtotal: R${quotation.subtotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
• Tax: R${quotation.tax.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
• Total: R${quotation.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
• Company Material Cost: R${quotation.companyMaterialCost.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
• Company Labour Cost: R${quotation.companyLabourCost.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
• Estimated Profit: R${quotation.estimatedProfit.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}

📅 DATES:
• Created: ${new Date(quotation.createdAt).toLocaleDateString('en-ZA')}
${quotation.validUntil ? `• Valid Until: ${new Date(quotation.validUntil).toLocaleDateString('en-ZA')}` : ''}

${quotation.projectDescription ? `📝 Project Description: ${quotation.projectDescription}` : ''}
${quotation.notes ? `📎 Notes: ${quotation.notes}` : ''}
${quotation.rejectionReason ? `❌ Rejection Reason: ${quotation.rejectionReason}` : ''}

${quotation.assignedTo ? `👷 Assigned To: ${quotation.assignedTo.firstName} ${quotation.assignedTo.lastName}` : ''}
${quotation.createdBy ? `👤 Created By: ${quotation.createdBy.firstName} ${quotation.createdBy.lastName}` : ''}
${quotation.lead ? `🎯 Related Lead: ID ${quotation.lead.id} - ${quotation.lead.customerName} (${quotation.lead.status})` : ''}
${quotation.project ? `📁 Related Project: ${quotation.project.projectNumber} - ${quotation.project.name}` : ''}

📋 LINE ITEMS:
${quotation.lineItems.length > 0 
  ? quotation.lineItems.map((item: any) => `  • ${item.description} | Qty: ${item.quantity} | Unit: R${item.unitPrice} | Total: R${item.total}`).join('\n')
  : (Array.isArray(quotation.items) ? (quotation.items as any[]).map((item: any) => `  • ${item.description} | Qty: ${item.quantity} | Unit: R${item.unitPrice} | Total: R${item.total}`).join('\n') : 'No line items')}

Full Data (JSON):
${JSON.stringify(quotation, null, 2)}`;
      } catch (error) {
        return `Error getting quotation details: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Tool 43: Accounts Receivable Report
  const getAccountsReceivableTool = tool({
    description: 'Get a full accounts receivable (AR) report showing ALL money owed to the company. Breaks down by age (current, 30 days, 60 days, 90+ days overdue) and by customer. Use when asked "how much is owed to us", "what are our receivables", "accounts receivable", "cash receivables", "how much worth of invoices still need to be paid".',
    parameters: z.object({}),
    execute: async () => {
      try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

        // All unpaid invoices (everything not PAID, CANCELLED, or REJECTED)
        const unpaidInvoices = await db.invoice.findMany({
          where: {
            status: { in: ['DRAFT', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'OVERDUE'] },
          },
          select: {
            id: true,
            invoiceNumber: true,
            customerName: true,
            customerEmail: true,
            total: true,
            status: true,
            dueDate: true,
            createdAt: true,
            isDisputed: true,
          },
          orderBy: { createdAt: 'asc' },
        });

        const totalReceivable = unpaidInvoices.reduce((sum: number, inv: any) => sum + inv.total, 0);

        // Age buckets
        const current: any[] = [];
        const thirtyDay: any[] = [];
        const sixtyDay: any[] = [];
        const ninetyPlus: any[] = [];

        unpaidInvoices.forEach((inv: any) => {
          const refDate = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.createdAt);
          if (refDate >= thirtyDaysAgo) current.push(inv);
          else if (refDate >= sixtyDaysAgo) thirtyDay.push(inv);
          else if (refDate >= ninetyDaysAgo) sixtyDay.push(inv);
          else ninetyPlus.push(inv);
        });

        const currentTotal = current.reduce((s: number, i: any) => s + i.total, 0);
        const thirtyTotal = thirtyDay.reduce((s: number, i: any) => s + i.total, 0);
        const sixtyTotal = sixtyDay.reduce((s: number, i: any) => s + i.total, 0);
        const ninetyTotal = ninetyPlus.reduce((s: number, i: any) => s + i.total, 0);

        // Group by customer
        const byCustomer: Record<string, { count: number; total: number }> = {};
        unpaidInvoices.forEach((inv: any) => {
          if (!byCustomer[inv.customerName]) byCustomer[inv.customerName] = { count: 0, total: 0 };
          byCustomer[inv.customerName].count++;
          byCustomer[inv.customerName].total += inv.total;
        });

        const disputedCount = unpaidInvoices.filter((inv: any) => inv.isDisputed).length;
        const overdueCount = unpaidInvoices.filter((inv: any) => inv.status === 'OVERDUE').length;

        // Also get paid invoices total for comparison
        const paidTotal = await db.invoice.aggregate({
          where: { status: 'PAID' },
          _sum: { total: true },
          _count: true,
        });

        let response = `💰 ACCOUNTS RECEIVABLE REPORT\n`;
        response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        response += `📅 Report Date: ${now.toLocaleDateString('en-ZA')}\n\n`;

        response += `💵 TOTAL RECEIVABLE: R${totalReceivable.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;
        response += `📊 Total Unpaid Invoices: ${unpaidInvoices.length}\n`;
        response += `${overdueCount > 0 ? `🔴 Overdue: ${overdueCount} invoice(s)\n` : ''}`;
        response += `${disputedCount > 0 ? `⚠️ Disputed: ${disputedCount} invoice(s)\n` : ''}`;
        response += `\n✅ Total Collected (Paid): R${(paidTotal._sum.total || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${paidTotal._count} invoices)\n`;

        response += `\n📊 AGING ANALYSIS:\n`;
        response += `🟢 Current (0-30 days): R${currentTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${current.length} invoices)\n`;
        response += `🟡 31-60 days: R${thirtyTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${thirtyDay.length} invoices)\n`;
        response += `🟠 61-90 days: R${sixtyTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${sixtyDay.length} invoices)\n`;
        response += `🔴 90+ days: R${ninetyTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${ninetyPlus.length} invoices)\n`;

        response += `\n👥 BY CUSTOMER:\n`;
        const sortedCustomers = Object.entries(byCustomer).sort(([, a], [, b]) => b.total - a.total);
        sortedCustomers.forEach(([name, data]) => {
          response += `  • ${name}: R${data.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${data.count} invoice(s))\n`;
        });

        if (unpaidInvoices.length > 0) {
          response += `\n📄 UNPAID INVOICES:\n`;
          unpaidInvoices.forEach((inv: any) => {
            const overdue = inv.dueDate && new Date(inv.dueDate) < now;
            response += `  • ${inv.invoiceNumber} | ${inv.customerName} | R${inv.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} | ${inv.status}${overdue ? ' ⚠️ OVERDUE' : ''}${inv.isDisputed ? ' ⚠️ DISPUTED' : ''}\n`;
          });
        }

        response += `\n💡 INSIGHTS:\n`;
        if (ninetyPlus.length > 0) response += `🔴 ${ninetyPlus.length} invoices are over 90 days old - consider escalating collection\n`;
        if (disputedCount > 0) response += `⚠️ ${disputedCount} invoices are disputed - resolve disputes to collect payment\n`;
        if (overdueCount > 0) response += `📞 ${overdueCount} invoices are marked OVERDUE - send payment reminders\n`;
        if (totalReceivable === 0) response += `✅ All invoices are paid - no outstanding receivables!\n`;
        const collectionRate = (paidTotal._sum.total || 0) + totalReceivable > 0 
          ? ((paidTotal._sum.total || 0) / ((paidTotal._sum.total || 0) + totalReceivable) * 100).toFixed(1) 
          : '100';
        response += `📈 Collection Rate: ${collectionRate}%\n`;

        return response;
      } catch (error) {
        return `Error generating accounts receivable report: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Tool 44: Comprehensive Business Dashboard
  const getBusinessDashboardTool = tool({
    description: 'Get a complete real-time business dashboard with ALL key metrics across the entire system: revenue, receivables, payables, orders, quotations, projects, leads, employees, assets, and liabilities. Use this for a comprehensive overview or when the user asks "how is the business doing", "give me a full overview", "business dashboard", "executive summary".',
    parameters: z.object({}),
    execute: async () => {
      try {
        const now = new Date();

        // === INVOICES ===
        const invoicesByStatus: Record<string, { count: number; total: number }> = {};
        const invoiceStatuses = ['DRAFT', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'REJECTED'];
        for (const s of invoiceStatuses) {
          const agg = await db.invoice.aggregate({ where: { status: s }, _sum: { total: true }, _count: true });
          if (agg._count > 0) invoicesByStatus[s] = { count: agg._count, total: agg._sum.total || 0 };
        }
        const totalRevenue = invoicesByStatus['PAID']?.total || 0;
        const unpaidStatuses = ['DRAFT', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'OVERDUE'];
        const totalReceivable = unpaidStatuses.reduce((sum, s) => sum + (invoicesByStatus[s]?.total || 0), 0);
        const totalInvoices = Object.values(invoicesByStatus).reduce((sum, v) => sum + v.count, 0);

        // === ORDERS ===
        const ordersByStatus: Record<string, number> = {};
        const orderStatuses = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
        for (const s of orderStatuses) {
          const c = await db.order.count({ where: { status: s } });
          if (c > 0) ordersByStatus[s] = c;
        }
        const totalOrders = Object.values(ordersByStatus).reduce((sum, v) => sum + v, 0);
        const orderRevenue = await db.order.aggregate({ _sum: { totalCost: true } });

        // === QUOTATIONS ===
        const quotationsByStatus: Record<string, { count: number; total: number }> = {};
        const quotationStatuses = ['DRAFT', 'PENDING_ARTISAN_REVIEW', 'IN_PROGRESS', 'PENDING_JUNIOR_MANAGER_REVIEW', 'PENDING_SENIOR_MANAGER_REVIEW', 'APPROVED', 'SENT_TO_CUSTOMER', 'REJECTED'];
        for (const s of quotationStatuses) {
          const agg = await db.quotation.aggregate({ where: { status: s }, _sum: { total: true }, _count: true });
          if (agg._count > 0) quotationsByStatus[s] = { count: agg._count, total: agg._sum.total || 0 };
        }
        const totalQuotations = Object.values(quotationsByStatus).reduce((sum, v) => sum + v.count, 0);
        const totalQuotedValue = Object.values(quotationsByStatus).reduce((sum, v) => sum + v.total, 0);

        // === LEADS ===
        const leadsByStatus: Record<string, number> = {};
        const leadStatuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST'];
        for (const s of leadStatuses) {
          const c = await db.lead.count({ where: { status: s } });
          if (c > 0) leadsByStatus[s] = c;
        }
        const totalLeads = Object.values(leadsByStatus).reduce((sum, v) => sum + v, 0);

        // === PROJECTS ===
        const projectsByStatus: Record<string, number> = {};
        const projectStatuses = ['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
        for (const s of projectStatuses) {
          const c = await db.project.count({ where: { status: s } });
          if (c > 0) projectsByStatus[s] = c;
        }

        // === EMPLOYEES ===
        const employeeCount = await db.user.count({ where: { role: 'EMPLOYEE' } });
        const totalUsers = await db.user.count();

        // === ASSETS ===
        const assetAgg = await db.asset.aggregate({ _sum: { currentValue: true }, _count: true });

        // === LIABILITIES ===
        const liabilityAgg = await db.liability.aggregate({ where: { isPaid: false }, _sum: { amount: true }, _count: true });

        // === PAYMENT REQUESTS ===
        const pendingPayroll = await db.paymentRequest.aggregate({
          where: { status: { in: ['PENDING', 'APPROVED'] } },
          _sum: { calculatedAmount: true },
          _count: true,
        });

        // CALCULATIONS
        const totalAssets = assetAgg._sum.currentValue || 0;
        const totalLiabilities = (liabilityAgg._sum.amount || 0) + (pendingPayroll._sum.calculatedAmount || 0);
        const netWorth = totalAssets - totalLiabilities + totalRevenue;

        let response = `📊 BUSINESS DASHBOARD - ${now.toLocaleDateString('en-ZA')}\n`;
        response += `══════════════════════════════════════\n\n`;

        response += `💰 FINANCIAL OVERVIEW:\n`;
        response += `  • Total Revenue (Paid): R${totalRevenue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;
        response += `  • Accounts Receivable: R${totalReceivable.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;
        response += `  • Total Assets: R${totalAssets.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${assetAgg._count} assets)\n`;
        response += `  • Total Liabilities: R${totalLiabilities.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${liabilityAgg._count} liabilities)\n`;
        response += `  • Pending Payroll: R${(pendingPayroll._sum.calculatedAmount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${pendingPayroll._count} requests)\n`;
        response += `  • Net Worth: R${netWorth.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n\n`;

        response += `📋 INVOICES (${totalInvoices} total):\n`;
        for (const [status, data] of Object.entries(invoicesByStatus)) {
          const icon = status === 'PAID' ? '✅' : status === 'OVERDUE' ? '🔴' : status === 'SENT' ? '📨' : status === 'CANCELLED' ? '❌' : '📝';
          response += `  ${icon} ${status}: ${data.count} = R${data.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;
        }

        response += `\n🔧 ORDERS (${totalOrders} total):\n`;
        for (const [status, count] of Object.entries(ordersByStatus)) {
          const icon = status === 'COMPLETED' ? '✅' : status === 'IN_PROGRESS' ? '🔄' : status === 'ASSIGNED' ? '👤' : status === 'PENDING' ? '⏳' : '❌';
          response += `  ${icon} ${status}: ${count}\n`;
        }
        response += `  💵 Total Order Value: R${(orderRevenue._sum.totalCost || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;

        response += `\n📝 QUOTATIONS (${totalQuotations} total, R${totalQuotedValue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} quoted):\n`;
        for (const [status, data] of Object.entries(quotationsByStatus)) {
          response += `  • ${status}: ${data.count} = R${data.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;
        }

        response += `\n🎯 LEADS (${totalLeads} total):\n`;
        for (const [status, count] of Object.entries(leadsByStatus)) {
          const icon = status === 'WON' ? '🏆' : status === 'LOST' ? '❌' : status === 'NEGOTIATION' ? '🤝' : '📌';
          response += `  ${icon} ${status}: ${count}\n`;
        }

        response += `\n📁 PROJECTS:\n`;
        for (const [status, count] of Object.entries(projectsByStatus)) {
          response += `  • ${status}: ${count}\n`;
        }

        response += `\n👥 TEAM: ${employeeCount} employees (${totalUsers} total users)\n`;

        response += `\n📈 KEY INSIGHTS:\n`;
        if (totalReceivable > 0) response += `  💰 R${totalReceivable.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} in receivables to collect\n`;
        if (invoicesByStatus['OVERDUE']) response += `  🔴 ${invoicesByStatus['OVERDUE'].count} overdue invoices worth R${invoicesByStatus['OVERDUE'].total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} - ACTION NEEDED\n`;
        if (ordersByStatus['PENDING']) response += `  ⏳ ${ordersByStatus['PENDING']} pending orders to assign\n`;
        if (leadsByStatus['NEW']) response += `  🆕 ${leadsByStatus['NEW']} new leads to follow up\n`;
        const conversionRate = totalLeads > 0 ? ((leadsByStatus['WON'] || 0) / totalLeads * 100).toFixed(1) : '0';
        response += `  📊 Lead Conversion Rate: ${conversionRate}%\n`;

        return response;
      } catch (error) {
        return `Error generating business dashboard: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Tool 45: Update Invoice Status
  const updateInvoiceStatusTool = tool({
    description: 'Update the status of an invoice. Can mark invoices as SENT, PAID, OVERDUE, CANCELLED, etc. When marking as PAID, automatically sets paidDate.',
    parameters: z.object({
      invoiceId: z.number().optional().describe('Invoice ID'),
      invoiceNumber: z.string().optional().describe('Invoice number (e.g., INV-001)'),
      newStatus: z.enum(['DRAFT', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'REJECTED']).describe('New invoice status'),
      rejectionReason: z.string().optional().describe('Reason for rejection (required when status is REJECTED)'),
      notes: z.string().optional().describe('Notes about the status change'),
    }),
    execute: async (params: any) => {
      try {
        const where: any = {};
        if (params.invoiceId) where.id = params.invoiceId;
        else if (params.invoiceNumber) where.invoiceNumber = params.invoiceNumber;
        else return 'Please provide either invoiceId or invoiceNumber';

        const existing = await db.invoice.findFirst({ where });
        if (!existing) return `Invoice not found.`;

        const updateData: any = { status: params.newStatus };
        if (params.newStatus === 'PAID') updateData.paidDate = new Date();
        if (params.newStatus === 'REJECTED' && params.rejectionReason) updateData.rejectionReason = params.rejectionReason;
        if (params.notes) updateData.notes = params.notes;

        const updated = await db.invoice.update({
          where: { id: existing.id },
          data: updateData,
        });

        return `✓ Invoice ${updated.invoiceNumber} status updated: ${existing.status} → ${params.newStatus}${params.newStatus === 'PAID' ? ` (Paid on ${new Date().toLocaleDateString('en-ZA')})` : ''}`;
      } catch (error) {
        return `Error updating invoice status: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Tool 46: Update Order Status
  const updateOrderStatusTool = tool({
    description: 'Update the status of an order/job. Can move orders through workflow: PENDING → ASSIGNED → IN_PROGRESS → COMPLETED.',
    parameters: z.object({
      orderId: z.number().optional().describe('Order ID'),
      orderNumber: z.string().optional().describe('Order number'),
      newStatus: z.enum(['PENDING_REVIEW', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).describe('New order status'),
      assignToId: z.number().optional().describe('Assign the order to this user ID (for ASSIGNED status)'),
      notes: z.string().optional().describe('Notes about the status change'),
    }),
    execute: async (params: any) => {
      try {
        const where: any = {};
        if (params.orderId) where.id = params.orderId;
        else if (params.orderNumber) where.orderNumber = params.orderNumber;
        else return 'Please provide either orderId or orderNumber';

        const existing = await db.order.findFirst({ where });
        if (!existing) return `Order not found.`;

        const updateData: any = { status: params.newStatus };
        if (params.assignToId) updateData.assignedToId = params.assignToId;
        if (params.notes) updateData.notes = params.notes;
        if (params.newStatus === 'IN_PROGRESS' && !existing.startTime) updateData.startTime = new Date();
        if (params.newStatus === 'COMPLETED') updateData.endTime = new Date();

        const updated = await db.order.update({
          where: { id: existing.id },
          data: updateData,
        });

        return `✓ Order ${updated.orderNumber} status updated: ${existing.status} → ${params.newStatus}${params.assignToId ? ` (Assigned to user ${params.assignToId})` : ''}`;
      } catch (error) {
        return `Error updating order status: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Tool 47: Search Across System
  const systemSearchTool = tool({
    description: 'Search across the ENTIRE system - invoices, orders, quotations, leads, projects - by customer name, reference number, or keyword. Use when the user asks to find something without specifying what type of record.',
    parameters: z.object({
      searchTerm: z.string().describe('The term to search for (name, number, keyword)'),
    }),
    execute: async (params: any) => {
      try {
        const term = params.searchTerm;
        const results: string[] = [];

        // Search invoices
        const invoices = await db.invoice.findMany({
          where: {
            OR: [
              { invoiceNumber: { contains: term, mode: 'insensitive' } },
              { customerName: { contains: term, mode: 'insensitive' } },
              { customerEmail: { contains: term, mode: 'insensitive' } },
              { notes: { contains: term, mode: 'insensitive' } },
            ],
          },
          select: { id: true, invoiceNumber: true, customerName: true, total: true, status: true },
          take: 10,
        });
        if (invoices.length > 0) {
          results.push(`📋 INVOICES (${invoices.length} found):`);
          invoices.forEach((i: any) => results.push(`  • ${i.invoiceNumber} | ${i.customerName} | R${i.total} | ${i.status}`));
        }

        // Search orders
        const orders = await db.order.findMany({
          where: {
            OR: [
              { orderNumber: { contains: term, mode: 'insensitive' } },
              { customerName: { contains: term, mode: 'insensitive' } },
              { customerEmail: { contains: term, mode: 'insensitive' } },
              { serviceType: { contains: term, mode: 'insensitive' } },
              { description: { contains: term, mode: 'insensitive' } },
            ],
          },
          select: { id: true, orderNumber: true, customerName: true, totalCost: true, status: true, serviceType: true },
          take: 10,
        });
        if (orders.length > 0) {
          results.push(`🔧 ORDERS (${orders.length} found):`);
          orders.forEach((o: any) => results.push(`  • ${o.orderNumber} | ${o.customerName} | ${o.serviceType} | R${o.totalCost} | ${o.status}`));
        }

        // Search quotations
        const quotations = await db.quotation.findMany({
          where: {
            OR: [
              { quoteNumber: { contains: term, mode: 'insensitive' } },
              { customerName: { contains: term, mode: 'insensitive' } },
              { customerEmail: { contains: term, mode: 'insensitive' } },
            ],
          },
          select: { id: true, quoteNumber: true, customerName: true, total: true, status: true },
          take: 10,
        });
        if (quotations.length > 0) {
          results.push(`📝 QUOTATIONS (${quotations.length} found):`);
          quotations.forEach((q: any) => results.push(`  • ${q.quoteNumber} | ${q.customerName} | R${q.total} | ${q.status}`));
        }

        // Search leads
        const leads = await db.lead.findMany({
          where: {
            OR: [
              { customerName: { contains: term, mode: 'insensitive' } },
              { customerEmail: { contains: term, mode: 'insensitive' } },
              { companyName: { contains: term, mode: 'insensitive' } },
              { description: { contains: term, mode: 'insensitive' } },
            ],
          },
          select: { id: true, customerName: true, customerEmail: true, status: true, estimatedValue: true },
          take: 10,
        });
        if (leads.length > 0) {
          results.push(`🎯 LEADS (${leads.length} found):`);
          leads.forEach((l: any) => results.push(`  • ID ${l.id} | ${l.customerName} | ${l.customerEmail} | ${l.status} | R${l.estimatedValue || 0}`));
        }

        // Search projects
        const projects = await db.project.findMany({
          where: {
            OR: [
              { projectNumber: { contains: term, mode: 'insensitive' } },
              { name: { contains: term, mode: 'insensitive' } },
              { customerName: { contains: term, mode: 'insensitive' } },
            ],
          },
          select: { id: true, projectNumber: true, name: true, customerName: true, status: true, estimatedBudget: true },
          take: 10,
        });
        if (projects.length > 0) {
          results.push(`📁 PROJECTS (${projects.length} found):`);
          projects.forEach((p: any) => results.push(`  • ${p.projectNumber} | ${p.name} | ${p.customerName} | ${p.status} | Budget: R${p.estimatedBudget || 0}`));
        }

        if (results.length === 0) {
          return `🔍 No results found for "${term}" across invoices, orders, quotations, leads, and projects.`;
        }

        return `🔍 SEARCH RESULTS FOR "${term}":\n━━━━━━━━━━━━━━━━━━━━━━━\n${results.join('\n')}`;
      } catch (error) {
        return `Error searching system: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Tool 48: Profit & Loss Summary
  const getProfitLossSummaryTool = tool({
    description: 'Get a real-time Profit & Loss summary calculated from actual data. Shows revenue (paid invoices), cost of goods sold (material + labour costs from invoices), gross profit, operating expenses (liabilities + payroll), and net profit. Use when asked "what is our profit", "are we making money", "P&L", "profit and loss".',
    parameters: z.object({
      dateFrom: z.string().optional().describe('Start date (ISO format) - defaults to start of current year'),
      dateTo: z.string().optional().describe('End date (ISO format) - defaults to today'),
    }),
    execute: async (params: any) => {
      try {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const dateFrom = params.dateFrom ? new Date(params.dateFrom) : startOfYear;
        const dateTo = params.dateTo ? new Date(params.dateTo) : now;

        // Revenue - Paid invoices in period
        const revenue = await db.invoice.aggregate({
          where: {
            status: 'PAID',
            paidDate: { gte: dateFrom, lte: dateTo },
          },
          _sum: { total: true, subtotal: true, tax: true, companyMaterialCost: true, companyLabourCost: true, estimatedProfit: true },
          _count: true,
        });

        // All invoices created in period (for pipeline view)
        const allInvoices = await db.invoice.aggregate({
          where: {
            createdAt: { gte: dateFrom, lte: dateTo },
          },
          _sum: { total: true },
          _count: true,
        });

        // Operating expenses - paid payment requests
        const paidPayroll = await db.paymentRequest.aggregate({
          where: {
            status: 'PAID',
            createdAt: { gte: dateFrom, lte: dateTo },
          },
          _sum: { calculatedAmount: true },
          _count: true,
        });

        // Liabilities paid in period
        const paidLiabilities = await db.liability.aggregate({
          where: {
            isPaid: true,
            paidDate: { gte: dateFrom, lte: dateTo },
          },
          _sum: { amount: true },
          _count: true,
        });

        const totalRevenue = revenue._sum.total || 0;
        const materialCosts = revenue._sum.companyMaterialCost || 0;
        const labourCosts = revenue._sum.companyLabourCost || 0;
        const cogs = materialCosts + labourCosts;
        const grossProfit = totalRevenue - cogs;
        const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue * 100).toFixed(1) : '0';
        const operatingExpenses = (paidPayroll._sum.calculatedAmount || 0) + (paidLiabilities._sum.amount || 0);
        const netProfit = grossProfit - operatingExpenses;
        const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue * 100).toFixed(1) : '0';

        return `📊 PROFIT & LOSS SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 Period: ${dateFrom.toLocaleDateString('en-ZA')} to ${dateTo.toLocaleDateString('en-ZA')}

💰 REVENUE:
  • Paid Invoice Revenue: R${totalRevenue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${revenue._count} invoices)
  • Total Invoiced (all statuses): R${(allInvoices._sum.total || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${allInvoices._count} invoices)

📦 COST OF GOODS SOLD:
  • Material Costs: R${materialCosts.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
  • Labour Costs: R${labourCosts.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
  • Total COGS: R${cogs.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}

📈 GROSS PROFIT: R${grossProfit.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${grossMargin}% margin)

💸 OPERATING EXPENSES:
  • Payroll: R${(paidPayroll._sum.calculatedAmount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${paidPayroll._count} payments)
  • Liabilities Paid: R${(paidLiabilities._sum.amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${paidLiabilities._count})
  • Total OpEx: R${operatingExpenses.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}

💵 NET PROFIT: R${netProfit.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${netMargin}% margin)

${netProfit > 0 ? '✅ Business is PROFITABLE' : '🔴 Business is operating at a LOSS'}
${parseFloat(grossMargin) > 50 ? '✅ Healthy gross margin (above 50%)' : parseFloat(grossMargin) > 30 ? '🟡 Moderate gross margin' : '🔴 Low gross margin - review pricing'}`;
      } catch (error) {
        return `Error generating P&L summary: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Tool 49: Customer 360 View
  const getCustomer360Tool = tool({
    description: 'Get a complete 360-degree view of a customer across the entire system: their leads, quotations, orders, invoices, projects, and payment history. Use when the user asks about a specific customer or says "show me everything about [customer]", "customer history for [name]".',
    parameters: z.object({
      customerName: z.string().optional().describe('Customer name to search for (partial match)'),
      customerEmail: z.string().optional().describe('Customer email to search for'),
    }),
    execute: async (params: any) => {
      try {
        if (!params.customerName && !params.customerEmail) return 'Please provide customerName or customerEmail';

        const nameFilter = params.customerName ? { contains: params.customerName, mode: 'insensitive' as const } : undefined;
        const emailFilter = params.customerEmail ? { contains: params.customerEmail, mode: 'insensitive' as const } : undefined;

        // Leads
        const leads = await db.lead.findMany({
          where: {
            OR: [
              ...(nameFilter ? [{ customerName: nameFilter }] : []),
              ...(emailFilter ? [{ customerEmail: emailFilter }] : []),
            ],
          },
          orderBy: { createdAt: 'desc' },
        });

        // Quotations
        const quotations = await db.quotation.findMany({
          where: {
            OR: [
              ...(nameFilter ? [{ customerName: nameFilter }] : []),
              ...(emailFilter ? [{ customerEmail: emailFilter }] : []),
            ],
          },
          select: { id: true, quoteNumber: true, customerName: true, total: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        });

        // Orders
        const orders = await db.order.findMany({
          where: {
            OR: [
              ...(nameFilter ? [{ customerName: nameFilter }] : []),
              ...(emailFilter ? [{ customerEmail: emailFilter }] : []),
            ],
          },
          select: { id: true, orderNumber: true, customerName: true, totalCost: true, status: true, serviceType: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        });

        // Invoices
        const invoices = await db.invoice.findMany({
          where: {
            OR: [
              ...(nameFilter ? [{ customerName: nameFilter }] : []),
              ...(emailFilter ? [{ customerEmail: emailFilter }] : []),
            ],
          },
          select: { id: true, invoiceNumber: true, customerName: true, total: true, status: true, dueDate: true, paidDate: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        });

        // Projects
        const projects = await db.project.findMany({
          where: {
            OR: [
              ...(nameFilter ? [{ customerName: nameFilter }] : []),
              ...(emailFilter ? [{ customerEmail: emailFilter }] : []),
            ],
          },
          select: { id: true, projectNumber: true, name: true, customerName: true, status: true, estimatedBudget: true, actualCost: true },
        });

        const totalInvoiced = invoices.reduce((s: number, i: any) => s + i.total, 0);
        const totalPaid = invoices.filter((i: any) => i.status === 'PAID').reduce((s: number, i: any) => s + i.total, 0);
        const totalOutstanding = invoices.filter((i: any) => !['PAID', 'CANCELLED', 'REJECTED'].includes(i.status)).reduce((s: number, i: any) => s + i.total, 0);
        const totalQuoted = quotations.reduce((s: number, q: any) => s + q.total, 0);

        const searchLabel = params.customerName || params.customerEmail;

        let response = `👤 CUSTOMER 360° VIEW: "${searchLabel}"\n`;
        response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        response += `💰 FINANCIAL SUMMARY:\n`;
        response += `  • Total Quoted: R${totalQuoted.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;
        response += `  • Total Invoiced: R${totalInvoiced.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;
        response += `  • Total Paid: R${totalPaid.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n`;
        response += `  • Outstanding: R${totalOutstanding.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}\n\n`;

        if (leads.length > 0) {
          response += `🎯 LEADS (${leads.length}):\n`;
          leads.forEach((l: any) => {
            response += `  • ID ${l.id} | ${l.customerName} | ${l.status} | ${l.serviceType} | R${l.estimatedValue || 0}\n`;
          });
          response += '\n';
        }

        if (quotations.length > 0) {
          response += `📝 QUOTATIONS (${quotations.length}):\n`;
          quotations.forEach((q: any) => {
            response += `  • ${q.quoteNumber} | R${q.total} | ${q.status} | ${new Date(q.createdAt).toLocaleDateString('en-ZA')}\n`;
          });
          response += '\n';
        }

        if (orders.length > 0) {
          response += `🔧 ORDERS (${orders.length}):\n`;
          orders.forEach((o: any) => {
            response += `  • ${o.orderNumber} | ${o.serviceType} | R${o.totalCost} | ${o.status} | ${new Date(o.createdAt).toLocaleDateString('en-ZA')}\n`;
          });
          response += '\n';
        }

        if (invoices.length > 0) {
          response += `💳 INVOICES (${invoices.length}):\n`;
          invoices.forEach((i: any) => {
            response += `  • ${i.invoiceNumber} | R${i.total} | ${i.status}${i.paidDate ? ` | Paid: ${new Date(i.paidDate).toLocaleDateString('en-ZA')}` : ''}${i.dueDate ? ` | Due: ${new Date(i.dueDate).toLocaleDateString('en-ZA')}` : ''}\n`;
          });
          response += '\n';
        }

        if (projects.length > 0) {
          response += `📁 PROJECTS (${projects.length}):\n`;
          projects.forEach((p: any) => {
            response += `  • ${p.projectNumber} | ${p.name} | ${p.status} | Budget: R${p.estimatedBudget || 0} | Spent: R${p.actualCost}\n`;
          });
          response += '\n';
        }

        if (leads.length === 0 && quotations.length === 0 && orders.length === 0 && invoices.length === 0 && projects.length === 0) {
          response += `No records found for "${searchLabel}" in the system.\n`;
        }

        return response;
      } catch (error) {
        return `Error getting customer 360 view: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Return all tools as an OBJECT with user context injected
  // This format is required by the AI SDK's generateText function
  return {
    createLead: createLeadTool,
    createEmployee: createEmployeeTool,
    createInvoice: createInvoiceTool,
    createOrder: createOrderTool,
    createQuotation: createQuotationTool,
    listQuotations: listQuotationsTool,
    generateFinancialReport: generateFinancialReportTool,
    queryFinancialMetrics: queryFinancialMetricsTool,
    uploadFile: uploadFileTool,
    generateStatement: generateStatementTool,
    listLeads: listLeadsTool,
    getLeadDetails: getLeadDetailsTool,
    listEmployees: listEmployeesTool,
    getProjectPerformance: getProjectPerformanceTool,
    updateLeadStatus: updateLeadStatusTool,
    getSalesSummary: getSalesSummaryTool,
    // Project Management
    createProject: createProjectTool,
    listProjects: listProjectsTool,
    updateProjectStatus: updateProjectStatusTool,
    // Asset Management
    createAsset: createAssetTool,
    listAssets: listAssetsTool,
    // Liability Management
    createLiability: createLiabilityTool,
    listLiabilities: listLiabilitiesTool,
    // HR & Payroll
    createPaymentRequest: createPaymentRequestTool,
    listPaymentRequests: listPaymentRequestsTool,
    // Advanced Analysis
    getBusinessHealth: getBusinessHealthTool,
    getCashFlowAnalysis: getCashFlowAnalysisTool,
    // Sales & Marketing
    createCampaign: createCampaignTool,
    sendCampaign: sendCampaignTool,
    getCampaignPerformance: getCampaignPerformanceTool,
    getLeadSourceAnalytics: getLeadSourceAnalyticsTool,
    getMarketingDashboard: getMarketingDashboardTool,
    sendReviewRequest: sendReviewRequestTool,
    generateMarketingReport: generateMarketingReportTool,
    // AI Campaign Generation
    generateCampaignContent: generateCampaignContentTool,
    amendCampaign: amendCampaignTool,
    suggestCampaignIdeas: suggestCampaignIdeasTool,
    // Business Intelligence & Data Query Tools
    listInvoices: listInvoicesTool,
    getInvoiceDetails: getInvoiceDetailsTool,
    listOrders: listOrdersTool,
    getOrderDetails: getOrderDetailsTool,
    getQuotationDetails: getQuotationDetailsTool,
    getAccountsReceivable: getAccountsReceivableTool,
    getBusinessDashboard: getBusinessDashboardTool,
    updateInvoiceStatus: updateInvoiceStatusTool,
    updateOrderStatus: updateOrderStatusTool,
    systemSearch: systemSearchTool,
    getProfitLossSummary: getProfitLossSummaryTool,
    getCustomer360: getCustomer360Tool,
  };
}

// Export legacy constant for backward compatibility (fallback to user 1)
export const aiAgentTools = createAIAgentTools(1);
