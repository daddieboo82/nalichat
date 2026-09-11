// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChatExportDialog from '@/components/messages/ChatExportDialog';

const mockInvoke = vi.hoisted(() => vi.fn());
const mockTrack = vi.hoisted(() => vi.fn());
const mockExportFile = vi.hoisted(() => vi.fn());
const subscriptionState = vi.hoisted(() => ({
  current: {
    hasEntitlement: () => false,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
}));

vi.mock('@/api/base44Client', () => ({
  base44: { functions: { invoke: mockInvoke } },
}));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => subscriptionState.current,
}));
vi.mock('@/lib/paywallAnalytics', () => ({
  trackPaywallEvent: mockTrack,
}));
vi.mock('@/lib/chatExport', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, exportConversationFile: mockExportFile };
});

describe('ChatExportDialog Free access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscriptionState.current = {
      hasEntitlement: () => false,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
  });

  afterEach(cleanup);

  it('shows an accessible entitlement prompt without blocking core chat', () => {
    render(
      <MemoryRouter>
        <div>Core conversation remains available</div>
        <ChatExportDialog open onOpenChange={() => {}} conversationId="conversation-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Core conversation remains available')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Export with Premium' })).toBeTruthy();
    expect(screen.getByText(/Messaging remains available on the Free plan/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View Premium plans' }).getAttribute('href')).toBe('/pricing');
    expect(screen.queryByRole('button', { name: /Export Markdown/i })).toBeNull();
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockTrack).toHaveBeenCalledWith('entitlement_prompt_view', {
      entitlement: 'chat.export',
      source: 'chat_export',
    });
  });

  it('does not generate or download after the export dialog unmounts', async () => {
    subscriptionState.current = {
      hasEntitlement: (entitlement) => entitlement === 'chat.export',
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
    let resolveRequest;
    mockInvoke.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    const { unmount } = render(
      <MemoryRouter>
        <ChatExportDialog open onOpenChange={() => {}} conversationId="conversation-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Export Markdown' }));
    expect(mockInvoke).toHaveBeenCalledWith('exportConversation', {
      conversation_id: 'conversation-1',
    });
    unmount();
    await act(async () => {
      resolveRequest({
        data: {
          conversation: { title: 'Private chat', type: 'dm', participants: [] },
          messages: [],
        },
      });
    });

    await waitFor(() => expect(mockExportFile).not.toHaveBeenCalled());
  });
});
