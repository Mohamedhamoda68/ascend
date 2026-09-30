// ============================================
// ASCEND · Telegram Webhook
// Handles: /start CODE (verify), /help, /status
// Created by Mohamed Hamouda
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

/* ========== ENV ========== */
const BOT_TOKEN: string = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const SUPABASE_URL: string = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY: string = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

/* ========== TYPES ========== */
interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
    from: {
      first_name?: string;
      username?: string;
      language_code?: string;
    };
  };
}

/* ========== SEND MESSAGE ========== */
async function sendMessage(chatId: number | string, text: string): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
  } catch (err) {
    console.error("Send message failed:", err);
  }
}

/* ========== HANDLE START (with code) ========== */
async function handleStart(chatId: number, from: any, code: string | null): Promise<void> {
  /* No code → welcome */
  if (!code) {
    const name = from.first_name || "صديقنا";
    await sendMessage(
      chatId,
      `👋 <b>أهلاً ${name}!</b>\n\n` +
      `أنا بوت منصة <b>ASCEND</b> 🎓\n\n` +
      `<b>اللي بقدر أساعدك فيه:</b>\n` +
      `✅ تأكيد حسابك\n` +
      `📢 إشعارات الدروس والاختبارات\n` +
      `📊 تقارير لولي الأمر\n\n` +
      `<i>لو عندك كود تأكيد، ادخل على الموقع واضغط "تأكيد الرقم".</i>`
    );
    return;
  }

  /* Find verification code */
  const { data: link, error: linkErr } = await supabase
    .from("telegram_links")
    .select("*")
    .eq("code", code)
    .eq("used", false)
    .maybeSingle();

  if (linkErr || !link) {
    await sendMessage(
      chatId,
      `❌ <b>كود غير صحيح</b>\n\n` +
      `تأكد إن الكود صح أو اعمله من جديد من الموقع.`
    );
    return;
  }

  /* Check expiration */
  if (new Date(link.expires_at) < new Date()) {
    await sendMessage(
      chatId,
      `⏰ <b>الكود انتهت صلاحيته</b>\n\n` +
      `ارجع للموقع واطلب كود جديد.`
    );
    return;
  }

  /* Update profile with telegram info */
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({
      telegram_chat_id: String(chatId),
      telegram_username: from.username || null,
      telegram_verified: true,
      phone_verified: true,
      status: 'active'
    })
    .eq("id", link.user_id);

  if (updateErr) {
    console.error("Update profile failed:", updateErr);
    await sendMessage(chatId, `⚠️ حصلت مشكلة. حاول تاني من الموقع.`);
    return;
  }

  /* Mark link as used */
  await supabase
    .from("telegram_links")
    .update({ used: true })
    .eq("id", link.id);

  /* Send success message */
  await sendMessage(
    chatId,
    `🎉 <b>تم التأكيد بنجاح!</b>\n\n` +
    `حسابك على منصة ASCEND اتفعّل ✅\n\n` +
    `<b>هتستقبل هنا:</b>\n` +
    `📹 إشعار عند إضافة فيديو جديد\n` +
    `📝 تذكير بالاختبارات\n` +
    `🎓 إشعار بالشهادات\n\n` +
    `<i>ارجع للموقع، هتقدر تدخل حسابك على طول.</i>`
  );
}

/* ========== HANDLE REGULAR MESSAGES ========== */
async function handleMessage(chatId: number, text: string): Promise<void> {
  const lower = text.toLowerCase().trim();

  /* /help */
  if (lower === "/help" || lower === "مساعدة" || lower === "help") {
    await sendMessage(
      chatId,
      `📖 <b>الأوامر المتاحة:</b>\n\n` +
      `/start - بداية المحادثة\n` +
      `/help - المساعدة\n` +
      `/status - حالة حسابك\n` +
      `/unsubscribe - إيقاف الإشعارات\n\n` +
      `<i>لأي استفسار، تواصل مع الدعم.</i>`
    );
    return;
  }

  /* /status */
  if (lower === "/status" || lower === "حالتي") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, telegram_verified, role")
      .eq("telegram_chat_id", String(chatId))
      .maybeSingle();

    if (!profile) {
      await sendMessage(chatId, `❌ حسابك مش مربوط. ارجع للموقع وأكمل التأكيد.`);
      return;
    }

    const roleLabel =
      profile.role === "student" ? "طالب" :
      profile.role === "parent" ? "ولي أمر" : "مشرف";

    await sendMessage(
      chatId,
      `📊 <b>حالة حسابك:</b>\n\n` +
      `👤 الاسم: <b>${profile.full_name}</b>\n` +
      `🎭 الدور: <b>${roleLabel}</b>\n` +
      `✅ التأكيد: <b>${profile.telegram_verified ? "مكتمل" : "ناقص"}</b>`
    );
    return;
  }

  /* /unsubscribe */
  if (lower === "/unsubscribe" || lower === "إيقاف") {
    await supabase
      .from("profiles")
      .update({ telegram_verified: false })
      .eq("telegram_chat_id", String(chatId));

    await sendMessage(
      chatId,
      `🔕 <b>تم إيقاف الإشعارات</b>\n\n` +
      `مش هتستقبل رسائل تانية.\n` +
      `لو عايز ترجع، استخدم /start.`
    );
    return;
  }

  /* Default */
  await sendMessage(
    chatId,
    `🤔 مش فاهم قصدك.\n\n` +
    `جرب /help عشان تشوف الأوامر المتاحة.`
  );
}

/* ========== MAIN HANDLER ========== */
serve(async (req: Request): Promise<Response> => {
  try {
    const update: TelegramUpdate = await req.json();

    if (!update.message) {
      return new Response("OK", { status: 200 });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text || "";
    const from = update.message.from;

    /* /start with optional code */
    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      const code = parts.length > 1 ? parts[1].trim() : null;
      await handleStart(chatId, from, code);
      return new Response("OK", { status: 200 });
    }

    /* Other commands */
    await handleMessage(chatId, text);
    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Error", { status: 500 });
  }
});