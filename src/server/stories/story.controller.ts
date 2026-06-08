import { Request, Response } from 'express';
import { storyRepository } from './story.repository';
import { validateStoryCreatePayload } from './storyPrivacy';

export const storyController = {
  // Create a new story
  createStory: async (req: any, res: Response) => {
    try {
      const { mediaUrl, mediaType, caption, privacy, expiresInHours, allowedUsers } = req.body;
      const userId = req.userId;

      const validation = validateStoryCreatePayload({ mediaUrl, mediaType, privacy, allowedUsers });
      if ('error' in validation) return res.status(400).json({ error: validation.error });
      const normalizedPrivacy = validation.privacy;

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + (expiresInHours || 24)); // Default 24 hours

      const newStory = await storyRepository.create({
        userId,
        mediaUrl,
        mediaType,
        caption,
        privacy: normalizedPrivacy,
        expiresAt,
        allowedUsers: normalizedPrivacy === 'CUSTOM' ? JSON.stringify(allowedUsers) : null,
      });

      // Include user and empty views for real-time broadcast formatting
      const populated = await storyRepository.findById(newStory.id);

      return res.status(201).json(populated);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Failed to create story' });
    }
  },

  // Get active stories for feed
  getActiveStories: async (req: any, res: Response) => {
    try {
      const userId = req.userId;
      const stories = await storyRepository.findActiveForUser(userId);
      res.json(stories);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch stories' });
    }
  },

  // View a story
  viewStory: async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.userId;

      const story = await storyRepository.findById(id);
      if (!(await storyRepository.canUserView(story, userId))) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const viewed = await storyRepository.markAsViewed(id, userId);
      res.json({ success: true, newView: viewed });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Failed to view story' });
    }
  },

  // React to a story
  reactToStory: async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const { emoji } = req.body;
      const userId = req.userId;

      const story = await storyRepository.findById(id);
      if (!(await storyRepository.canUserView(story, userId))) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const reaction = await storyRepository.addReaction(id, userId, emoji);
      res.json({ success: true, reaction });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Failed to react to story' });
    }
  },

  // Get archive
  getArchive: async (req: any, res: Response) => {
    try {
      const userId = req.userId;
      const archive = await storyRepository.findUserArchive(userId);
      res.json(archive);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch archive' });
    }
  },

  // Delete story
  deleteStory: async (req: any, res: Response) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      await storyRepository.deleteStory(id, userId);
      res.json({ success: true });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Failed to delete story' });
    }
  },

  // Get views
  getViews: async (req: any, res: Response) => {
    try {
      const userId = req.userId;
      const { id } = req.params;
      const views = await storyRepository.getStoryViews(id, userId);
      if (!views) return res.status(403).json({ error: 'Access denied' });
      res.json(views);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch views' });
    }
  }
};
