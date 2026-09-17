import React from 'react';
import { create, act } from 'react-test-renderer';
import { useEvents } from '../useEvents';
import { createWrapper } from '../../utils/test-utils';
import { listEvents } from '@/api/events';
import { useUserStore } from '@/state/userStore';

// Mock dependencies
jest.mock('@/api/events', () => ({
  listEvents: jest.fn(),
}));

jest.mock('@/state/userStore', () => ({
  useUserStore: jest.fn(),
}));

describe('useEvents caching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useUserStore as unknown as jest.Mock).mockImplementation(() => true);
  });

  it('fetches once and uses cache on subsequent renders', async () => {
    const mockEvents = [{ id: '1', title: 'Test Event', category: 'General' }];
    (listEvents as jest.Mock).mockResolvedValue(mockEvents);

    const { wrapper: Wrapper } = createWrapper();
    let hookResult: ReturnType<typeof useEvents> | undefined;

    const TestComponent = () => {
      hookResult = useEvents();
      return null;
    };

    let root: any;
    await act(async () => {
      root = create(
        <Wrapper>
          <TestComponent />
        </Wrapper>
      );
    });

    // Let the event loop flush to resolve the mock promise
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(hookResult!.events).toEqual(mockEvents);
    expect(listEvents).toHaveBeenCalledTimes(1);

    // Rerender the component
    await act(async () => {
      root.update(
        <Wrapper>
          <TestComponent />
        </Wrapper>
      );
    });

    expect(hookResult!.events).toEqual(mockEvents);
    
    // The API should STILL have only been called once!
    expect(listEvents).toHaveBeenCalledTimes(1);
  });
});
