import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canViewStoryByPrivacy, isStoryMediaType, isStoryPrivacy, parseAllowedUsers, validateStoryCreatePayload } from '../src/server/stories/storyPrivacy';

const checks = {
  hasDirectThread: (ownerId: string, userId: string) => ownerId === 'owner' && userId === 'contact',
  isCloseFriend: (ownerId: string, userId: string) => ownerId === 'owner' && userId === 'close',
};

describe('story privacy', () => {
  it('validates supported privacy and media values', () => {
    assert.equal(isStoryPrivacy('PUBLIC'), true);
    assert.equal(isStoryPrivacy('CONTACTS'), true);
    assert.equal(isStoryPrivacy('CLOSE_FRIENDS'), true);
    assert.equal(isStoryPrivacy('CUSTOM'), true);
    assert.equal(isStoryPrivacy('PRIVATE'), false);

    assert.equal(isStoryMediaType('image'), true);
    assert.equal(isStoryMediaType('video'), true);
    assert.equal(isStoryMediaType('audio'), false);
  });

  it('parses allowed users defensively', () => {
    assert.deepEqual(parseAllowedUsers(JSON.stringify(['u1', 42, 'u2'])), ['u1', 'u2']);
    assert.deepEqual(parseAllowedUsers('not json'), []);
    assert.deepEqual(parseAllowedUsers(null), []);
  });

  it('rejects invalid story create payloads', () => {
    assert.deepEqual(
      validateStoryCreatePayload({ mediaUrl: '/uploads/a.png', mediaType: 'image', privacy: 'CUSTOM' }),
      { error: 'Custom stories require allowedUsers' },
    );
    assert.deepEqual(
      validateStoryCreatePayload({ mediaUrl: '/uploads/a.png', mediaType: 'image', privacy: 'CUSTOM', allowedUsers: [] }),
      { error: 'Custom stories require allowedUsers' },
    );
    assert.deepEqual(
      validateStoryCreatePayload({ mediaUrl: '/uploads/a.png', mediaType: 'image', privacy: 'CUSTOM', allowedUsers: 'u1' }),
      { error: 'Custom stories require allowedUsers' },
    );
    assert.deepEqual(
      validateStoryCreatePayload({ mediaUrl: '/uploads/a.png', mediaType: 'audio' }),
      { error: 'Invalid media type' },
    );
    assert.deepEqual(
      validateStoryCreatePayload({ mediaUrl: '/uploads/a.png', mediaType: 'image', privacy: 'PRIVATE' }),
      { error: 'Invalid story privacy' },
    );
    assert.deepEqual(
      validateStoryCreatePayload({ mediaUrl: '/uploads/a.png', mediaType: 'image', privacy: 'CUSTOM', allowedUsers: ['u1'] }),
      { privacy: 'CUSTOM' },
    );
  });

  it('allows public stories and owner access', async () => {
    assert.equal(await canViewStoryByPrivacy({ userId: 'owner', privacy: 'PUBLIC' }, 'anyone', checks), true);
    assert.equal(await canViewStoryByPrivacy({ userId: 'owner', privacy: 'CLOSE_FRIENDS' }, 'owner', checks), true);
  });

  it('enforces custom allowedUsers', async () => {
    const story = { userId: 'owner', privacy: 'CUSTOM', allowedUsers: JSON.stringify(['u1']) };
    assert.equal(await canViewStoryByPrivacy(story, 'u1', checks), true);
    assert.equal(await canViewStoryByPrivacy(story, 'u2', checks), false);
    assert.equal(await canViewStoryByPrivacy({ userId: 'owner', privacy: 'CUSTOM' }, 'u1', checks), false);
  });

  it('enforces contacts and close friends using injected access checks', async () => {
    assert.equal(await canViewStoryByPrivacy({ userId: 'owner', privacy: 'CONTACTS' }, 'contact', checks), true);
    assert.equal(await canViewStoryByPrivacy({ userId: 'owner', privacy: 'CONTACTS' }, 'stranger', checks), false);
    assert.equal(await canViewStoryByPrivacy({ userId: 'owner', privacy: 'CLOSE_FRIENDS' }, 'close', checks), true);
    assert.equal(await canViewStoryByPrivacy({ userId: 'owner', privacy: 'CLOSE_FRIENDS' }, 'contact', checks), false);
  });

  it('keeps REST and socket callers on the same privacy decision function', async () => {
    const story = { userId: 'owner' };
    const restLikeChecks = checks;
    const socketLikeChecks = checks;

    assert.equal(await canViewStoryByPrivacy({ ...story, privacy: 'CONTACTS' }, 'contact', restLikeChecks), true);
    assert.equal(await canViewStoryByPrivacy({ ...story, privacy: 'CONTACTS' }, 'contact', socketLikeChecks), true);
    assert.equal(await canViewStoryByPrivacy({ ...story, privacy: 'CLOSE_FRIENDS' }, 'close', restLikeChecks), true);
    assert.equal(await canViewStoryByPrivacy({ ...story, privacy: 'CLOSE_FRIENDS' }, 'close', socketLikeChecks), true);
  });
});
