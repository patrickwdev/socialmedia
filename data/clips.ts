import { faker } from '@faker-js/faker';

export type ClipUser = {
  name: string;
  username: string;
  avatar: string;
  isVerified: boolean;
};

export type ClipItem = {
  id: string;
  user: ClipUser;
  videoPlaceholder: string;
  caption: string;
  tags: string[];
  likes: number;
  comments: number;
  shares: number;
  music: string;
};

const CAPTION_TAGS = ['#athlete', '#highlights', '#gameday', '#nextup'];

export const CLIPS: ClipItem[] = Array.from({ length: 10 }).map((_, i) => ({
  id: i.toString(),
  user: {
    name: faker.person.fullName(),
    username: faker.internet.username(),
    avatar: faker.image.avatar(),
    isVerified: faker.datatype.boolean(),
  },
  videoPlaceholder: faker.image.urlPicsumPhotos({ width: 600, height: 1000 }),
  caption: faker.lorem.sentence(),
  tags: CAPTION_TAGS,
  likes: faker.number.int({ min: 1000, max: 50000 }),
  comments: faker.number.int({ min: 50, max: 2000 }),
  shares: faker.number.int({ min: 10, max: 5000 }),
  music: 'Original Audio - ' + faker.person.fullName(),
}));

