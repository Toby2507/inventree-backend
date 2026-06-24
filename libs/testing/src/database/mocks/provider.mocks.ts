export const makeDatabaseConnectionMock = () => ({});

export const makeDatabaseClienMock = () => ({
  on: jest.fn().mockReturnValue(undefined),
  query: jest.fn().mockResolvedValue(undefined),
  connect: jest.fn().mockResolvedValue(undefined),
});

export const makeDatabaseProviderMock = () => {
  return {
    forBootstrapMigration: makeDatabaseConnectionMock(),
    forOperationalMigration: makeDatabaseConnectionMock(),
    forAnalyticsMigration: makeDatabaseConnectionMock(),
    analyticsRead: makeDatabaseConnectionMock(),
    analyticsWrite: makeDatabaseConnectionMock(),
    operationalRead: makeDatabaseConnectionMock(),
    operationalWrite: makeDatabaseConnectionMock(),
    notificationClient: makeDatabaseClienMock(),
  };
};
