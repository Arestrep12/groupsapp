"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { startTransition, useDeferredValue, useEffect, useState } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SignOutButton } from "./sign-out-button";

type InboxItem = {
  id: Id<"conversations">;
  name: string;
  avatar: string;
  preview: string;
  time: string;
  accent: string;
  active: boolean;
  membersLabel: string;
};

type SidebarChannel = {
  name: string;
  color: string;
  lock?: boolean;
};

type ChatMessage = {
  id: Id<"messages">;
  author: string;
  time: string;
  own: boolean;
  body: string;
};

type GroupMember = {
  id: Id<"users">;
  displayName: string;
  username?: string;
  role: "admin" | "member";
  isCurrentUser: boolean;
  canRemove: boolean;
  canToggleAdmin: boolean;
};

type UserSuggestion = {
  id: Id<"users">;
  username: string;
  displayName: string;
  alreadyMember: boolean;
};

type TopNotice = {
  kind: "error";
  message: string;
};

type ChatData = {
  workspace: { name: string; initials: string };
  inboxItems: InboxItem[];
  channels: SidebarChannel[];
  activeConversationId: Id<"conversations"> | null;
};

type ActiveConversationData = {
  activeConversation: {
    id: Id<"conversations">;
    name: string;
    membersLabel: string;
    badge: string;
    badgeColor: string;
    canManageGroup: boolean;
  } | null;
  members: GroupMember[];
  messages: ChatMessage[];
};

const emptyData: ChatData = {
  workspace: {
    name: "GroupsApp",
    initials: "GA",
  },
  inboxItems: [],
  channels: [],
  activeConversationId: null,
};

const emptyActiveConversationData: ActiveConversationData = {
  activeConversation: null,
  members: [],
  messages: [],
};

export function ChatShell({ convexReady }: { convexReady: boolean }) {
  if (!convexReady) {
    return (
      <ChatLayout
        conversationData={emptyActiveConversationData}
        data={emptyData}
        draftDisabled
        status="Convex no configurado todavía."
      />
    );
  }

  return <ConvexChatShell />;
}

