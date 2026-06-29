import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import SBT_FACTORY_ABI from '../../client/src/contractsABI/SBT_FACTORY_ABI.json';
import SURVEYS_ABI from '../../client/src/contractsABI/SURVEYS_ABI.json';
import * as localArweaveDb from '../helpers/localArweaveDb.js';

import contractScripts from '../../client/src/utilities/web3/contractScripts.js';
import { arweaveScripts } from '../../client/src/utilities/arweave/arweaveScripts.js';

const LOCAL_RPC_URL = process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8545';
const utils = ethers.utils || {
  hexlify: ethers.hexlify,
  hexZeroPad: (value, length) => ethers.zeroPadValue(value, length),
  Interface: ethers.Interface,
  id: ethers.id,
  keccak256: ethers.keccak256,
  toUtf8Bytes: ethers.toUtf8Bytes,
  solidityKeccak256: (types, values) => ethers.solidityPackedKeccak256(types, values),
};

const createEip1193Provider = (provider, getActiveAccount) => {
  const normalizeCall = (methodOrPayload, params) => {
    if (typeof methodOrPayload === 'string') {
      return { method: methodOrPayload, params: params || [] };
    }
    if (methodOrPayload && typeof methodOrPayload.method === 'string') {
      return { method: methodOrPayload.method, params: methodOrPayload.params || [] };
    }
    throw new Error('Unsupported JSON-RPC call');
  };
  const send = (methodOrPayload, params) => {
    const { method, params: callParams } = normalizeCall(methodOrPayload, params);
    const activeAccount = getActiveAccount ? getActiveAccount() : null;
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
      return Promise.resolve(activeAccount ? [activeAccount] : []);
    }
    if (method === 'eth_sendTransaction' && Array.isArray(callParams) && callParams[0]) {
      const tx = { ...callParams[0] };
      if (!tx.from && activeAccount) {
        tx.from = activeAccount;
      }
      return provider.send(method, [tx]);
    }
    return provider.send(method, callParams || []);
  };
  const request = async ({ method, params }) => send(method, params || []);
  const sendAsync = (payload, callback) => {
    send(payload)
      .then((result) => callback(null, { id: payload.id, jsonrpc: '2.0', result }))
      .catch((error) => callback(error, null));
  };
  return { request, send, sendAsync };
};

const loadLocalContracts = () => {
  const contractsPath = path.resolve(__dirname, '../../client/src/variables/local-contracts.json');
  const raw = fs.readFileSync(contractsPath, 'utf8');
  return JSON.parse(raw);
};

const RUN_LOCAL_CHAIN_TESTS = process.env.CE_RUN_LOCAL_CHAIN_TESTS === '1';
const describeLocal = RUN_LOCAL_CHAIN_TESTS ? describe : describe.skip;

