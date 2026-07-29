import type { Ctx } from "../bot.js";
import { read, write } from "./store.js";
import { now } from "./time.js";

const STAFF_INDEX = "staff:index";
const INVITE_INDEX = "invites:index";

export function adminChatId(): number | undefined {
  const value = typeof process === "undefined" ? undefined : process.env.ADMIN_CHAT_ID;
  if (!value || !/^-?\d+$/.test(value)) return undefined;
  return Number(value);
}

export async function isAdmin(ctx: Ctx): Promise<boolean> {
  const adminChat = adminChatId();
  if (!adminChat || !ctx.from) return false;
  try {
    const member = await ctx.api.getChatMember(adminChat, ctx.from.id);
    return member.status === "creator" || member.status === "administrator";
  } catch {
    return false;
  }
}

export async function isAuthorized(ctx: Ctx): Promise<boolean> {
  // This workspace is public. Staff membership still governs owner controls,
  // but every Telegram user may create a clearly labelled demonstration card.
  return Boolean(ctx.from);
}

export async function requireAuthorized(ctx: Ctx): Promise<boolean> {
  if (await isAuthorized(ctx)) return true;
  await ctx.reply("Open this bot in a private chat to create an ID-style image.");
  return false;
}

export async function createInvite(ctx: Ctx): Promise<string> {
  const actor = ctx.from?.id ?? 0;
  const code = `${actor.toString(36)}${now().getTime().toString(36)}`.slice(-20);
  const index = (await read<string[]>(INVITE_INDEX)) ?? [];
  if (!index.includes(code)) {
    index.push(code);
    await write(INVITE_INDEX, index);
  }
  await write(`invite:${code}`, { createdAt: now().getTime(), expiresAt: now().getTime() + 7 * 86400000 });
  return code;
}

export async function acceptInvite(ctx: Ctx, code: string): Promise<boolean> {
  if (!ctx.from || !/^[a-z0-9]{3,20}$/.test(code)) return false;
  const invite = await read<{ expiresAt: number }>(`invite:${code}`);
  if (!invite || invite.expiresAt < now().getTime()) return false;
  const staff = (await read<number[]>(STAFF_INDEX)) ?? [];
  if (!staff.includes(ctx.from.id)) {
    staff.push(ctx.from.id);
    await write(STAFF_INDEX, staff);
  }
  return true;
}

export async function staffIds(): Promise<number[]> {
  return (await read<number[]>(STAFF_INDEX)) ?? [];
}

export async function revokeStaff(id: number): Promise<void> {
  const staff = (await read<number[]>(STAFF_INDEX)) ?? [];
  await write(STAFF_INDEX, staff.filter((staffId) => staffId !== id));
}
