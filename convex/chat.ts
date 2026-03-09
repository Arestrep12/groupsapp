import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

type ReaderCtx = QueryCtx | MutationCtx;

const groupAccents = ["#eec861", "#b9dce3", "#d7c8f0", "#b8d7cb"] as const;

const seedUsers = [
  {
    clerkId: "seed-jon",
    firstName: "Jon",
    lastName: "Adams",
    username: "jonadams",
    imageUrl: undefined,
  },
  {
    clerkId: "seed-ada",
    firstName: "Ada",
    lastName: "Bot",
    username: "adabot",
    imageUrl: undefined,
  },
] as const;

const seedGroups = [
  {
    name: "General",
    preview: "Arranquemos con el chat real sobre Convex.",
    memberClerkIds: ["seed-jon", "seed-ada"],
    messages: [
      {
        authorClerkId: "seed-jon",
        author: "Jon Adams",
        body: "Bien, ya dejamos el prototipo conectado a Convex.",
      },
      {
        authorClerkId: "seed-ada",
        author: "Ada Bot",
        body: "El siguiente paso es dejar los grupos administrables por sus propios miembros.",
      },
    ],
  },
  {
    name: "Producto",
    preview: "Define aquí próximos cambios y pruebas.",
    memberClerkIds: ["seed-ada"],
    messages: [
      {
        authorClerkId: "seed-ada",
        author: "Ada Bot",
        body: "Este grupo sirve para probar la administración de miembros y nombre.",
      },
    ],
  },
] as const;

export const ensureSeedData = mutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    username: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingConversations = await ctx.db.query("conversations").collect();

    if (existingConversations.length > 0) {
      return { created: false };
    }

    const currentUser = await upsertCurrentUser(ctx, args);
    const seedUserIds = new Map<string, Id<"users">>();

    for (const seedUser of seedUsers) {
      const userId = await ensureUserRecord(ctx, seedUser);
      seedUserIds.set(seedUser.clerkId, userId);
    }

    const now = Date.now();

    for (const [index, group] of seedGroups.entries()) {
      const createdAt = now + index * 60_000;
      const conversationId = await ctx.db.insert("conversations", {
        name: group.name,
        preview: group.preview,
        timeLabel: formatTimeLabel(createdAt),
        avatar: getInitials(group.name),
        accent: groupAccents[index % groupAccents.length],
        isActive: index === 0,
        position: index,
        createdByClerkId: args.clerkId,
      });

      await ctx.db.insert("conversationMembers", {
        conversationId,
        userId: currentUser._id,
        role: "admin",
        joinedAt: createdAt,
      });

      for (const clerkId of group.memberClerkIds) {
        const userId = seedUserIds.get(clerkId);

        if (!userId) {
          continue;
        }

        await ctx.db.insert("conversationMembers", {
          conversationId,
          userId,
          role: clerkId === "seed-jon" ? "admin" : "member",
          joinedAt: createdAt,
        });
      }

      for (const [messageIndex, message] of group.messages.entries()) {
        await ctx.db.insert("messages", {
          conversationId,
          authorClerkId: message.authorClerkId,
          author: message.author,
          body: message.body,
          timeLabel: formatTimeLabel(createdAt + messageIndex * 60_000),
          own: false,
          position: messageIndex,
          createdAt: createdAt + messageIndex * 60_000,
        });
      }
    }

    return { created: true };
  },
});

