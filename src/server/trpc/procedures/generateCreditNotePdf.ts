import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { roundCurrency } from "~/utils/money";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
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

const contractorRoles = ["CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER", "CONTRACTOR_JUNIOR_MANAGER"] as const;

async function canAccessCreditNote(user: { id: number; role: string; contractorCompanyName: string | null }, createdById: number | null, customerEmail: string) {
  if (isAdmin(user as any)) return true;

  if (contractorRoles.includes(user.role as any)) {
    if (user.role === "CONTRACTOR") return createdById === user.id;

    const company = user.contractorCompanyName?.trim();
    if (!company) return createdById === user.id;

    const companyUsers = await db.user.findMany({
      where: {
        contractorCompanyName: company,
        role: { in: [...contractorRoles] },
      },
      select: { id: true },
    });
    const ids = companyUsers.map((u) => u.id);
    return createdById !== null && ids.includes(createdById);
  }

  return user.email === customerEmail;
}

export const generateCreditNotePdf = baseProcedure
  .input(
    z.object({
      token: z.string(),
      creditNoteId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const creditNote = await db.creditNote.findUnique({
      where: { id: input.creditNoteId },
      include: {
        invoice: {
          include: {
            order: { select: { orderNumber: true } },
            project: { select: { name: true, projectNumber: true } },
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
        },
      },
    });

    if (!creditNote) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Credit note not found" });
    }

    const allowed = await canAccessCreditNote(
      user,
      creditNote.invoice.createdById ?? null,
      creditNote.customerEmail,
    );
    if (!allowed) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this credit note" });
    }

    const invoice = creditNote.invoice;
    const isContractorInvoice = invoice.createdBy && contractorRoles.includes(invoice.createdBy.role as any);

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

    const logoBuffer = isContractorInvoice ? await getContractorLogo() : await getCompanyLogo();
    const pdfSettings = await getPdfSettings();
    const colors = resolveTheme(pdfSettings.themeName, pdfSettings.customBrand);

    const rawItems = Array.isArray(creditNote.items) ? (creditNote.items as any[]) : [];
    const lineItems: PDFLineItem[] = rawItems.map((item) => {
      const exclTotal = Number(item.total ?? Number(item.quantity || 1) * Number(item.unitPrice || 0));
      const vatPct = 15;
      const inclTotal = roundCurrency(exclTotal * (1 + vatPct / 100));
      return {
        description: item.description || "Credit adjustment",
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
        discountPercent: 0,
        vatPercent: vatPct,
        exclTotal,
        inclTotal,
        unitOfMeasure: item.unitOfMeasure || "Sum",
      };
    });

    const displaySubtotal = roundCurrency(Number(creditNote.subtotal) || 0);
    const displayTotal = roundCurrency(Number(creditNote.total) || 0);
    const displayVat = roundCurrency(displayTotal - displaySubtotal);

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
        customerName: creditNote.customerName,
        customerEmail: creditNote.customerEmail,
        customerPhone: creditNote.customerPhone || undefined,
        address: creditNote.address || undefined,
      },
      document: {
        documentType: "CREDIT_NOTE",
        documentNumber: creditNote.creditNoteNumber,
        reference: invoice.invoiceNumber,
        date: creditNote.createdAt,
        status: creditNote.status,
        orderNumber: invoice.order?.orderNumber || undefined,
        projectName: invoice.project?.name || invoice.project?.projectNumber || undefined,
        paymentTerms: pdfSettings.paymentTerms || undefined,
      },
      items: lineItems,
      totals: {
        subtotal: displaySubtotal,
        vat: displayVat,
        total: displayTotal,
      },
      notes: [
        `Reason: ${creditNote.reason}`,
        creditNote.disputeReason ? `Dispute reference: ${creditNote.disputeReason}` : undefined,
        creditNote.notes || undefined,
      ].filter(Boolean).join("\n"),
      paymentTerms: pdfSettings.paymentTerms || undefined,
      logoBuffer,
    };

    const pdfBuffer = await generatePdfFromData(data);
    return { pdf: pdfBuffer.toString("base64") };
  });
