import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { userRepository } from '../repositories/user.repository';
import { getJwtSecret } from '../config/auth';
import { readTokenFromRequest } from '../utils/sessionCookie';

export const authenticateUser = async (req: Request | any, res: Response | any, next: NextFunction | any) => {
  try {
    const token = readTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
    const user = await userRepository.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }
    
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};