export const getChatData = query({
  args: {
    currentClerkId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.currentClerkId) {
      return emptyChatData();
    }

    const currentUser = await getUserByClerkId(ctx, args.currentClerkId);

    if (!currentUser) {
      return emptyChatData();
    }

    const [conversations, memberships, messages] = await Promise.all([
      ctx.db.query("conversations").withIndex("by_position").collect(),
      ctx.db.query("conversationMembers").collect(),
      ctx.db.query("messages").withIndex("by_position").collect(),
    ]);

    const membershipConversationIds = new Set(
      memberships
        .filter((membership) => membership.userId === currentUser._id)
        .map((membership) => membership.conversationId),
    );

    const visibleConversations = conversations.filter((conversation) =>
      membershipConversationIds.has(conversation._id),
    );

    const selectedConversation = visibleConversations[0] ?? null;

    return {
      workspace: {
        name: "GroupsApp",
        initials: "GA",
      },
      inboxItems: visibleConversations.map((conversation) => {
        const latestMessage = findLatestConversationMessage(messages, conversation._id);
        const memberCount = memberships.filter(
          (membership) => membership.conversationId === conversation._id,
        ).length;

        return {
          id: conversation._id,
          name: conversation.name,
          avatar: conversation.avatar,
          preview: latestMessage?.body ?? conversation.preview,
          time: latestMessage?.timeLabel ?? conversation.timeLabel,
          accent: conversation.accent,
          active: conversation._id === selectedConversation?._id,
          membersLabel: formatMembersLabel(memberCount),
        };
      }),
      channels: [
        { name: "Crear grupo", color: "#4caeb8" },
        { name: "Administrar miembros", color: "#9da6ad" },
      ],
      activeConversationId: selectedConversation?._id ?? null,
    };
  },
});

export const getConversationDetail = query({
  args: {
    conversationId: v.optional(v.id("conversations")),
    currentClerkId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.currentClerkId) {
      return emptyConversationData();
    }

    const currentUser = await getUserByClerkId(ctx, args.currentClerkId);

    if (!currentUser) {
      return emptyConversationData();
    }

    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", (queryBuilder) => queryBuilder.eq("userId", currentUser._id))
      .collect();

    if (!memberships.length) {
      return emptyConversationData();
    }

    const conversationIds = new Set(memberships.map((membership) => membership.conversationId));
    const conversations = await ctx.db.query("conversations").withIndex("by_position").collect();
    const availableConversations = conversations.filter((conversation) =>
      conversationIds.has(conversation._id),
    );
    const selectedConversation =
      availableConversations.find((conversation) => conversation._id === args.conversationId) ??
      availableConversations[0];

    if (!selectedConversation) {
      return emptyConversationData();
    }

    const [conversationMemberships, conversationMessages] = await Promise.all([
      ctx.db
        .query("conversationMembers")
        .withIndex("by_conversation", (queryBuilder) =>
          queryBuilder.eq("conversationId", selectedConversation._id),
        )
        .collect(),
      ctx.db
        .query("messages")
        .withIndex("by_conversation_position", (queryBuilder) =>
          queryBuilder.eq("conversationId", selectedConversation._id),
        )
        .collect(),
    ]);

    conversationMessages.sort((left, right) => left.position - right.position);

    const memberUsers = await Promise.all(
      conversationMemberships.map((membership) => ctx.db.get(membership.userId)),
    );

    const currentMembership = conversationMemberships.find(
      (membership) => membership.userId === currentUser._id,
    );
    const adminCount = conversationMemberships.filter(
      (membership) => membership.role === "admin",
    ).length;

    return {
      activeConversation: {
        id: selectedConversation._id,
        name: selectedConversation.name,
        membersLabel: formatMembersLabel(conversationMemberships.length),
        badge: selectedConversation.avatar,
        badgeColor: selectedConversation.accent,
        canManageGroup: currentMembership?.role === "admin",
      },
      members: conversationMemberships
        .map((membership, index) => {
          const member = memberUsers[index];

          if (!member) {
            return null;
          }

          const displayName =
            [member.firstName, member.lastName].filter(Boolean).join(" ").trim() ||
            member.username ||
            member.email ||
            "Usuario";
          const isCurrentUser = member.clerkId === args.currentClerkId;

          return {
            id: member._id,
            displayName,
            username: member.username,
            role: membership.role,
            isCurrentUser,
            canRemove:
              currentMembership?.role === "admin" &&
              !isCurrentUser &&
              !(membership.role === "admin" && adminCount === 1),
            canToggleAdmin:
              currentMembership?.role === "admin" &&
              !(isCurrentUser && adminCount === 1) &&
              !(membership.role === "admin" && adminCount === 1),
          };
        })
        .filter((member) => member !== null)
        .sort((left, right) => {
          if (left.role !== right.role) {
            return left.role === "admin" ? -1 : 1;
          }

          return left.displayName.localeCompare(right.displayName);
        }),
      messages: conversationMessages.map((message) => ({
        id: message._id,
        author: message.author,
        time: message.timeLabel,
        own: args.currentClerkId === message.authorClerkId,
        body: message.body,
      })),
    };
  },
});

