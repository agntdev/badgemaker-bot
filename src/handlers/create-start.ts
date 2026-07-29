import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem } from "../toolkit/index.js";
import { requireAuthorized } from "../lib/access.js";

registerMainMenuItem({ label: "Create ID", data: "create:start", order: 10 });

const composer = new Composer<Ctx>();

async function begin(ctx: Ctx): Promise<void> {
  if (!(await requireAuthorized(ctx))) return;
  const flow = ctx.session as Record<string, unknown>;
  flow.idStep = "photo";
  flow.idDraft = { fields: [] };
  await ctx.reply("Send the photo you want on the ID card.", {
    reply_markup: { force_reply: true, input_field_placeholder: "Upload a clear portrait photo" },
  });
}

composer.callbackQuery("create:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  await begin(ctx);
});

export { begin };
export default composer;
