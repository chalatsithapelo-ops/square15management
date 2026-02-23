import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { getContractorLogo } from "~/server/utils/logo";
import {
  generatePdfFromData,
  getPdfSettings,
  resolveTheme,
  type FullPDFData,
  type PDFLineItem,
  type PDFTemplateLayout,
} from "~/server/utils/pdf-templates";

export const generatePropertyManagerInvoicePdf = baseProcedure
  .input(
    z.object({
      token: z.string(),
      invoiceId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const payload = z.object({ userId: z.number() }).parse(verified);

      const invoice = await db.propertyManagerInvoice.findUnique({
        where: { id: input.invoiceId },
        include: {
          propertyManager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              pmCompanyName: true,
              pmCompanyAddressLine1: true,
              pmCompanyAddressLine2: true,
              pmCompanyPhone: true,
            },
          },
          order: {
            select: {
              orderNumber: true,
              contractor: {
                select: {
                  id: true,
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
                },
              },
            },
          },
        },
      });

      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }

      // Get contractor details (the seller)
      let contractorDetails: any;
      if (invoice.order?.contractor) {
        contractorDetails = invoice.order.contractor;
      } else {
        const contractorSettings = await db.systemSettings.findMany({
          where: {
            key: {
              in: [
                "contractor_company_name", "contractor_company_address_line1",
                "contractor_company_address_line2", "contractor_company_phone",
                "contractor_company_email", "contractor_company_vat_number",
                "contractor_company_bank_name", "contractor_company_bank_account_name",
                "contractor_company_bank_account_number", "contractor_company_bank_branch_code",
              ],
            },
          },
        });
        const map: Record<string, string> = {};
        for (const s of contractorSettings) if (s.value) map[s.key] = s.value;
        contractorDetails = {
          contractorCompanyName: map.contractor_company_name || "Your Company Name",
          contractorCompanyAddressLine1: map.contractor_company_address_line1 || "",
          contractorCompanyAddressLine2: map.contractor_company_address_line2 || "",
          contractorCompanyPhone: map.contractor_company_phone || "",
          contractorCompanyEmail: map.contractor_company_email || "",
          contractorCompanyVatNumber: map.contractor_company_vat_number || "",
          contractorCompanyBankName: map.contractor_company_bank_name || "",
          contractorCompanyBankAccountName: map.contractor_company_bank_account_name || "",
          contractorCompanyBankAccountNumber: map.contractor_company_bank_account_number || "",
          contractorCompanyBankBranchCode: map.contractor_company_bank_branch_code || "",
        };
      }

      const companyName = contractorDetails.contractorCompanyName || "Your Company";
      const logoBuffer = await getContractorLogo();
      const pdfSettings = await getPdfSettings();
      const colors = resolveTheme(pdfSettings.themeName, pdfSettings.customBrand);

      // Build line items
      const rawItems = Array.isArray(invoice.items) ? invoice.items : [];
      const lineItems: PDFLineItem[] = (rawItems as any[]).map((item) => {
        const exclTotal = item.total || (item.quantity || 1) * (item.unitPrice || 0);
        const vatPct = 15;
        return {
          description: item.description || "Service",
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          discountPercent: 0,
          vatPercent: vatPct,
          exclTotal,
          inclTotal: exclTotal * (1 + vatPct / 100),
          unitOfMeasure: item.unitOfMeasure || "Sum",
        };
      });

      const pmName = invoice.propertyManager
        ? `${invoice.propertyManager.firstName} ${invoice.propertyManager.lastName}`
        : "Property Manager";

      const data: FullPDFData = {
        template: pdfSettings.template as PDFTemplateLayout,
        colors,
        company: {
          companyName,
          companyTagline: pdfSettings.companyTagline,
          companyAddressLine1: contractorDetails.contractorCompanyAddressLine1 || "",
          companyAddressLine2: contractorDetails.contractorCompanyAddressLine2 || "",
          companyPhone: contractorDetails.contractorCompanyPhone || "",
          companyEmail: contractorDetails.contractorCompanyEmail || "",
          companyVatNumber: contractorDetails.contractorCompanyVatNumber || "",
          companyBankName: contractorDetails.contractorCompanyBankName || "",
          companyBankAccountName: contractorDetails.contractorCompanyBankAccountName || "",
          companyBankAccountNumber: contractorDetails.contractorCompanyBankAccountNumber || "",
          companyBankBranchCode: contractorDetails.contractorCompanyBankBranchCode || "",
        },
        customer: {
          customerName: pmName,
          customerEmail: invoice.propertyManager?.email || "",
          customerPhone: invoice.propertyManager?.phone || "",
          address: invoice.propertyManager?.pmCompanyAddressLine1 || "",
        },
        document: {
          documentType: "INVOICE",
          documentNumber: invoice.invoiceNumber,
          date: invoice.createdAt,
          status: invoice.status.replace(/_/g, " "),
          orderNumber: invoice.order?.orderNumber || undefined,
          paymentTerms: pdfSettings.paymentTerms || undefined,
        },
        items: lineItems,
        totals: {
          subtotal: invoice.subtotal,
          vat: invoice.tax || 0,
          total: invoice.total,
        },
        banking: contractorDetails.contractorCompanyBankName ? {
          bankName: contractorDetails.contractorCompanyBankName,
          accountName: contractorDetails.contractorCompanyBankAccountName || "",
          accountNumber: contractorDetails.contractorCompanyBankAccountNumber || "",
          branchCode: contractorDetails.contractorCompanyBankBranchCode || "",
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
      console.error("Error generating PM invoice PDF:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate invoice PDF",
      });
    }
  });
