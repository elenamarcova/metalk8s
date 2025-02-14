import React, { useMemo } from 'react';
import { Route } from 'react-router-dom';
import { ErrorPage500, ErrorPageAuth } from '@scality/core-ui';
import { useTypedSelector } from '../hooks';
import { ComponentWithFederatedImports } from '@scality/module-federation';
import { useDispatch } from 'react-redux';
import { updateAPIConfigAction } from '../ducks/config';

const InternalPrivateRoute = ({
  moduleExports,
  component,
  location,
  ...rest
}) => {
  const { language, api } = useTypedSelector((state) => state.config);
  const url_support = api?.url_support;
  const { userData } = moduleExports['./auth/AuthProvider'].useAuth();
  const dispatch = useDispatch();

  useMemo(() => {
    dispatch(updateAPIConfigAction(userData));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!userData]);

  if (userData.token && userData.username) {
    return <Route {...rest} component={component} />;
  } else {
    return (
      <ErrorPageAuth
        data-cy="sc-error-pageauth"
        supportLink={url_support}
        locale={language}
      />
    );
  }
};

const PrivateRoute = ({ ...props }) => {
  return (
    <ComponentWithFederatedImports
      componentWithInjectedImports={InternalPrivateRoute}
      componentProps={props}
      renderOnError={<ErrorPage500 />}
      federatedImports={[
        {
          remoteEntryUrl: window.shellUIRemoteEntryUrl,
          scope: 'shell',
          module: './auth/AuthProvider',
        },
      ]}
    />
  );
};

export default PrivateRoute;
