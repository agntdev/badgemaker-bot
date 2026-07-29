import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard } from "../toolkit/index.js";
import { acceptInvite, isAuthorized } from "../lib/access.js";

// The /start handler renders the bot's MAIN MENU — the primary way users operate
// a button-first bot. A feature adds its own button by calling
// `registerMainMenuItem(...)` in its own `src/handlers/<slug>.ts`; this handler
// renders whatever is registered (plus a Help button), so you do NOT edit this
// file to add a feature. Send ONE message — no placeholder line above the menu.
const composer = new Composer<Ctx>();

const WELCOME = "Welcome to the private ID workspace. Choose an action below.";

composer.command("start", async (ctx) => {
  const payload = ctx.message?.text.split(/\s+/, 2)[1];
  if (payload?.startsWith("join_") && await acceptInvite(ctx, payload.slice(5))) {
    await ctx.reply("Your staff access is active. Choose an action below.", { reply_markup: mainMenuKeyboard() });
    return;
  }
  if (!(await isAuthorized(ctx))) {
    await ctx.reply("You don't have access to this ID workspace. Ask an administrator for an invite.");
    return;
  }
  await ctx.reply(WELCOME, { reply_markup: mainMenuKeyboard() });
});

// "Back to menu" — re-render the main menu in place from any sub-view.
composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await isAuthorized(ctx))) {
    await ctx.reply("You don't have access to this ID workspace. Ask an administrator for an invite.");
    return;
  }
  await ctx.editMessageText(WELCOME, { reply_markup: mainMenuKeyboard() });
});

export default composer;
