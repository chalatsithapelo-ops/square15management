import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { SlipCategory } from "@prisma/client";
import { getCompanyDetails } from "~/server/utils/company-details";
import { sendCompletionReportEmail, sendOrderStatusUpdateEmail } from "~/server/utils/email";
import PDFDocument from "pdfkit";
import { getCompanyLogo } from "~/server/utils/logo";
import { fetchImageAsBuffer } from "~/server/utils/pdf-images";
import { authenticateUser } from "~/server/utils/auth";
import { notifyAdmins, notifyCustomerOrderStatus } from "~/server/utils/notifications";

export const updateOrderStatus = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
      isPMOrder: z.boolean().optional(), // Flag to indicate PropertyManagerOrder
      status: z.enum(["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
      materialCost: z.number().optional(),
      labourCost: z.number().optional(),
      beforePictures: z.array(z.string()).optional(),
      afterPictures: z.array(z.string()).optional(),
      expenseSlips: z.array(z.object({
        url: z.string(),
        category: z.nativeEnum(SlipCategory),
        description: z.string().optional(),
        amount: z.number().optional(),
      })).optional(),
      signedJobCardUrl: z.string().optional(),
      clientRepName: z.string().optional(),
      clientRepSignDate: z.string().datetime().optional(),
      // Labor/job activity data for automatic job activity creation
      hoursWorked: z.number().optional(),
      daysWorked: z.number().optional(),
      hourlyRate: z.number().optional(),
      dailyRate: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('=== SERVER updateOrderStatus CALLED ===');
    console.log('Full input:', JSON.stringify(input, null, 2));
    
    if (!input.token) {
      console.log('ERROR: Token is missing or empty!');
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Token is missing from request",
      });
    }
    
    if (typeof input.token !== 'string') {
      console.log('ERROR: Token is not a string, type:', typeof input.token);
      throw new TRPCError({
        code: "UNAUTHORIZED", 
        message: "Token must be a string",
      });
    }
    
    console.log('Token received:', input.token.substring(0, 50) + '...');
    console.log('Token length:', input.token.length);
    
    try {
      console.log('Attempting JWT verification...');
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      console.log('JWT verified successfully!');
      z.object({ userId: z.number() }).parse(verified);
      const tokenUserId = (verified as any).userId;
      console.log('JWT parsed successfully, userId:', tokenUserId);

      // Get the authenticated user
      const user = await db.user.findUnique({
        where: { id: tokenUserId },
      });

      if (!user) {
        console.log('ERROR: User not found for userId:', tokenUserId);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not found",
        });
      }

      console.log('User found:', user.email, 'role:', user.role);

      const updateData: any = {
        status: input.status,
      };

      // Validate before pictures when starting job
      if (input.status === "IN_PROGRESS") {
        if (!input.beforePictures || input.beforePictures.length < 3) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "At least 3 before pictures are required to start the job",
          });
        }
        updateData.startTime = new Date();
      }

      // Validate after pictures, signed job card, and expense slips when completing job
      if (input.status === "COMPLETED") {
        if (!input.afterPictures || input.afterPictures.length < 3) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "At least 3 after pictures are required to complete the job",
          });
        }
        if (!input.signedJobCardUrl) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Signed job card is required to complete the job",
          });
        }
        if (!input.clientRepName) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Client representative name is required to complete the job",
          });
        }
        if (!input.clientRepSignDate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Client representative sign date is required to complete the job",
          });
        }
        if (!input.expenseSlips || input.expenseSlips.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "At least one expense slip is required to complete the job",
          });
        }
        updateData.endTime = new Date();
      }

      if (input.materialCost !== undefined) {
        updateData.materialCost = input.materialCost;
      }

      if (input.labourCost !== undefined) {
        updateData.labourCost = input.labourCost;
      }

      if (input.beforePictures) {
        updateData.beforePictures = input.beforePictures;
      }

      if (input.afterPictures) {
        updateData.afterPictures = input.afterPictures;
      }

      if (input.signedJobCardUrl) {
        updateData.signedJobCardUrl = input.signedJobCardUrl;
      }

      if (input.clientRepName) {
        updateData.clientRepName = input.clientRepName;
      }

      if (input.clientRepSignDate) {
        updateData.clientRepSignDate = new Date(input.clientRepSignDate);
      }

      // Create expense slip records if provided
      if (input.expenseSlips && input.expenseSlips.length > 0) {
        if (input.isPMOrder) {
          // Handle PM order expense slips
          // Delete existing expense slips for this PM order if updating
          await db.propertyManagerOrderExpenseSlip.deleteMany({
            where: { orderId: input.orderId },
          });

          // Create new expense slips for PM order
          await db.propertyManagerOrderExpenseSlip.createMany({
            data: input.expenseSlips.map((slip) => ({
              orderId: input.orderId,
              url: slip.url,
              category: slip.category,
              description: slip.description,
              amount: slip.amount,
            })),
          });

          // If materialCost is not explicitly provided, calculate it from expense slips
          if (input.materialCost === undefined && input.status === "COMPLETED") {
            const totalFromSlips = input.expenseSlips.reduce(
              (sum, slip) => sum + (slip.amount || 0),
              0
            );
            
            // Validate that we have a valid material cost
            if (totalFromSlips <= 0) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Material cost must be greater than 0. Please specify amounts in expense slips or provide a manual material cost.",
              });
            }
            
            updateData.materialCost = totalFromSlips;
          }

          // Create material records from expense slips for PDF display
          // Delete existing materials first
          await db.propertyManagerOrderMaterial.deleteMany({
            where: { orderId: input.orderId },
          });

          // Group expense slips by category and create material records
          const materialsByCategory = new Map<string, { total: number; count: number }>();
          input.expenseSlips.forEach((slip) => {
            const category = slip.category || 'UNCATEGORIZED';
            const current = materialsByCategory.get(category) || { total: 0, count: 0 };
            materialsByCategory.set(category, {
              total: current.total + (slip.amount || 0),
              count: current.count + 1
            });
          });

          // Create material records from grouped categories
          for (const [category, data] of materialsByCategory.entries()) {
            await db.propertyManagerOrderMaterial.create({
              data: {
                orderId: input.orderId,
                name: category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
                quantity: data.count,
                unitPrice: data.total / data.count,
                totalCost: data.total,
              },
            });
          }
        } else {
          // Handle regular order expense slips
          // Delete existing expense slips for this order if updating
          await db.expenseSlip.deleteMany({
            where: { orderId: input.orderId },
          });

          // Create new expense slips
          await db.expenseSlip.createMany({
            data: input.expenseSlips.map((slip) => ({
              orderId: input.orderId,
              url: slip.url,
              category: slip.category,
              description: slip.description,
              amount: slip.amount,
            })),
          });

          // If materialCost is not explicitly provided, calculate it from expense slips
          if (input.materialCost === undefined && input.status === "COMPLETED") {
            const totalFromSlips = input.expenseSlips.reduce(
              (sum, slip) => sum + (slip.amount || 0),
              0
            );
            
            // Validate that we have a valid material cost
            if (totalFromSlips <= 0) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Material cost must be greater than 0. Please specify amounts in expense slips or provide a manual material cost.",
              });
            }
            
            updateData.materialCost = totalFromSlips;
          }

          // Create material records from expense slips for PDF display
          // Delete existing materials first
          await db.material.deleteMany({
            where: { orderId: input.orderId },
          });

          // Group expense slips by category and create material records
          const materialsByCategory = new Map<string, { total: number; count: number }>();
          input.expenseSlips.forEach((slip) => {
            const category = slip.category || 'UNCATEGORIZED';
            const current = materialsByCategory.get(category) || { total: 0, count: 0 };
            materialsByCategory.set(category, {
              total: current.total + (slip.amount || 0),
              count: current.count + 1
            });
          });

          // Create material records from grouped categories
          for (const [category, data] of materialsByCategory.entries()) {
            await db.material.create({
              data: {
                orderId: input.orderId,
                name: category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
                quantity: data.count,
                unitPrice: data.total / data.count,
                totalCost: data.total,
              },
            });
          }
        }
      }

      // Create job activity records from labor data for PDF display
      if (input.status === "COMPLETED" && (input.hoursWorked || input.daysWorked)) {
        if (input.isPMOrder) {
          // Delete existing job activities first
          await db.propertyManagerOrderJobActivity.deleteMany({
            where: { orderId: input.orderId },
          });

          // Get the assigned artisan ID from the order
          const pmOrderForActivity = await db.propertyManagerOrder.findUnique({
            where: { id: input.orderId },
            select: { assignedToId: true, startTime: true },
          });

          if (pmOrderForActivity?.assignedToId) {
            const duration = input.hoursWorked 
              ? input.hoursWorked * 60 
              : (input.daysWorked || 0) * 8 * 60; // Assume 8 hours per day

            const now = new Date();
            const startTime =
              pmOrderForActivity.startTime ??
              (duration > 0 ? new Date(now.getTime() - Math.round(duration) * 60 * 1000) : now);

            const durationMinutes = Math.round(duration);
            const hoursWorked = input.hoursWorked ?? (input.daysWorked ? input.daysWorked * 8 : null);
            const rate = input.hoursWorked ? (input.hourlyRate ?? null) : (input.dailyRate ?? null);
            const description = input.hoursWorked ? "Hourly work" : "Daily work";

            await db.propertyManagerOrderJobActivity.create({
              data: {
                orderId: input.orderId,
                artisanId: pmOrderForActivity.assignedToId,
                startTime,
                durationMinutes,
                description,
                hoursWorked,
                rate,
              },
            });

            // Calculate and update labour cost
            if (input.labourCost === undefined) {
              const calculatedLabourCost = input.hoursWorked && input.hourlyRate
                ? input.hoursWorked * input.hourlyRate
                : (input.daysWorked && input.dailyRate ? input.daysWorked * input.dailyRate : 0);
              
              updateData.labourCost = calculatedLabourCost;
            }
          }
        } else {
          // Delete existing job activities first
          await db.jobActivity.deleteMany({
            where: { orderId: input.orderId },
          });

          // Get the assigned artisan ID from the order
          const regularOrderForActivity = await db.order.findUnique({
            where: { id: input.orderId },
            select: { assignedToId: true, startTime: true },
          });

          if (regularOrderForActivity?.assignedToId) {
            const duration = input.hoursWorked 
              ? input.hoursWorked * 60 
              : (input.daysWorked || 0) * 8 * 60; // Assume 8 hours per day

            const now = new Date();
            const startTime =
              regularOrderForActivity.startTime ??
              (duration > 0 ? new Date(now.getTime() - Math.round(duration) * 60 * 1000) : now);

            const durationMinutes = Math.round(duration);
            const description = input.hoursWorked
              ? `Hourly work${input.hourlyRate ? ` @ R${input.hourlyRate}/hr` : ""}`
              : `Daily work${input.dailyRate ? ` @ R${input.dailyRate}/day` : ""}`;

            await db.jobActivity.create({
              data: {
                orderId: input.orderId,
                artisanId: regularOrderForActivity.assignedToId,
                startTime,
                durationMinutes,
                description,
              },
            });

            // Calculate and update labour cost
            if (input.labourCost === undefined) {
              const calculatedLabourCost = input.hoursWorked && input.hourlyRate
                ? input.hoursWorked * input.hourlyRate
                : (input.daysWorked && input.dailyRate ? input.daysWorked * input.dailyRate : 0);
              
              updateData.labourCost = calculatedLabourCost;
            }
          }
        }
      }

      // Calculate total cost
      // Check if this is a PropertyManagerOrder or regular Order
      let order: any = null;
      let pmOrder: any = null;
      
      if (input.isPMOrder) {
        pmOrder = await db.propertyManagerOrder.findUnique({
          where: { id: input.orderId },
        });
        if (!pmOrder) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Property Manager Order not found",
          });
        }
        
        // Authorization check: verify user is assigned to this PM order
        if (pmOrder.assignedToId !== user.id) {
          console.log('ERROR: User not authorized for PM order. pmOrder.assignedToId:', pmOrder.assignedToId, 'user.id:', user.id);
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "You are not assigned to this order",
          });
        }
        console.log('Authorization passed for PM order:', pmOrder.orderNumber);
      } else {
        order = await db.order.findUnique({
          where: { id: input.orderId },
        });
        if (!order) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Order not found",
          });
        }
        
        // Authorization check: verify user is assigned to this regular order
        if (order.assignedToId !== user.id) {
          console.log('ERROR: User not authorized for order. order.assignedToId:', order.assignedToId, 'user.id:', user.id);
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "You are not assigned to this order",
          });
        }
        console.log('Authorization passed for regular order:', order.orderNumber);
      }

      // Update the appropriate order type
      let updatedOrder: any;
      
      if (input.isPMOrder && pmOrder) {
        // Update PropertyManagerOrder
        updatedOrder = await db.propertyManagerOrder.update({
          where: { id: input.orderId },
          data: updateData,
          include: {
            propertyManager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
            contractor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
            progressUpdates: {
              orderBy: {
                createdAt: "desc",
              },
              take: 5,
            },
          },
        });
      } else if (order) {
        // Calculate total cost for regular orders
        updateData.totalCost =
          (input.materialCost ?? order.materialCost) +
          (input.labourCost ?? order.labourCost) +
          order.callOutFee;

        // Update regular Order
        updatedOrder = await db.order.update({
          where: { id: input.orderId },
          data: updateData,
          include: {
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
            materials: true,
            jobActivities: true,
            expenseSlips: true,
          },
        });
      }

      // Notifications (regular orders only) - best effort
      try {
        if (!input.isPMOrder && order && updatedOrder && input.status !== order.status) {
          const customerUser = await db.user.findUnique({
            where: { email: updatedOrder.customerEmail },
            select: { id: true, role: true },
          });

          if (customerUser?.role === "CUSTOMER") {
            await notifyCustomerOrderStatus({
              customerId: customerUser.id,
              orderNumber: updatedOrder.orderNumber,
              orderId: updatedOrder.id,
              newStatus: updatedOrder.status,
            });
          }

          await notifyAdmins({
            message: `Order ${updatedOrder.orderNumber} status updated to ${updatedOrder.status}`,
            type: "ORDER_STATUS_UPDATED" as any,
            relatedEntityId: updatedOrder.id,
            relatedEntityType: "ORDER",
          });

          if (["ASSIGNED", "IN_PROGRESS", "CANCELLED"].includes(updatedOrder.status)) {
            await sendOrderStatusUpdateEmail({
              customerEmail: updatedOrder.customerEmail,
              customerName: updatedOrder.customerName,
              orderNumber: updatedOrder.orderNumber,
              serviceType: updatedOrder.serviceType,
              newStatus: updatedOrder.status,
              assignedToName: updatedOrder.assignedTo
                ? `${updatedOrder.assignedTo.firstName} ${updatedOrder.assignedTo.lastName}`
                : undefined,
            });
          }
        }
      } catch (notifyError) {
        console.error("[updateOrderStatus] Failed to send order notifications:", notifyError);
      }

      // Update linked maintenance request status if exists
      const linkedMaintenanceRequest = await db.maintenanceRequest.findFirst({
        where: { convertedToOrderId: input.orderId },
      });

      if (linkedMaintenanceRequest) {
        let maintenanceStatus = linkedMaintenanceRequest.status;
        
        if (input.status === "IN_PROGRESS") {
          maintenanceStatus = "IN_PROGRESS";
        } else if (input.status === "COMPLETED") {
          maintenanceStatus = "COMPLETED";
          await db.maintenanceRequest.update({
            where: { id: linkedMaintenanceRequest.id },
            data: {
              status: maintenanceStatus,
              completedDate: new Date(),
            },
          });
        } else if (input.status === "IN_PROGRESS") {
          await db.maintenanceRequest.update({
            where: { id: linkedMaintenanceRequest.id },
            data: {
              status: maintenanceStatus,
            },
          });
        }
      }

      // If order is completed, automatically create a draft invoice for Jr Admin review
      if (input.status === "COMPLETED") {
        // Get company details for custom prefix
        const companyDetails = await getCompanyDetails();

        const MAX_INVOICE_NUMBER_ATTEMPTS = 25;

        const isInvoiceNumberCollisionError = (err: unknown) => {
          const code = (err as any)?.code;
          if (code !== "P2002") return false;

          const target = (err as any)?.meta?.target;
          if (Array.isArray(target)) return target.includes("invoiceNumber");
          if (typeof target === "string") return target.includes("invoiceNumber");

          const message = (err as any)?.message;
          return typeof message === "string" && message.includes("invoiceNumber");
        };

        // Generate an invoice number that is safe under concurrency.
        // (Counting + 1 can collide when two invoices are created at the same time.)
        const createInvoiceNumber = async (attempt: number) => {
          const invoiceCount = await db.invoice.count();
          const pmInvoiceCount = await db.propertyManagerInvoice.count();
          const next = invoiceCount + pmInvoiceCount + 1 + attempt;
          const base = `${companyDetails.invoicePrefix}-${String(next).padStart(5, "0")}`;
          // If counts are stale (e.g. deletions), we might still collide.
          // Add a deterministic suffix on later attempts to guarantee uniqueness.
          return attempt < 10 ? base : `${base}-${attempt}`;
        };

        // Build line items from order details
        const items = [];
        
        // Add labour cost as a line item if present
        if (updatedOrder.labourCost > 0) {
          items.push({
            description: `Labour - ${updatedOrder.serviceType}`,
            quantity: 1,
            unitPrice: updatedOrder.labourCost,
            total: updatedOrder.labourCost,
            unitOfMeasure: "Sum",
          });
        }

        // Add material cost as a line item if present
        if (updatedOrder.materialCost > 0) {
          items.push({
            description: "Materials",
            quantity: 1,
            unitPrice: updatedOrder.materialCost,
            total: updatedOrder.materialCost,
            unitOfMeasure: "Sum",
          });
        }

        // Add call-out fee as a line item if present
        if (updatedOrder.callOutFee > 0) {
          items.push({
            description: "Call-out Fee",
            quantity: 1,
            unitPrice: updatedOrder.callOutFee,
            total: updatedOrder.callOutFee,
            unitOfMeasure: "Sum",
          });
        }

        // Calculate invoice totals
        const subtotal = updatedOrder.totalCost || 0;
        const tax = subtotal * 0.15;
        const total = subtotal + tax;

        // Ensure required fields have values
        const customerName = updatedOrder.customerName || "Customer";
        const customerEmail = updatedOrder.customerEmail || "customer@example.com";
        const customerPhone = updatedOrder.customerPhone || "N/A";
        const address = updatedOrder.address || "N/A";

        // Create the appropriate invoice type based on order type
        if (input.isPMOrder && pmOrder) {
          // Create PropertyManagerInvoice for PM orders with SENT_TO_PM status
          for (let attempt = 0; attempt < MAX_INVOICE_NUMBER_ATTEMPTS; attempt++) {
            const invoiceNumber = await createInvoiceNumber(attempt);
            try {
              await db.propertyManagerInvoice.create({
                data: {
                  invoiceNumber,
                  customerName,
                  customerEmail,
                  customerPhone,
                  address,
                  items: items,
                  subtotal: subtotal,
                  tax: tax,
                  total: total,
                  status: "SENT_TO_PM",
                  pmOrderId: updatedOrder.id,
                  propertyManagerId: updatedOrder.propertyManagerId,
                  notes: `Auto-generated invoice for completed PM order ${updatedOrder.orderNumber}`,
                  companyMaterialCost: updatedOrder.materialCost || 0,
                  companyLabourCost: updatedOrder.labourCost || 0,
                  estimatedProfit: total - (updatedOrder.materialCost || 0) - (updatedOrder.labourCost || 0),
                },
              });
              break;
            } catch (err) {
              const isInvoiceNumberCollision = isInvoiceNumberCollisionError(err);

              if (!isInvoiceNumberCollision || attempt === MAX_INVOICE_NUMBER_ATTEMPTS - 1) {
                throw err;
              }
            }
          }
        } else {
          // Create regular Invoice for standard orders with PENDING_REVIEW status
          for (let attempt = 0; attempt < MAX_INVOICE_NUMBER_ATTEMPTS; attempt++) {
            const invoiceNumber = await createInvoiceNumber(attempt);
            try {
              await db.invoice.create({
                data: {
                  invoiceNumber,
                  customerName,
                  customerEmail,
                  customerPhone,
                  address,
                  items: items,
                  subtotal: subtotal,
                  tax: tax,
                  total: total,
                  status: "PENDING_REVIEW",
                  orderId: updatedOrder.id,
                  notes: `Auto-generated invoice for completed order ${updatedOrder.orderNumber}`,
                  companyMaterialCost: updatedOrder.materialCost || 0,
                  companyLabourCost: updatedOrder.labourCost || 0,
                  estimatedProfit: total - (updatedOrder.materialCost || 0) - (updatedOrder.labourCost || 0),
                },
              });
              break;
            } catch (err) {
              const isInvoiceNumberCollision = isInvoiceNumberCollisionError(err);

              if (!isInvoiceNumberCollision || attempt === MAX_INVOICE_NUMBER_ATTEMPTS - 1) {
                throw err;
              }
            }
          }
        }
      }

      // If order is completed, send completion report email to customer (best effort, non-blocking)
      if (input.status === "COMPLETED") {
        void (async () => {
          try {
            // Generate the Order PDF for the customer
            console.log(`[updateOrderStatus] Generating Order PDF for customer email...`);
            
            // We need to generate the PDF inline here since we need the Buffer
            // This is similar to generateOrderPdf but returns Buffer directly
            const pdfDoc = new PDFDocument({ margin: 50 });
            const pdfChunks: Buffer[] = [];

            pdfDoc.on("data", (chunk) => pdfChunks.push(chunk));

            const pdfBufferPromise = new Promise<Buffer>((resolve, reject) => {
              pdfDoc.on("end", () => {
                const buffer = Buffer.concat(pdfChunks);
                resolve(buffer);
              });
              pdfDoc.on("error", reject);
            });

            // Generate the PDF content (reusing logic from generateOrderPdf.ts)
            const pdfCompanyDetails = await getCompanyDetails();

          // ===== HEADER SECTION WITH BRAND BANNER =====
          pdfDoc.rect(0, 0, 595, 140).fill(env.BRAND_PRIMARY_COLOR);
          pdfDoc.rect(0, 135, 595, 5).fill(env.BRAND_SECONDARY_COLOR);

          // Add company logo on the banner
          const pdfLogoBuffer = await getCompanyLogo();
          if (pdfLogoBuffer) {
            try {
              pdfDoc.circle(100, 70, 45).fill("#ffffff").opacity(1);
              pdfDoc.image(pdfLogoBuffer, 55, 25, { width: 90 });
            } catch (error) {
              console.error("Error adding logo to PDF:", error);
            }
          }

          // Company details on the banner
          pdfDoc
            .fontSize(11)
            .fillColor("#ffffff")
            .font("Helvetica-Bold")
            .text(pdfCompanyDetails.companyName, 320, 35, { align: "right", width: 225 })
            .font("Helvetica")
            .fontSize(9)
            .text(pdfCompanyDetails.companyAddressLine1, 320, 52, { align: "right", width: 225 })
            .text(pdfCompanyDetails.companyAddressLine2, 320, 65, { align: "right", width: 225 })
            .text(`Tel: ${pdfCompanyDetails.companyPhone}`, 320, 85, { align: "right", width: 225 })
            .text(`Email: ${pdfCompanyDetails.companyEmail}`, 320, 98, { align: "right", width: 225 })
            .text(`VAT: ${pdfCompanyDetails.companyVatNumber}`, 320, 111, { align: "right", width: 225 });

          // ===== ORDER TITLE AND STATUS =====
          pdfDoc
            .fontSize(28)
            .fillColor(env.BRAND_PRIMARY_COLOR)
            .font("Helvetica-Bold")
            .text("ORDER SUMMARY", 50, 170);

          // Status badge
          const statusBg = "#d1fae5";
          pdfDoc.rect(450, 172, 95, 20).fill(statusBg);
          pdfDoc
            .fontSize(10)
            .fillColor(env.BRAND_SUCCESS_COLOR)
            .font("Helvetica-Bold")
            .text("COMPLETED", 450, 177, { width: 95, align: "center" });

          // Order details
          pdfDoc
            .fontSize(10)
            .fillColor("#666666")
            .font("Helvetica")
            .text(`Order No: ${updatedOrder.orderNumber}`, 50, 210)
            .fillColor(env.BRAND_ACCENT_COLOR)
            .text(`Completed: ${new Date().toLocaleDateString("en-ZA", { 
              year: "numeric", 
              month: "long", 
              day: "numeric" 
            })}`, 50, 225);

          // ===== CUSTOMER DETAILS BOX =====
          const customerBoxTop = 260;
          pdfDoc
            .rect(50, customerBoxTop, 240, 110)
            .lineWidth(2)
            .strokeColor(env.BRAND_ACCENT_COLOR)
            .stroke();
          pdfDoc.rect(51, customerBoxTop + 1, 238, 108).fill("#f9fafb");
          pdfDoc.rect(50, customerBoxTop, 240, 28).fill(env.BRAND_ACCENT_COLOR);
          pdfDoc
            .fontSize(11)
            .fillColor("#ffffff")
            .font("Helvetica-Bold")
            .text("CUSTOMER DETAILS", 60, customerBoxTop + 8);

          pdfDoc
            .fontSize(10)
            .fillColor("#1a1a1a")
            .font("Helvetica-Bold")
            .text(updatedOrder.customerName, 60, customerBoxTop + 38, { width: 220 })
            .font("Helvetica")
            .fontSize(9)
            .fillColor("#333333")
            .text(updatedOrder.address, 60, customerBoxTop + 53, { width: 220 })
            .text(updatedOrder.customerEmail, 60, customerBoxTop + 73, { width: 220 })
            .text(`Tel: ${updatedOrder.customerPhone}`, 60, customerBoxTop + 88, { width: 220 });

          // ===== ARTISAN DETAILS BOX =====
          const artisanBoxLeft = 310;
          if (updatedOrder.assignedTo) {
            pdfDoc
              .rect(artisanBoxLeft, customerBoxTop, 235, 110)
              .lineWidth(2)
              .strokeColor(env.BRAND_PRIMARY_COLOR)
              .stroke();
            pdfDoc.rect(artisanBoxLeft + 1, customerBoxTop + 1, 233, 108).fill("#f9fafb");
            pdfDoc.rect(artisanBoxLeft, customerBoxTop, 235, 28).fill(env.BRAND_PRIMARY_COLOR);
            pdfDoc
              .fontSize(11)
              .fillColor("#ffffff")
              .font("Helvetica-Bold")
              .text("ASSIGNED ARTISAN", artisanBoxLeft + 10, customerBoxTop + 8);

            pdfDoc
              .fontSize(10)
              .fillColor("#1a1a1a")
              .font("Helvetica-Bold")
              .text(
                `${updatedOrder.assignedTo.firstName} ${updatedOrder.assignedTo.lastName}`,
                artisanBoxLeft + 10,
                customerBoxTop + 38,
                { width: 215 }
              )
              .font("Helvetica")
              .fontSize(9)
              .fillColor("#333333")
              .text(
                updatedOrder.assignedTo.email,
                artisanBoxLeft + 10,
                customerBoxTop + 53,
                { width: 215 }
              )
              .text(
                `Tel: ${updatedOrder.assignedTo.phone || "N/A"}`,
                artisanBoxLeft + 10,
                customerBoxTop + 68,
                { width: 215 }
              );
          }

          // ===== SERVICE DETAILS SECTION =====
          let pdfYPos = 395;
          pdfDoc
            .fontSize(14)
            .fillColor(env.BRAND_PRIMARY_COLOR)
            .font("Helvetica-Bold")
            .text("SERVICE DETAILS", 50, pdfYPos);
          pdfYPos += 25;

          pdfDoc
            .fontSize(10)
            .fillColor("#666666")
            .font("Helvetica")
            .text("Service Type:", 60, pdfYPos, { width: 100 })
            .fillColor("#1a1a1a")
            .font("Helvetica-Bold")
            .text(updatedOrder.serviceType, 160, pdfYPos, { width: 385 });
          pdfYPos += 20;

          pdfDoc
            .fillColor("#666666")
            .font("Helvetica")
            .text("Description:", 60, pdfYPos, { width: 100 })
            .fillColor("#333333")
            .text(updatedOrder.description, 160, pdfYPos, { width: 385, align: "justify" });
          pdfYPos += 50;

          // ===== PICTURES SECTION =====
          pdfDoc
            .fontSize(14)
            .fillColor(env.BRAND_PRIMARY_COLOR)
            .font("Helvetica-Bold")
            .text("DOCUMENTATION", 50, pdfYPos);
          pdfYPos += 25;

          // Fetch before and after images
          const beforeImageBuffers: Buffer[] = [];
          const afterImageBuffers: Buffer[] = [];

          for (let i = 0; i < Math.min(updatedOrder.beforePictures.length, 4); i++) {
            const buffer = await fetchImageAsBuffer(updatedOrder.beforePictures[i]!);
            if (buffer) beforeImageBuffers.push(buffer);
          }

          for (let i = 0; i < Math.min(updatedOrder.afterPictures.length, 4); i++) {
            const buffer = await fetchImageAsBuffer(updatedOrder.afterPictures[i]!);
            if (buffer) afterImageBuffers.push(buffer);
          }

          const imageBoxHeight = 250;
          
          // Before pictures box
          pdfDoc
            .rect(50, pdfYPos, 240, imageBoxHeight)
            .lineWidth(1)
            .strokeColor(env.BRAND_ACCENT_COLOR)
            .stroke();
          pdfDoc.rect(51, pdfYPos + 1, 238, imageBoxHeight - 2).fill("#f9fafb");
          pdfDoc.rect(50, pdfYPos, 240, 22).fill(env.BRAND_ACCENT_COLOR);
          pdfDoc
            .fontSize(10)
            .fillColor("#ffffff")
            .font("Helvetica-Bold")
            .text("BEFORE PICTURES", 60, pdfYPos + 6);

          if (beforeImageBuffers.length > 0) {
            const imageStartY = pdfYPos + 28;
            const imageWidth = 100;
            const imageHeight = 90;
            const imageSpacing = 10;
            
            beforeImageBuffers.forEach((buffer, index) => {
              try {
                const xPos = 60 + (index % 2) * (imageWidth + imageSpacing);
                const yPosImg = imageStartY + Math.floor(index / 2) * (imageHeight + imageSpacing);
                pdfDoc.image(buffer, xPos, yPosImg, { fit: [imageWidth, imageHeight] });
              } catch (error) {
                console.error(`Error embedding before image ${index}:`, error);
              }
            });
          }

          // After pictures box
          const afterBoxLeft = 305;
          pdfDoc
            .rect(afterBoxLeft, pdfYPos, 240, imageBoxHeight)
            .lineWidth(1)
            .strokeColor(env.BRAND_ACCENT_COLOR)
            .stroke();
          pdfDoc.rect(afterBoxLeft + 1, pdfYPos + 1, 238, imageBoxHeight - 2).fill("#f9fafb");
          pdfDoc.rect(afterBoxLeft, pdfYPos, 240, 22).fill(env.BRAND_ACCENT_COLOR);
          pdfDoc
            .fontSize(10)
            .fillColor("#ffffff")
            .font("Helvetica-Bold")
            .text("AFTER PICTURES", afterBoxLeft + 10, pdfYPos + 6);

          if (afterImageBuffers.length > 0) {
            const imageStartY = pdfYPos + 28;
            const imageWidth = 100;
            const imageHeight = 90;
            const imageSpacing = 10;
            
            afterImageBuffers.forEach((buffer, index) => {
              try {
                const xPos = afterBoxLeft + 10 + (index % 2) * (imageWidth + imageSpacing);
                const yPosImg = imageStartY + Math.floor(index / 2) * (imageHeight + imageSpacing);
                pdfDoc.image(buffer, xPos, yPosImg, { fit: [imageWidth, imageHeight] });
              } catch (error) {
                console.error(`Error embedding after image ${index}:`, error);
              }
            });
          }

          pdfYPos += imageBoxHeight + 20;

          // ===== SIGNATURE SECTION =====
          if (pdfYPos + 130 > 750) {
            pdfDoc.addPage();
            pdfYPos = 50;
          }

          pdfDoc
            .rect(50, pdfYPos, 495, 120)
            .lineWidth(2)
            .strokeColor(env.BRAND_ACCENT_COLOR)
            .stroke();
          pdfDoc.rect(51, pdfYPos + 1, 493, 118).fill("#f9fafb");
          pdfDoc.rect(50, pdfYPos, 495, 30).fill(env.BRAND_ACCENT_COLOR);
          pdfDoc
            .fontSize(12)
            .fillColor("#ffffff")
            .font("Helvetica-Bold")
            .text("CLIENT CONFIRMATION", 60, pdfYPos + 9);
          pdfYPos += 40;

          pdfDoc
            .fontSize(9)
            .fillColor("#666666")
            .font("Helvetica")
            .text(
              "I confirm that the work has been completed to my satisfaction.",
              60,
              pdfYPos,
              { width: 475 }
            );
          pdfYPos += 20;

          // Signature
          pdfDoc
            .fontSize(10)
            .fillColor("#333333")
            .font("Helvetica")
            .text("Signature:", 60, pdfYPos);

          if (updatedOrder.signedJobCardUrl) {
            const signatureBuffer = await fetchImageAsBuffer(updatedOrder.signedJobCardUrl);
            if (signatureBuffer) {
              try {
                pdfDoc.image(signatureBuffer, 140, pdfYPos - 10, { fit: [250, 50] });
              } catch (error) {
                console.error("Error embedding signature:", error);
                pdfDoc.text("_________________________________", 140, pdfYPos);
              }
            } else {
              pdfDoc.text("_________________________________", 140, pdfYPos);
            }
          } else {
            pdfDoc.text("_________________________________", 140, pdfYPos);
          }
          pdfYPos += 30;

          pdfDoc
            .fontSize(10)
            .fillColor("#333333")
            .font("Helvetica")
            .text("Name:", 60, pdfYPos);
          if (updatedOrder.clientRepName) {
            pdfDoc.font("Helvetica-Bold").text(updatedOrder.clientRepName, 140, pdfYPos);
          } else {
            pdfDoc.text("_______________________", 140, pdfYPos);
          }
          pdfYPos += 25;

          pdfDoc
            .font("Helvetica")
            .text("Date:", 60, pdfYPos);
          if (updatedOrder.clientRepSignDate) {
            pdfDoc
              .font("Helvetica-Bold")
              .text(
                new Date(updatedOrder.clientRepSignDate).toLocaleDateString("en-ZA", {
                  year: "numeric",
                  month: "long",
                  day: "numeric"
                }),
                140,
                pdfYPos
              );
          } else {
            pdfDoc.text("_________________________________", 140, pdfYPos);
          }

          // ===== FOOTER =====
          pdfDoc
            .moveTo(50, 770)
            .lineTo(545, 770)
            .strokeColor(env.BRAND_ACCENT_COLOR)
            .lineWidth(1)
            .stroke();

          pdfDoc
            .fontSize(8)
            .fillColor("#999999")
            .font("Helvetica")
            .text(
              `${pdfCompanyDetails.companyName} | ${pdfCompanyDetails.companyEmail} | VAT Reg: ${pdfCompanyDetails.companyVatNumber}`,
              50,
              778,
              { align: "center", width: 495 }
            );

            pdfDoc.end();

            // Wait for PDF generation to complete
            const pdfBuffer = await pdfBufferPromise;
            
            console.log(`[updateOrderStatus] Order PDF generated successfully, size: ${pdfBuffer.length} bytes`);

            // Send the completion email
            await sendCompletionReportEmail({
              customerEmail: updatedOrder.customerEmail,
              customerName: updatedOrder.customerName,
              completionType: "ORDER",
              completionTitle: updatedOrder.orderNumber,
              completionDate: new Date(),
              pdfBuffer,
              pdfFilename: `Order_${updatedOrder.orderNumber}_Completion_Report.pdf`,
              additionalDetails: updatedOrder.serviceType,
            });

            console.log(`[updateOrderStatus] Completion report email sent successfully to ${updatedOrder.customerEmail}`);
          } catch (emailError) {
            // Log the error but don't fail the order update
            console.error("[updateOrderStatus] Failed to send completion report email:", emailError);
          }
        })().catch((unhandledError) => {
          console.error("[updateOrderStatus] Completion report task crashed:", unhandledError);
        });
      }

      return updatedOrder;
    } catch (error) {
      if (error instanceof TRPCError) {
        console.error('[updateOrderStatus] TRPCError caught:', error.message, 'code:', error.code);
        throw error;
      }
      console.error('[updateOrderStatus] Unexpected error:', error);
      console.error('[updateOrderStatus] Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('[updateOrderStatus] Error message:', error instanceof Error ? error.message : String(error));
      console.error('[updateOrderStatus] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to update order status",
      });
    }
  });
