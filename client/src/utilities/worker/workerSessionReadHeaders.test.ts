import { notePrivateSession } from './workerGroupReadProof';
import { sessionReadHeaders } from './workerSessionReadHeaders';
import { holdSignIn, holdSignInAndProof, TEST_READ_PROOF } from './workerSessionReadHeaders.testUtils';

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

it('sends a sign-in only once the Worker has shown the session private, so older Workers never get one', () => {
  const release = holdSignIn('https://worker.example', 'open');
  try {
    // A 0.9.10 Worker answers a signed-in voice call 404; on a session not known private nothing new is sent.
    expect(sessionReadHeaders('https://worker.example', 'open')).toEqual({});
    notePrivateSession('https://worker.example/', 'open');
    expect(sessionReadHeaders('https://worker.example', 'open')).toEqual({ Authorization: 'Bearer member-token' });
    expect(sessionReadHeaders('https://other.example', 'open')).toEqual({});
  } finally {
    release();
  }
});
