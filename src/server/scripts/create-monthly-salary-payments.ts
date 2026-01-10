import { db } from "~/server/db";
import { notifyAdminsPaymentRequest } from "~/server/utils/notifications";

export async function createMonthlySalaryPayments() {
  console.log("Checking for monthly salary payments due today...");
  
  try {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Get the last day of the current month
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Find employees with monthly salaries due today
    // Also include employees whose payment day is greater than the last day of this month
    // (e.g., payment day 31 in February should be paid on the 28th/29th)
    const isLastDayOfMonth = currentDay === lastDayOfMonth;
    
    const employeesDueForPayment = await db.user.findMany({
      where: {
        monthlySalary: {
          not: null,
        },
        monthlyPaymentDay: {
          not: null,
        },
        OR: isLastDayOfMonth
          ? [
              // On the last day of the month, include both:
              // 1. Employees whose payment day is today
              { monthlyPaymentDay: currentDay },
              // 2. Employees whose payment day is greater than the last day
              //    (e.g., day 31 in a month with only 30 days)
              {
                monthlyPaymentDay: {
                  gt: lastDayOfMonth,
                },
              },
            ]
          : [
              // On any other day, only include employees whose payment day is today
              { monthlyPaymentDay: currentDay },
            ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        monthlySalary: true,
        monthlyPaymentDay: true,
      },
    });
    
    console.log(`Found ${employeesDueForPayment.length} employees due for monthly salary payment`);
    
    // Get the start and end of the current month for checking existing payments
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    
    for (const employee of employeesDueForPayment) {
      try {
        // Check if a payment request already exists for this employee this month
        const existingPayment = await db.paymentRequest.findFirst({
          where: {
            artisanId: employee.id,
            createdAt: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
            notes: {
              contains: "Automated monthly salary payment",
            },
          },
        });
        
        if (existingPayment) {
          console.log(
            `✓ Payment already exists for ${employee.firstName} ${employee.lastName} (${employee.email}) for this month`
          );
          continue;
        }
        
        // Generate unique request number
        const count = await db.paymentRequest.count();
        const requestNumber = `PAY-${String(count + 1).padStart(5, "0")}`;
        
        // Create the payment request
        const paymentRequest = await db.paymentRequest.create({
          data: {
            requestNumber,
            artisanId: employee.id,
            orderIds: [],
            calculatedAmount: employee.monthlySalary!,
            notes: `Automated monthly salary payment for ${new Date(currentYear, currentMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}. Scheduled payment day: ${employee.monthlyPaymentDay}`,
            status: "PENDING",
          },
        });
        
        // Send notification to admins about the new payment request
        await notifyAdminsPaymentRequest({
          artisanName: `${employee.firstName} ${employee.lastName}`,
          amount: paymentRequest.calculatedAmount,
          paymentRequestId: paymentRequest.id,
        });
        
        console.log(
          `✓ Created monthly salary payment request ${requestNumber} for ${employee.firstName} ${employee.lastName} (${employee.email}) - R${employee.monthlySalary}`
        );
      } catch (error) {
        console.error(
          `Failed to create payment request for employee #${employee.id} (${employee.email}):`,
          error
        );
        // Continue with other employees even if one fails
      }
    }
    
    console.log("✓ Monthly salary payment check completed successfully");
  } catch (error) {
    console.error("Monthly salary payment check failed:", error);
    throw error;
  }
}

// Run the check if this script is executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  createMonthlySalaryPayments()
    .then(() => {
      console.log("create-monthly-salary-payments.ts complete");
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
