import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { httpRouter } from "convex/server";

const http = httpRouter();

type ClerkWebhookEvent =
  | {
      type: "user.created" | "user.updated";
      data: {
        id: string;
        first_name: string | null;
        last_name: string | null;
        username: string | null;
        image_url: string;
        email_addresses: Array<{
          email_address: string;
          id: string;
        }>;
        primary_email_address_id: string | null;
      };
    }
  | {
      type: "user.deleted";
      data: {
        id: string | null;
      };
    };

http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

    if (!signingSecret) {
      return jsonResponse(
        { error: "Missing CLERK_WEBHOOK_SIGNING_SECRET." },
        500,
      );
    }

    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return jsonResponse({ error: "Missing Svix headers." }, 400);
    }

    const body = await request.text();

    try {
      await verifyWebhook({
        body,
        secret: signingSecret,
        svixId,
        svixTimestamp,
        svixSignature,
      });
    } catch (error) {
      console.error("Invalid Clerk webhook signature", error);
      return jsonResponse({ error: "Invalid signature." }, 400);
    }

    const event = JSON.parse(body) as ClerkWebhookEvent;

    switch (event.type) {
      case "user.created":
      case "user.updated": {
        await ctx.runMutation(internal.users.upsertFromClerk, {
          clerkId: event.data.id,
          email: getPrimaryEmail(event.data),
          firstName: event.data.first_name ?? undefined,
          lastName: event.data.last_name ?? undefined,
          username: event.data.username ?? undefined,
          imageUrl: event.data.image_url || undefined,
        });
        break;
      }
      case "user.deleted": {
        if (!event.data.id) {
          return jsonResponse({ error: "Missing Clerk user id." }, 400);
        }

        await ctx.runMutation(internal.users.deleteByClerkId, {
          clerkId: event.data.id,
        });
        break;
      }
      default:
        return jsonResponse({ received: true, ignored: true }, 200);
    }

    return jsonResponse({ received: true }, 200);
  }),
});

export default http;

function getPrimaryEmail(
  user: Extract<ClerkWebhookEvent, { type: "user.created" | "user.updated" }>["data"],
) {
  const primaryEmail = user.email_addresses.find(
    (emailAddress) => emailAddress.id === user.primary_email_address_id,
  );

  return primaryEmail?.email_address ?? user.email_addresses[0]?.email_address;
}

async function verifyWebhook({
  body,
  secret,
  svixId,
  svixTimestamp,
  svixSignature,
}: {
  body: string;
  secret: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
}) {
  const timestampSeconds = Number(svixTimestamp);

  if (!Number.isFinite(timestampSeconds)) {
    throw new Error("Invalid Svix timestamp.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  if (Math.abs(nowSeconds - timestampSeconds) > 300) {
    throw new Error("Expired Svix timestamp.");
  }

  const expectedSignature = await sign(
    decodeSecret(secret),
    new TextEncoder().encode(`${svixId}.${svixTimestamp}.${body}`),
  );

  const signatures = svixSignature
    .split(" ")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.split(","))
    .filter(([version, signature]) => version === "v1" && Boolean(signature))
    .map(([, signature]) => decodeBase64(signature));

  const isValid = signatures.some((signature) =>
    constantTimeEqual(signature, expectedSignature),
  );

  if (!isValid) {
    throw new Error("Signature mismatch.");
  }
}

async function sign(secret: Uint8Array, payload: Uint8Array) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, toArrayBuffer(payload)),
  );
}

function decodeSecret(secret: string) {
  return decodeBase64(secret.startsWith("whsec_") ? secret.slice(6) : secret);
}

function decodeBase64(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const decoded = atob(padded);

  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index] ^ right[index];
  }

  return mismatch === 0;
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function jsonResponse(body: Record<string, boolean | number | string>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
