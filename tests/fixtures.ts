import type { Dataset, Issue } from '../src/model.js';
import type { Config } from '../src/config.js';

export const config: Config = {
  baseUrl: 'http://127.0.0.1', project: 'TEST', closedStatuses: ['Closed'], pageSize: 2,
  maxIssues: 0, timeoutMs: 1000, retries: 0, requestDelayMs: 0, histogramBins: 5,
  dataFile: 'data/issues.json', reportFile: 'reports/index.html', logFile: 'logs/jira-analytics.log',
};

export function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    key: 'TEST-1', created: '2025-01-01T00:00:00.000Z', resolved: '2025-01-03T00:00:00.000Z',
    status: 'Closed', priority: 'Major', assignee: { id: 'a', name: 'Alice' }, reporter: { id: 'b', name: 'Bob' },
    loggedSeconds: 7200,
    changes: [
      { at: '2025-01-02T00:00:00.000Z', from: 'Open', to: 'In Progress' },
      { at: '2025-01-03T00:00:00.000Z', from: 'In Progress', to: 'Closed' },
    ], ...overrides,
  };
}

export function rawIssue(key = 'TEST-1') {
  return {
    key,
    fields: {
      created: '2025-01-01T00:00:00.000+0000', resolutiondate: '2025-01-03T00:00:00.000+0000',
      status: { name: 'Closed' }, priority: { name: 'Major' }, timespent: 7200,
      assignee: { key: 'a', displayName: 'Alice' }, reporter: { key: 'b', displayName: 'Bob' },
    },
    changelog: {
      startAt: 0, total: 2,
      histories: [
        { created: '2025-01-02T00:00:00.000+0000', items: [{ field: 'status', fromString: 'Open', toString: 'In Progress' }] },
        { created: '2025-01-03T00:00:00.000+0000', items: [{ field: 'status', fromString: 'In Progress', toString: 'Closed' }] },
      ],
    },
  };
}

/** Маленький набор данных только для автоматических тестов. */
export function testDataset(): Dataset {
  const issues = [issue(), issue({ key: 'TEST-2', status: 'Open', resolved: null, changes: [] }), issue({ key: 'TEST-3' })];
  return {
    version: 1, source: 'https://jira.example.test', project: 'TEST',
    fetchedAt: '2025-01-04T00:00:00.000Z', jql: 'project = "TEST" ORDER BY created DESC, key DESC',
    total: issues.length, complete: true, issues,
  };
}
