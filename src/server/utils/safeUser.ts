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
    role: u.role,
    balance: u.balance,
    ownedAvatars: u.ownedAvatars,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
};

export const adminUserDto = (u: any) => privateUserDto(u);

export const publicUsersDto = (users: any[]) => users.map(publicUserDto);
export const privateUsersDto = (users: any[]) => users.map(privateUserDto);
export const adminUsersDto = (users: any[]) => users.map(adminUserDto);

// Backward-compatible aliases. The default safe user is public.
export const safeUser = publicUserDto;
export const safeUsers = publicUsersDto;
