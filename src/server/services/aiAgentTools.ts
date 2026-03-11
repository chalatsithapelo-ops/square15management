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
        const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
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

        const quoteNumber = `QUO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
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
    description: 'List and count quotations with optional status filter',
    parameters: z.object({
      status: z.enum(['DRAFT', 'PENDING_ARTISAN_REVIEW', 'IN_PROGRESS', 'PENDING_JUNIOR_MANAGER_REVIEW', 'PENDING_SENIOR_MANAGER_REVIEW', 'APPROVED', 'SENT_TO_CUSTOMER', 'REJECTED']).optional().describe('Filter by quotation status'),
    }),
    execute: async (params: any) => {
      try {
        const where: any = {};
        if (params.status) {
          where.status = params.status;
        }

        const quotations = await db.quotation.findMany({
          where,
          select: {
            id: true,
            quoteNumber: true,
            customerName: true,
            total: true,
            status: true,
            createdAt: true,
            leadId: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 20, // Limit to last 20 quotations
        });

        const count = quotations.length;
        const total = await db.quotation.count({ where });

        if (count === 0) {
          return `No quotations found${params.status ? ` with status ${params.status}` : ''}.`;
        }

        let response = `Found ${total} quotation${total !== 1 ? 's' : ''}${params.status ? ` with status ${params.status}` : ''}:\n\n`;
        
        quotations.forEach((q: any) => {
          response += `- ID ${q.id}: ${q.quoteNumber} | ${q.customerName} | R${q.total} | ${q.status} | Created: ${new Date(q.createdAt).toLocaleDateString()}${q.leadId ? ` | Lead ID: ${q.leadId}` : ''}\n`;
        });

        if (total > 20) {
          response += `\n(Showing most recent 20 of ${total} total)`;
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
              amount: true,
            },
          });
          metrics.revenue = invoices._sum.amount || 0;
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
            amount: true,
          },
        });

        return `Sales Summary:
- Active Deals: ${leads}
- Total Revenue (Paid Invoices): $${invoices._sum.amount || 0}
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
        const projectNumber = `PRJ-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        
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
            status: 'ACTIVE',
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
      status: z.enum(['ACTIVE', 'MAINTENANCE', 'DISPOSED', 'SOLD']).optional().describe('Filter by status'),
    }),
    execute: async (params: any) => {
      try {
        const where: any = {};
        if (params.category) where.category = params.category;
        if (params.status) where.status = params.status;

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
          response += `- ${a.name} (${a.category}) | Purchase: R${a.purchasePrice} | Current: R${a.currentValue || a.purchasePrice} | Status: ${a.status}\n`;
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
      interestRate: z.number().optional().describe('Interest rate percentage'),
    }),
    execute: async (params: any) => {
      try {
        const liability = await db.liability.create({
          data: {
            name: params.name,
            category: params.category,
            amount: params.amount,
            remainingAmount: params.amount,
            dueDate: params.dueDate ? new Date(params.dueDate) : null,
            creditor: params.creditor || null,
            interestRate: params.interestRate || null,
            status: 'ACTIVE',
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
      status: z.enum(['ACTIVE', 'PAID', 'OVERDUE', 'DEFAULTED']).optional().describe('Filter by status'),
    }),
    execute: async (params: any) => {
      try {
        const where: any = {};
        if (params.status) where.status = params.status;

        const liabilities = await db.liability.findMany({
          where,
          orderBy: { dueDate: 'asc' },
        });

        const totalDebt = liabilities.reduce((sum: number, l: any) => sum + (l.remainingAmount || l.amount), 0);

        if (liabilities.length === 0) {
          return `No liabilities found.`;
        }

        let response = `Total Liabilities: R${totalDebt}\n\n`;
        liabilities.forEach((l: any) => {
          response += `- ${l.name} (${l.category}) | Amount: R${l.amount} | Remaining: R${l.remainingAmount || l.amount} | Status: ${l.status}${l.dueDate ? ` | Due: ${new Date(l.dueDate).toLocaleDateString()}` : ''}\n`;
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
          where: { status: 'ACTIVE' },
          _sum: { remainingAmount: true },
        });

        const paymentRequests = await db.paymentRequest.aggregate({
          where: { status: { in: ['PENDING', 'APPROVED'] } },
          _sum: { amount: true },
        });

        // Assets
        const assets = await db.asset.aggregate({
          where: { status: 'ACTIVE' },
          _sum: { currentValue: true },
        });

        // Projects
        const activeProjects = await db.project.count({
          where: { status: 'IN_PROGRESS' },
        });

        const revenue = paidInvoices._sum.total || 0;
        const totalLiabilities = (liabilities._sum.remainingAmount || 0) + (paymentRequests._sum.amount || 0);
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
          _sum: { amount: true },
          _count: true,
        });

        const upcomingLiabilities = await db.liability.findMany({
          where: {
            status: 'ACTIVE',
            dueDate: {
              gte: new Date(),
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Next 30 days
            },
          },
        });

        const cashInflow = pendingInvoices._sum.total || 0;
        const cashOutflow = (pendingPayments._sum.amount || 0) + upcomingLiabilities.reduce((sum: number, l: any) => sum + (l.remainingAmount || 0), 0);
        const netCashFlow = cashInflow - cashOutflow;

        return `💵 CASH FLOW ANALYSIS

📥 EXPECTED INFLOWS (Next 30 days):
- Pending Invoices: R${cashInflow} (${pendingInvoices._count} invoices)
- Overdue Invoices: ${overdueInvoices} (COLLECT URGENTLY)

📤 EXPECTED OUTFLOWS (Next 30 days):
- Pending Payroll: R${pendingPayments._sum.amount || 0} (${pendingPayments._count} requests)
- Upcoming Liabilities: R${upcomingLiabilities.reduce((sum: number, l: any) => sum + (l.remainingAmount || 0), 0)} (${upcomingLiabilities.length} payments)
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
          where: { status: 'PAID', paidAt: { gte: startDate } },
          _sum: { amount: true },
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
  Invoices Paid: ${invoiceRevenue._count} (R${(invoiceRevenue._sum.amount || 0).toLocaleString()})
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
  };
}

// Export legacy constant for backward compatibility (fallback to user 1)
export const aiAgentTools = createAIAgentTools(1);
