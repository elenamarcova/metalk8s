import React from 'react';
import styled from 'styled-components';
import { TextBadge } from './style/CommonLayoutStyle';
import { useIntl } from 'react-intl';
import {
  fontSize,
  fontWeight,
  spacing,
} from '@scality/core-ui/dist/style/theme';
import {
  useLinkOpener,
  useDiscoveredViews,
} from '../containers/ConfigProvider';
import { useHistory } from 'react-router';

const AlertsContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const BadgesContainer = styled.div`
  display: flex;
  & > div {
    margin-right: ${spacing.sp16};
  }
`;

const BadgeContainer = styled.div`
  display: flex;
`;

const TitleContainer = styled.div`
  display: flex;
  width: 100%;
  margin-bottom: ${spacing.sp4};
`;

const Title = styled.div`
  color: ${(props) => props.theme.textPrimary};
  font-size: ${fontSize.base};
  font-weight: ${fontWeight.bold};
`;

const SubTitle = styled.div`
  color: ${(props) => props.theme.textSecondary};
  font-size: ${fontSize.small};
`;

const Link = styled.div`
  color: ${(props) => props.theme.textLink};
  cursor: pointer;
  margin-left: auto;
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
`;

const DashboardAlerts = ({ leafAlerts }) => {
  const { openLink } = useLinkOpener();
  const history = useHistory();
  const discoveredViews = useDiscoveredViews();
  const alertView = discoveredViews.find(
    (view) => view.view.path === '/alerts',
  );
  const intl = useIntl();
  const criticalAlerts = leafAlerts.filter(
    (alert) => alert.severity === 'critical',
  );
  const warningAlerts = leafAlerts.filter(
    (alert) => alert.severity === 'warning',
  );
  const totalAlerts = criticalAlerts.length + warningAlerts.length;

  return (
    <AlertsContainer>
      <TitleContainer>
        <Title>{intl.formatMessage({ id: 'platform_active_alerts' })}</Title>
        <TextBadge variant="infoPrimary" data-testid="all-alert-badge">
          {totalAlerts}
        </TextBadge>
      </TitleContainer>
      {totalAlerts === 0 ? (
        <SubTitle>{intl.formatMessage({ id: 'no_active_alerts' })}</SubTitle>
      ) : (
        <>
          <BadgesContainer>
            <BadgeContainer>
              Critical
              <TextBadge
                variant="statusCritical"
                data-testid="critical-alert-badge"
              >
                {criticalAlerts.length}
              </TextBadge>
            </BadgeContainer>
            <BadgeContainer>
              Warning
              <TextBadge
                variant="statusWarning"
                data-testid="warning-alert-badge"
              >
                {warningAlerts.length}
              </TextBadge>
            </BadgeContainer>
          </BadgesContainer>
          <Link
            onClick={() => {
              history.push('/alerts');
              openLink(alertView);
            }}
            data-testid="view-all-link"
          >
            {intl.formatMessage({ id: 'view_all' })} >
          </Link>
        </>
      )}
    </AlertsContainer>
  );
};

export default DashboardAlerts;
