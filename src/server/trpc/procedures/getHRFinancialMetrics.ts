import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";

export const getHRFinancialMetrics = baseProcedure
  .input(
    z.object({
      token: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    
    // Require permission to view HR financial data
    requirePermission(user, PERMISSIONS.VIEW_ALL_EMPLOYEES);

    const startDate = input.startDate ? new Date(input.startDate) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = input.endDate ? new Date(input.endDate) : new Date();

    // Get all employees with their roles
    const employees = await db.user.findMany({
      select: {
        id: true,
        role: true,
        monthlySalary: true,
        hourlyRate: true,
        dailyRate: true,
        createdAt: true,
      },
    });

    // Get all payslips within date range
    const payslips = await db.payslip.findMany({
      where: {
        paymentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            role: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        paymentDate: 'asc',
      },
    });

    // Get all payment requests within date range that are paid
    const paymentRequests = await db.paymentRequest.findMany({
      where: {
        status: "PAID",
        paidDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        artisan: {
          select: {
            id: true,
            role: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        paidDate: 'asc',
      },
    });

    // Get completed orders for labour costs
    const orders = await db.order.findMany({
      where: {
        status: "COMPLETED",
        endTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    });

    // Get completed milestones for project costs
    const milestones = await db.milestone.findMany({
      where: {
        status: "COMPLETED",
        actualEndDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    });

    // Calculate payroll trends by month
    const payrollByMonth = new Map<string, number>();
    
    payslips.forEach((payslip) => {
      const monthKey = payslip.paymentDate.toISOString().substring(0, 7); // YYYY-MM
      payrollByMonth.set(monthKey, (payrollByMonth.get(monthKey) || 0) + payslip.netPay);
    });

    paymentRequests.forEach((pr) => {
      if (pr.paidDate) {
        const monthKey = pr.paidDate.toISOString().substring(0, 7);
        payrollByMonth.set(monthKey, (payrollByMonth.get(monthKey) || 0) + pr.calculatedAmount);
      }
    });

    const payrollTrends = Array.from(payrollByMonth.entries())
      .map(([month, amount]) => ({
        period: month,
        amount: amount,
        date: new Date(month + "-01"),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate expenses by department (role)
    const expensesByRole = new Map<string, {
      payslips: number;
      paymentRequests: number;
      orderLabour: number;
      orderMaterials: number;
      milestoneLabour: number;
      milestoneMaterials: number;
      total: number;
    }>();

    // Initialize all roles
    employees.forEach((emp) => {
      if (!expensesByRole.has(emp.role)) {
        expensesByRole.set(emp.role, {
          payslips: 0,
          paymentRequests: 0,
          orderLabour: 0,
          orderMaterials: 0,
          milestoneLabour: 0,
          milestoneMaterials: 0,
          total: 0,
        });
      }
    });

    // Aggregate payslips by role
    payslips.forEach((payslip) => {
      const role = payslip.employee.role;
      const roleData = expensesByRole.get(role) || {
        payslips: 0,
        paymentRequests: 0,
        orderLabour: 0,
        orderMaterials: 0,
        milestoneLabour: 0,
        milestoneMaterials: 0,
        total: 0,
      };
      roleData.payslips += payslip.netPay;
      roleData.total += payslip.netPay;
      expensesByRole.set(role, roleData);
    });

    // Aggregate payment requests by role
    paymentRequests.forEach((pr) => {
      const role = pr.artisan.role;
      const roleData = expensesByRole.get(role) || {
        payslips: 0,
        paymentRequests: 0,
        orderLabour: 0,
        orderMaterials: 0,
        milestoneLabour: 0,
        milestoneMaterials: 0,
        total: 0,
      };
      roleData.paymentRequests += pr.calculatedAmount;
      roleData.total += pr.calculatedAmount;
      expensesByRole.set(role, roleData);
    });

    // Aggregate order costs by role
    orders.forEach((order) => {
      if (order.assignedTo) {
        const role = order.assignedTo.role;
        const roleData = expensesByRole.get(role) || {
          payslips: 0,
          paymentRequests: 0,
          orderLabour: 0,
          orderMaterials: 0,
          milestoneLabour: 0,
          milestoneMaterials: 0,
          total: 0,
        };
        roleData.orderLabour += order.labourCost;
        roleData.orderMaterials += order.materialCost;
        roleData.total += order.labourCost + order.materialCost;
        expensesByRole.set(role, roleData);
      }
    });

    // Aggregate milestone costs by role
    milestones.forEach((milestone) => {
      if (milestone.assignedTo) {
        const role = milestone.assignedTo.role;
        const roleData = expensesByRole.get(role) || {
          payslips: 0,
          paymentRequests: 0,
          orderLabour: 0,
          orderMaterials: 0,
          milestoneLabour: 0,
          milestoneMaterials: 0,
          total: 0,
        };
        roleData.milestoneLabour += milestone.labourCost;
        roleData.milestoneMaterials += milestone.materialCost;
        roleData.total += milestone.labourCost + milestone.materialCost;
        expensesByRole.set(role, roleData);
      }
    });

    const departmentExpenses = Array.from(expensesByRole.entries())
      .map(([role, expenses]) => ({
        department: role,
        ...expenses,
      }))
      .filter((dept) => dept.total > 0)
      .sort((a, b) => b.total - a.total);

    // Calculate key HR metrics
    const totalEmployees = employees.length;
    const employeesByRole = new Map<string, number>();
    employees.forEach((emp) => {
      employeesByRole.set(emp.role, (employeesByRole.get(emp.role) || 0) + 1);
    });

    const employeesWithMonthlySalary = employees.filter((e) => e.monthlySalary);
    const averageMonthlySalary = employeesWithMonthlySalary.length > 0
      ? employeesWithMonthlySalary.reduce((sum, e) => sum + (e.monthlySalary || 0), 0) / employeesWithMonthlySalary.length
      : 0;

    const employeesWithHourlyRate = employees.filter((e) => e.hourlyRate);
    const averageHourlyRate = employeesWithHourlyRate.length > 0
      ? employeesWithHourlyRate.reduce((sum, e) => sum + (e.hourlyRate || 0), 0) / employeesWithHourlyRate.length
      : 0;

    const employeesWithDailyRate = employees.filter((e) => e.dailyRate);
    const averageDailyRate = employeesWithDailyRate.length > 0
      ? employeesWithDailyRate.reduce((sum, e) => sum + (e.dailyRate || 0), 0) / employeesWithDailyRate.length
      : 0;

    const totalPayrollPaid = payslips.reduce((sum, p) => sum + p.netPay, 0) +
      paymentRequests.reduce((sum, pr) => sum + pr.calculatedAmount, 0);

    const totalExpenses = departmentExpenses.reduce((sum, dept) => sum + dept.total, 0);

    const totalPayslips = payslips.length;
    const totalPaymentRequests = paymentRequests.filter((pr) => pr.status === "PAID").length;

    return {
      payrollTrends,
      departmentExpenses,
      keyMetrics: {
        totalEmployees,
        employeesByRole: Array.from(employeesByRole.entries()).map(([role, count]) => ({
          role,
          count,
        })),
        averageMonthlySalary,
        averageHourlyRate,
        averageDailyRate,
        totalPayrollPaid,
        totalExpenses,
        totalPayslips,
        totalPaymentRequests,
        employeesWithMonthlySalary: employeesWithMonthlySalary.length,
        employeesWithHourlyRate: employeesWithHourlyRate.length,
        employeesWithDailyRate: employeesWithDailyRate.length,
      },
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };
  });