export const searchUsersByUsername = query({
  args: {
    currentClerkId: v.optional(v.string()),
    conversationId: v.optional(v.id("conversations")),
    search: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedSearch = args.search.trim().toLowerCase();

    if (!normalizedSearch || !args.currentClerkId) {
      return [];
    }

    const currentUser = await getUserByClerkId(ctx, args.currentClerkId);

    if (!currentUser) {
      return [];
    }

    if (args.conversationId) {
      const membership = await getConversationMembership(ctx, args.conversationId, currentUser._id);

      if (membership?.role !== "admin") {
        return [];
      }
    }

    const [users, conversationMemberships] = await Promise.all([
      ctx.db.query("users").collect(),
      args.conversationId
        ? ctx.db
            .query("conversationMembers")
            .withIndex("by_conversation", (queryBuilder) =>
              queryBuilder.eq("conversationId", args.conversationId!),
            )
            .collect()
        : Promise.resolve([]),
    ]);

    const existingMemberIds = new Set(conversationMemberships.map((membership) => membership.userId));

    return users
      .filter((user) => user._id !== currentUser._id)
      .filter((user) => user.username?.toLowerCase().includes(normalizedSearch))
      .slice(0, 5)
      .map((user) => ({
        id: user._id,
        username: user.username ?? "",
        displayName:
          [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
          user.username ||
          user.email ||
          "Usuario",
        alreadyMember: existingMemberIds.has(user._id),
      }));
  },
});

export const createGroup = mutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    username: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    name: v.string(),
    memberUsernames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();

    if (!name) {
      throw new Error("El nombre del grupo es obligatorio.");
    }

    const currentUser = await upsertCurrentUser(ctx, args);
    const invitees = await resolveUsersByUsername(ctx, args.memberUsernames);
    const existingConversations = await ctx.db.query("conversations").collect();
    const createdAt = Date.now();
    const conversationId = await ctx.db.insert("conversations", {
      name,
      preview: "Grupo creado. Empieza la conversación.",
      timeLabel: formatTimeLabel(createdAt),
      avatar: getInitials(name),
      accent: groupAccents[existingConversations.length % groupAccents.length],
      isActive: existingConversations.length === 0,
      position: existingConversations.length,
      createdByClerkId: args.clerkId,
    });

    await ctx.db.insert("conversationMembers", {
      conversationId,
      userId: currentUser._id,
      role: "admin",
      joinedAt: createdAt,
    });

    for (const invitee of invitees) {
      if (invitee._id === currentUser._id) {
        continue;
      }

      await ctx.db.insert("conversationMembers", {
        conversationId,
        userId: invitee._id,
        role: "member",
        joinedAt: createdAt,
      });
    }

    return conversationId;
  },
});

