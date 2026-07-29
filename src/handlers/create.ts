import { Composer, InputFile } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { requireAuthorized, adminChatId } from "../lib/access.js";
import { read, remove, write } from "../lib/store.js";
import { now } from "../lib/time.js";
import { begin } from "./create-start.js";

type TemplateName = string;
interface Draft { photo?: string; fullName?: string; fields: string[]; template?: TemplateName; }
interface Submission { id: string; uploader_id: number; timestamp: number; photo: string; full_name: string; additional_fields: string[]; template_used: TemplateName; image_file_ref: string; }

const composer = new Composer<Ctx>();
const flow = (ctx: Ctx): Record<string, unknown> => ctx.session as Record<string, unknown>;
const draft = (ctx: Ctx): Draft => (flow(ctx).idDraft as Draft | undefined) ?? { fields: [] };

async function chooseTemplate(ctx: Ctx): Promise<void> {
  flow(ctx).idStep = "template";
  const templates = (await read<string[]>("templates:index")) ?? ["simple", "corporate", "badge"];
  await write("templates:index", templates);
  await ctx.reply("Choose the ID layout.", { reply_markup: inlineKeyboard([
    ...templates.slice(0, 20).map((template, index) => [inlineButton(template, `create:template:${index}`)]),
  ]) });
}

function clean(value: string): string { return value.trim().replace(/\s+/g, " "); }

function summary(item: Draft): string {
  return ["Review this ID card:", `Name: ${item.fullName}`, `Layout: ${item.template}`, ...item.fields.map((field) => `Field: ${field}`)].join("\n");
}

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function base64(bytes: Uint8Array): string {
  let text = "";
  for (let index = 0; index < bytes.length; index += 8192) text += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return btoa(text);
}

async function idCard(ctx: Ctx, item: Draft): Promise<InputFile> {
  const token = typeof process !== "undefined" ? process.env.BOT_TOKEN : (ctx as Ctx & { env?: { BOT_TOKEN?: string } }).env?.BOT_TOKEN;
  if (!token || !item.photo) throw new Error("photo rendering is unavailable");
  const file = await ctx.api.getFile(item.photo);
  if (!file.file_path) throw new Error("photo file is unavailable");
  const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
  if (!response.ok) throw new Error("photo download failed");
  const photo = base64(new Uint8Array(await response.arrayBuffer()));
  const lines = [item.fullName ?? "", ...item.fields].slice(0, 7)
    .map((line, index) => `<text x="330" y="${150 + index * 55}" font-family="Arial, sans-serif" font-size="${index === 0 ? 32 : 22}" fill="#172033">${xml(line)}</text>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560"><rect width="900" height="560" fill="#f5f7fb"/><rect width="900" height="72" fill="#172033"/><text x="42" y="47" font-family="Arial, sans-serif" font-size="28" fill="#ffffff">${xml(item.template ?? "ID card")}</text><rect x="42" y="112" width="240" height="320" fill="#d9e1ef"/><image x="42" y="112" width="240" height="320" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${photo}"/>${lines}</svg>`;
  return new InputFile(new TextEncoder().encode(svg), "id-card.svg");
}

composer.command("create", async (ctx) => { await begin(ctx); });

composer.command("cancel", async (ctx) => {
  const state = flow(ctx);
  delete state.idStep;
  delete state.idDraft;
  await ctx.reply("ID creation was cancelled. You can start again from the menu.");
});

composer.on("message:photo", async (ctx, next) => {
  if (flow(ctx).idStep !== "photo") return next();
  if (!(await requireAuthorized(ctx))) return;
  const photos = ctx.message.photo;
  const item: Draft = { fields: [] };
  item.photo = photos[photos.length - 1].file_id;
  flow(ctx).idDraft = item;
  flow(ctx).idStep = "name";
  await ctx.reply("Enter the full name exactly as it should appear.", { reply_markup: { force_reply: true, input_field_placeholder: "Full name" } });
});

composer.on("message:document", async (ctx, next) => {
  if (flow(ctx).idStep !== "photo") return next();
  await ctx.reply("That file isn't a photo. Send the image as a Telegram photo.");
});

composer.on("message:text", async (ctx, next) => {
  const state = flow(ctx);
  const step = state.idStep;
  if (step !== "name" && step !== "field") return next();
  if (!(await requireAuthorized(ctx))) return;
  const value = clean(ctx.message.text);
  if (step === "name") {
    if (value.length < 2 || value.length > 120) {
      await ctx.reply("Enter a full name between 2 and 120 characters.");
      return;
    }
    const item = draft(ctx);
    item.fullName = value;
    state.idDraft = item;
    state.idStep = "fields";
    await ctx.reply("Add an optional field, or continue without one.", { reply_markup: inlineKeyboard([
      [inlineButton("Add field", "create:field:add"), inlineButton("Choose layout", "create:fields:done")],
    ]) });
    return;
  }
  const item = draft(ctx);
  if (!value.includes(":") || value.length > 160) {
    await ctx.reply("Use a short label and value, for example: Department: Operations.");
    return;
  }
  if (item.fields.length >= 6) {
    await ctx.reply("You can add up to six optional fields. Choose the layout to continue.");
    state.idStep = "fields";
    return;
  }
  item.fields.push(value);
  state.idDraft = item;
  state.idStep = "fields";
  await ctx.reply(`Field ${item.fields.length} added. Add another field or choose the layout.`, { reply_markup: inlineKeyboard([
    [inlineButton("Add field", "create:field:add"), inlineButton("Choose layout", "create:fields:done")],
  ]) });
});

composer.callbackQuery("create:field:add", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await requireAuthorized(ctx))) return;
  if (draft(ctx).fields.length >= 6) { await ctx.reply("You can add up to six optional fields. Choose the layout to continue."); return; }
  flow(ctx).idStep = "field";
  await ctx.reply("Enter one field as Label: value.", { reply_markup: { force_reply: true, input_field_placeholder: "Department: Operations" } });
});

