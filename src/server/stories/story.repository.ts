import { getPrisma } from '../../services/db';
import { safeUser } from '../utils/safeUser';
import { canViewStoryByPrivacy } from './storyPrivacy';

async function hasDirectThread(ownerId: string, userId: string): Promise<boolean> {
  if (ownerId === userId) return true;
  const count = await getPrisma().message.count({
    where: {
      OR: [
        { fromId: ownerId, toUserId: userId },
        { fromId: userId, toUserId: ownerId },
      ],
    },
  });
  return count > 0;
}

async function isCloseFriend(ownerId: string, userId: string): Promise<boolean> {
  if (ownerId === userId) return true;
  const count = await getPrisma().closeFriend.count({
    where: { ownerId, friendId: userId },
  });
  return count > 0;
}

async function canUserViewStory(story: any, userId: string): Promise<boolean> {
  return canViewStoryByPrivacy(story, userId, { hasDirectThread, isCloseFriend });
}

export function safeStory(story: any): any {
  if (!story) return story;
  return {
    ...story,
    user: story.user ? safeUser(story.user) : story.user,
    views: Array.isArray(story.views)
      ? story.views.map((view: any) => ({ ...view, user: view.user ? safeUser(view.user) : view.user }))
      : story.views,
    reactions: Array.isArray(story.reactions)
      ? story.reactions.map((reaction: any) => ({ ...reaction, user: reaction.user ? safeUser(reaction.user) : reaction.user }))
      : story.reactions,
  };
}

export const storyRepository = {
  create: async (data: any) => {
    return await getPrisma().story.create({ data });
  },

  findById: async (id: string, requesterUserId?: string) => {
    const story = await getPrisma().story.findUnique({
      where: { id },
      include: {
        user: true,
        views: requesterUserId ? { where: { userId: requesterUserId } } : false,
      },
    });
    return safeStory(story);
  },

  findActiveForUser: async (userId: string) => {
    const now = new Date();
    
    const stories = await getPrisma().story.findMany({
      where: {
        expiresAt: { gt: now },
        isArchived: false,
      },
      include: {
        user: true,
        views: {
          where: { userId } // fetch views of this user to know if seen
        },
        reactions: true
      },
      orderBy: { createdAt: 'asc' }
    });
    const visible = await Promise.all(stories.map(async (story: any) => (
      await canUserViewStory(story, userId) ? safeStory(story) : null
    )));
    return visible.filter(Boolean);
  },

  findUserArchive: async (userId: string) => {
    const stories = await getPrisma().story.findMany({
      where: {
        userId,
        OR: [
          { expiresAt: { lte: new Date() } },
          { isArchived: true },
          { isHighlight: true }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: {
        views: true,
        reactions: true
      }
    });
    return stories.map(safeStory);
  },

  findUserHighlights: async (targetUserId: string, requesterUserId: string) => {
    const stories = await getPrisma().story.findMany({
      where: {
        userId: targetUserId,
        isHighlight: true,
        OR: [
          { privacy: 'PUBLIC' },
          { userId: requesterUserId },
          { allowedUsers: { not: null } }
        ]
      },
      orderBy: { createdAt: 'asc' },
    });
    const visible = await Promise.all(stories.map(async (story: any) => (
      await canUserViewStory(story, requesterUserId) ? safeStory(story) : null
    )));
    return visible.filter(Boolean);
  },

  canUserView: canUserViewStory,

  markAsViewed: async (storyId: string, userId: string) => {
    try {
      await getPrisma().storyView.create({
        data: {
          storyId,
          userId,
        }
      });
      return true;
    } catch {
      // already viewed
      return false;
    }
  },

  addReaction: async (storyId: string, userId: string, emoji: string) => {
    try {
      const res = await getPrisma().storyReaction.create({
        data: {
          storyId,
          userId,
          emoji,
        }
      });
      return res;
    } catch {
      // maybe already reacted with same emoji, ignore
      return null;
    }
  },
  
  deleteStory: async (id: string, userId: string) => {
    const result = await getPrisma().story.deleteMany({
      where: { id, userId }
    });
    return result.count > 0;
  },

  getStoryViews: async (storyId: string, authorId: string) => {
    // Ensure the requester is the author
    const story = await getPrisma().story.findFirst({
      where: { id: storyId, userId: authorId }
    });
    if (!story) return null;

    const views = await getPrisma().storyView.findMany({
      where: { storyId },
      include: { user: true },
      orderBy: { viewedAt: 'desc' }
    });
    return views.map((view: any) => ({ ...view, user: safeUser(view.user) }));
  }
};
