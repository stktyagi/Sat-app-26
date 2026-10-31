import { create } from 'zustand';
import { fetchBanners, Banner } from '@/api/banners';
import { fetchReels } from '@/api/reels';
import { listStories, BackendStory } from '@/api/stories';
import { listVenues } from '@/api/venues';
import { Reel, Venue } from '@/types/models';
import { UserStory } from '@/types/story';
import { BannerItem, DEMO_BANNERS } from '@/components/display/HeroBanner';
import { MOCK_REELS } from '@/mocks/reels';
import { resolveStoryImage } from '@/hooks/useStories';

interface ContentCacheState {
  // Banners
  banners: BannerItem[];
  rawBanners: Banner[];
  bannersLoading: boolean;
  bannersError: string | null;
  bannersFetched: boolean;

  // Reels
  reels: Reel[];
  reelsLoading: boolean;
  reelsError: string | null;
  reelsFetched: boolean;

  // Stories
  stories: UserStory[];
  rawStories: BackendStory[];
  storiesLoading: boolean;
  storiesError: string | null;
  storiesFetched: boolean;

  // Venues (Map) - Cached in frontend only
  venues: Venue[];
  venuesLoading: boolean;
  venuesError: string | null;
  venuesFetched: boolean;

  // Actions
  getBanners: (forceRefresh?: boolean) => Promise<BannerItem[]>;
  getReels: (forceRefresh?: boolean) => Promise<Reel[]>;
  getStories: (forceRefresh?: boolean) => Promise<UserStory[]>;
  getVenues: (forceRefresh?: boolean) => Promise<Venue[]>;

  invalidateBanners: () => void;
  invalidateReels: () => void;
  invalidateStories: () => void;
  invalidateVenues: () => void;
  invalidateAll: () => void;
}

