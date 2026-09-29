import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const BOT_TOKEN: string = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const SUPABASE_URL: string = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY: string = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
    from: {
      first_name?: string;
      username?: string;
    };
  };
}

async function sendMessage(chatId: number | string, text: string): Promise<void> {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
}

async function handleStart(chatId: number, from: any, code: string | null): Promise<void> {
  if (!code) {
    const name = from.first_name || "صديقنا";
    await sendMessage(
      chatId,
      `👋 <b>أهلًا ${name}!</b>\n\n` +
      `أنا بوت منصة <b>ASCEND</b> 🎓\n\n` +
      `<b>اللي أقدر أساعدك فيه:</b>\n` +
      `✅ التحقق من حسابك\n` +
      `📢 إشعارات الدروس والاختبارات\n` +
      `📊 تقارير لولي الأمر\n\n` +
      `<i>لو عندك كود تحقق، افتح الرابط من الموقع مباشرة.</i>`
    );
    return;
  }

  const { data: link } = await supabase
    .from("telegram_links")
    .select("*")
    .eq("code", code)
    .eq("used", false)
    .maybeSingle();

  if (!link) {
    await sendMessage(chatId, `❌ <b>كود غير صحيح</b>\n\nتأكد إن الكود صح أو اعمله من جديد من الموقع.`);
    return;
  }

  if (new Date(link.expires_at) < new Date()) {
    await sendMessage(chatId, `⏰ <b>الكود انتهت صلاحيته</b>\n\nارجع للموقع واطلب كود جديد.`);
    return;
  }

  await supabase
    .from("profiles")
    .update({
      telegram_chat_id: String(chatId),
      telegram_username: from.username || null,
      telegram_verified: true,
      phone_verified: true,
    })
    .eq("id", link.user_id);

  await supabase
    .from("telegram_links")
    .update({ used: true })
    .eq("id", link.id);

  await sendMessage(
    chatId,
    `🎉 <b>تم التحقق بنجاح!</b>\n\n` +
    `حسابك على منصة ASCEND اتربط بنجاح ✅\n\n` +
    `<b>هتستقبل هنا:</b>\n` +
    `📹 إشعار عند إضافة فيديو جديد\n` +
    `📝 تذكير بالاختبارات\n` +
    `🎓 إشعار بالشهادات\n` +
    `📊 تقارير دورية`
  );
}

async function handleMessage(chatId: number, text: string): Promise<void> {
  const lower = text.toLowerCase().trim();

  if (lower === "/help" || lower === "مساعدة") {
    await sendMessage(
      chatId,
      `📖 <b>الأوامر المتاحة:</b>\n\n` +
      `/start - بداية المحادثة\n` +
      `/help - المساعدة\n` +
      `/status - حالة حسابك\n` +
      `/unsubscribe - إيقاف الإشعارات`
    );
    return;
  }

  if (lower === "/status" || lower === "حالتي") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, telegram_verified, role")
      .eq("telegram_chat_id", String(chatId))
      .maybeSingle();

    if (!profile) {
      await sendMessage(chatId, `❌ حسابك مش مربوط. ارجع للموقع وأكمل التحقق.`);
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
      `✅ التحقق: <b>${profile.telegram_verified ? "مكتمل" : "ناقص"}</b>`
    );
    return;
  }

  if (lower === "/unsubscribe" || lower === "إيقاف") {
    await supabase
      .from("profiles")
      .update({ telegram_verified: false })
      .eq("telegram_chat_id", String(chatId));

    await sendMessage(chatId, `🔕 <b>تم إيقاف الإشعارات</b>\n\nمش هتستقبل رسائل تانية.`);
    return;
  }

  await sendMessage(chatId, `🤔 مش فاهم قصدك.\n\nجرب /help عشان تشوف الأوامر المتاحة.`);
}

serve(async (req: Request): Promise<Response> => {
  try {
    const update: TelegramUpdate = await req.json();

    if (!update.message) {
      return new Response("OK", { status: 200 });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text || "";
    const from = update.message.from;

    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      const code = parts.length > 1 ? parts[1].trim() : null;
      await handleStart(chatId, from, code);
      return new Response("OK", { status: 200 });
    }

    await handleMessage(chatId, text);
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Error", { status: 500 });
  }
});