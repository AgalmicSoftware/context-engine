import {
  ADMIN_ACTION_NONCE_RETRY_ATTEMPTS,
  postSignedAdminWorkerRequest as postSignedAdminWorkerRequestImpl,
  sleep,
  type AdminSignedWorkerRequestArgs,
} from '../../utilities/worker/signedAdminWorkerRequest';

export { ADMIN_ACTION_NONCE_RETRY_ATTEMPTS, sleep, type AdminSignedWorkerRequestArgs };

export const postSignedAdminWorkerRequest: typeof postSignedAdminWorkerRequestImpl = async (args) => {
  const requestArgs = args;
  return postSignedAdminWorkerRequestImpl(requestArgs);
};
