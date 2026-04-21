import { faker } from '@faker-js/faker';

export interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  banner?: string;
  isVerified: boolean;
  isAthlete: boolean;
  sport: string;
  team?: string;
  bio?: string;
  location?: string;
  followers: string;
  fans: string;
  following: string;
  highlightsCount: number;
}

export interface Post {
  id: string;
  user: User;
  content: string; // Image/Video URL (or empty for text posts)
  assets?: PostAsset[];
  caption: string;
  likes: number;
  comments: number;
  /** Repost count; optional until persisted in backend */
  reposts?: number;
  shares: number;
  timeAgo: string;
  /** ISO timestamp for live relative time on the feed */
  createdAt?: string;
  isLive?: boolean;
  type: 'video' | 'image' | 'text' | 'poll';
  postType?: 'post' | 'clips';
  /** Profile Clips tab: which sub-grid this clip belongs to (video + postType clips). */
  clipsSource?: 'highlights' | 'grinds' | 'clips';
  poll?: PostPoll;
  /** Optional place label attached at compose time (e.g. city or venue). */
  location?: string;
}

export interface PostAsset {
  uri: string;
  type: 'video' | 'image';
}

export type PostPollDurationDays = 1 | 3 | 7;

export interface PostPoll {
  question: string;
  choices: string[];
  durationDays: PostPollDurationDays;
  endsAt?: string;
}

export const CURRENT_USER: User = {
  id: 'u1',
  name: 'Marcus Sterling',
  username: 'marcus_speed',
  avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop',
  isVerified: true,
  isAthlete: true,
  sport: 'Professional Sprinter',
  team: 'Team USA',
  bio: 'Olympic Gold Medalist | 100m & 200m Specialist.\nPushing the boundaries of human speed. Training for Paris 2024. 🏃💨 #TrackAndField #SpeedWork',
  followers: '1.2M',
  fans: '856K',
  following: '482',
  highlightsCount: 84,
};

export const generatePosts = (count: number): Post[] => {
  return Array.from({ length: count }).map(() => {
    const createdMsAgo = faker.helpers.arrayElement([
      30_000, // 30s
      120_000, // 2m
      600_000, // 10m
      3_600_000, // 1h
      7_200_000, // 2h
      86_400_000, // 1d
      604_800_000, // 7d
    ]);
    const createdAt = new Date(Date.now() - createdMsAgo).toISOString();
    return {
      // Keep mock data simple: one asset by default, with schema ready for multi-asset posts.
      id: faker.string.uuid(),
      user: {
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        username: faker.internet.username(),
        avatar: faker.image.avatar(),
        isVerified: faker.datatype.boolean(0.8), // 80% chance of being verified
        isAthlete: true,
        sport: faker.helpers.arrayElement(['Basketball', 'Track & Field', 'Soccer', 'Swimming', 'Tennis']),
        followers: faker.number.int({ min: 1000, max: 1000000 }).toString(),
        fans: faker.number.int({ min: 500, max: 800000 }).toString(),
        following: faker.number.int({ min: 10, max: 500 }).toString(),
        highlightsCount: faker.number.int({ min: 5, max: 100 }),
      },
      content: faker.image.urlPicsumPhotos({ width: 600, height: 800 }), // Using picsum for varied aspect ratios
      assets: undefined,
      caption: faker.lorem.sentence() + ' ' + faker.helpers.arrayElement(['🔥', '💪', '🏆', '🏀', '⚡️']),
      likes: faker.number.int({ min: 100, max: 50000 }),
      comments: faker.number.int({ min: 10, max: 2000 }),
      reposts: faker.number.int({ min: 0, max: 500 }),
      shares: faker.number.int({ min: 5, max: 1000 }),
      timeAgo: '',
      createdAt,
      isLive: faker.datatype.boolean(0.1),
      type: 'image', // Simulating video with image for now
    };
  });
};

export const MOCK_POSTS = generatePosts(10);

/** Minimal follower for list display */
export interface FollowerItem {
  id: string;
  name: string;
  username: string;
  avatar: string;
  isVerified: boolean;
}

export function generateFollowers(count: number): FollowerItem[] {
  return Array.from({ length: count }).map(() => ({
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    username: faker.internet.username(),
    avatar: faker.image.avatar(),
    isVerified: faker.datatype.boolean(0.3),
  }));
}

export const MOCK_FOLLOWERS = generateFollowers(12);
export const MOCK_FANS = generateFollowers(10);
export const MOCK_FOLLOWING = generateFollowers(14);
export const MOCK_SUGGESTED = generateFollowers(8);
/** Larger pool for Connect screen (suggestions + find someone) */
export const MOCK_CONNECT_PEOPLE = generateFollowers(24);
