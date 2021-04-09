//@flow
import {
  removeWarningAlerts,
  formatActiveAlerts,
  sortAlerts,
  STATUS_CRITICAL,
  STATUS_HEALTH,
} from './alertUtils';

export type PrometheusAlert = {
  annotations: {
    [key: string]: string,
  },
  receivers: {
    name: string,
  }[],
  fingerprint: string,
  startsAt: string,
  updatedAt: string,
  endsAt: string,
  status: {
    state: 'unprocessed' | 'active' | 'suppressed',
    silencedBy: string[],
    inhibitedBy: string[],
  },
  labels: {
    [key: string]: string,
  },
  generatorURL: string,
};

export type AlertLabels = {
  [labelName: string]: string,
  parents?: string[],
  selectors?: string[],
};

export function getAlerts(alertManagerUrl: string) {
  return fetch(alertManagerUrl + '/api/v2/alerts')
  .then(r => {
      if(r.ok) {
          return r.json();
      }
      throw new Error(`Alert manager responded with ${r.status}`)
  })  
  .then((resolve) => {
      if (resolve.error) {
        throw resolve.error;
      }
      return resolve;
    })
    .then((result) => {
      // format the alerts then remove the warning and finally sort the alerts.
      return sortAlerts(removeWarningAlerts(formatActiveAlerts(result)));
    });
}

export const checkActiveAlertProvider = (): Promise<{
  status: 'healthy' | 'critical',
}> => {
  // depends on Watchdog to see the if Alertmanager is up
  return getAlerts().then((result) => {
    const watchdog = result.find(
      (alert) => alert.labels.alertname === 'Watchdog',
    );
    if (watchdog) return STATUS_HEALTH;
    else return STATUS_CRITICAL;
  });
};
