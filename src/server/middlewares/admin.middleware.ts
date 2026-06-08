import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { userRepository } from '../repositories/user.repository';
import { getJwtSecret } from '../config/auth';

export const authenticateAdmin = async (req: Request | any, res: Response | any, next: NextFunction | any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
    const user = await userRepository.findById(decoded.userId);
    
    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return res.status(403).json({ error: 'Forbidden: Admin access only' });
    }
    
    req.userId = decoded.userId;
    req.userRole = user.role;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};