export const renameGroup = mutation({
  args: {
    currentClerkId: v.string(),
    conversationId: v.id("conversations"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireUserByClerkId(ctx, args.currentClerkId);
    await requireAdminMembership(ctx, args.conversationId, currentUser._id);

    const name = args.name.trim();

    if (!name) {
      throw new Error("El nombre del grupo es obligatorio.");
    }

    await ctx.db.patch(args.conversationId, {
      name,
      avatar: getInitials(name),
    });

    return args.conversationId;
  },
});

export const addGroupMemberByUsername = mutation({
  args: {
    currentClerkId: v.string(),
    conversationId: v.id("conversations"),
    username: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireUserByClerkId(ctx, args.currentClerkId);
    await requireAdminMembership(ctx, args.conversationId, currentUser._id);

    const user = await findUserByUsername(ctx, args.username.trim());

    if (!user) {
      return {
        ok: false as const,
        code: "user_not_found" as const,
      };
    }

    const existingMembership = await getConversationMembership(ctx, args.conversationId, user._id);

    if (existingMembership) {
      return {
        ok: false as const,
        code: "already_member" as const,
      };
    }

    await ctx.db.insert("conversationMembers", {
      conversationId: args.conversationId,
      userId: user._id,
      role: "member",
      joinedAt: Date.now(),
    });

    return {
      ok: true as const,
      memberUserId: user._id,
    };
  },
});

export const removeGroupMember = mutation({
  args: {
    currentClerkId: v.string(),
    conversationId: v.id("conversations"),
    memberUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireUserByClerkId(ctx, args.currentClerkId);
    await requireAdminMembership(ctx, args.conversationId, currentUser._id);

    if (args.memberUserId === currentUser._id) {
      throw new Error("No puedes quitarte a ti mismo desde esta acción.");
    }

    const membership = await getConversationMembership(ctx, args.conversationId, args.memberUserId);

    if (!membership) {
      throw new Error("Ese usuario no pertenece al grupo.");
    }

    if (membership.role === "admin") {
      const adminCount = await countConversationAdmins(ctx, args.conversationId);

      if (adminCount === 1) {
        throw new Error("El grupo debe conservar al menos un admin.");
      }
    }

    await ctx.db.delete(membership._id);
    return membership._id;
  },
});

export const setGroupMemberRole = mutation({
  args: {
    currentClerkId: v.string(),
    conversationId: v.id("conversations"),
    memberUserId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireUserByClerkId(ctx, args.currentClerkId);
    await requireAdminMembership(ctx, args.conversationId, currentUser._id);

    const membership = await getConversationMembership(ctx, args.conversationId, args.memberUserId);

    if (!membership) {
      throw new Error("Ese usuario no pertenece al grupo.");
    }

    if (membership.role === args.role) {
      return membership._id;
    }

    if (membership.role === "admin" && args.role === "member") {
      const adminCount = await countConversationAdmins(ctx, args.conversationId);

      if (adminCount === 1) {
        throw new Error("El grupo debe conservar al menos un admin.");
      }
    }

    await ctx.db.patch(membership._id, {
      role: args.role,
    });

    return membership._id;
  },
});

export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    currentClerkId: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmedBody = args.body.trim();

    if (!trimmedBody) {
      throw new Error("Message body is required.");
    }

    const currentUser = await requireUserByClerkId(ctx, args.currentClerkId);
    const membership = await getConversationMembership(ctx, args.conversationId, currentUser._id);

    if (!membership) {
      throw new Error("No perteneces a este grupo.");
    }

    const existingMessages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_position", (queryBuilder) =>
        queryBuilder.eq("conversationId", args.conversationId),
      )
      .collect();

    existingMessages.sort((left, right) => left.position - right.position);

    const createdAt = Date.now();

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      authorClerkId: args.currentClerkId,
      author: getUserDisplayName(currentUser),
      body: trimmedBody,
      timeLabel: formatTimeLabel(createdAt),
      own: false,
      position: existingMessages.length,
      createdAt,
    });

    await ctx.db.patch(args.conversationId, {
      preview: trimmedBody,
      timeLabel: formatTimeLabel(createdAt),
    });

    return messageId;
  },
});

function emptyChatData() {
  return {
    workspace: {
      name: "GroupsApp",
      initials: "GA",
    },
    inboxItems: [],
    channels: [],
    activeConversationId: null,
  };
}

function emptyConversationData() {
  return {
    activeConversation: null,
    members: [],
    messages: [],
  };
}

async function getUserByClerkId(ctx: ReaderCtx, clerkId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (queryBuilder) => queryBuilder.eq("clerkId", clerkId))
    .unique();
}

