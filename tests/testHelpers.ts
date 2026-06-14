export const leakedUserFields = [
  'socketId',
  'email',
  'phoneNumber',
  'googleSub',
  'dateOfBirth',
  'role',
  'balance',
  'passwordHash',
  'resetToken',
  'pushTokens',
  'fcmToken',
  'apnsToken',
  'expoPushToken',
];

export const assertNoLeakedUserFields = (value: Record<string, unknown>) => {
  leakedUserFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(value, field)) {
      throw new Error(`${field} leaked`);
    }
  });
};