export const useContentCacheStore = create<ContentCacheState>((set, get) => ({
  banners: DEMO_BANNERS,
  rawBanners: [],
  bannersLoading: false,
  bannersError: null,
  bannersFetched: false,

  reels: MOCK_REELS,
  reelsLoading: false,
  reelsError: null,
  reelsFetched: false,

  stories: [],
  rawStories: [],
  storiesLoading: false,
  storiesError: null,
  storiesFetched: false,

  venues: [],
  venuesLoading: false,
  venuesError: null,
  venuesFetched: false,

  getBanners: async (forceRefresh = false) => {
    const state = get();
    // Cache hit: return immediately without network call
    if (state.bannersFetched && !forceRefresh) {
      return state.banners;
    }

    set({ bannersLoading: true, bannersError: null });
    try {
      const items = await fetchBanners();
      if (items && items.length > 0) {
        const transformed: BannerItem[] = items.map((b) => ({
          id: b.id,
          title: b.title || 'Saturnalia',
          description: b.description || '',
          image: b.imageUrl,
          link: b.link,
          linkType: b.linkType,
          isActive: b.isActive,
          order: b.order,
        }));
        set({
          banners: transformed,
          rawBanners: items,
          bannersFetched: true,
          bannersLoading: false,
        });
        return transformed;
      } else {
        // Fallback to demo banners if none configured on backend
        set({
          banners: DEMO_BANNERS,
          rawBanners: [],
          bannersFetched: true,
          bannersLoading: false,
        });
        return DEMO_BANNERS;
      }
    } catch (err: any) {
      console.warn('Failed to fetch backend banners, using fallback:', err?.message);
      set({
        bannersError: err?.message || 'Failed to load banners',
        bannersFetched: true,
        bannersLoading: false,
      });
      return state.banners.length > 0 ? state.banners : DEMO_BANNERS;
    }
  },

  getReels: async (forceRefresh = false) => {
    const state = get();
    // Cache hit: return immediately without network call
    if (state.reelsFetched && !forceRefresh) {
      return state.reels;
    }

    set({ reelsLoading: true, reelsError: null });
    try {
      const items = await fetchReels();
      if (items && items.length > 0) {
        const sorted = [...items].sort((a, b) => {
          const orderA = a.order ?? 0;
          const orderB = b.order ?? 0;
          if (orderA !== orderB) {
            return orderB - orderA;
          }
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        set({
          reels: sorted,
          reelsFetched: true,
          reelsLoading: false,
        });
        return sorted;
      } else {
        set({
          reels: MOCK_REELS,
          reelsFetched: true,
          reelsLoading: false,
        });
        return MOCK_REELS;
      }
    } catch (err: any) {
      console.warn('Failed to fetch backend reels, using fallback:', err?.message);
      set({
        reelsError: err?.message || 'Failed to load reels',
        reelsFetched: true,
        reelsLoading: false,
      });
      return state.reels.length > 0 ? state.reels : MOCK_REELS;
    }
  },

  getStories: async (forceRefresh = false) => {
    const state = get();
    // Cache hit: return immediately without network call
    if (state.storiesFetched && !forceRefresh) {
      return state.stories;
    }

    set({ storiesLoading: true, storiesError: null });
    try {
      const items: BackendStory[] = await listStories();
      if (items && items.length > 0) {
        const mapped: UserStory[] = items.map((st) => {
          const rawImages: string[] =
            st.images && st.images.length > 0
              ? st.images
              : st.items
              ? st.items.map((it) => it.url)
              : [];

          const storyItems = rawImages.map((img, idx) => ({
            storyId: st.items?.[idx]?.id || `${st.id || st.name}-${idx}`,
            storyLink: resolveStoryImage(img),
            storyUploadTime: st.createdAt ? new Date(st.createdAt).getTime() : Date.now(),
            storyExpiryTime: Date.now() + 86400000 * 365,
            mediaType: (st.items?.[idx]?.mediaType as 'image' | 'video') || 'image',
          }));

          const firstImage = rawImages.length > 0 ? resolveStoryImage(rawImages[0]) : undefined;

          return {
            userId: st.id || st.name,
            name: st.name || 'Event',
            photoURL: firstImage,
            stories: storyItems,
            lastUploadTime: st.createdAt ? new Date(st.createdAt).getTime() : Date.now(),
          };
        });

        set({
          stories: mapped,
          rawStories: items,
          storiesFetched: true,
          storiesLoading: false,
        });
        return mapped;
      } else {
        set({
          stories: [],
          rawStories: [],
          storiesFetched: true,
          storiesLoading: false,
        });
        return [];
      }
    } catch (err: any) {
      console.warn('Failed to fetch backend stories:', err?.message);
      set({
        storiesError: err?.message || 'Failed to load stories',
        storiesFetched: true,
        storiesLoading: false,
      });
      return state.stories.length > 0 ? state.stories : [];
    }
  },

  getVenues: async (forceRefresh = false) => {
    const state = get();
    // Cache hit: return immediately without network call
    if (state.venuesFetched && !forceRefresh && state.venues.length > 0) {
      return state.venues;
    }

    set({ venuesLoading: true, venuesError: null });
    try {
      const items = await listVenues();
      set({
        venues: items || [],
        venuesFetched: true,
        venuesLoading: false,
      });
      return items || [];
    } catch (err: any) {
      console.warn('Failed to fetch backend venues:', err?.message);
      set({
        venuesError: err?.message || 'Failed to load venues',
        venuesFetched: true,
        venuesLoading: false,
      });
      return state.venues;
    }
  },

  invalidateBanners: () => set({ bannersFetched: false }),
  invalidateReels: () => set({ reelsFetched: false }),
  invalidateStories: () => set({ storiesFetched: false }),
  invalidateVenues: () => set({ venuesFetched: false }),
  invalidateAll: () =>
    set({
      bannersFetched: false,
      reelsFetched: false,
      storiesFetched: false,
      venuesFetched: false,
    }),
}));
