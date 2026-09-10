// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Messages from '@/pages/Messages';
import Explore from '@/pages/Explore';
import UploadArtDialog from '@/components/explore/UploadArtDialog';
import Settings from '@/pages/Settings';

const conversationStore = vi.hoisted(() => ({ items: [] }));
const messageStore = vi.hoisted(() => ({ byConversation: {} }));
const deferredMessage = vi.hoisted(() => ({ promise: null, resolve: null }));

const mockBase44 = vi.hoisted(() => ({
  auth: {
    me: vi.fn(),
    updateMe: vi.fn(),
    redirectToLogin: vi.fn(),
  },
  entities: {
    User: { subscribe: vi.fn(() => () => {}) },
    Conversation: {
      list: vi.fn(() => Promise.resolve(conversationStore.items)),
      get: vi.fn((id) => Promise.resolve(conversationStore.items.find((item) => item.id === id))),
      create: vi.fn(async (payload) => {
        const created = {
          id: `conv-${conversationStore.items.length + 1}`,
          last_message_at: null,
          last_message_text: '',
          ...payload,
        };
        conversationStore.items = [...conversationStore.items, created];
        messageStore.byConversation[created.id] = [];
        return created;
      }),
      update: vi.fn(async (id, patch) => {
        conversationStore.items = conversationStore.items.map((item) => item.id === id ? { ...item, ...patch } : item);
      }),
      subscribe: vi.fn(() => () => {}),
    },
    Message: {
      filter: vi.fn(async ({ conversation_id }) => messageStore.byConversation[conversation_id] || []),
      create: vi.fn((payload) => deferredMessage.promise ?? Promise.resolve({ id: 'msg-1', ...payload })),
      update: vi.fn(async () => ({})),
      subscribe: vi.fn(() => () => {}),
    },
    ArtPost: {
      list: vi.fn(),
      filter: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
  integrations: {
    Core: {
      UploadFile: vi.fn(),
    },
  },
  functions: {
    invoke: vi.fn(),
  },
}));

const mockAuthState = vi.hoisted(() => ({
  current: {
    user: null,
    isAuthenticated: false,
    checkUserAuth: vi.fn(),
  },
}));

const mockSubscription = vi.hoisted(() => ({
  current: {
    subscription: null,
    isPro: false,
    isProFilesharing: false,
    isTrialActive: false,
    isLoading: false,
  },
}));

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

vi.mock('@/api/base44Client', () => ({ base44: mockBase44 }));
vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => mockAuthState.current,
}));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => mockSubscription.current,
}));
vi.mock('@/components/layout/PullToRefresh', () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock('@/components/messages/ConversationList', () => ({
  default: ({ myConversations, onSelect, onStartDM, users, currentUserId }) => (
    <div>
      <button onClick={() => onStartDM(users.find((user) => user.id !== currentUserId))}>Start DM</button>
      {myConversations.map((conversation) => (
        <button key={conversation.id} onClick={() => onSelect(conversation.id)}>
          {conversation.name || conversation.id}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('@/components/messages/ContactsTab', () => ({ default: () => <div>Contacts</div> }));
vi.mock('@/components/messages/NewChatDialog', () => ({ default: () => null }));
vi.mock('@/components/messages/GroupChatDialog', () => ({ default: () => null }));
vi.mock('@/components/messages/ExternalMessageDialog', () => ({ default: () => null }));
vi.mock('@/components/GlobalInviteDialog', () => ({ default: () => null }));
vi.mock('@/components/messages/ModerationBanner', () => ({ default: () => <div>Moderation</div> }));
vi.mock('@/components/messages/ChatView', () => ({
  default: ({ conversation, messages, onSendMessage }) => (
    <div>
      <div>Conversation: {conversation.name || conversation.id}</div>
      <button onClick={() => onSendMessage({ type: 'text', text: 'hello there' })}>Send Hello</button>
      <div data-testid="message-list">
        {messages.map((message) => `${message.id}:${message.text}:${message._optimistic ? 'temp' : 'real'}`).join('|')}
      </div>
    </div>
  ),
}));
vi.mock('@/components/explore/ArtPostCard', () => ({
  default: ({ post }) => <div>{post.title}</div>,
}));
vi.mock('@/components/explore/AddToPlaylistDialog', () => ({ default: () => null }));
vi.mock('@/components/explore/TrackCommentsDialog', () => ({ default: () => null }));
vi.mock('@/components/settings/DeleteAccountDialog', () => ({ default: () => null }));
vi.mock('@/components/onboarding/InteractiveWizard', () => ({ default: () => null }));
vi.mock('@/components/audio/DeviceSelector', () => ({ default: () => null }));
vi.mock('@/components/nali/NaliProactivitySettings', () => ({ default: () => <div>Nali Settings</div> }));
vi.mock('@/components/ui/responsive-select', () => ({
  Select: ({ value, onValueChange, children }) => (
    <select aria-label="Role" value={value} onChange={(event) => onValueChange(event.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }) => <>{children}</>,
  SelectItem: ({ value, children }) => <option value={value}>{children}</option>,
}));
vi.mock('@/hooks/use-sound', () => ({ sounds: { click: vi.fn(), nav: vi.fn(), success: vi.fn(), notification: vi.fn() } }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('sonner', () => ({ toast: mockToast }));
vi.mock('@/lib/squadBonus', () => ({ recordSquadActivity: vi.fn() }));
vi.mock('@/lib/avatarValidation', () => ({ isValidAvatarUrl: vi.fn(() => true) }));

const createDeferred = () => {
  let resolve;
  const promise = new Promise((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
};

const renderWithProviders = (ui, initialEntries = ['/']) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('core usage flow coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    conversationStore.items = [];
    messageStore.byConversation = {};
    deferredMessage.promise = null;
    deferredMessage.resolve = null;
    mockAuthState.current = {
      user: null,
      isAuthenticated: false,
      checkUserAuth: vi.fn(),
    };
    mockSubscription.current = {
      subscription: null,
      isPro: false,
      isProFilesharing: false,
      isTrialActive: false,
      isLoading: false,
    };
    mockBase44.functions.invoke.mockImplementation(async (name) => {
      if (name === 'listPublicUsers') {
        return { data: { users: [] } };
      }
      if (name === 'updateUserPresence') {
        return { data: { ok: true } };
      }
      if (name === 'toggleLike') {
        return { data: { liked: true, likes: 1 } };
      }
      return { data: {} };
    });
    mockBase44.entities.ArtPost.list.mockResolvedValue([]);
    mockBase44.entities.ArtPost.filter.mockResolvedValue([]);
    mockBase44.entities.ArtPost.create.mockResolvedValue({ id: 'post-1' });
    mockBase44.integrations.Core.UploadFile.mockResolvedValue({ file_url: 'https://cdn.example.com/file.mp3' });
    mockBase44.auth.updateMe.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('loads messages for a new onboarded user with the empty state', async () => {
    const currentUser = { id: 'user-1', display_name: 'Fresh', full_name: 'Fresh User' };
    mockBase44.auth.me.mockResolvedValue(currentUser);
    mockBase44.functions.invoke.mockImplementation(async (name) => {
      if (name === 'listPublicUsers') {
        return { data: { users: [currentUser] } };
      }
      return { data: {} };
    });

    renderWithProviders(<Messages />);

    await screen.findByText('Your Messages');
    expect(screen.getByText(/Select a conversation from the sidebar/)).toBeTruthy();
  });

  it('creates a DM, sends an optimistic message, and swaps in the saved message', async () => {
    const currentUser = { id: 'user-1', display_name: 'Fresh', full_name: 'Fresh User' };
    const otherUser = { id: 'user-2', display_name: 'Producer Two', full_name: 'Producer Two' };
    const pending = createDeferred();
    deferredMessage.promise = pending.promise;
    deferredMessage.resolve = (payload) => {
      messageStore.byConversation[payload.conversation_id] = [payload];
      pending.resolve(payload);
    };

    mockBase44.auth.me.mockResolvedValue(currentUser);
    mockBase44.functions.invoke.mockImplementation(async (name) => {
      if (name === 'listPublicUsers') {
        return { data: { users: [currentUser, otherUser] } };
      }
      if (name === 'updateUserPresence') {
        return { data: { ok: true } };
      }
      return { data: {} };
    });

    renderWithProviders(<Messages />);

    fireEvent.click(await screen.findByRole('button', { name: 'Start DM' }));

    await screen.findByText('Conversation: conv-1');
    fireEvent.click(screen.getByRole('button', { name: 'Send Hello' }));

    await waitFor(() => {
      expect(screen.getByTestId('message-list').textContent).toContain('hello there:temp');
    });

    deferredMessage.resolve({
      id: 'msg-1',
      text: 'hello there',
      type: 'text',
      conversation_id: 'conv-1',
      sender_id: 'user-1',
      sender_name: 'Fresh',
      sender_avatar: undefined,
    });

    await waitFor(() => {
      expect(screen.getByTestId('message-list').textContent).toContain('msg-1:hello there:real');
    });
    expect(mockBase44.entities.Conversation.create).toHaveBeenCalledWith({
      type: 'dm',
      participant_ids: ['user-1', 'user-2'],
    });
  });

  it('redirects anonymous explore release actions to login and retries load failures', async () => {
    let first = true;
    mockBase44.entities.ArtPost.list.mockImplementation(async () => {
      if (first) {
        first = false;
        throw new Error('network');
      }
      return [];
    });

    renderWithProviders(<Explore />);

    fireEvent.click(screen.getByRole('button', { name: 'Release Track' }));
    expect(mockBase44.auth.redirectToLogin).toHaveBeenCalled();

    await screen.findByText("Couldn't load tracks");
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await screen.findByText('No tracks yet');
    expect(mockBase44.entities.ArtPost.list).toHaveBeenCalledTimes(2);
  });

  it('publishes tracks from the upload dialog and updates the user profile xp', async () => {
    const currentUser = { id: 'user-1', display_name: 'Fresh', full_name: 'Fresh User', xp: 150, total_posts: 2 };
    const onSuccess = vi.fn();
    const { container } = renderWithProviders(
      <UploadArtDialog open onClose={() => {}} currentUser={currentUser} onSuccess={onSuccess} />
    );

    const audioInput = container.querySelector('#audio-upload');
    fireEvent.change(audioInput, {
      target: { files: [new File(['audio'], 'first-track.mp3', { type: 'audio/mpeg' })] },
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('first-track')).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText('Explicit'));
    fireEvent.click(screen.getByRole('button', { name: 'Publish Track' }));

    await waitFor(() => {
      expect(mockBase44.entities.ArtPost.create).toHaveBeenCalledWith(expect.objectContaining({
        title: 'first-track',
        file_url: 'https://cdn.example.com/file.mp3',
        is_explicit: true,
        creator_id: 'user-1',
        creator_name: 'Fresh',
      }));
      expect(mockBase44.auth.updateMe).toHaveBeenCalledWith({ xp: 200, level: 2, total_posts: 3 });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('keeps the upload dialog open when publish fails so the user can retry', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      mockBase44.entities.ArtPost.create.mockRejectedValueOnce(new Error('upload failed'));
      const onSuccess = vi.fn();
      const { container } = renderWithProviders(
        <UploadArtDialog
          open
          onClose={() => {}}
          currentUser={{ id: 'user-1', display_name: 'Fresh', full_name: 'Fresh User', xp: 0, total_posts: 0 }}
          onSuccess={onSuccess}
        />
      );

      fireEvent.change(container.querySelector('#audio-upload'), {
        target: { files: [new File(['audio'], 'retry-track.mp3', { type: 'audio/mpeg' })] },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Publish Track' }));

      await waitFor(() => {
        expect(onSuccess).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Publish Track' })).toBeTruthy();
      });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('loads settings, saves profile edits, and refreshes the global auth user', async () => {
    const checkUserAuth = vi.fn().mockResolvedValue(undefined);
    const currentUser = {
      id: 'user-1',
      email: 'user@example.com',
      display_name: 'Old Name',
      full_name: 'Old Name',
      bio: 'Original bio',
      role: 'artist',
      location: 'Old Town',
      genres: ['Hip-Hop'],
      avatar_url: 'https://cdn.example.com/avatar.png',
    };
    mockAuthState.current = {
      user: currentUser,
      isAuthenticated: true,
      checkUserAuth,
    };
    mockBase44.auth.me.mockResolvedValue(currentUser);

    renderWithProviders(<Settings />);

    fireEvent.change(await screen.findByDisplayValue('Old Name'), { target: { value: 'New Alias' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    await waitFor(() => {
      expect(mockBase44.auth.updateMe).toHaveBeenCalledWith(expect.objectContaining({
        display_name: 'New Alias',
        bio: 'Original bio',
        role: 'artist',
        location: 'Old Town',
        genres: ['Hip-Hop'],
        avatar_url: 'https://cdn.example.com/avatar.png',
      }));
      expect(checkUserAuth).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith('Profile updated!');
    });
  });
});
