import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { getCompanyLogo, getContractorLogo } from "~/server/utils/logo";
import { getCompanyDetails } from "~/server/utils/company-details";
import {
  generatePdfFromData,
  getPdfSettings,
  resolveTheme,
  type FullPDFData,
  type PDFLineItem,
  type PDFTemplateLayout,
} from "~/server/utils/pdf-templates";

export const generateInvoicePdf = baseProcedure
  .input(
    z.object({
      token: z.string(),
      invoiceId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const { userId } = z.object({ userId: z.number() }).parse(verified as any);

      const requestingUser = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, email: true },
      });

      if (!requestingUser) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
      }

      const invoice = await db.invoice.findUnique({
        where: { id: input.invoiceId },
        include: {
          order: {
            select: { orderNumber: true },
          },
          project: {
            select: { name: true, projectNumber: true },
          },
          createdBy: {
            select: {
              id: true,
              role: true,
              firstName: true,
              lastName: true,
              contractorCompanyName: true,
              contractorCompanyAddressLine1: true,
              contractorCompanyAddressLine2: true,
              contractorCompanyPhone: true,
              contractorCompanyEmail: true,
              contractorCompanyVatNumber: true,
              contractorCompanyBankName: true,
              contractorCompanyBankAccountName: true,
              contractorCompanyBankAccountNumber: true,
              contractorCompanyBankBranchCode: true,
              pmCompanyName: true,
              pmCompanyAddressLine1: true,
              pmCompanyAddressLine2: true,
              pmCompanyPhone: true,
              pmCompanyEmail: true,
              pmCompanyVatNumber: true,
              pmCompanyBankName: true,
              pmCompanyBankAccountName: true,
              pmCompanyBankAccountNumber: true,
              pmCompanyBankBranchCode: true,
            },
          },
        },
      });

      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }

      const isAdminPortalUser =
        requestingUser.role === "ADMIN" ||
        requestingUser.role === "SENIOR_ADMIN" ||
        requestingUser.role === "JUNIOR_ADMIN";

      if (!isAdminPortalUser && !["SENT", "OVERDUE", "PAID"].includes(invoice.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only sent, overdue, or paid invoices can be exported",
        });
      }

      // Determine if this is a contractor or property manager invoice
      const isContractorInvoice = invoice.createdBy &&
        (invoice.createdBy.role === "CONTRACTOR" ||
         invoice.createdBy.role === "CONTRACTOR_SENIOR_MANAGER" ||
         invoice.createdBy.role === "CONTRACTOR_JUNIOR_MANAGER");

      // Get company details based on who created the invoice
      let companyDetails: any;
      if (isContractorInvoice && invoice.createdBy?.contractorCompanyName) {
        companyDetails = {
          companyName: invoice.createdBy.contractorCompanyName,
          companyAddressLine1: invoice.createdBy.contractorCompanyAddressLine1 || "",
          companyAddressLine2: invoice.createdBy.contractorCompanyAddressLine2 || "",
          companyPhone: invoice.createdBy.contractorCompanyPhone || "",
          companyEmail: invoice.createdBy.contractorCompanyEmail || "",
          companyVatNumber: invoice.createdBy.contractorCompanyVatNumber || "",
          companyBankName: invoice.createdBy.contractorCompanyBankName || "",
          companyBankAccountName: invoice.createdBy.contractorCompanyBankAccountName || "",
          companyBankAccountNumber: invoice.createdBy.contractorCompanyBankAccountNumber || "",
          companyBankBranchCode: invoice.createdBy.contractorCompanyBankBranchCode || "",
        };
      } else if (invoice.createdBy?.pmCompanyName) {
        companyDetails = {
          companyName: invoice.createdBy.pmCompanyName,
          companyAddressLine1: invoice.createdBy.pmCompanyAddressLine1 || "",
          companyAddressLine2: invoice.createdBy.pmCompanyAddressLine2 || "",
          companyPhone: invoice.createdBy.pmCompanyPhone || "",
          companyEmail: invoice.createdBy.pmCompanyEmail || "",
          companyVatNumber: invoice.createdBy.pmCompanyVatNumber || "",
          companyBankName: invoice.createdBy.pmCompanyBankName || "",
          companyBankAccountName: invoice.createdBy.pmCompanyBankAccountName || "",
          companyBankAccountNumber: invoice.createdBy.pmCompanyBankAccountNumber || "",
          companyBankBranchCode: invoice.createdBy.pmCompanyBankBranchCode || "",
        };
      } else {
        companyDetails = await getCompanyDetails();
      }

      const logoBuffer = isContractorInvoice
        ? await getContractorLogo()
        : await getCompanyLogo();

      // Get PDF template settings
      const pdfSettings = await getPdfSettings();
      const colors = resolveTheme(pdfSettings.themeName, pdfSettings.customBrand);

      // Build line items
      const rawItems = Array.isArray(invoice.items) ? invoice.items : [];
      const lineItems: PDFLineItem[] = rawItems.map((item: any) => {
        const exclTotal = item.total || item.quantity * item.unitPrice;
        const vatPct = 15;
        const inclTotal = exclTotal * (1 + vatPct / 100);
        return {
          description: item.description || "",
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          discountPercent: 0,
          vatPercent: vatPct,
          exclTotal,
          inclTotal,
          unitOfMeasure: item.unitOfMeasure || "Sum",
        };
      });

      const salesRep = invoice.createdBy
        ? `${invoice.createdBy.firstName} ${invoice.createdBy.lastName}`
        : undefined;

      const statusLabel = invoice.status === "PAID" ? "PAID"
        : invoice.status === "OVERDUE" ? "OVERDUE"
        : "OUTSTANDING";

      const data: FullPDFData = {
        template: pdfSettings.template as PDFTemplateLayout,
        colors,
        company: {
          companyName: companyDetails.companyName,
          companyTagline: pdfSettings.companyTagline,
          companyAddressLine1: companyDetails.companyAddressLine1,
          companyAddressLine2: companyDetails.companyAddressLine2,
          postalAddress: companyDetails.companyPostalAddress || undefined,
          physicalAddress: companyDetails.companyPhysicalAddress || undefined,
          companyPhone: companyDetails.companyPhone,
          companyEmail: companyDetails.companyEmail,
          companyVatNumber: companyDetails.companyVatNumber,
          companyBankName: companyDetails.companyBankName,
          companyBankAccountName: companyDetails.companyBankAccountName,
          companyBankAccountNumber: companyDetails.companyBankAccountNumber,
          companyBankBranchCode: companyDetails.companyBankBranchCode,
        },
        customer: {
          customerName: invoice.customerName,
          customerEmail: invoice.customerEmail,
          customerPhone: invoice.customerPhone,
          address: invoice.address,
        },
        document: {
          documentType: "INVOICE",
          documentNumber: invoice.invoiceNumber,
          date: invoice.createdAt,
          dueDate: invoice.dueDate || undefined,
          salesRep,
          status: statusLabel,
          orderNumber: invoice.order?.orderNumber || undefined,
          projectName: invoice.project?.name || invoice.project?.projectNumber || undefined,
          paidDate: invoice.paidDate || undefined,
          paymentTerms: pdfSettings.paymentTerms || undefined,
        },
        items: lineItems,
        totals: {
          subtotal: invoice.subtotal,
          vat: invoice.tax,
          total: invoice.total,
        },
        banking: companyDetails.companyBankName ? {
          bankName: companyDetails.companyBankName,
          accountName: companyDetails.companyBankAccountName || "",
          accountNumber: companyDetails.companyBankAccountNumber || "",
          branchCode: companyDetails.companyBankBranchCode || "",
          reference: invoice.invoiceNumber,
        } : undefined,
        notes: invoice.notes || undefined,
        paymentTerms: pdfSettings.paymentTerms || undefined,
        logoBuffer,
      };

      const pdfBuffer = await generatePdfFromData(data);
      return { pdf: pdfBuffer.toString("base64") };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
