import { sessionReadHeaders } from './workerSessionReadHeaders';
import { holdSignInAndProof, TEST_READ_PROOF } from './workerSessionReadHeaders.testUtils';

it('sends the session’s held sign-in beside its invite proof, and neither for another session', () => {
  expect(sessionReadHeaders('https://worker.example', 'salon')).toEqual({});
  const release = holdSignInAndProof('https://worker.example', 'salon');
  try {
    expect(sessionReadHeaders('https://worker.example/', 'salon')).toEqual({
      'X-CE-Group-Invite': TEST_READ_PROOF,
      Authorization: 'Bearer member-token',
    });
    expect(sessionReadHeaders('https://worker.example', 'edge')).toEqual({});
    expect(sessionReadHeaders('https://other.example', 'salon')).toEqual({});
  } finally {
    release();
  }
});
