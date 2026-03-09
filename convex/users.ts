import { v } from "convex/values";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";

export const upsertFromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    username: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await upsertUser(ctx, args);
  },
});

export const ensureCurrentUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    username: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await upsertUser(ctx, args);
  },
});

export const deleteByClerkId = internalMutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (query) => query.eq("clerkId", args.clerkId))
      .unique();

    if (!existingUser) {
      return null;
    }

    await ctx.db.delete(existingUser._id);
    return existingUser._id;
  },
});

async function upsertUser(
  ctx: MutationCtx,
  args: {
    clerkId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    imageUrl?: string;
  },
) {
  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (query) => query.eq("clerkId", args.clerkId))
    .unique();

  if (existingUser) {
    await ctx.db.patch(existingUser._id, {
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      username: args.username,
      imageUrl: args.imageUrl,
    });
    return existingUser._id;
  }

  return await ctx.db.insert("users", args);
}
