import { COMMUNITY_POINT_DETAILS } from '@/services/rewards/rewardService';

describe('community point details', () => {
  it('documents every supported server-awarded activity', () => {
    expect(Object.keys(COMMUNITY_POINT_DETAILS).sort()).toEqual([
      'community_comment',
      'community_post',
      'focus_completion',
      'live_attendance',
      'live_host',
      'live_stage',
      'prayer_support',
      'testimony',
    ]);
  });

  it('uses transparent, user-facing descriptions', () => {
    for (const detail of Object.values(COMMUNITY_POINT_DETAILS)) {
      expect(detail.label.length).toBeGreaterThan(3);
      expect(detail.description.length).toBeGreaterThan(12);
      expect(detail.reward).toContain('point');
    }
  });
});
