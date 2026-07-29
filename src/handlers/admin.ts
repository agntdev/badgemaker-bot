import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { createInvite, isAdmin, revokeStaff, staffIds } from "../lib/access.js";
import { read, remove, write } from "../lib/store.js";
import { dateLabel, now } from "../lib/time.js";

registerMainMenuItem({ label: "Manage workspace", data: "admin:open", order: 30 });
const composer = new Composer<Ctx>();
const state = (ctx: Ctx): Record<string, unknown> => ctx.session as Record<string, unknown>;

async function guard(ctx: Ctx): Promise<boolean> {
  if (await isAdmin(ctx)) return true;
  await ctx.reply("Only an administrator can manage this workspace.");
  return false;
}

function adminMenu() {
  return inlineKeyboard([
    [inlineButton("Invite staff", "admin:invite"), inlineButton("Manage staff", "admin:staff")],
    [inlineButton("Manage layouts", "admin:templates"), inlineButton("Set retention", "admin:retention")],
    [inlineButton("View submissions", "admin:logs")],
  ]);
}

composer.callbackQuery("admin:open", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await guard(ctx))) return;
  await ctx.reply("Manage staff, layouts, retention, and submissions.", { reply_markup: adminMenu() });
});

composer.callbackQuery("admin:invite", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await guard(ctx))) return;
  const code = await createInvite(ctx);
  const username = ctx.me.username;
  const link = username ? `https://t.me/${username}?start=join_${code}` : undefined;
  await ctx.reply(link ? `Share this staff invite. It expires in 7 days:\n${link}` : `Share this join code. It expires in 7 days:\n${code}`);
});

composer.callbackQuery("admin:staff", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await guard(ctx))) return;
  const staff = await staffIds();
  if (!staff.length) { await ctx.reply("No invited staff yet — create an invite to add someone."); return; }
  await ctx.reply("Choose a staff member to remove.", { reply_markup: inlineKeyboard(staff.slice(0, 20).map((_, i) => [inlineButton(`Remove staff member ${i + 1}`, `admin:remove:${i}`)])) });
});

composer.callbackQuery(/^admin:remove:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await guard(ctx))) return;
  const staff = await staffIds();
  const id = staff[Number(ctx.match[1])];
  if (id === undefined) { await ctx.reply("That staff member is no longer on the list."); return; }
  await revokeStaff(id);
  await ctx.reply("Staff access was removed.");
});

composer.callbackQuery("admin:templates", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await guard(ctx))) return;
  const names = (await read<string[]>("templates:index")) ?? ["simple", "corporate", "badge"];
  await write("templates:index", names);
  await ctx.reply("Choose a layout to remove, or add a new layout.", { reply_markup: inlineKeyboard([
    ...names.map((name, i) => [inlineButton(`Remove ${name}`, `admin:template:remove:${i}`)]),
    [inlineButton("Add layout", "admin:template:add")],
  ]) });
});

composer.callbackQuery("admin:template:add", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await guard(ctx))) return;
  state(ctx).adminStep = "template-name";
  await ctx.reply("Enter a short layout name.", { reply_markup: { force_reply: true, input_field_placeholder: "Layout name" } });
});

composer.on("message:text", async (ctx, next) => {
  if (state(ctx).adminStep !== "template-name") return next();
  if (!(await guard(ctx))) return;
  const name = ctx.message.text.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9 -]{1,30}$/.test(name)) { await ctx.reply("Use 2–31 letters, numbers, spaces, or hyphens."); return; }
  const names = (await read<string[]>("templates:index")) ?? ["simple", "corporate", "badge"];
  if (!names.includes(name)) { names.push(name); await write("templates:index", names); await write(`template:${name}`, { template_name: name, background: "standard", photo_placement: "left", text_styles: "professional" }); }
  delete state(ctx).adminStep;
  await ctx.reply("The layout is ready to use.");
});

composer.callbackQuery(/^admin:template:remove:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await guard(ctx))) return;
  const names = (await read<string[]>("templates:index")) ?? ["simple", "corporate", "badge"];
  const position = Number(ctx.match[1]);
  if (names.length <= 1 || !names[position]) { await ctx.reply("Keep at least one layout available."); return; }
  const [name] = names.splice(position, 1);
  await write("templates:index", names);
  await remove(`template:${name}`);
  await ctx.reply("The layout was removed.");
});

composer.callbackQuery("admin:retention", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await guard(ctx))) return;
  await ctx.reply("Choose how long to keep submission records.", { reply_markup: inlineKeyboard([[30, 90, 180, 365].map((days) => inlineButton(`${days} days`, `admin:retention:${days}`))]) });
});

composer.callbackQuery(/^admin:retention:(30|90|180|365)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await guard(ctx))) return;
  await write("settings", { retentionDays: Number(ctx.match[1]) });
  await ctx.reply(`Submission records will be kept for ${ctx.match[1]} days.`);
});

composer.callbackQuery("admin:logs", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await guard(ctx))) return;
  const retention = (await read<{ retentionDays?: number }>("settings"))?.retentionDays ?? 90;
  const ids = (await read<string[]>("submissions:index")) ?? [];
  const cutoff = now().getTime() - retention * 86400000;
  const recent: string[] = [];
  for (const id of ids) {
    const item = await read<{ timestamp: number; full_name: string }>(`submission:${id}`);
    if (item && item.timestamp >= cutoff) recent.push(`${item.full_name} — ${dateLabel(item.timestamp)}`);
  }
  await ctx.reply(recent.length ? `Recent submissions:\n${recent.slice(-20).join("\n")}` : "No submissions yet — create an ID to add the first record.");
});

export default composer;
