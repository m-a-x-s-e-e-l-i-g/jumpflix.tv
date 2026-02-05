import { fail, type Actions } from "@sveltejs/kit";
import { sendTelegramMessage } from "$lib/server/telegram";

export const actions: Actions = {
  submitFilm: async ({ request }) => {
    const formData = await request.formData();
    const rawSubmission = formData.get("submission");
    const submission = typeof rawSubmission === "string" ? rawSubmission.trim() : "";

    if (!submission) {
      return fail(400, { message: "Please enter a title or link." });
    }

    try {
      await sendTelegramMessage(`${submission}`, { disableWebPagePreview: true });
    } catch (error) {
      console.error("Telegram submission error", error);
      const message = String(error ?? "").includes("Telegram configuration missing")
        ? "Submissions are temporarily unavailable."
        : "Unable to send submission right now. Please try again shortly.";
      return fail(502, { message });
    }

    return { success: true };
  },
};
