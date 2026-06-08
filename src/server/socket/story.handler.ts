import { Server } from 'socket.io';
import { storyRepository } from '../stories/story.repository';

const notifyStoryCreated = async (io: Server, story: any, onlineUsers: Map<string, any>) => {
  await Promise.all(Array.from(onlineUsers.entries()).map(async ([targetUserId, onlineUser]) => {
    if (targetUserId === story.userId) return;
    if (!(await storyRepository.canUserView(story, targetUserId))) return;
    const targetSocketId = onlineUser?.socketId;
    if (targetSocketId) io.to(targetSocketId).emit('story:new');
  }));
};

export const handleStories = (io: Server, socket: any, onlineUsers: Map<string, any>) => {
  // Client creates a story -> broadcast to others
  socket.on('story:created', async (story: any) => {
    try {
      if (!story?.id) return;
      const dbStory = await storyRepository.findById(story.id);
      if (!dbStory || dbStory.userId !== socket.userId) return;
      await notifyStoryCreated(io, dbStory, onlineUsers);
    } catch (err) {
      console.error('[STORY_SOCKET_ERR] story:created failed:', err);
    }
  });

  // Client views a story -> send to author
  socket.on('story:viewed', async ({ storyId }: any) => {
    try {
      if (!storyId) return;
      const story = await storyRepository.findById(storyId);
      if (!(await storyRepository.canUserView(story, socket.userId))) return;
      const targetSocketId = onlineUsers.get(story.userId)?.socketId;
      if (targetSocketId) {
        io.to(targetSocketId).emit('story:viewUpdate', { storyId, viewerId: socket.userId });
      }
    } catch (err) {
      console.error('[STORY_SOCKET_ERR] story:viewed failed:', err);
    }
  });

  // Client reacts -> send reaction to author
  socket.on('story:react', async (data: any) => {
    try {
      if (!data?.storyId) return;
      const story = await storyRepository.findById(data.storyId);
      if (!(await storyRepository.canUserView(story, socket.userId))) return;
      const targetSocketId = onlineUsers.get(story.userId)?.socketId;
      if (targetSocketId) {
        io.to(targetSocketId).emit('story:reactionAdded', { 
          storyId: data.storyId, 
          reaction: data.reaction,
          viewerId: socket.userId,
        });
      }
    } catch (err) {
      console.error('[STORY_SOCKET_ERR] story:react failed:', err);
    }
  });
};
