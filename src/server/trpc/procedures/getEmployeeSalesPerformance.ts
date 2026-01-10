import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

export const getEmployeeSalesPerformance = baseProcedure
  .input(
    z.object({
      token: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    // Authenticate and require admin access
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    const startDate = input.startDate ? new Date(input.startDate) : new Date(new Date().setMonth(new Date().getMonth() - 3));
    const endDate = input.endDate ? new Date(input.endDate) : new Date();

    // Get all leads in the period with creator information
    const leads = await db.lead.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group leads by employee
    const employeeLeadsMap = new Map<number, typeof leads>();
    leads.forEach((lead) => {
      const employeeId = lead.createdById;
      if (!employeeLeadsMap.has(employeeId)) {
        employeeLeadsMap.set(employeeId, []);
      }
      employeeLeadsMap.get(employeeId)!.push(lead);
    });

    // Calculate metrics for each employee
    const employeePerformance = Array.from(employeeLeadsMap.entries()).map(([employeeId, employeeLeads]) => {
      const employee = employeeLeads[0].createdBy;
      
      // Basic counts
      const totalLeads = employeeLeads.length;
      const wonLeads = employeeLeads.filter(l => l.status === "WON");
      const lostLeads = employeeLeads.filter(l => l.status === "LOST");
      const contactedLeads = employeeLeads.filter(l => 
        ["CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"].includes(l.status)
      );
      const activeLeads = employeeLeads.filter(l => 
        !["WON", "LOST"].includes(l.status)
      );

      // Conversion metrics
      const conversionRate = totalLeads > 0 ? (wonLeads.length / totalLeads) * 100 : 0;
      const winRate = totalLeads > 0 ? (wonLeads.length / totalLeads) * 100 : 0;
      const contactRate = totalLeads > 0 ? (contactedLeads.length / totalLeads) * 100 : 0;

      // Calculate average response time (time from creation to CONTACTED status)
      let totalResponseTimeHours = 0;
      let responseTimeCount = 0;
      
      contactedLeads.forEach((lead) => {
        // Use updatedAt as a proxy for when the status changed
        // In a real system, you'd want a separate status history table
        const createdTime = new Date(lead.createdAt).getTime();
        const contactedTime = new Date(lead.updatedAt).getTime();
        const diffHours = (contactedTime - createdTime) / (1000 * 60 * 60);
        
        // Only count if the lead was contacted (not created as contacted)
        if (diffHours > 0 && lead.status !== "NEW") {
          totalResponseTimeHours += diffHours;
          responseTimeCount++;
        }
      });
      
      const avgResponseTimeHours = responseTimeCount > 0 
        ? totalResponseTimeHours / responseTimeCount 
        : 0;

      // Financial metrics
      const wonLeadsWithValue = wonLeads.filter(l => l.estimatedValue);
      const totalWonValue = wonLeadsWithValue.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);
      const avgDealValue = wonLeadsWithValue.length > 0 ? totalWonValue / wonLeadsWithValue.length : 0;

      const activeLeadsWithValue = activeLeads.filter(l => l.estimatedValue);
      const pipelineValue = activeLeadsWithValue.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);

      // Lead breakdown by status
      const leadsByStatus = {
        NEW: employeeLeads.filter(l => l.status === "NEW").length,
        CONTACTED: employeeLeads.filter(l => l.status === "CONTACTED").length,
        QUALIFIED: employeeLeads.filter(l => l.status === "QUALIFIED").length,
        PROPOSAL_SENT: employeeLeads.filter(l => l.status === "PROPOSAL_SENT").length,
        NEGOTIATION: employeeLeads.filter(l => l.status === "NEGOTIATION").length,
        WON: wonLeads.length,
        LOST: lostLeads.length,
      };

      return {
        employee: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          role: employee.role,
        },
        metrics: {
          totalLeads,
          wonLeads: wonLeads.length,
          lostLeads: lostLeads.length,
          activeLeads: activeLeads.length,
          conversionRate: Math.round(conversionRate * 10) / 10,
          winRate: Math.round(winRate * 10) / 10,
          contactRate: Math.round(contactRate * 10) / 10,
          avgResponseTimeHours: Math.round(avgResponseTimeHours * 10) / 10,
          avgDealValue: Math.round(avgDealValue),
          pipelineValue: Math.round(pipelineValue),
          totalWonValue: Math.round(totalWonValue),
        },
        leadsByStatus,
      };
    });

    // Sort by total leads (most active first)
    employeePerformance.sort((a, b) => b.metrics.totalLeads - a.metrics.totalLeads);

    return employeePerformance;
  });