describeLocal('contractScripts surveys + SBT (local)', () => {
  jest.setTimeout(60000);

  const initArweaveMock = () => {
    let counter = 1;
    const nextTxId = () => {
      const hex = utils.hexZeroPad(utils.hexlify(counter), 32);
      counter += 1;
      return arweaveScripts.hexToBase64url(hex);
    };

    arweaveScripts.uploadDataToArweave = async (data) => {
      const txId = nextTxId();
      const payload = typeof data === 'string' ? data : JSON.stringify(data || {});
      localArweaveDb.put(txId, payload);
      return txId;
    };

    arweaveScripts.downloadDataFromArweave = async (txId) =>
      localArweaveDb.get(txId) || JSON.stringify({});
  };

  let groupCfg;
  let account;
  let accountTwo;
  let accounts = [];
  let activeAccountIndex = 0;
  let rpcProvider;
  const groupName = 'contextEngine';
  const setActiveAccount = (index) => {
    activeAccountIndex = index;
  };
  const getActiveAccount = () => accounts[activeAccountIndex];
  const advanceTime = async (seconds) => {
    const latest = await rpcProvider.getBlock('latest');
    const baseTime = latest?.timestamp || Math.floor(Date.now() / 1000);
    const target = baseTime + seconds;
    const trySend = async (method, params) => {
      try {
        await rpcProvider.send(method, params);
        return true;
      } catch (_) {
        return false;
      }
    };

    const setOk =
      (await trySend('evm_setNextBlockTimestamp', [target])) ||
      (await trySend('anvil_setNextBlockTimestamp', [target]));

    if (!setOk) {
      const delta = Math.max(1, target - baseTime);
      await trySend('evm_increaseTime', [delta]) || await trySend('anvil_increaseTime', [delta]);
    }

    await trySend('evm_mine', []) || await trySend('anvil_mine', []);

    const after = await rpcProvider.getBlock('latest');
    if ((after?.timestamp || 0) < target) {
      const delta = target - (after?.timestamp || 0);
      await trySend('evm_increaseTime', [delta]) || await trySend('anvil_increaseTime', [delta]);
      await trySend('evm_mine', []) || await trySend('anvil_mine', []);
    }
  };

  beforeAll(async () => {
    initArweaveMock();
    const local = loadLocalContracts();
    const chainId = Number(local.chainId || 31337);
    groupCfg = {
      slug: 'contextEngine',
      sessionName: 'contextEngine',
      networkChainId: chainId,
      contracts: {
        surveys: { address: local.Surveys, chainId },
        sbtFactory: { address: local.SBTFactory, chainId },
      },
    };

    const JsonRpcProvider = ethers.providers?.JsonRpcProvider || ethers.JsonRpcProvider;
    rpcProvider = new JsonRpcProvider(LOCAL_RPC_URL);
    accounts = await rpcProvider.listAccounts();
    account = accounts[0];
    accountTwo = accounts[1];

    window.ethereum = createEip1193Provider(rpcProvider, getActiveAccount);
  });

  beforeEach(() => {
    setActiveAccount(0);
    localArweaveDb.reset();
  });

  afterAll(() => {
    localArweaveDb.cleanup();
  });

  const readArweavePayloads = () => {
    const db = localArweaveDb.readDb();
    return Object.values(db || {})
      .map((payload) => {
        try {
          return JSON.parse(payload);
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean);
  };

  const findArweavePayload = (predicate) =>
    readArweavePayloads().find((payload) => predicate(payload));

  const buildTokenUriData = (overrides = {}) => ({
    name: overrides.name || 'ContextEngine Group',
    description: overrides.description || 'contextEngine test token',
    image: overrides.image || 'https://arweave.example.test/EXAMPLE_IMAGE_TX_ID',
    burnAuth: overrides.burnAuth || 'AdminOnly',
    network: overrides.network || 'Anvil',
    unlisted: overrides.unlisted ?? false,
    tags: overrides.tags || ['contextEngine'],
    maxTokens: overrides.maxTokens ?? 0,
    hasPasswordMint: overrides.hasPasswordMint ?? false,
    chainID: groupCfg?.networkChainId || 31337,
    creator: account,
    documentIDHashes: overrides.documentIDHashes || [],
    documentURLs: overrides.documentURLs || [],
    groupName,
  });

  const uploadTokenUri = async (overrides = {}) => {
    const payload = buildTokenUriData(overrides);
    const txId = await arweaveScripts.uploadDataToArweave(JSON.stringify(payload), 'json', {
      arweaveJwk: '',
    });
    return { txId, payload };
  };

  const createSbtAndGetAddress = async (args, tokenUriOverrides = {}) => {
    const { txId, payload } = await uploadTokenUri(tokenUriOverrides);
    if (!txId) {
      throw new Error('Missing tokenURI txId for SBT creation.');
    }
    const [
      providerName,
      name,
      symbol,
      limitedNumber,
      adminAddress,
      mintingEndTime,
      hasPasswordMint,
      burnAuth,
      hashedPasswords,
      _tokenUri,
      groupPasswordHash,
      groupCfgArg,
      create2Salt = '',
      createOptions = {},
    ] = args;
    const receipt = await contractScripts.createSBT(
      providerName,
      name,
      symbol,
      limitedNumber,
      adminAddress,
      mintingEndTime,
      hasPasswordMint,
      burnAuth,
      hashedPasswords,
      txId,
      groupPasswordHash,
      groupCfgArg,
      create2Salt,
      createOptions
    );
    expect(receipt).toBeTruthy();

    const storedTokenUri = localArweaveDb.get(txId);
    expect(storedTokenUri).toBe(JSON.stringify(payload));

    const iface = new utils.Interface(SBT_FACTORY_ABI);
    const topic = iface.getEventTopic('SBTCreated');
    const log = receipt.logs.find((entry) => entry.topics && entry.topics[0] === topic);
    const parsed = log ? iface.parseLog(log) : null;
    expect(parsed).toBeTruthy();
    return parsed.args.sbtAddress || parsed.args[0];
  };

  const createScopedSignatureSbtAndGetAddress = async ({
    name,
    symbol,
    limitedNumber = 0,
    hasPasswordMint = false,
    groupPassword,
    tokenUriOverrides = {},
    create2Salt = `test/${symbol.toLowerCase()}`,
  }) => {
    const predictedAddress = await contractScripts.predictSBTAddress(
      'none',
      name,
      symbol,
      limitedNumber,
      account,
      0,
      hasPasswordMint,
      3,
      [],
      '',
      ethers.constants.HashZero,
      groupCfg,
      create2Salt,
      { useConfiguredDeterministic: true, initializeGroupPasswordHash: true }
    );

    const groupPasswordHash = contractScripts.computeGroupPasswordHash({
      password: groupPassword,
      sbtAddress: predictedAddress,
    });

    const sbtAddress = await createSbtAndGetAddress([
      'wagmi',
      name,
      symbol,
      limitedNumber,
      account,
      0,
      hasPasswordMint,
      3,
      [],
      '',
      groupPasswordHash,
      groupCfg,
      create2Salt,
      { useConfiguredDeterministic: true, initializeGroupPasswordHash: true },
    ], tokenUriOverrides);

    expect(sbtAddress).toBe(predictedAddress);
    return { sbtAddress, groupPasswordHash };
  };

  it('creates surveys, questions, and responses on-chain', async () => {
    const surveyId = 'survey-contextengine-1';
    const questionIds = ['question-ce-1', 'question-ce-2'];
    const creationBlock = await rpcProvider.getBlockNumber();
    const surveyData = {
      surveyID: surveyId,
      title: 'ContextEngine Research Sprint',
      questionIDs: questionIds,
      creator: account,
      documentURLs: ['https://example.example.test/context-engine'],
      groupName,
      creationBlock,
    };
    const questionData = [
      {
        id: questionIds[0],
        type: 'multichoice',
        prompt: 'Which features matter most to you?',
        options: ['Privacy', 'Speed', 'Integrations'],
        tags: ['product', 'priorities'],
        creator: account,
        associatedSurveyId: surveyId,
        groupName,
      },
      {
        id: questionIds[1],
        type: 'binary',
        prompt: 'Would you join the next sprint?',
        options: undefined,
        tags: ['community'],
        creator: account,
        associatedSurveyId: surveyId,
        groupName,
      },
    ];

    const surveyCreateResult = await contractScripts.addSurveyWithQuestions(
      'wagmi',
      surveyId,
      surveyData,
      questionIds,
      questionData,
      groupCfg
    );

    expect(surveyCreateResult?.receipt).toBeTruthy();
    expect(surveyCreateResult?.surveyArweaveTxId).toBeTruthy();
    expect(surveyCreateResult?.uploadedQuestions).toHaveLength(2);

    const surveyPayload = findArweavePayload((payload) => payload.surveyID === surveyId);
    const firstQuestionPayload = findArweavePayload((payload) => payload.id === questionIds[0]);
    const secondQuestionPayload = findArweavePayload((payload) => payload.id === questionIds[1]);
    expect(surveyPayload).toMatchObject({
      surveyID: surveyId,
      title: 'ContextEngine Research Sprint',
      questionIDs: questionIds,
      creator: account,
      documentURLs: ['https://example.example.test/context-engine'],
      groupName,
      sessionName: groupName,
      sessionSlug: groupName,
    });
    expect(surveyPayload.creationBlock).toBe(creationBlock);
    expect(firstQuestionPayload).toMatchObject({
      id: questionIds[0],
      type: 'multichoice',
      prompt: 'Which features matter most to you?',
      options: ['Privacy', 'Speed', 'Integrations'],
      tags: ['product', 'priorities'],
      creator: account,
      associatedSurveyId: surveyId,
      groupName,
      sessionName: groupName,
      sessionSlug: groupName,
    });
    expect(secondQuestionPayload).toMatchObject({
      id: questionIds[1],
      type: 'binary',
      prompt: 'Would you join the next sprint?',
      tags: ['community'],
      creator: account,
      associatedSurveyId: surveyId,
      groupName,
      sessionName: groupName,
      sessionSlug: groupName,
    });

    const storedSurvey = await contractScripts.getSurveyDataById('none', surveyId, groupCfg, {
      throwOnFailure: true,
      forceArweaveFetch: true,
    });
    expect(storedSurvey).toMatchObject({
      surveyID: surveyId,
      title: surveyData.title,
      questionIDs: questionIds,
    });

    const storedFirstQuestion = await contractScripts.getQuestionData('none', questionIds[0], groupCfg, {
      throwOnFailure: true,
      forceArweaveFetch: true,
    });
    expect(storedFirstQuestion).toMatchObject({
      id: questionIds[0],
      type: 'multichoice',
      prompt: questionData[0].prompt,
      options: ['Privacy', 'Speed', 'Integrations'],
      associatedSurveyId: surveyId,
    });

    const standaloneQuestionId = 'question-standalone';
    const standaloneCreateResult = await contractScripts.addQuestions(
      'wagmi',
      [standaloneQuestionId],
      [{
        id: standaloneQuestionId,
        type: 'freeform',
        prompt: 'Standalone',
        tags: [],
        creator: account,
        associatedSurveyId: ethers.constants.HashZero,
        groupName,
      }],
      [ethers.constants.HashZero],
      groupCfg
    );
    expect(standaloneCreateResult?.receipt).toBeTruthy();
    expect(standaloneCreateResult?.uploadedQuestions).toHaveLength(1);
    const standaloneQuestionPayload = findArweavePayload((payload) => payload.id === standaloneQuestionId);
    expect(standaloneQuestionPayload).toMatchObject({
      id: standaloneQuestionId,
      type: 'freeform',
      prompt: 'Standalone',
      tags: [],
      creator: account,
      associatedSurveyId: ethers.constants.HashZero,
      groupName,
      sessionName: groupName,
      sessionSlug: groupName,
    });

    const questionResponses = [
      {
        questionID: questionIds[0],
        responder: account,
        type: 'multichoice',
        prompt: questionData[0].prompt,
        conviction: 3,
        importance: 2,
        answer: {
          value: ['Privacy', 'Speed'],
          encrypted: false,
          hash: '',
          encryptedPortion: '',
        },
        additional: {
          value: 'Privacy is critical.',
          encrypted: false,
          hash: '',
          encryptedPortion: '',
        },
      },
      {
        questionID: questionIds[1],
        responder: account,
        type: 'binary',
        prompt: questionData[1].prompt,
        conviction: 1,
        importance: 1,
        answer: {
          value: true,
          encrypted: false,
          hash: '',
          encryptedPortion: '',
        },
        additional: {
          value: '',
          encrypted: false,
          hash: '',
          encryptedPortion: '',
        },
      },
    ];
    const surveyResponse = {
      surveyTitle: surveyData.title,
      surveyID: surveyId,
      responder: account,
      timeStamp: Date.now(),
      groupName,
      responses: questionResponses,
    };

    const submitReceipt = await contractScripts.submitResponses(
      'wagmi',
      questionIds,
      questionResponses,
      surveyId,
      surveyResponse,
      groupCfg
    );

    expect(submitReceipt).toBeTruthy();

    const surveyResponsePayload = findArweavePayload((payload) => payload.surveyID === surveyId && Array.isArray(payload.responses));
    const firstQuestionResponsePayload = findArweavePayload((payload) => payload.questionID === questionIds[0]);
    const secondQuestionResponsePayload = findArweavePayload((payload) => payload.questionID === questionIds[1]);
    expect(surveyResponsePayload).toMatchObject({
      surveyTitle: surveyData.title,
      surveyID: surveyId,
      responder: account,
      groupName,
      responses: expect.arrayContaining([
        expect.objectContaining({
          questionID: questionIds[0],
          answer: expect.objectContaining({ value: ['Privacy', 'Speed'], encrypted: false }),
          additional: expect.objectContaining({ value: 'Privacy is critical.', encrypted: false }),
        }),
        expect.objectContaining({
          questionID: questionIds[1],
          answer: expect.objectContaining({ value: true, encrypted: false }),
        }),
      ]),
    });
    expect(surveyResponsePayload.responses).toHaveLength(2);
    expect(firstQuestionResponsePayload).toMatchObject({
      questionID: questionIds[0],
      responder: account,
      type: 'multichoice',
      prompt: questionData[0].prompt,
      conviction: 3,
      importance: 2,
      answer: expect.objectContaining({
        value: ['Privacy', 'Speed'],
        encrypted: false,
      }),
      additional: expect.objectContaining({
        value: 'Privacy is critical.',
        encrypted: false,
      }),
    });
    expect(secondQuestionResponsePayload).toMatchObject({
      questionID: questionIds[1],
      responder: account,
      type: 'binary',
      prompt: questionData[1].prompt,
      conviction: 1,
      importance: 1,
      answer: expect.objectContaining({
        value: true,
        encrypted: false,
      }),
    });

    const firstResponseHash = await contractScripts.getResponseHash('none', account, questionIds[0], groupCfg, {
      throwOnError: true,
    });
    const surveyResponseHash = await contractScripts.getResponseHash('none', account, surveyId, groupCfg, {
      throwOnError: true,
    });
    expect(firstResponseHash).toBeTruthy();
    expect(surveyResponseHash).toBeTruthy();

    const storedFirstResponse = await contractScripts.getResponse('none', account, questionIds[0], groupCfg, {
      throwOnFailure: true,
      forceArweaveFetch: true,
    });
    const storedSurveyResponse = await contractScripts.getSurveyResponse('none', account, surveyId, groupCfg, {
      throwOnFailure: true,
      forceArweaveFetch: true,
    });
    expect(storedFirstResponse).toMatchObject({
      questionID: questionIds[0],
      responder: account,
      answer: expect.objectContaining({ value: ['Privacy', 'Speed'] }),
      additional: expect.objectContaining({ value: 'Privacy is critical.' }),
    });
    expect(storedSurveyResponse).toMatchObject({
      surveyID: surveyId,
      responder: account,
      responses: expect.arrayContaining([
        expect.objectContaining({ questionID: questionIds[0] }),
        expect.objectContaining({ questionID: questionIds[1] }),
      ]),
    });
  });

  it('creates a public SBT and mints via contractScripts', async () => {
    const sbtAddress = await createSbtAndGetAddress([
      'wagmi',
      'ContextEngine Public',
      'CEPUB',
      0,
      account,
      0,
      false,
      3,
      [],
      '',
      ethers.constants.HashZero,
      groupCfg,
    ], {
      name: 'ContextEngine Public',
      hasPasswordMint: false,
      maxTokens: 0,
      tags: ['contextEngine', 'public'],
    });

    await contractScripts.claim('wagmi', sbtAddress);

    const minted = await contractScripts.getMintedTokens('none', sbtAddress, groupCfg);
    expect(Number(minted)).toBeGreaterThan(0);
  });

  it('prefers on-chain collection burn auth over stale tokenURI burnAuth metadata', async () => {
    const sbtAddress = await createSbtAndGetAddress([
      'wagmi',
      'ContextEngine Burn Auth',
      'CEBA',
      0,
      account,
      0,
      false,
      2,
      [],
      '',
      ethers.constants.HashZero,
      groupCfg,
    ], {
      name: 'ContextEngine Burn Auth',
      hasPasswordMint: false,
      maxTokens: 0,
      burnAuth: 'AdminOnly',
      tags: ['contextEngine', 'burnAuth'],
    });

    const metadata = await contractScripts.getSbtMetadata('none', sbtAddress, groupCfg);

    expect(metadata?.burnAuth).toBe(2);
  });

  it('burns an SBT via contractScripts', async () => {
    const sbtAddress = await createSbtAndGetAddress([
      'wagmi',
      'ContextEngine Burn',
      'CEBRN',
      0,
      account,
      0,
      false,
      2,
      [],
      '',
      ethers.constants.HashZero,
      groupCfg,
    ], {
      name: 'ContextEngine Burn',
      hasPasswordMint: false,
      maxTokens: 0,
      tags: ['contextEngine', 'burn'],
    });

    await contractScripts.claim('wagmi', sbtAddress);
    const tokenId = await contractScripts.getSBTTokenIdByOwner('none', sbtAddress, account, groupCfg);
    expect(Number(tokenId)).toBeGreaterThan(0);

    await contractScripts.burnToken('wagmi', sbtAddress, tokenId);

    const ownerAfter = await contractScripts.getOwnerByTokenId('none', sbtAddress, tokenId, groupCfg);
    expect(ownerAfter).toBeNull();
  });

  it('mints a password-gated SBT with generated passwords', async () => {
    const passwords = ['alpha-pass', 'beta-pass'];
    const hashed = passwords.map((pw) => utils.keccak256(utils.toUtf8Bytes(pw)));

    const sbtAddress = await createSbtAndGetAddress([
      'wagmi',
      'ContextEngine Password',
      'CEPW',
      0,
      account,
      0,
      true,
      3,
      hashed,
      '',
      ethers.constants.HashZero,
      groupCfg,
    ], {
      name: 'ContextEngine Password',
      hasPasswordMint: true,
      maxTokens: 0,
      tags: ['contextEngine', 'password'],
    });

    const validBefore = await contractScripts.isPasswordValid('none', sbtAddress, hashed[0], groupCfg);
    expect(validBefore).toBe(true);

    const commit = utils.solidityKeccak256(['string', 'address'], [passwords[0], account]);
    await contractScripts.startClaim('wagmi', sbtAddress, commit);

    await advanceTime(6);

    await expect(
      contractScripts.claimWithPassword('wagmi', sbtAddress, 'wrong-pass')
    ).rejects.toThrow();

    await contractScripts.claimWithPassword('wagmi', sbtAddress, passwords[0]);

    const mintedAfter = await contractScripts.getMintedTokens('none', sbtAddress, groupCfg);
    expect(Number(mintedAfter)).toBe(1);

    const untouched = await contractScripts.isPasswordValid('none', sbtAddress, hashed[1], groupCfg);
    expect(untouched).toBe(true);
  });

  it('adds hashed passwords after creation and mints', async () => {
    const password = 'gamma-pass';
    const initialHashed = utils.keccak256(utils.toUtf8Bytes('starter-pass'));
    const hashed = utils.keccak256(utils.toUtf8Bytes(password));

    const sbtAddress = await createSbtAndGetAddress([
      'wagmi',
      'ContextEngine Invites',
      'CEINV',
      0,
      account,
      0,
      true,
      3,
      [initialHashed],
      '',
      ethers.constants.HashZero,
      groupCfg,
    ], {
      name: 'ContextEngine Invites',
      hasPasswordMint: true,
      maxTokens: 0,
      tags: ['contextEngine', 'invite'],
    });

    await contractScripts.addHashedPasswords('wagmi', sbtAddress, [hashed]);

    const valid = await contractScripts.isPasswordValid('none', sbtAddress, hashed, groupCfg);
    expect(valid).toBe(true);

    const commit = utils.solidityKeccak256(['string', 'address'], [password, account]);
    await contractScripts.startClaim('wagmi', sbtAddress, commit);
    await advanceTime(6);
    await contractScripts.claimWithPassword('wagmi', sbtAddress, password);

    const minted = await contractScripts.getMintedTokens('none', sbtAddress, groupCfg);
    expect(Number(minted)).toBe(1);
  });

  it('mints with group-password signature', async () => {
    const groupPassword = 'group-secret';
    const { sbtAddress, groupPasswordHash } = await createScopedSignatureSbtAndGetAddress({
      name: 'ContextEngine Group',
      symbol: 'CEGRP',
      groupPassword,
      tokenUriOverrides: {
      name: 'ContextEngine Group',
      hasPasswordMint: false,
      maxTokens: 0,
      tags: ['contextEngine', 'group'],
      },
    });

    const onchainHash = await contractScripts.getGroupPasswordHash('none', sbtAddress, groupCfg);
    expect(onchainHash).toBe(groupPasswordHash);

    const signature = await contractScripts.signGroupMintAuthorization({
      password: groupPassword,
      sbtAddress,
      userAddress: account,
    });

    await contractScripts.mintWithGroupSignature('wagmi', sbtAddress, signature);

    const minted = await contractScripts.getMintedTokens('none', sbtAddress, groupCfg);
    expect(Number(minted)).toBe(1);
  });

  it('rejects public claim when the SBT is in group-signature mode', async () => {
    const groupPassword = 'group-claim-blocked';
    const { sbtAddress } = await createScopedSignatureSbtAndGetAddress({
      name: 'ContextEngine Group Locked',
      symbol: 'CEGRLOCK',
      groupPassword,
      tokenUriOverrides: {
      name: 'ContextEngine Group Locked',
      hasPasswordMint: false,
      maxTokens: 0,
      tags: ['contextEngine', 'group'],
      },
    });

    await expect(contractScripts.claim('wagmi', sbtAddress)).rejects.toThrow(/Public claim not enabled/);
  });

  it('mints with invite signature payloads', async () => {
    const groupPassword = 'invite-secret';
    const { sbtAddress } = await createScopedSignatureSbtAndGetAddress({
      name: 'ContextEngine Invite',
      symbol: 'CEINV2',
      limitedNumber: 5,
      hasPasswordMint: true,
      groupPassword,
      tokenUriOverrides: {
      name: 'ContextEngine Invite',
      hasPasswordMint: true,
      maxTokens: 5,
      tags: ['contextEngine', 'invite'],
      },
    });

    const invites = await contractScripts.generateInvitePayloads({
      password: groupPassword,
      sbtAddress,
      nonces: [1],
    });

    expect(invites.length).toBe(1);

    await contractScripts.claimWithInvite(
      'wagmi',
      sbtAddress,
      Number(invites[0].nonce),
      invites[0].signature
    );

    const minted = await contractScripts.getMintedTokens('none', sbtAddress, groupCfg);
    expect(Number(minted)).toBe(1);
  });

  it('rejects public claim when the SBT is in invite mode', async () => {
    const groupPassword = 'invite-claim-blocked';
    const { sbtAddress } = await createScopedSignatureSbtAndGetAddress({
      name: 'ContextEngine Invite Locked',
      symbol: 'CEINVLOCK',
      limitedNumber: 2,
      hasPasswordMint: true,
      groupPassword,
      tokenUriOverrides: {
      name: 'ContextEngine Invite Locked',
      hasPasswordMint: true,
      maxTokens: 2,
      tags: ['contextEngine', 'invite'],
      },
    });

    await expect(contractScripts.claim('wagmi', sbtAddress)).rejects.toThrow(/Public claim not enabled/);
  });

  it('rejects startClaim when password mint is disabled', async () => {
    const sbtAddress = await createSbtAndGetAddress([
      'wagmi',
      'ContextEngine No Password',
      'CENOPW',
      0,
      account,
      0,
      false,
      3,
      [],
      '',
      ethers.constants.HashZero,
      groupCfg,
    ], {
      name: 'ContextEngine No Password',
      hasPasswordMint: false,
      maxTokens: 0,
      tags: ['contextEngine', 'public'],
    });

    const commit = utils.solidityKeccak256(['string', 'address'], ['pw', account]);
    await expect(contractScripts.startClaim('wagmi', sbtAddress, commit)).rejects.toThrow();
  });

  it('blocks minting after mintingEndTime', async () => {
    const now = (await rpcProvider.getBlock('latest')).timestamp;
    const sbtAddress = await createSbtAndGetAddress([
      'wagmi',
      'ContextEngine Timed',
      'CETIME',
      0,
      account,
      now - 1,
      false,
      3,
      [],
      '',
      ethers.constants.HashZero,
      groupCfg,
    ], {
      name: 'ContextEngine Timed',
      hasPasswordMint: false,
      maxTokens: 0,
      tags: ['contextEngine', 'timed'],
    });

    await expect(contractScripts.claim('wagmi', sbtAddress)).rejects.toThrow();
  });

  it('does not mint on invalid invite nonce', async () => {
    const groupPassword = 'invite-bad-nonce';
    const { sbtAddress } = await createScopedSignatureSbtAndGetAddress({
      name: 'ContextEngine Invite Bad',
      symbol: 'CEINVX',
      limitedNumber: 1,
      hasPasswordMint: true,
      groupPassword,
      tokenUriOverrides: {
      name: 'ContextEngine Invite Bad',
      hasPasswordMint: true,
      maxTokens: 0,
      tags: ['contextEngine', 'invite'],
      },
    });

    const invites = await contractScripts.generateInvitePayloads({
      password: groupPassword,
      sbtAddress,
      nonces: [2],
    });

    await expect(
      contractScripts.claimWithInvite(
        'wagmi',
        sbtAddress,
        Number(invites[0].nonce),
        invites[0].signature
      )
    ).rejects.toThrow(/InvalidNonce/);

    const minted = await contractScripts.getMintedTokens('none', sbtAddress, groupCfg);
    expect(Number(minted)).toBe(0);
  });

  it('enforces maxTokens across multiple wallets', async () => {
    const sbtAddress = await createSbtAndGetAddress([
      'wagmi',
      'ContextEngine Limited',
      'CELIM',
      1,
      account,
      0,
      false,
      3,
      [],
      '',
      ethers.constants.HashZero,
      groupCfg,
    ], {
      name: 'ContextEngine Limited',
      hasPasswordMint: false,
      maxTokens: 1,
      tags: ['contextEngine', 'limited'],
    });

    await contractScripts.claim('wagmi', sbtAddress);

    setActiveAccount(1);
    await expect(contractScripts.claim('wagmi', sbtAddress)).rejects.toThrow(/Max tokens reached/);

    const minted = await contractScripts.getMintedTokens('none', sbtAddress, groupCfg);
    expect(Number(minted)).toBe(1);
    expect(accountTwo).toBeTruthy();
  });

  it('blocks a wallet from minting the same SBT twice', async () => {
    const sbtAddress = await createSbtAndGetAddress([
      'wagmi',
      'ContextEngine Single Mint',
      'CEONE',
      0,
      account,
      0,
      false,
      3,
      [],
      '',
      ethers.constants.HashZero,
      groupCfg,
    ], {
      name: 'ContextEngine Single Mint',
      hasPasswordMint: false,
      maxTokens: 0,
      tags: ['contextEngine', 'single'],
    });

    await contractScripts.claim('wagmi', sbtAddress);

    await expect(contractScripts.claim('wagmi', sbtAddress)).rejects.toThrow(/Address already owns an SBT/i);

    const minted = await contractScripts.getMintedTokens('none', sbtAddress, groupCfg);
    expect(Number(minted)).toBe(1);
  });

  it('rejects claimWithPassword without startClaim', async () => {
    const password = 'no-start';
    const hashed = [utils.keccak256(utils.toUtf8Bytes(password))];
    const sbtAddress = await createSbtAndGetAddress([
      'wagmi',
      'ContextEngine PW Start',
      'CEPWNS',
      0,
      account,
      0,
      true,
      3,
      hashed,
      '',
      ethers.constants.HashZero,
      groupCfg,
    ], {
      name: 'ContextEngine PW Start',
      hasPasswordMint: true,
      maxTokens: 0,
      tags: ['contextEngine', 'password'],
    });

    await expect(contractScripts.claimWithPassword('wagmi', sbtAddress, password)).rejects.toThrow(/Claim not started/);
  });

  it('rejects group signature mint outside group-signature mode', async () => {
    const sbtAddress = await createSbtAndGetAddress([
      'wagmi',
      'ContextEngine No Group',
      'CENGRP',
      0,
      account,
      0,
      false,
      3,
      [],
      '',
      ethers.constants.HashZero,
      groupCfg,
    ], {
      name: 'ContextEngine No Group',
      hasPasswordMint: false,
      maxTokens: 0,
      tags: ['contextEngine', 'group'],
    });

    await expect(
      contractScripts.mintWithGroupSignature('wagmi', sbtAddress, '0x')
    ).rejects.toThrow(/Group signature mint not enabled/);
  });

  it('rejects group signature mint with wrong password', async () => {
    const groupPassword = 'group-right';
    const { sbtAddress } = await createScopedSignatureSbtAndGetAddress({
      name: 'ContextEngine Group Wrong',
      symbol: 'CEGRW',
      groupPassword,
      tokenUriOverrides: {
      name: 'ContextEngine Group Wrong',
      hasPasswordMint: false,
      maxTokens: 0,
      tags: ['contextEngine', 'group'],
      },
    });

    const signature = await contractScripts.signGroupMintAuthorization({
      password: 'group-wrong',
      sbtAddress,
      userAddress: account,
    });

    await expect(
      contractScripts.mintWithGroupSignature('wagmi', sbtAddress, signature)
    ).rejects.toThrow(/Invalid signature/);
  });

  it('enforces maxTokens for group signature mints', async () => {
    const groupPassword = 'group-limit';
    const { sbtAddress } = await createScopedSignatureSbtAndGetAddress({
      name: 'ContextEngine Group Limit',
      symbol: 'CEGRL',
      limitedNumber: 1,
      groupPassword,
      tokenUriOverrides: {
      name: 'ContextEngine Group Limit',
      hasPasswordMint: false,
      maxTokens: 1,
      tags: ['contextEngine', 'group'],
      },
    });

    const signatureOne = await contractScripts.signGroupMintAuthorization({
      password: groupPassword,
      sbtAddress,
      userAddress: account,
    });
    await contractScripts.mintWithGroupSignature('wagmi', sbtAddress, signatureOne);

    setActiveAccount(1);
    const signatureTwo = await contractScripts.signGroupMintAuthorization({
      password: groupPassword,
      sbtAddress,
      userAddress: accountTwo,
    });
    await expect(
      contractScripts.mintWithGroupSignature('wagmi', sbtAddress, signatureTwo)
    ).rejects.toThrow(/Max tokens reached/);
  });

  it('rejects invite with wrong signature', async () => {
    const groupPassword = 'invite-good';
    const { sbtAddress } = await createScopedSignatureSbtAndGetAddress({
      name: 'ContextEngine Invite Wrong',
      symbol: 'CEINVW',
      limitedNumber: 1,
      hasPasswordMint: true,
      groupPassword,
      tokenUriOverrides: {
      name: 'ContextEngine Invite Wrong',
      hasPasswordMint: true,
      maxTokens: 0,
      tags: ['contextEngine', 'invite'],
      },
    });

    const invites = await contractScripts.generateInvitePayloads({
      password: 'invite-wrong',
      sbtAddress,
      nonces: [1],
    });

    await expect(
      contractScripts.claimWithInvite(
        'wagmi',
        sbtAddress,
        Number(invites[0].nonce),
        invites[0].signature
      )
    ).rejects.toThrow(/InvalidSignature/);
  });

  it('rejects invite when maxTokens is reached', async () => {
    const groupPassword = 'invite-limit';
    const { sbtAddress } = await createScopedSignatureSbtAndGetAddress({
      name: 'ContextEngine Invite Limit',
      symbol: 'CEINVL',
      limitedNumber: 1,
      hasPasswordMint: true,
      groupPassword,
      tokenUriOverrides: {
      name: 'ContextEngine Invite Limit',
      hasPasswordMint: true,
      maxTokens: 1,
      tags: ['contextEngine', 'invite'],
      },
    });

    const inviteOne = await contractScripts.generateInvitePayloads({
      password: groupPassword,
      sbtAddress,
      nonces: [1],
    });

    await contractScripts.claimWithInvite(
      'wagmi',
      sbtAddress,
      Number(inviteOne[0].nonce),
      inviteOne[0].signature
    );

    setActiveAccount(1);
    const inviteTwo = await contractScripts.generateInvitePayloads({
      password: groupPassword,
      sbtAddress,
      nonces: [2],
    });

    await expect(
      contractScripts.claimWithInvite(
        'wagmi',
        sbtAddress,
        Number(inviteTwo[0].nonce),
        inviteTwo[0].signature
      )
    ).rejects.toThrow(/MaxTokensReached/);
  });

  it('rejects invite when address already owns an SBT', async () => {
    const groupPassword = 'invite-own';
    const { sbtAddress } = await createScopedSignatureSbtAndGetAddress({
      name: 'ContextEngine Invite Own',
      symbol: 'CEINVO',
      limitedNumber: 2,
      hasPasswordMint: true,
      groupPassword,
      tokenUriOverrides: {
      name: 'ContextEngine Invite Own',
      hasPasswordMint: true,
      maxTokens: 0,
      tags: ['contextEngine', 'invite'],
      },
    });

    const inviteOne = await contractScripts.generateInvitePayloads({
      password: groupPassword,
      sbtAddress,
      nonces: [1],
    });

    await contractScripts.claimWithInvite(
      'wagmi',
      sbtAddress,
      Number(inviteOne[0].nonce),
      inviteOne[0].signature
    );

    const inviteTwo = await contractScripts.generateInvitePayloads({
      password: groupPassword,
      sbtAddress,
      nonces: [2],
    });

    await expect(
      contractScripts.claimWithInvite(
        'wagmi',
        sbtAddress,
        Number(inviteTwo[0].nonce),
        inviteTwo[0].signature
      )
    ).rejects.toThrow(/AlreadyOwns/);
  });

  it('rejects addHashedPasswords from non-admin', async () => {
    const sbtAddress = await createSbtAndGetAddress([
      'wagmi',
      'ContextEngine Add PW',
      'CEADPW',
      0,
      account,
      0,
      true,
      3,
      [utils.keccak256(utils.toUtf8Bytes('seed-pass'))],
      '',
      ethers.constants.HashZero,
      groupCfg,
    ], {
      name: 'ContextEngine Add PW',
      hasPasswordMint: true,
      maxTokens: 0,
      tags: ['contextEngine', 'password'],
    });

    const hashed = utils.keccak256(utils.toUtf8Bytes('new-pass'));
    setActiveAccount(1);
    await expect(contractScripts.addHashedPasswords('wagmi', sbtAddress, [hashed])).rejects.toThrow(/Not admin/);
  });

  it('enforces burn auth: OwnerOnly', async () => {
    const sbtAddress = await createSbtAndGetAddress([
      'wagmi',
      'ContextEngine Burn Owner',
      'CEBRO',
      0,
      accountTwo,
      0,
      false,
      1,
      [],
      '',
      ethers.constants.HashZero,
      groupCfg,
    ], {
      name: 'ContextEngine Burn Owner',
      hasPasswordMint: false,
      maxTokens: 0,
      tags: ['contextEngine', 'burn'],
    });

    await contractScripts.claim('wagmi', sbtAddress);
    const tokenId = await contractScripts.getSBTTokenIdByOwner('none', sbtAddress, account, groupCfg);

    setActiveAccount(1);
    await expect(contractScripts.burnToken('wagmi', sbtAddress, tokenId)).rejects.toThrow(/Not authorized/);

    setActiveAccount(0);
    await contractScripts.burnToken('wagmi', sbtAddress, tokenId);
  });

  it('enforces burn auth: IssuerOnly', async () => {
    const sbtAddress = await createSbtAndGetAddress([
      'wagmi',
      'ContextEngine Burn Issuer',
      'CEBRI',
      0,
      accountTwo,
      0,
      false,
      0,
      [],
      '',
      ethers.constants.HashZero,
      groupCfg,
    ], {
      name: 'ContextEngine Burn Issuer',
      hasPasswordMint: false,
      maxTokens: 0,
      tags: ['contextEngine', 'burn'],
    });

    await contractScripts.claim('wagmi', sbtAddress);
    const tokenId = await contractScripts.getSBTTokenIdByOwner('none', sbtAddress, account, groupCfg);

    await expect(contractScripts.burnToken('wagmi', sbtAddress, tokenId)).rejects.toThrow(/Not authorized/);

    setActiveAccount(1);
    await contractScripts.burnToken('wagmi', sbtAddress, tokenId);
  });

  it('enforces burn auth: Both', async () => {
    const sbtAddress = await createSbtAndGetAddress([
      'wagmi',
      'ContextEngine Burn Both',
      'CEBRB',
      0,
      accountTwo,
      0,
      false,
      2,
      [],
      '',
      ethers.constants.HashZero,
      groupCfg,
    ], {
      name: 'ContextEngine Burn Both',
      hasPasswordMint: false,
      maxTokens: 0,
      tags: ['contextEngine', 'burn'],
    });

    await contractScripts.claim('wagmi', sbtAddress);
    await contractScripts.burnToken('wagmi', sbtAddress, 1);

    setActiveAccount(0);
    await contractScripts.claim('wagmi', sbtAddress);
    setActiveAccount(1);
    await contractScripts.burnToken('wagmi', sbtAddress, 2);
  });

  it('enforces burn auth: Neither', async () => {
    const sbtAddress = await createSbtAndGetAddress([
      'wagmi',
      'ContextEngine Burn Neither',
      'CEBRN',
      0,
      accountTwo,
      0,
      false,
      3,
      [],
      '',
      ethers.constants.HashZero,
      groupCfg,
    ], {
      name: 'ContextEngine Burn Neither',
      hasPasswordMint: false,
      maxTokens: 0,
      tags: ['contextEngine', 'burn'],
    });

    await contractScripts.claim('wagmi', sbtAddress);
    const tokenId = await contractScripts.getSBTTokenIdByOwner('none', sbtAddress, account, groupCfg);

    await expect(contractScripts.burnToken('wagmi', sbtAddress, tokenId)).rejects.toThrow(/Not authorized/);
    setActiveAccount(1);
    await expect(contractScripts.burnToken('wagmi', sbtAddress, tokenId)).rejects.toThrow(/Not authorized/);
  });

});
