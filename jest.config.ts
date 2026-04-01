const baseProjectConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest/setup-after-env.ts'],
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@app/database(|/.*)$': '<rootDir>/libs/database/src/$1',
    '^@app/domain(|/.*)$': '<rootDir>/libs/domain/src/$1',
    '^@app/common(|/.*)$': '<rootDir>/libs/common/src/$1',
  },
};

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  passWithNoTests: true,
  // testMatch: ['<rootDir>/apps/**/*.spec.ts', '<rootDir>/libs/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  globalSetup: '<rootDir>/jest/global-setup.ts',
  globalTeardown: '<rootDir>/jest/global-teardown.ts',
  setupFilesAfterEnv: ['<rootDir>/jest/setup-after-env.ts'],
  collectCoverageFrom: [
    'apps/**/*.{ts,js}',
    'libs/**/*.{ts,js}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/config/**',
    '!**/testing/**',
    '!**/main.ts',
    '!**/*.module.ts',
    '!**/*.event.ts',
    '!**/*.dto{,s}.ts',
    '!**/*.interface{,s}.ts',
    '!**/*.constants.ts',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleNameMapper: {
    '^@app/database(|/.*)$': '<rootDir>/libs/database/src/$1',
    '^@app/domain(|/.*)$': '<rootDir>/libs/domain/src/$1',
    '^@app/common(|/.*)$': '<rootDir>/libs/common/src/$1',
  },
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
    },
  },
  projects: [
    // =====================
    // API
    // =====================
    {
      displayName: 'api-unit',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/apps/api/src/**/*.spec.ts'],
    },
    {
      displayName: 'api-int',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/apps/api/test/**/*.int.spec.ts'],
    },
    {
      displayName: 'api-e2e',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/apps/api/test/**/*.e2e.spec.ts'],
    },
    // =====================
    // OUTBOX PROCESSOR
    // =====================
    {
      displayName: 'outbox-processor-unit',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/apps/outbox-processor/src/**/*.spec.ts'],
    },
    {
      displayName: 'outbox-processor-int',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/apps/outbox-processor/test/**/*.int.spec.ts'],
    },
    {
      displayName: 'outbox-processor-e2e',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/apps/outbox-processor/test/**/*.e2e.spec.ts'],
    },
    // =====================
    // WORKER CORE
    // =====================
    {
      displayName: 'worker-core-unit',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/apps/worker-core/src/**/*.spec.ts'],
    },
    {
      displayName: 'worker-core-int',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/apps/worker-core/test/**/*.int.spec.ts'],
    },
    {
      displayName: 'worker-core-e2e',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/apps/worker-core/test/**/*.e2e.spec.ts'],
    },
    // =====================
    // INTELLIGENCE WORKER
    // =====================
    {
      displayName: 'intelligence-worker-unit',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/apps/intelligence-worker/src/**/*.spec.ts'],
    },
    {
      displayName: 'intelligence-worker-int',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/apps/intelligence-worker/test/**/*.int.spec.ts'],
    },
    {
      displayName: 'intelligence-worker-e2e',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/apps/intelligence-worker/test/**/*.e2e.spec.ts'],
    },
    // =====================
    // REPORT WORKER
    // =====================
    {
      displayName: 'report-worker-unit',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/apps/report-worker/src/**/*.spec.ts'],
    },
    {
      displayName: 'report-worker-int',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/apps/report-worker/test/**/*.int.spec.ts'],
    },
    {
      displayName: 'report-worker-e2e',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/apps/report-worker/test/**/*.e2e.spec.ts'],
    },
    // =====================
    // LIBS
    // =====================
    {
      displayName: 'libs-unit',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/libs/**/src/**/*.spec.ts'],
    },
    {
      displayName: 'libs-int',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/libs/**/test/**/*.int.spec.ts'],
    },
    {
      displayName: 'libs-e2e',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/libs/**/test/**/*.e2e.spec.ts'],
    },
  ],
};
