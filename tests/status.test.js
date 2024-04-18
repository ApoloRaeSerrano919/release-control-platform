const {ReleaseStatus} = require('../src/domain/releaseStatus');

test('contains rollback states', () => {
  expect(ReleaseStatus.ROLLBACK_QUEUED).toBe('ROLLBACK_QUEUED');
  expect(ReleaseStatus.ROLLED_BACK).toBe('ROLLED_BACK');
});
