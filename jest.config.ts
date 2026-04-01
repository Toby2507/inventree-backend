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
  testMatch: ['<rootDir>/apps/**/*.spec.ts', '<rootDir>/libs/**/*.spec.ts'],
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
    {
      displayName: 'api',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/apps/api/**/*.spec.ts'],
    },
    {
      displayName: 'outbox-processor',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/apps/outbox-processor/**/*.spec.ts'],
    },
    {
      displayName: 'worker-core',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/apps/worker-core/**/*.spec.ts'],
    },
    {
      displayName: 'intelligence-worker',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/apps/intelligence-worker/**/*.spec.ts'],
    },
    {
      displayName: 'report-worker',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/apps/report-worker/**/*.spec.ts'],
    },
    {
      displayName: 'libs',
      ...baseProjectConfig,
      testMatch: ['<rootDir>/libs/**/*.spec.ts'],
    },
  ],
};
