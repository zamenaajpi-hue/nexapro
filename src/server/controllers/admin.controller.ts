import { Request, Response } from 'express';
import { adminService } from '../services/admin.service';
import { userRepository } from '../repositories/user.repository';

export const adminController = {
  getStats: async (req: Request, res: Response) => {
    try {
      const stats = await adminService.getStats();
      res.json(stats);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  },

  getUsers: async (req: Request, res: Response) => {
    try {
      const users = await adminService.getUsers();
      res.json(users);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  },

  updateUserRole: async (req: Request | any, res: Response | any) => {
    try {
      const { role } = req.body;
      const targetUserId = req.params.id;
      const requesterRole = req.userRole;

      // Fetch target user's current role
      const targetUser = await userRepository.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Security Check:
      if (requesterRole !== 'owner') {
        // Regular admin cannot promote anyone to admin/owner, or demote other admins/owners
        if (role === 'admin' || role === 'owner' || targetUser.role === 'admin' || targetUser.role === 'owner') {
          return res.status(403).json({ error: 'Permission denied: Only the Nexa Owner can manage admin or owner roles' });
        }
      }

      const updated = await adminService.updateUserRole(targetUserId, role);
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update user role' });
    }
  },

  deleteUser: async (req: Request | any, res: Response | any) => {
    try {
      const targetUserId = req.params.id;
      const requesterRole = req.userRole;

      if (targetUserId === req.userId) {
        return res.status(400).json({ error: 'Cannot delete yourself' });
      }

      const targetUser = await userRepository.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Security Check:
      if (requesterRole !== 'owner') {
        // Regular admins can only delete regular accounts (role "user" or empty)
        if (targetUser.role === 'admin' || targetUser.role === 'owner') {
          return res.status(403).json({ error: 'Permission denied: Only the Nexa Owner can delete admins or owners' });
        }
      }
      
      await adminService.deleteUser(targetUserId);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  },

  getGroups: async (req: Request, res: Response) => {
    try {
      const groups = await adminService.getGroups();
      res.json(groups);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch groups' });
    }
  },

  deleteGroup: async (req: Request, res: Response) => {
    try {
      await adminService.deleteGroup(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete group' });
    }
  },

  getMessages: async (req: Request, res: Response) => {
    try {
      const messages = await adminService.getMessages();
      res.json(messages);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  },

  deleteMessage: async (req: Request, res: Response) => {
    try {
      await adminService.deleteMessage(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete message' });
    }
  }
};
