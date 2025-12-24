import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { z } from "zod";

const preferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
});

// Note: Preferences are currently stored client-side
// TODO: Add a preferences field to User model or create a UserSettings model
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("status" in authResult) {
      return errorResponse(authResult.error, authResult.status);
    }

    const body = await request.json();
    const validated = preferencesSchema.parse(body);

    // For now, just return the validated preferences
    // In production, these would be stored in a preferences field or settings table
    return successResponse({
      preferences: {
        emailNotifications: validated.emailNotifications ?? true,
        pushNotifications: validated.pushNotifications ?? true,
        smsNotifications: validated.smsNotifications ?? false,
        marketingEmails: validated.marketingEmails ?? false,
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    console.error("Update preferences error:", error);
    return errorResponse("Failed to update preferences", 500);
  }
}
