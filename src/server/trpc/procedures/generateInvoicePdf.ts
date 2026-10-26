import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { getCompanyLogo, getContractorLogo } from "~/server/utils/logo";
import { getCompanyDetails } from "~/server/utils/company-details";
import { roundCurrency } from "~/utils/money";
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

      // Get company details based on who created the invoice.
      // Always load the global company details first so we can per-field
      // fall back to them when the user's contractor/PM-specific fields are
      // blank (otherwise the PDF "FROM" block ends up missing the address).
      const globalCompanyDetails = await getCompanyDetails();
      let companyDetails: any;
      if (isContractorInvoice && invoice.createdBy?.contractorCompanyName) {
        companyDetails = {
          companyName: invoice.createdBy.contractorCompanyName || globalCompanyDetails.companyName,
          companyAddressLine1: invoice.createdBy.contractorCompanyAddressLine1 || globalCompanyDetails.companyAddressLine1 || "",
          companyAddressLine2: invoice.createdBy.contractorCompanyAddressLine2 || globalCompanyDetails.companyAddressLine2 || "",
          companyPostalAddress: globalCompanyDetails.companyPostalAddress || "",
          companyPhysicalAddress: globalCompanyDetails.companyPhysicalAddress || "",
          companyPhone: invoice.createdBy.contractorCompanyPhone || globalCompanyDetails.companyPhone || "",
          companyEmail: invoice.createdBy.contractorCompanyEmail || globalCompanyDetails.companyEmail || "",
          companyVatNumber: invoice.createdBy.contractorCompanyVatNumber || globalCompanyDetails.companyVatNumber || "",
          companyBankName: invoice.createdBy.contractorCompanyBankName || globalCompanyDetails.companyBankName || "",
          companyBankAccountName: invoice.createdBy.contractorCompanyBankAccountName || globalCompanyDetails.companyBankAccountName || "",
          companyBankAccountNumber: invoice.createdBy.contractorCompanyBankAccountNumber || globalCompanyDetails.companyBankAccountNumber || "",
          companyBankBranchCode: invoice.createdBy.contractorCompanyBankBranchCode || globalCompanyDetails.companyBankBranchCode || "",
        };
      } else if (invoice.createdBy?.pmCompanyName) {
        companyDetails = {
          companyName: invoice.createdBy.pmCompanyName || globalCompanyDetails.companyName,
          companyAddressLine1: invoice.createdBy.pmCompanyAddressLine1 || globalCompanyDetails.companyAddressLine1 || "",
          companyAddressLine2: invoice.createdBy.pmCompanyAddressLine2 || globalCompanyDetails.companyAddressLine2 || "",
          companyPostalAddress: globalCompanyDetails.companyPostalAddress || "",
          companyPhysicalAddress: globalCompanyDetails.companyPhysicalAddress || "",
          companyPhone: invoice.createdBy.pmCompanyPhone || globalCompanyDetails.companyPhone || "",
          companyEmail: invoice.createdBy.pmCompanyEmail || globalCompanyDetails.companyEmail || "",
          companyVatNumber: invoice.createdBy.pmCompanyVatNumber || globalCompanyDetails.companyVatNumber || "",
          companyBankName: invoice.createdBy.pmCompanyBankName || globalCompanyDetails.companyBankName || "",
          companyBankAccountName: invoice.createdBy.pmCompanyBankAccountName || globalCompanyDetails.companyBankAccountName || "",
          companyBankAccountNumber: invoice.createdBy.pmCompanyBankAccountNumber || globalCompanyDetails.companyBankAccountNumber || "",
          companyBankBranchCode: invoice.createdBy.pmCompanyBankBranchCode || globalCompanyDetails.companyBankBranchCode || "",
        };
      } else {
        companyDetails = globalCompanyDetails;
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
        const inclTotal = roundCurrency(Number(exclTotal) * (1 + vatPct / 100));
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

      const displaySubtotal = roundCurrency(Number(invoice.subtotal) || 0);
      const displayTotal = roundCurrency(Number(invoice.total) || 0);
      const displayDiscount = roundCurrency(Number((invoice as any).discountAmount) || 0);
      // Pass the discounted (net) exclusive as `subtotal` so template `VAT = total - subtotal`
      // reflects the actual VAT charged, and render the discount line separately.
      const displayNetSubtotal = roundCurrency(Math.max(0, displaySubtotal - displayDiscount));
      const displayVat = roundCurrency(displayTotal - displayNetSubtotal);

      // Deposit tracking — pass through to the PDF template so a Deposit
      // Received line + Balance Due block are rendered under the totals.
      const depositPaid = roundCurrency(Number((invoice as any).depositAmount) || 0);
      const balanceDue = roundCurrency(Math.max(0, displayTotal - depositPaid));
      const depositPaidDate = (invoice as any).depositPaidDate ?? null;
      const depositReference = (invoice as any).depositReference ?? null;

      // Deposit REQUESTED — up-front payment terms shown on the invoice PDF.
      const depositRequested = roundCurrency(
        Number((invoice as any).depositRequestedAmount) || 0,
      );
      const depositRequestedPercent = Number((invoice as any).depositRequestedPercent) || 0;
      const balanceOnCompletion = roundCurrency(
        Math.max(0, displayTotal - depositRequested),
      );
      const depositDueDate = (invoice as any).depositDueDate ?? null;

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
          customerVatNumber: invoice.customerVatNumber || undefined,
        },
        projectDescription: (invoice as any).projectDescription || undefined,
        document: {
          documentType: "INVOICE",
          documentNumber: invoice.invoiceNumber,
          reference: invoice.clientReferenceNumber || undefined,
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
          subtotal: displayNetSubtotal,
          vat: displayVat,
          total: displayTotal,
          ...(displayDiscount > 0 ? { totalDiscount: displayDiscount } : {}),
          ...(depositPaid > 0
            ? {
                depositPaid,
                balanceDue,
                depositPaidDate,
                depositReference,
              }
            : {}),
          ...(depositRequested > 0
            ? {
                depositRequested,
                depositRequestedPercent,
                balanceOnCompletion,
                depositDueDate,
              }
            : {}),
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