async function requireUserByClerkId(ctx: MutationCtx, clerkId: string) {
  const user = await getUserByClerkId(ctx, clerkId);

  if (!user) {
    throw new Error("No existe un perfil local para este usuario.");
  }

  return user;
}

async function upsertCurrentUser(
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
  const existingUser = await getUserByClerkId(ctx, args.clerkId);

  if (existingUser) {
    await ctx.db.patch(existingUser._id, {
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      username: args.username,
      imageUrl: args.imageUrl,
    });

    return {
      ...existingUser,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      username: args.username,
      imageUrl: args.imageUrl,
    };
  }

  const userId = await ctx.db.insert("users", {
    clerkId: args.clerkId,
    email: args.email,
    firstName: args.firstName,
    lastName: args.lastName,
    username: args.username,
    imageUrl: args.imageUrl,
  });

  return {
    _id: userId,
    _creationTime: Date.now(),
    clerkId: args.clerkId,
    email: args.email,
    firstName: args.firstName,
    lastName: args.lastName,
    username: args.username,
    imageUrl: args.imageUrl,
  };
}

async function ensureUserRecord(
  ctx: MutationCtx,
  user: {
    clerkId: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    imageUrl?: string;
  },
) {
  const existingUser = await getUserByClerkId(ctx, user.clerkId);

  if (existingUser) {
    return existingUser._id;
  }

  return await ctx.db.insert("users", {
    clerkId: user.clerkId,
    email: undefined,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    imageUrl: user.imageUrl,
  });
}

async function getConversationMembership(
  ctx: ReaderCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation_user", (queryBuilder) =>
      queryBuilder.eq("conversationId", conversationId).eq("userId", userId),
    )
    .unique();
}

async function requireAdminMembership(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
) {
  const membership = await getConversationMembership(ctx, conversationId, userId);

  if (membership?.role !== "admin") {
    throw new Error("Solo los admins del grupo pueden hacer este cambio.");
  }

  return membership;
}

async function countConversationAdmins(ctx: ReaderCtx, conversationId: Id<"conversations">) {
  const memberships = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation", (queryBuilder) =>
      queryBuilder.eq("conversationId", conversationId),
    )
    .collect();

  return memberships.filter((membership) => membership.role === "admin").length;
}

async function resolveUsersByUsername(ctx: MutationCtx, usernames: string[]) {
  const normalized = [...new Set(usernames.map((username) => username.trim()).filter(Boolean))];
  const resolvedUsers: Doc<"users">[] = [];
  const missingUsernames: string[] = [];

  for (const username of normalized) {
    const user = await findUserByUsername(ctx, username);

    if (!user) {
      missingUsernames.push(username);
      continue;
    }

    resolvedUsers.push(user);
  }

  if (missingUsernames.length > 0) {
    throw new Error(`No existen estos usernames dentro de la app: ${missingUsernames.join(", ")}.`);
  }

  return resolvedUsers;
}

async function findUserByUsername(ctx: ReaderCtx, username: string) {
  const exactMatch = await ctx.db
    .query("users")
    .withIndex("by_username", (queryBuilder) => queryBuilder.eq("username", username))
    .unique();

  if (exactMatch) {
    return exactMatch;
  }

  const normalized = username.trim().toLowerCase();
  const users = await ctx.db.query("users").collect();

  return users.find((user) => user.username?.toLowerCase() === normalized) ?? null;
}

function findLatestConversationMessage(
  messages: Array<Doc<"messages">>,
  conversationId: Id<"conversations">,
) {
  return messages
    .filter((message) => message.conversationId === conversationId)
    .sort((left, right) => right.createdAt - left.createdAt)[0];
}

function formatTimeLabel(value: number) {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatMembersLabel(memberCount: number) {
  return `${memberCount} ${memberCount === 1 ? "miembro" : "miembros"}`;
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "GA";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getUserDisplayName(user: Doc<"users">) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username || "You";
}
