import type {
  afterAll as JestAfterAll,
  afterEach as JestAfterEach,
  beforeAll as JestBeforeAll,
  beforeEach as JestBeforeEach,
  describe as JestDescribe,
  expect as JestExpect,
  it as JestIt,
  jest as JestRuntime,
  test as JestTest,
} from '@jest/globals';
import type {
  FunctionLike,
  Mock as JestMock,
  Mocked as JestMocked,
  MockedFunction as JestMockedFunction,
  MockInstance as JestMockInstance,
} from 'jest-mock';
import '@testing-library/jest-dom/jest-globals';

declare global {
  const afterAll: typeof JestAfterAll;
  const afterEach: typeof JestAfterEach;
  const beforeAll: typeof JestBeforeAll;
  const beforeEach: typeof JestBeforeEach;
  const describe: typeof JestDescribe;
  const expect: typeof JestExpect;
  const it: typeof JestIt;
  const test: typeof JestTest;

  namespace jest {
    type Mock<Return = unknown, Args extends unknown[] = unknown[]> = JestMock<(...args: Args) => Return>;
    type Mocked<T extends object> = JestMocked<T>;
    type MockedFunction<T extends FunctionLike> = JestMockedFunction<T>;
    type SpyInstance<Return = unknown, Args extends unknown[] = unknown[]> = JestMockInstance<(...args: Args) => Return>;
  }

  const jest: Omit<typeof JestRuntime, 'fn'> & {
    fn<T extends FunctionLike>(implementation: T): JestMock<T>;
    // Preserve the established @types/jest two-generic compatibility call for
    // unannotated mocks; all other globals and typed mocks use Jest 30's real
    // exported types, so this is not an all-any test environment.
    fn<Return = any, Args extends any[] = any[]>(
      implementation?: (...args: Args) => Return,
    ): jest.Mock<Return, Args>;
  };
}

export {};
