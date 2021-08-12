import React, { useMemo } from 'react';
import { useAlerts } from '../containers/AlertProvider';
import styled from 'styled-components';
import { spacing } from '@scality/core-ui/dist/style/theme';
import DashboardAlerts from './DashboardAlerts';

const GlobalHealthContainer = styled.div`
  display: flex;
  height: 100%;
  justify-content: space-between;
  padding: 0 ${spacing.sp24} 0 ${spacing.sp24};

  & > div {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 200px;
    &:not(:first-of-type):before {
      content: '';
      position: relative;
      margin: 0 ${spacing.sp32} 0 ${spacing.sp32};
      height: ${spacing.sp32};
      width: ${spacing.sp2};
      background-color: ${(props) => props.theme.backgroundLevel1};
    }
  }
`;

const DashboardGlobalHealth = () => {
  const alerts = useAlerts({});
  const leafAlerts = useMemo(
    () => alerts?.alerts.filter((alert) => !alert.labels.children) || [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(alerts?.alerts)],
  );

  return (
    <GlobalHealthContainer>
      <div>Datacenter</div>
      <div>GlobalHealth</div>
      <div>
        <DashboardAlerts leafAlerts={leafAlerts} />
      </div>
      <div>Activity</div>
    </GlobalHealthContainer>
  );
};

export default DashboardGlobalHealth;