function ConvexChatShell() {
  const { user } = useUser();
  const ensureCurrentUser = useMutation(api.users.ensureCurrentUser);
  const ensureSeedData = useMutation(api.chat.ensureSeedData);
  const sendMessage = useMutation(api.chat.sendMessage);
  const createGroup = useMutation(api.chat.createGroup);
  const renameGroup = useMutation(api.chat.renameGroup);
  const addGroupMemberByUsername = useMutation(
    api.chat.addGroupMemberByUsername,
  );
  const removeGroupMember = useMutation(api.chat.removeGroupMember);
  const setGroupMemberRole = useMutation(api.chat.setGroupMemberRole);
  const [selectedConversationId, setSelectedConversationId] = useState<
    Id<"conversations"> | undefined
  >(undefined);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("Sincronizando usuario...");
  const [isSending, setIsSending] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isManagingGroup, setIsManagingGroup] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembersText, setGroupMembersText] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [inviteUsername, setInviteUsername] = useState("");
  const [isSubmittingAdminAction, setIsSubmittingAdminAction] = useState(false);
  const [topNotice, setTopNotice] = useState<TopNotice | null>(null);
  const [lastConversationData, setLastConversationData] =
    useState<ActiveConversationData>(emptyActiveConversationData);

  const data = useQuery(api.chat.getChatData, {
    currentClerkId: user?.id,
  });
  const conversationData = useQuery(api.chat.getConversationDetail, {
    conversationId: selectedConversationId,
    currentClerkId: user?.id,
  });
  const deferredInviteUsername = useDeferredValue(inviteUsername.trim());
  const userSuggestions =
    useQuery(api.chat.searchUsersByUsername, {
      currentClerkId: user?.id,
      conversationId: selectedConversationId,
      search: deferredInviteUsername,
    }) ?? [];
  const resolvedActiveConversation =
    conversationData?.activeConversation ??
    lastConversationData.activeConversation;

  useEffect(() => {
    if (!user) {
      return;
    }

    void ensureCurrentUser({
      clerkId: user.id,
      email: user.primaryEmailAddress?.emailAddress,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      username: user.username ?? undefined,
      imageUrl: user.imageUrl,
    }).then(
      () => setStatus("Usuario sincronizado con Convex."),
      () => setStatus("No fue posible sincronizar el usuario."),
    );
  }, [
    ensureCurrentUser,
    user,
    user?.firstName,
    user?.id,
    user?.imageUrl,
    user?.lastName,
    user?.primaryEmailAddress?.emailAddress,
    user?.username,
  ]);

  useEffect(() => {
    if (!user || data === undefined || data.inboxItems.length > 0) {
      return;
    }

    void ensureSeedData({
      clerkId: user.id,
      email: user.primaryEmailAddress?.emailAddress,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      username: user.username ?? undefined,
      imageUrl: user.imageUrl,
    }).then(
      () => setStatus("Grupos listos desde Convex."),
      () => setStatus("No fue posible inicializar los grupos."),
    );
  }, [
    data,
    ensureSeedData,
    user,
    user?.firstName,
    user?.id,
    user?.imageUrl,
    user?.lastName,
    user?.primaryEmailAddress?.emailAddress,
    user?.username,
  ]);

  useEffect(() => {
    if (!data?.activeConversationId) {
      return;
    }

    setSelectedConversationId(
      (current) => current ?? data.activeConversationId,
    );
  }, [data?.activeConversationId]);

  useEffect(() => {
    if (!conversationData) {
      return;
    }

    setLastConversationData(conversationData);
  }, [conversationData]);

  useEffect(() => {
    setRenameDraft(resolvedActiveConversation?.name ?? "");
    setInviteUsername("");
    setIsManagingGroup(false);
  }, [resolvedActiveConversation]);

  useEffect(() => {
    if (!topNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setTopNotice(null);
    }, 3600);

    return () => window.clearTimeout(timeoutId);
  }, [topNotice]);

  async function handleSendMessage() {
    const activeConversation = resolvedActiveConversation;

    if (!activeConversation || !user || isSending) {
      return;
    }

    const trimmedDraft = draft.trim();

    if (!trimmedDraft) {
      return;
    }

    setIsSending(true);
    setStatus("Enviando mensaje...");

    try {
      await sendMessage({
        conversationId: activeConversation.id,
        currentClerkId: user.id,
        body: trimmedDraft,
      });
      setDraft("");
      setStatus("Mensaje enviado.");
    } catch (error) {
      setStatus("No fue posible enviar el mensaje.");
      showErrorNotice(getErrorMessage(error, "No fue posible enviar el mensaje."));
    } finally {
      setIsSending(false);
    }
  }

  async function handleCreateGroup() {
    if (!user || isCreatingGroup) {
      return;
    }

    setIsCreatingGroup(true);
    setStatus("Creando grupo...");

    try {
      const conversationId = await createGroup({
        clerkId: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
        username: user.username ?? undefined,
        imageUrl: user.imageUrl,
        name: groupName,
        memberUsernames: splitUsernames(groupMembersText),
      });
      setGroupName("");
      setGroupMembersText("");
      setShowCreateGroup(false);
      startTransition(() => {
        setSelectedConversationId(conversationId);
      });
      setStatus("Grupo creado.");
    } catch (error) {
      setStatus("No fue posible crear el grupo.");
      showErrorNotice(getErrorMessage(error, "No fue posible crear el grupo."));
    } finally {
      setIsCreatingGroup(false);
    }
  }

  async function handleRenameGroup() {
    const activeConversation = resolvedActiveConversation;

    if (!activeConversation || !user || isSubmittingAdminAction) {
      return;
    }

    setIsSubmittingAdminAction(true);
    setStatus("Actualizando nombre del grupo...");

    try {
      await renameGroup({
        currentClerkId: user.id,
        conversationId: activeConversation.id,
        name: renameDraft,
      });
      setStatus("Nombre del grupo actualizado.");
    } catch (error) {
      setStatus("No fue posible renombrar el grupo.");
      showErrorNotice(getErrorMessage(error, "No fue posible renombrar el grupo."));
    } finally {
      setIsSubmittingAdminAction(false);
    }
  }

  async function handleInviteUser(username: string) {
    const activeConversation = resolvedActiveConversation;

    if (!activeConversation || !user || isSubmittingAdminAction) {
      return;
    }

    setIsSubmittingAdminAction(true);
    setStatus(`Agregando a ${username}...`);

    try {
      const result = await addGroupMemberByUsername({
        currentClerkId: user.id,
        conversationId: activeConversation.id,
        username,
      });

      if (!result.ok) {
        setStatus("No fue posible agregar ese usuario.");
        showErrorNotice(
          result.code === "user_not_found"
            ? "El usuario que intentas agregar no existe."
            : "Ese usuario ya está dentro del grupo.",
        );
        return;
      }

      setInviteUsername("");
      setStatus(`${username} se agregó al grupo.`);
    } catch (error) {
      setStatus("No fue posible agregar ese usuario.");
      showErrorNotice(getErrorMessage(error, "No fue posible agregar ese usuario."));
    } finally {
      setIsSubmittingAdminAction(false);
    }
  }

  async function handleRemoveMember(memberUserId: Id<"users">) {
    const activeConversation = resolvedActiveConversation;

    if (!activeConversation || !user || isSubmittingAdminAction) {
      return;
    }

    setIsSubmittingAdminAction(true);
    setStatus("Quitando usuario del grupo...");

    try {
      await removeGroupMember({
        currentClerkId: user.id,
        conversationId: activeConversation.id,
        memberUserId,
      });
      setStatus("Usuario quitado del grupo.");
    } catch (error) {
      setStatus("No fue posible quitar al usuario.");
      showErrorNotice(getErrorMessage(error, "No fue posible quitar al usuario."));
    } finally {
      setIsSubmittingAdminAction(false);
    }
  }

  async function handleToggleAdmin(member: GroupMember) {
    const activeConversation = resolvedActiveConversation;

    if (!activeConversation || !user || isSubmittingAdminAction) {
      return;
    }

    setIsSubmittingAdminAction(true);
    setStatus("Actualizando permisos del grupo...");

    try {
      await setGroupMemberRole({
        currentClerkId: user.id,
        conversationId: activeConversation.id,
        memberUserId: member.id,
        role: member.role === "admin" ? "member" : "admin",
      });
      setStatus("Permisos del grupo actualizados.");
    } catch (error) {
      setStatus("No fue posible actualizar el rol.");
      showErrorNotice(getErrorMessage(error, "No fue posible actualizar el rol."));
    } finally {
      setIsSubmittingAdminAction(false);
    }
  }

  function showErrorNotice(message: string) {
    setTopNotice({
      kind: "error",
      message,
    });
  }

  if (data === undefined) {
    return (
      <ChatLayout
        conversationData={emptyActiveConversationData}
        data={emptyData}
        draftDisabled
        status={status}
      />
    );
  }

  const resolvedConversationData = conversationData ?? lastConversationData;
  const inboxItems = data.inboxItems.map((item) => ({
    ...item,
    active: item.id === selectedConversationId,
  }));

  return (
    <ChatLayout
      createGroupName={groupName}
      createGroupUsernames={groupMembersText}
      conversationData={resolvedConversationData}
      data={{
        ...data,
        inboxItems,
      }}
      draft={draft}
      draftDisabled={!resolvedConversationData.activeConversation || isSending}
      inviteSuggestions={userSuggestions}
      inviteUsername={inviteUsername}
      isCreatingGroup={isCreatingGroup}
      isManagingGroup={isManagingGroup}
      isSubmittingAdminAction={isSubmittingAdminAction}
      notice={topNotice}
      onCreateGroup={handleCreateGroup}
      onCreateGroupNameChange={setGroupName}
      onCreateGroupUsernamesChange={setGroupMembersText}
      onDraftChange={setDraft}
      onInviteUsernameChange={setInviteUsername}
      onRemoveMember={handleRemoveMember}
      onRenameDraftChange={setRenameDraft}
      onRenameGroup={handleRenameGroup}
      onSelectConversation={(conversationId) => {
        startTransition(() => {
          setSelectedConversationId(conversationId);
        });
      }}
      onSendMessage={handleSendMessage}
      onSubmitInvite={() => void handleInviteUser(inviteUsername.trim())}
      onSuggestionSelect={(username) => void handleInviteUser(username)}
      onToggleAdmin={(member) => void handleToggleAdmin(member)}
      onToggleCreateGroup={() => setShowCreateGroup((current) => !current)}
      onToggleManageGroup={() => setIsManagingGroup((current) => !current)}
      renameDraft={renameDraft}
      showCreateGroup={showCreateGroup}
      status={status}
    />
  );
}

