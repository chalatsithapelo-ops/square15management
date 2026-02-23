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

export const generateQuotationPdf = baseProcedure
  .input(
    z.object({
      token: z.string(),
      quotationId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

      const quotation = await db.quotation.findUnique({
        where: { id: input.quotationId },
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          project: {
            select: {
              name: true,
              projectNumber: true,
            },
          },
          lead: {
            select: {
              address: true,
              customerName: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              role: true,
              contractorCompanyName: true,
              contractorCompanyAddressLine1: true,
              contractorCompanyAddressLine2: true,
              contractorCompanyPhone: true,
              contractorCompanyEmail: true,
              contractorCompanyVatNumber: true,
              pmCompanyName: true,
              pmCompanyAddressLine1: true,
              pmCompanyAddressLine2: true,
              pmCompanyPhone: true,
              pmCompanyEmail: true,
              pmCompanyVatNumber: true,
            },
          },
        },
      });

      if (!quotation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Quotation not found" });
      }

      if (quotation.status !== "APPROVED" && quotation.status !== "SENT_TO_CUSTOMER") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only approved quotations or those sent to customers can be exported",
        });
      }

      // Determine company details and logo
      let companyDetails;
      let logoBuffer;
      const isContractor = quotation.createdBy &&
        (quotation.createdBy.role === "CONTRACTOR" ||
         quotation.createdBy.role === "CONTRACTOR_SENIOR_MANAGER" ||
         quotation.createdBy.role === "CONTRACTOR_JUNIOR_MANAGER") &&
        quotation.createdBy.contractorCompanyName;

      if (isContractor && quotation.createdBy) {
        companyDetails = {
          companyName: quotation.createdBy.contractorCompanyName!,
          companyAddressLine1: quotation.createdBy.contractorCompanyAddressLine1 || "",
          companyAddressLine2: quotation.createdBy.contractorCompanyAddressLine2 || "",
          companyPhone: quotation.createdBy.contractorCompanyPhone || "",
          companyEmail: quotation.createdBy.contractorCompanyEmail || "",
          companyVatNumber: quotation.createdBy.contractorCompanyVatNumber || "",
        };
        logoBuffer = await getContractorLogo();
      } else {
        companyDetails = await getCompanyDetails();
        logoBuffer = await getCompanyLogo();
      }

      // Get PDF template settings
      const pdfSettings = await getPdfSettings();
      const colors = resolveTheme(pdfSettings.themeName);

      // Build line items
      const rawItems = Array.isArray(quotation.items) ? quotation.items : [];
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

      // Determine project name and building name
      const projectName = quotation.project?.name || quotation.project?.projectNumber || undefined;
      const buildingName = quotation.lead?.address || undefined;

      // Sales rep
      const salesRep = quotation.assignedTo
        ? `${quotation.assignedTo.firstName} ${quotation.assignedTo.lastName}`
        : undefined;

      const data: FullPDFData = {
        template: pdfSettings.template as PDFTemplateLayout,
        colors,
        company: {
          companyName: companyDetails.companyName,
          companyTagline: pdfSettings.companyTagline,
          companyAddressLine1: companyDetails.companyAddressLine1,
          companyAddressLine2: companyDetails.companyAddressLine2,
          companyPhone: companyDetails.companyPhone,
          companyEmail: companyDetails.companyEmail,
          companyVatNumber: companyDetails.companyVatNumber,
          companyBankName: (companyDetails as any).companyBankName,
          companyBankAccountName: (companyDetails as any).companyBankAccountName,
          companyBankAccountNumber: (companyDetails as any).companyBankAccountNumber,
          companyBankBranchCode: (companyDetails as any).companyBankBranchCode,
        },
        customer: {
          customerName: quotation.customerName,
          customerEmail: quotation.customerEmail,
          customerPhone: quotation.customerPhone,
          address: quotation.address,
        },
        document: {
          documentType: "QUOTATION",
          documentNumber: quotation.quoteNumber,
          reference: quotation.clientReferenceQuoteNumber || undefined,
          date: quotation.createdAt,
          dueDate: quotation.validUntil || undefined,
          salesRep,
          projectName,
          buildingName,
          paymentTerms: pdfSettings.paymentTerms || undefined,
        },
        items: lineItems,
        totals: {
          subtotal: quotation.subtotal,
          vat: quotation.tax,
          total: quotation.total,
        },
        banking: (companyDetails as any).companyBankName ? {
          bankName: (companyDetails as any).companyBankName || "",
          accountName: (companyDetails as any).companyBankAccountName || "",
          accountNumber: (companyDetails as any).companyBankAccountNumber || "",
          branchCode: (companyDetails as any).companyBankBranchCode || "",
          reference: quotation.quoteNumber,
        } : undefined,
        notes: quotation.notes || undefined,
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
