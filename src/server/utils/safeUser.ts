const publicFields = (u: any) => ({
  id: u.id,
  nickname: u.nickname,
  nexaId: u.nexaId,
  avatarColor: u.avatarColor,
  avatarImage: u.avatarImage,
  initials: u.initials,
  bio: u.bio,
  publicKey: u.publicKey,
  status: u.status,
});

export type ProfileVisibility = 'PRIVATE' | 'CONTACTS' | 'PUBLIC';

export const normalizeProfileVisibility = (value: unknown): ProfileVisibility => {
  return value === 'CONTACTS' || value === 'PUBLIC' || value === 'PRIVATE' ? value : 'PRIVATE';
};

type ProfileViewOptions = {
  viewerId?: string | null;
  isAdmin?: boolean;
  isContact?: boolean;
};

const canViewPrivateProfileField = (
  owner: any,
  visibility: unknown,
  options: ProfileViewOptions = {},
) => {
  if (!owner) return false;
  if (options.isAdmin || (options.viewerId && options.viewerId === owner.id)) return true;

  const normalized = normalizeProfileVisibility(visibility);
  if (normalized === 'PUBLIC') return true;
  if (normalized === 'CONTACTS') return options.isContact === true;
  return false;
};

export const publicUserDto = (u: any) => {
  if (!u) return u;
  return publicFields(u);
};

export const privateUserDto = (u: any) => {
  if (!u) return u;
  return {
    ...publicFields(u),
    email: u.email,
    phoneNumber: u.phoneNumber,
    firstName: u.firstName,
    lastName: u.lastName,
    dateOfBirth: u.dateOfBirth,
    activityStatus: u.activityStatus,
    emailVisibility: normalizeProfileVisibility(u.emailVisibility),
    phoneVisibility: normalizeProfileVisibility(u.phoneVisibility),
    role: u.role,
    balance: u.balance,
    ownedAvatars: u.ownedAvatars,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
};

export const adminUserDto = (u: any) => privateUserDto(u);

export const profileViewUserDto = (u: any, options: ProfileViewOptions = {}) => {
  if (!u) return u;
  const result: any = publicFields(u);
  result.emailVisibility = normalizeProfileVisibility(u.emailVisibility);
  result.phoneVisibility = normalizeProfileVisibility(u.phoneVisibility);

  if (canViewPrivateProfileField(u, u.emailVisibility, options)) {
    result.email = u.email;
  }
  if (canViewPrivateProfileField(u, u.phoneVisibility, options)) {
    result.phoneNumber = u.phoneNumber;
  }

  return result;
};

export const publicUsersDto = (users: any[]) => users.map(publicUserDto);
export const privateUsersDto = (users: any[]) => users.map(privateUserDto);
export const adminUsersDto = (users: any[]) => users.map(adminUserDto);

// Backward-compatible aliases. The default safe user is public.
export const safeUser = publicUserDto;
export const safeUsers = publicUsersDto;
