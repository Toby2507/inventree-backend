export const MetricNames = {
  COMMAND_DURATION: 'app.command.duration',
  COMMAND_TOTAL: 'app.command.total',
  QUERY_DURATION: 'app.query.duration',
  QUERY_TOTAL: 'app.query.total',
  HTTP_DURATION: 'app.http.duration',
  HTTP_TOTAL: 'app.http.total',
  HTTP_ACTIVE: 'app.http.active_requests',
  REPO_DURATION: 'app.repository.duration',
  REPO_TOTAL: 'app.repository.total',
  JOB_DURATION: 'app.job.duration',
  JOB_TOTAL: 'app.job.total',
  JOB_QUEUE_DEPTH: 'app.job.queue_depth',
  OUTBOX_PUBLISHED: 'app.outbox.published',
  OUTBOX_FAILED: 'app.outbox.failed',
  OUTBOX_LATENCY: 'app.outbox.latency',
  CUSTOM_DURATION: 'app.custom.duration',
  CUSTOM_TOTAL: 'app.custom.total',
} as const;

export type MetricName = (typeof MetricNames)[keyof typeof MetricNames];
