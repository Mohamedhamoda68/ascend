import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const BOT_TOKEN: string = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const SUPABASE_URL: string = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY: string = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SendRequest {
  user_id: string;
  title: string;
  body?: string;
  link_url?: string;
}

async function sendTelegramMessage(chatId: string, text: string): Promise<any> {
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  return res.json();
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: SendRequest = await req.json();
    const { user_id, title, body, link_url } = payload;

    if (!user_id || !title) {
      return new Response(
        JSON.stringify({ error: "user_id and title required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("telegram_chat_id, telegram_verified, full_name")
      .eq("id", user_id)
      .maybeSingle();

    if (!profile?.telegram_chat_id || !profile?.telegram_verified) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No telegram linked" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    let message = `<b>${title}</b>`;
    if (body) {
      message += `\n\n${body}`;
    }
    if (link_url) {
      const fullUrl = link_url.startsWith("http")
        ? link_url
        : `https://ascend-platform.com${link_url}`;
      message += `\n\n🔗 <a href="${fullUrl}">اضغط هنا</a>`;
    }

    const result = await sendTelegramMessage(profile.telegram_chat_id, message);

    return new Response(
      JSON.stringify({ success: true, result }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});