function ChatLayout({
  data,
  conversationData,
  status,
  draft = "",
  draftDisabled = true,
  showCreateGroup = false,
  createGroupName = "",
  createGroupUsernames = "",
  renameDraft = "",
  inviteUsername = "",
  inviteSuggestions = [],
  notice,
  isCreatingGroup = false,
  isManagingGroup = false,
  isSubmittingAdminAction = false,
  onDraftChange,
  onSelectConversation,
  onSendMessage,
  onToggleCreateGroup,
  onCreateGroupNameChange,
  onCreateGroupUsernamesChange,
  onCreateGroup,
  onToggleManageGroup,
  onRenameDraftChange,
  onRenameGroup,
  onInviteUsernameChange,
  onSubmitInvite,
  onSuggestionSelect,
  onRemoveMember,
  onToggleAdmin,
}: {
  data: ChatData;
  conversationData: ActiveConversationData;
  status: string;
  draft?: string;
  draftDisabled: boolean;
  showCreateGroup?: boolean;
  createGroupName?: string;
  createGroupUsernames?: string;
  renameDraft?: string;
  inviteUsername?: string;
  inviteSuggestions?: UserSuggestion[];
  notice?: TopNotice | null;
  isCreatingGroup?: boolean;
  isManagingGroup?: boolean;
  isSubmittingAdminAction?: boolean;
  onDraftChange?: (value: string) => void;
  onSelectConversation?: (conversationId: Id<"conversations">) => void;
  onSendMessage?: () => void;
  onToggleCreateGroup?: () => void;
  onCreateGroupNameChange?: (value: string) => void;
  onCreateGroupUsernamesChange?: (value: string) => void;
  onCreateGroup?: () => void;
  onToggleManageGroup?: () => void;
  onRenameDraftChange?: (value: string) => void;
  onRenameGroup?: () => void;
  onInviteUsernameChange?: (value: string) => void;
  onSubmitInvite?: () => void;
  onSuggestionSelect?: (username: string) => void;
  onRemoveMember?: (memberUserId: Id<"users">) => void;
  onToggleAdmin?: (member: GroupMember) => void;
}) {
  const { user } = useUser();
  const workspaceName =
    user?.username ?? user?.firstName ?? data.workspace.name;
  const workspaceInitials =
    user?.username?.slice(0, 2).toUpperCase() ??
    user?.firstName?.slice(0, 2).toUpperCase() ??
    data.workspace.initials;

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#2f373c]">
      {notice ? (
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4"
        >
          <div className="top-notice top-notice--error">
            <span className="top-notice__eyebrow">Aviso</span>
            <p className="top-notice__message">{notice.message}</p>
          </div>
        </div>
      ) : null}

      <div className="grid min-h-screen lg:grid-cols-[370px_minmax(0,1fr)]">
        <aside className="border-r border-[#e7e7e1] bg-[linear-gradient(180deg,#fbfbf9_0%,#f8f8f6_100%)] px-5 py-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3eee7] text-[11px] tracking-[0.15em] text-[#9a9891]">
                {workspaceInitials}
              </div>
              <div>
                <p className="text-[14px] font-medium text-[#252d31]">
                  {workspaceName}
                </p>
                <p className="mt-1 text-[12px] text-[#8f9598]">{status}</p>
              </div>
            </div>
            <SignOutButton />
          </div>

          <div className="mt-8 rounded-[20px] border border-[#dbe3df] bg-white/85 p-4 shadow-[0_12px_30px_rgba(26,39,44,0.04)]">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-[#6e7579]">
                Nuevo grupo
              </p>
              <button
                className="rounded-full bg-[#e8f7fb] px-3 py-1 text-[12px] font-medium text-[#2f6d77]"
                onClick={onToggleCreateGroup}
                type="button"
              >
                {showCreateGroup ? "Cerrar" : "Crear"}
              </button>
            </div>

            {showCreateGroup ? (
              <div className="mt-4 space-y-3">
                <input
                  className="w-full rounded-2xl border border-[#d7ddda] bg-[#fcfcfb] px-4 py-3 text-[14px] outline-none"
                  onChange={(event) =>
                    onCreateGroupNameChange?.(event.target.value)
                  }
                  placeholder="Nombre del grupo"
                  value={createGroupName}
                />
                <textarea
                  className="min-h-24 w-full rounded-2xl border border-[#d7ddda] bg-[#fcfcfb] px-4 py-3 text-[14px] outline-none"
                  onChange={(event) =>
                    onCreateGroupUsernamesChange?.(event.target.value)
                  }
                  placeholder="Usernames a invitar, separados por coma"
                  value={createGroupUsernames}
                />
                <button
                  className="w-full rounded-2xl bg-[#bbe4eb] px-4 py-3 text-[14px] font-medium text-white disabled:bg-[#d5e5e8]"
                  disabled={isCreatingGroup || !createGroupName.trim()}
                  onClick={onCreateGroup}
                  type="button"
                >
                  {isCreatingGroup ? "Creando..." : "Crear grupo"}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-[13px] leading-6 text-[#7d858a]">
                El creador queda como admin y puede invitar usuarios por su
                username.
              </p>
            )}
          </div>

          <div className="mt-10">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-[#6e7579]">
                Tus grupos
              </p>
              <span className="text-[12px] text-[#8f9598]">
                {data.inboxItems.length}
              </span>
            </div>
            <div className="mt-4 space-y-2 text-[17px] text-[#394247]">
              {data.inboxItems.map((item) => (
                <button
                  key={item.id}
                  className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                    item.active ? "bg-[#e8f7fb]" : "hover:bg-white/80"
                  }`}
                  onClick={() => onSelectConversation?.(item.id)}
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <span style={{ color: item.accent }}>#</span>
                    <span className="truncate font-medium">{item.name}</span>
                    <span className="ml-auto text-[12px] text-[#8f9598]">
                      {item.time}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-[13px] text-[#7f878b]">
                    {item.preview}
                  </p>
                  <p className="mt-1 text-[12px] text-[#4a95a0]">
                    {item.membersLabel}
                  </p>
                </button>
              ))}
              {data.inboxItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#d6ddda] px-4 py-5 text-[14px] text-[#7c8489]">
                  Aún no perteneces a ningún grupo.
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-10">
            <p className="text-[13px] font-semibold text-[#6e7579]">
              Flujos activos
            </p>
            <div className="mt-4 space-y-2">
              {data.channels.map((channel) => (
                <div
                  key={channel.name}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-[14px] text-[#5e686d]"
                >
                  <span style={{ color: channel.color }}>•</span>
                  <span>{channel.name}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex min-h-screen flex-col bg-white">
          <header className="border-b border-[#e7e7e1] px-6 py-4">
            {conversationData.activeConversation ? (
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full text-sm font-medium text-[#263036]"
                    style={{
                      backgroundColor:
                        conversationData.activeConversation.badgeColor,
                    }}
                  >
                    {conversationData.activeConversation.badge}
                  </div>
                  <div>
                    <h2 className="text-[18px] font-semibold text-[#232b30]">
                      {conversationData.activeConversation.name}
                    </h2>
                    <p className="mt-1 text-[14px] text-[#4a95a0]">
                      {conversationData.activeConversation.membersLabel}
                    </p>
                  </div>
                </div>

                {conversationData.activeConversation.canManageGroup ? (
                  <button
                    className="rounded-full border border-[#d6ddda] px-4 py-2 text-[13px] font-medium text-[#495257]"
                    onClick={onToggleManageGroup}
                    type="button"
                  >
                    {isManagingGroup ? "Cerrar admin" : "Administrar grupo"}
                  </button>
                ) : null}
              </div>
            ) : (
              <div>
                <h2 className="text-[18px] font-semibold text-[#232b30]">
                  Sin grupo
                </h2>
                <p className="mt-1 text-[14px] text-[#7a8187]">
                  Crea un grupo o espera una invitación para empezar.
                </p>
              </div>
            )}
          </header>

          {conversationData.activeConversation?.canManageGroup &&
          isManagingGroup ? (
            <section className="border-b border-[#eef1ed] bg-[#fbfcfb] px-6 py-5">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                <div className="rounded-[22px] border border-[#dde5e0] bg-white p-4">
                  <p className="text-[13px] font-semibold text-[#6e7579]">
                    Configuración
                  </p>
                  <div className="mt-4 space-y-3">
                    <input
                      className="w-full rounded-2xl border border-[#d7ddda] bg-[#fcfcfb] px-4 py-3 text-[14px] outline-none"
                      onChange={(event) =>
                        onRenameDraftChange?.(event.target.value)
                      }
                      value={renameDraft}
                    />
                    <button
                      className="w-full rounded-2xl bg-[#232b30] px-4 py-3 text-[14px] font-medium text-white disabled:bg-[#9ea6aa]"
                      disabled={isSubmittingAdminAction || !renameDraft.trim()}
                      onClick={onRenameGroup}
                      type="button"
                    >
                      Guardar nombre
                    </button>
                  </div>

                  <div className="mt-6">
                    <p className="text-[13px] font-semibold text-[#6e7579]">Invitar usuario</p>
                    <div className="mt-3 space-y-3">
                      <input
                        className="w-full rounded-2xl border border-[#d7ddda] bg-[#fcfcfb] px-4 py-3 text-[14px] outline-none"
                        onChange={(event) =>
                          onInviteUsernameChange?.(event.target.value)
                        }
                        placeholder="username"
                        value={inviteUsername}
                      />
                      <button
                        className="w-full rounded-2xl bg-[#bbe4eb] px-4 py-3 text-[14px] font-medium text-white disabled:bg-[#d5e5e8]"
                        disabled={
                          isSubmittingAdminAction || !inviteUsername.trim()
                        }
                        onClick={onSubmitInvite}
                        type="button"
                      >
                        Agregar al grupo
                      </button>
                    </div>

                    {inviteSuggestions.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {inviteSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            className="flex w-full items-center justify-between rounded-2xl border border-[#e4e9e6] px-3 py-3 text-left"
                            disabled={suggestion.alreadyMember}
                            onClick={() =>
                              onSuggestionSelect?.(suggestion.username)
                            }
                            type="button"
                          >
                            <div>
                              <p className="text-[14px] font-medium text-[#293136]">
                                {suggestion.displayName}
                              </p>
                              <p className="text-[12px] text-[#7d858a]">
                                usuario: {suggestion.username}
                              </p>
                            </div>
                            <span className="text-[12px] text-[#4a95a0]">
                              {suggestion.alreadyMember ? "Ya está" : "Agregar"}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[22px] border border-[#dde5e0] bg-white p-4">
                  <p className="text-[13px] font-semibold text-[#6e7579]">
                    Miembros
                  </p>
                  <div className="mt-4 space-y-3">
                    {conversationData.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex flex-col gap-3 rounded-2xl border border-[#edf1ee] px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-[15px] font-medium text-[#283136]">
                              {member.displayName}
                            </p>
                            <span className="rounded-full bg-[#f3f5f5] px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-[#6f787d]">
                              {member.role}
                            </span>
                            {member.isCurrentUser ? (
                              <span className="rounded-full bg-[#e8f7fb] px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-[#2f6d77]">
                                tú
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[13px] text-[#7d858a]">
                            {member.username
                              ? `usuario: ${member.username}`
                              : "Sin username público"}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {member.canToggleAdmin ? (
                            <button
                              className="rounded-full border border-[#d6ddda] px-3 py-2 text-[12px] font-medium text-[#495257]"
                              disabled={isSubmittingAdminAction}
                              onClick={() => onToggleAdmin?.(member)}
                              type="button"
                            >
                              {member.role === "admin"
                                ? "Quitar admin"
                                : "Hacer admin"}
                            </button>
                          ) : null}
                          {member.canRemove ? (
                            <button
                              className="rounded-full border border-[#e4c9c4] px-3 py-2 text-[12px] font-medium text-[#a65f52]"
                              disabled={isSubmittingAdminAction}
                              onClick={() => onRemoveMember?.(member.id)}
                              type="button"
                            >
                              Quitar del grupo
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <div className="flex-1 px-6 py-8">
            {conversationData.messages.length ? (
              conversationData.messages.map((message, index) => {
                if (message.own) {
                  return (
                    <div key={message.id} className={index > 0 ? "mt-8" : ""}>
                      <div className="ml-auto max-w-[720px] rounded-[22px] bg-[#e8f7fb] px-6 py-4 text-[17px] leading-8 text-[#283136]">
                        {message.body}
                      </div>
                      <p className="mt-2 text-right text-[13px] text-[#7c8489]">
                        {message.time}
                      </p>
                    </div>
                  );
                }

                return (
                  <div
                    key={message.id}
                    className={index > 0 ? "mt-3" : "mt-16"}
                  >
                    <div className="flex items-end gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eec861] text-[15px] text-[#fffdf8]">
                        {message.author.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="mb-2 text-[13px] text-[#7c8489]">
                          {message.author} {message.time}
                        </p>
                        <div className="max-w-[390px] rounded-[18px] bg-[#f3f5f5] px-5 py-4 text-[17px] text-[#283136]">
                          {message.body}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="mt-16 rounded-[22px] border border-dashed border-[#d6ddda] px-6 py-8 text-[16px] text-[#7c8489]">
                Este grupo todavía no tiene mensajes.
              </div>
            )}
          </div>

          <div className="px-6 pb-5">
            <div className="rounded-[18px] border border-[#cfd3d2] px-5 py-5 shadow-[0_3px_10px_rgba(26,39,44,0.03)]">
              <label
                className="text-[16px] text-[#959b9f]"
                htmlFor="chat-draft"
              >
                Mensaje al grupo
              </label>
              <textarea
                className="mt-4 min-h-[130px] w-full resize-none bg-transparent text-[16px] text-[#2b3438] outline-none disabled:text-[#99a2a7]"
                disabled={draftDisabled}
                id="chat-draft"
                onChange={(event) => onDraftChange?.(event.target.value)}
                placeholder="Escribe un mensaje para este grupo"
                value={draft}
              />
              <div className="mt-4 flex items-center justify-between">
                <div className="text-[13px] text-[#7b8186]">
                  Solo los miembros del grupo pueden escribir.
                </div>
                <button
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#bbe4eb] text-[20px] text-white disabled:bg-[#d5e5e8]"
                  disabled={draftDisabled || !draft.trim()}
                  onClick={onSendMessage}
                  type="button"
                >
                  ➤
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function splitUsernames(value: string) {
  return value
    .split(/[\s,]+/)
    .map((username) => username.trim())
    .filter(Boolean);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    const normalizedMessage = error.message.toLowerCase();

    if (normalizedMessage.includes("no existe un usuario con ese username")) {
      return "El usuario que intentas agregar no existe.";
    }

    if (normalizedMessage.includes("ya pertenece al grupo")) {
      return "Ese usuario ya está dentro del grupo.";
    }

    if (normalizedMessage.includes("solo los admins del grupo")) {
      return "Solo un admin puede hacer ese cambio.";
    }

    if (normalizedMessage.includes("debe conservar al menos un admin")) {
      return "El grupo debe tener al menos un admin.";
    }

    if (normalizedMessage.includes("no perteneces a este grupo")) {
      return "Ya no perteneces a este grupo.";
    }

    return fallback;
  }

  return fallback;
}
