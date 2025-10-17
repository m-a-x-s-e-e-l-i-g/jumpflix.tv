import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID } from "$env/static/private";
import { fail, type Actions } from "@sveltejs/kit";

const BOT_TOKEN = TELEGRAM_BOT_TOKEN?.trim();
const CHANNEL_ID = TELEGRAM_CHANNEL_ID?.trim();

export const actions: Actions = {
  submitFilm: async ({ request }) => {
    const formData = await request.formData();
    const rawSubmission = formData.get("submission");
    const submission = typeof rawSubmission === "string" ? rawSubmission.trim() : "";

    if (!submission) {
      return fail(400, { message: "Please enter a title or link." });
    }

    if (!BOT_TOKEN || !CHANNEL_ID) {
      console.error("Telegram configuration missing. Ensure TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID are set.");
      return fail(500, { message: "Submissions are temporarily unavailable." });
    }

    const payload = {
      chat_id: CHANNEL_ID,
      text: `${submission}`,
      disable_web_page_preview: true,
    };

    try {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Telegram API error", response.status, errorText);
        return fail(502, { message: "Unable to send submission right now. Please try again shortly." });
      }
    } catch (error) {
      console.error("Telegram submission error", error);
      return fail(502, { message: "Unable to send submission right now. Please try again shortly." });
    }

    return { success: true };
  },
};
