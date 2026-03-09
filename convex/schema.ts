import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    username: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_username", ["username"]),
  conversations: defineTable({
    name: v.string(),
    preview: v.string(),
    timeLabel: v.string(),
    avatar: v.string(),
    accent: v.string(),
    isActive: v.boolean(),
    position: v.number(),
    createdByClerkId: v.string(),
  }).index("by_position", ["position"]),
  conversationMembers: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
    joinedAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user", ["userId"])
    .index("by_conversation_user", ["conversationId", "userId"]),
  channelLinks: defineTable({
    name: v.string(),
    color: v.string(),
    locked: v.optional(v.boolean()),
    position: v.number(),
  }).index("by_position", ["position"]),
  messages: defineTable({
    conversationId: v.id("conversations"),
    authorClerkId: v.optional(v.string()),
    author: v.string(),
    body: v.string(),
    timeLabel: v.string(),
    own: v.boolean(),
    position: v.number(),
    createdAt: v.number(),
  })
    .index("by_position", ["position"])
    .index("by_conversation_position", ["conversationId", "position"]),
});