composer.callbackQuery("create:fields:done", async (ctx) => { await ctx.answerCallbackQuery(); if (await requireAuthorized(ctx)) await chooseTemplate(ctx); });

composer.callbackQuery(/^create:template:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await requireAuthorized(ctx))) return;
  const templates = (await read<string[]>("templates:index")) ?? ["simple", "corporate", "badge"];
  const template = templates[Number(ctx.match[1])];
  if (!template) { await ctx.reply("That layout is no longer available. Choose a layout again."); return; }
  const item = draft(ctx);
  item.template = template;
  flow(ctx).idDraft = item;
  flow(ctx).idStep = "confirm";
  await ctx.reply(summary(item), { reply_markup: inlineKeyboard([[inlineButton("Submit ID", "create:confirm:yes"), inlineButton("Cancel", "create:confirm:no")]]) });
});

composer.callbackQuery("create:confirm:no", async (ctx) => {
  await ctx.answerCallbackQuery();
  delete flow(ctx).idStep;
  delete flow(ctx).idDraft;
  await ctx.reply("ID creation was cancelled. You can start again from the menu.");
});

composer.callbackQuery("create:confirm:yes", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await requireAuthorized(ctx))) return;
  const item = draft(ctx);
  if (!ctx.from || !item.photo || !item.fullName || !item.template) { await ctx.reply("Your draft is incomplete. Start a new ID from the menu."); return; }
  const timestamp = now().getTime();
  const id = `${ctx.from.id}-${timestamp}`;
  let generated;
  try {
    generated = await ctx.replyWithDocument(await idCard(ctx, item), { caption: summary(item) });
  } catch {
    await ctx.reply("Couldn't create the ID image right now. Check the photo and try again.");
    return;
  }
  const imageFileRef = generated.document?.file_id;
  if (!imageFileRef) { await ctx.reply("Couldn't save the ID image. Try again."); return; }
  const submission: Submission = { id, uploader_id: ctx.from.id, timestamp, photo: item.photo, full_name: item.fullName, additional_fields: item.fields, template_used: item.template, image_file_ref: imageFileRef };
  await write(`submission:${id}`, submission);
  const index = (await read<string[]>("submissions:index")) ?? [];
  const retention = (await read<{ retentionDays?: number }>("settings"))?.retentionDays ?? 90;
  const cutoff = timestamp - retention * 86400000;
  const retained: string[] = [];
  for (const existingId of index) {
    const existing = await read<Submission>(`submission:${existingId}`);
    if (!existing || existing.timestamp < cutoff) await remove(`submission:${existingId}`);
    else retained.push(existingId);
  }
  retained.push(id);
  await write("submissions:index", retained);
  const admin = adminChatId();
  if (admin) {
    try { await ctx.api.sendDocument(admin, imageFileRef, { caption: `New ID submission\n${summary(item)}` }); } catch { /* A blocked or misconfigured admin chat must not lose the user submission. */ }
  }
  delete flow(ctx).idStep;
  delete flow(ctx).idDraft;
  await ctx.reply(admin ? "Your ID image is ready and has been sent for review." : "Your ID image is ready. Admin delivery isn't set up yet.");
});

export default composer;
