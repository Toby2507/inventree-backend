export const defaultJobOptions = {
  removeOnComplete: true,
  removeOnFail: false,
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
};
