// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MessageSearch from './MessageSearch';

const mockBase44 = vi.hoisted(() => ({
  functions: { invoke: vi.fn() },
}));
const subscriptionState = vi.hoisted(() => ({
  entitled: false,
}));

vi.mock('@/api/base44Client', () => ({ base44: mockBase44 }));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    hasEntitlement: () => subscriptionState.entitled,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/lib/paywallAnalytics', () => ({
  trackPaywallEvent: vi.fn(),
}));

const conversation = {
  id: 'conversation-1',
  participant_ids: ['user-1', 'user-2'],
};
const users = [
  { id: 'user-1', display_name: 'Jordan' },
  { id: 'user-2', display_name: 'Taylor' },
  { id: 'outsider', display_name: 'Outsider' },
];

function renderSearch() {
  return render(
    <MemoryRouter>
      <MessageSearch
        conversation={conversation}
        users={users}
        onClose={vi.fn()}
        onSelectMessage={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe('MessageSearch', () => {
  beforeEach(() => {
    subscriptionState.entitled = false;
    mockBase44.functions.invoke.mockReset();
    mockBase44.functions.invoke.mockResolvedValue({
      data: {
        results: [{
          id: 'message-1',
          sender_id: 'user-2',
          sender_name: 'Taylor',
          text: 'final mix',
          type: 'text',
          created_date: '2026-09-10T12:00:00.000Z',
        }],
        pagination: { next_offset: null },
      },
    });
  });

  afterEach(cleanup);

  it('keeps basic text search available to Free users and prompts only for filters', async () => {
    renderSearch();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search messages' }), {
      target: { value: 'final mix' },
    });
    expect(await screen.findByText('final mix')).toBeTruthy();
    expect(mockBase44.functions.invoke).toHaveBeenCalledWith(
      'searchMessages',
      expect.objectContaining({
        conversation_id: conversation.id,
        query: 'final mix',
        sender_id: undefined,
        types: undefined,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByText('Advanced message filters')).toBeTruthy();
    expect(screen.getByText(/find the right conversation faster/)).toBeTruthy();
  });

  it('sends composable Premium filters with timezone-normalized date boundaries', async () => {
    subscriptionState.entitled = true;
    renderSearch();

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByLabelText('Sender'), { target: { value: 'user-2' } });
    fireEvent.change(screen.getByLabelText('Message type'), { target: { value: 'audio' } });
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Through date'), { target: { value: '2026-09-03' } });
    fireEvent.change(screen.getByLabelText('Sort order'), { target: { value: 'oldest' } });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search messages' }), { target: { value: 'hook' } });

    await waitFor(() => {
      expect(mockBase44.functions.invoke).toHaveBeenLastCalledWith(
        'searchMessages',
        expect.objectContaining({
          conversation_id: conversation.id,
          query: 'hook',
          sender_id: 'user-2',
          types: ['audio'],
          date_from: new Date(2026, 8, 1).toISOString(),
          date_to: new Date(2026, 8, 4).toISOString(),
          order: 'oldest',
        }),
      );
    });

    expect(screen.queryByRole('option', { name: 'Outsider' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByLabelText('Sender').value).toBe('');
    expect(screen.getByLabelText('Message type').value).toBe('');
    expect(screen.getByLabelText('From date').value).toBe('');
    expect(screen.getByLabelText('Through date').value).toBe('');
  });

  it('shows server search failures without exposing stale results', async () => {
    mockBase44.functions.invoke.mockRejectedValueOnce(new Error('Search unavailable'));
    renderSearch();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search messages' }), {
      target: { value: 'missing' },
    });

    expect(await screen.findByText('Search unavailable')).toBeTruthy();
    expect(screen.queryByText('final mix')).toBeNull();
  });

  it('continues after an empty bounded scan window', async () => {
    mockBase44.functions.invoke
      .mockResolvedValueOnce({
        data: { results: [], pagination: { next_offset: 500 } },
      })
      .mockResolvedValueOnce({
        data: {
          results: [{
            id: 'message-2',
            sender_id: 'user-2',
            sender_name: 'Taylor',
            text: 'older match',
            type: 'text',
            created_date: '2026-08-10T12:00:00.000Z',
          }],
          pagination: { next_offset: null },
        },
      });
    renderSearch();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search messages' }), {
      target: { value: 'older' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Search older messages' }));

    expect(await screen.findByText('older match')).toBeTruthy();
    expect(mockBase44.functions.invoke).toHaveBeenLastCalledWith(
      'searchMessages',
      expect.objectContaining({ offset: 500 }),
    );
  });

  it('discards a load-more response after the search criteria change', async () => {
    let resolveOlderPage;
    const olderPage = new Promise((resolve) => {
      resolveOlderPage = resolve;
    });
    mockBase44.functions.invoke.mockImplementation(async (_name, payload) => {
      if (payload.offset === 30) return olderPage;
      const isNewQuery = payload.query === 'new query';
      return {
        data: {
          results: [{
            id: isNewQuery ? 'new-result' : 'old-result',
            sender_id: 'user-2',
            sender_name: 'Taylor',
            text: isNewQuery ? 'new result' : 'old result',
            type: 'text',
            created_date: '2026-09-10T12:00:00.000Z',
          }],
          pagination: { next_offset: isNewQuery ? null : 30 },
        },
      };
    });
    renderSearch();

    const searchbox = screen.getByRole('searchbox', { name: 'Search messages' });
    fireEvent.change(searchbox, { target: { value: 'old query' } });
    expect(await screen.findByText('old result')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    fireEvent.change(searchbox, { target: { value: 'new query' } });
    expect(await screen.findByText('new result')).toBeTruthy();

    resolveOlderPage({
      data: {
        results: [{
          id: 'stale-result',
          sender_id: 'user-2',
          sender_name: 'Taylor',
          text: 'stale result',
          type: 'text',
          created_date: '2026-08-10T12:00:00.000Z',
        }],
        pagination: { next_offset: null },
      },
    });
    await waitFor(() => {
      expect(screen.queryByText('stale result')).toBeNull();
    });
  });
});
