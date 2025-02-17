//@flow
import React, { type Node } from 'react';
import { useIntl } from 'react-intl';
import { useTypedSelector } from '../hooks';
import { ErrorBoundary } from 'react-error-boundary';
import type { FilterLabels, Alert } from '../services/alertUtils';
import { ErrorPage500 } from '@scality/core-ui';
import {
  ComponentWithFederatedImports,
  FederatedComponent,
} from '@scality/module-federation';
import { STATUS_HEALTH } from '../constants';

export type Status = 'healthy' | 'warning' | 'critical';

const alertGlobal = {};
export const useAlerts = (filters: FilterLabels) => {
  return alertGlobal.hooks.useAlerts(filters);
};

export const useHighestSeverityAlerts = (filters: FilterLabels) => {
  return alertGlobal.hooks.useHighestSeverityAlerts(filters);
};

export const useAlertLibrary = () => {
  return alertGlobal.hooks;
};

export const highestAlertToStatus = (alerts?: Alert[]): Status => {
  return (alerts?.[0] && ((alerts[0].severity: any): Status)) || STATUS_HEALTH;
};

const InternalAlertProvider = ({
  moduleExports,
  children,
}: {
  moduleExports: {},
  children: Node,
}): Node => {
  alertGlobal.hooks = moduleExports['./alerts/alertHooks'];

  const alertManagerUrl = useTypedSelector(
    (state) => state.config.api.url_alertmanager,
  );

  return (
    <FederatedComponent
      module={'./alerts/AlertProvider'}
      scope={'shell'}
      url={window.shellUIRemoteEntryUrl}
      props={{ alertManagerUrl, children }}
    ></FederatedComponent>
  );
};

function ErrorFallback() {
  const intl = useIntl();
  const language = intl.locale;

  const { api } = useTypedSelector((state) => state.config);
  const url_support = api?.url_support;
  return (
    <ErrorPage500
      data-cy="sc-error-page500"
      locale={language}
      supportLink={url_support}
    />
  );
}

const AlertProvider = ({ children }: { children: Node }): Node => {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <ComponentWithFederatedImports
        componentWithInjectedImports={InternalAlertProvider}
        renderOnError={<ErrorPage500 />}
        componentProps={{ children }}
        federatedImports={[
          {
            scope: 'shell',
            module: './alerts/alertHooks',
            remoteEntryUrl: window.shellUIRemoteEntryUrl,
          },
        ]}
      />
    </ErrorBoundary>
  );
};

export default AlertProvider;
