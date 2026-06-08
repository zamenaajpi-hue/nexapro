export const STORY_PRIVACY_VALUES = ['PUBLIC', 'CONTACTS', 'CLOSE_FRIENDS', 'CUSTOM'] as const;
export type StoryPrivacy = typeof STORY_PRIVACY_VALUES[number];

export const STORY_MEDIA_TYPES = ['image', 'video'] as const;
export type StoryMediaType = typeof STORY_MEDIA_TYPES[number];

export type StoryAccessChecks = {
  hasDirectThread: (ownerId: string, userId: string) => Promise<boolean> | boolean;
  isCloseFriend: (ownerId: string, userId: string) => Promise<boolean> | boolean;
};

export function isStoryPrivacy(value: unknown): value is StoryPrivacy {
  return typeof value === 'string' && (STORY_PRIVACY_VALUES as readonly string[]).includes(value);
}

export function isStoryMediaType(value: unknown): value is StoryMediaType {
  return typeof value === 'string' && (STORY_MEDIA_TYPES as readonly string[]).includes(value);
}

export function parseAllowedUsers(allowedUsers: string | null | undefined): string[] {
  if (!allowedUsers) return [];
  try {
    const parsed = JSON.parse(allowedUsers);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function validateStoryCreatePayload(payload: {
  mediaUrl?: unknown;
  mediaType?: unknown;
  privacy?: unknown;
  allowedUsers?: unknown;
}) {
  if (!payload.mediaUrl || !payload.mediaType) {
    return { error: 'Media URL and type are required' as const };
  }
  if (!isStoryMediaType(payload.mediaType)) {
    return { error: 'Invalid media type' as const };
  }
  if (payload.privacy && !isStoryPrivacy(payload.privacy)) {
    return { error: 'Invalid story privacy' as const };
  }

  const privacy = isStoryPrivacy(payload.privacy) ? payload.privacy : 'PUBLIC';
  if (privacy === 'CUSTOM' && (!Array.isArray(payload.allowedUsers) || payload.allowedUsers.length === 0)) {
    return { error: 'Custom stories require allowedUsers' as const };
  }

  return { privacy };
}

export async function canViewStoryByPrivacy(
  story: { userId: string; privacy?: string | null; allowedUsers?: string | null } | null | undefined,
  userId: string,
  checks: StoryAccessChecks,
): Promise<boolean> {
  if (!story) return false;
  if (story.userId === userId) return true;

  const privacy = story.privacy || 'PUBLIC';
  if (privacy === 'PUBLIC') return true;
  if (privacy === 'CUSTOM') return parseAllowedUsers(story.allowedUsers).includes(userId);
  if (privacy === 'CONTACTS') return Boolean(await checks.hasDirectThread(story.userId, userId));
  if (privacy === 'CLOSE_FRIENDS') return Boolean(await checks.isCloseFriend(story.userId, userId));
  return false;
}
