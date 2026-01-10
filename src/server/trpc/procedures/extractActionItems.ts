import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

export const extractActionItems = baseProcedure
  .input(
    z.object({
      token: z.string(),
      text: z.string().min(10, "Text must be at least 10 characters"),
      context: z.object({
        projectName: z.string().optional(),
        meetingDate: z.string().optional(),
        attendees: z.array(z.string()).optional(),
      }).optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    try {
      // Set up AI model
      const model = google("gemini-2.0-flash-exp");

      // Build context information
      let contextInfo = "";
      if (input.context) {
        if (input.context.projectName) {
          contextInfo += `\nProject: ${input.context.projectName}`;
        }
        if (input.context.meetingDate) {
          contextInfo += `\nMeeting Date: ${input.context.meetingDate}`;
        }
        if (input.context.attendees && input.context.attendees.length > 0) {
          contextInfo += `\nAttendees: ${input.context.attendees.join(", ")}`;
        }
      }

      // Extract action items
      const { object } = await generateObject({
        model,
        output: "array",
        schema: z.object({
          action: z.string().describe("Clear, actionable description of the task (start with a verb)"),
          priority: z.enum(["HIGH", "MEDIUM", "LOW"]).describe("Priority level based on urgency and importance"),
          suggestedOwner: z.string().optional().describe("Suggested person to own this action (if mentioned in text)"),
          suggestedDeadline: z.string().optional().describe("Suggested deadline or timeframe (e.g., 'This week', 'By Friday', 'End of month')"),
          category: z.enum([
            "FOLLOW_UP",
            "DECISION_NEEDED",
            "DOCUMENTATION",
            "COMMUNICATION",
            "TECHNICAL_WORK",
            "REVIEW",
            "OTHER"
          ]).describe("Category of the action item"),
          context: z.string().optional().describe("Additional context or notes about this action"),
        }),
        prompt: `You are an expert project manager and meeting facilitator. Extract actionable tasks and follow-up items from the following text.

Text to analyze:
${input.text}
${contextInfo}

Guidelines for extracting action items:

1. Action Description:
   - Start with an action verb (e.g., "Review", "Send", "Schedule", "Follow up")
   - Be specific and clear
   - Include enough context to be standalone
   - Example: "Send quotation for electrical work to John by Friday"

2. Priority:
   - HIGH: Urgent, time-sensitive, blocking other work, or critical to project success
   - MEDIUM: Important but not urgent, standard timeline
   - LOW: Nice to have, can be deferred, or informational

3. Suggested Owner:
   - Only specify if clearly mentioned or implied in the text
   - Use the person's name as mentioned
   - Leave empty if not clear

4. Suggested Deadline:
   - Extract explicit deadlines mentioned
   - Infer reasonable timeframes from context (e.g., "ASAP" = "This week")
   - Use relative terms: "This week", "Next Monday", "End of month", "Q1 2024"
   - Leave empty if no deadline is mentioned or implied

5. Category:
   - FOLLOW_UP: Following up with clients, vendors, or team members
   - DECISION_NEEDED: Requires a decision from stakeholders
   - DOCUMENTATION: Creating, updating, or reviewing documents
   - COMMUNICATION: Sending emails, making calls, scheduling meetings
   - TECHNICAL_WORK: Actual work tasks (coding, design, construction, etc.)
   - REVIEW: Reviewing proposals, documents, work, or deliverables
   - OTHER: Anything that doesn't fit above categories

6. Context:
   - Add relevant background information
   - Include dependencies or prerequisites
   - Note any constraints or special considerations

What to extract:
- Explicit action items ("John will...", "Need to...", "Action: ...")
- Implicit tasks (problems mentioned that need solving)
- Follow-ups (questions raised, information needed)
- Decisions that need to be made
- Items marked for review or approval

What NOT to extract:
- Completed actions (past tense)
- General discussion points without actions
- Background information or context
- Decisions already made

Extract 3-10 action items depending on the content. Focus on quality over quantity - only extract genuine, actionable tasks.`,
      });

      return {
        actionItems: object as any[],
        totalItems: (object as any[]).length,
        extractedAt: new Date().toISOString(),
        extractedBy: `${user.firstName} ${user.lastName}`,
      };
    } catch (error: any) {
      console.error("Error extracting action items:", error);
      
      const errorMessage = error.message || error.toString();
      
      if (errorMessage.includes("Payment Required") || 
          errorMessage.includes("402") || 
          errorMessage.includes("insufficient credits") ||
          errorMessage.includes("insufficient_quota") ||
          errorMessage.includes("billing") ||
          errorMessage.includes("Invalid API key") ||
          errorMessage.includes("Incorrect API key") ||
          errorMessage.includes("401")) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI action item extraction is currently unavailable. Please create action items manually.",
        });
      }
      
      if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "AI service rate limit exceeded. Please try again in a few moments.",
        });
      }
      
      if (error instanceof TRPCError) throw error;
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to extract action items. Please create manually.",
      });
    }
  });
