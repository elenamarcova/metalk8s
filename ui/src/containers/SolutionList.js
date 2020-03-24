import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useHistory } from 'react-router';
import { Formik, Form } from 'formik';
import * as yup from 'yup';
import styled from 'styled-components';
import {
  Table,
  Button,
  Breadcrumb,
  Modal,
  Input,
  Loader,
} from '@scality/core-ui';
import { padding } from '@scality/core-ui/dist/style/theme';
import { sortSelector } from '../services/utils';
import NoRowsRenderer from '../components/NoRowsRenderer';
import {
  BreadcrumbContainer,
  BreadcrumbLabel,
} from '../components/BreadcrumbStyle';
import { intl } from '../translations/IntlGlobalProvider';
import { useRefreshEffect } from '../services/utils';
import {
  refreshSolutionsAction,
  stopRefreshSolutionsAction,
  prepareEnvironmentAction,
} from '../ducks/app/solutions';

const PageContainer = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: ${padding.base};
`;

const PageSubtitle = styled.h3`
  color: ${props => props.theme.brand.textPrimary};
  margin: ${padding.small} 0;
  display: flex;
  align-items: center;
`;

const VersionLabel = styled.label`
  padding: 0 ${padding.smaller};
  ${props => (props.active ? 'font-weight: bold;' : '')}
`;

const ModalBody = styled.div``;

const FormStyle = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding-bottom: ${padding.base};
  min-height: 220px;
  .sc-input {
    display: inline-flex;
    margin: ${padding.smaller} 0;
    justify-content: center;
    .sc-input-label {
      width: 200px;
    }
  }
`;

const TableContainer = styled.div`
  height: 40%;
  margin: 0 0 50px 0;
`;

const EnvironmentHeader = styled.div`
  display: flex;
  justify-content: space-between;
`;

const ActionContainer = styled.div`
  display: flex;
  justify-content: space-between;
  margin: 10px 0;
  padding: 10px 0;
`;

const SelectContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-top: 20px;
`;

const EnvironmentSolutionContainer = styled.div`
  display: flex;
  align-items: baseline;
`;

const SolutionLinks = styled.div`
  padding-left: ${padding.smaller};
`;

const LoaderContainer = styled.div`
  display: flex;
  flex-wrap: nowrap;
  padding: 0 0 0 ${padding.smaller};
`;

const SolutionsList = props => {
  const theme = useSelector(state => state.config.theme);
  const solutions = useSelector(state => state.app.solutions.solutions);
  const environments = useSelector(state => state.app.solutions.environments);
  const history = useHistory();
  const dispatch = useDispatch();
  useRefreshEffect(refreshSolutionsAction, stopRefreshSolutionsAction);

  const [solutionSortBy, setSolutionSortBy] = useState('name');
  const [solutionSortDirection, setSolutionSortDirection] = useState('ASC');
  const [envSortBy, setEnvSortBy] = useState('name');
  const [envSortDirection, setEnvSortDirection] = useState('ASC');
  const [isAddSolutionModalOpen, setisAddSolutionModalOpen] = useState(false);
  const [selectedEnvironment, setSelectedEnvironment] = useState('');

  const onSort = (setSortBy, setSortDirection) => ({
    sortBy,
    sortDirection,
  }) => {
    setSortBy(sortBy);
    setSortDirection(sortDirection);
  };

  const solutionColumns = [
    {
      label: intl.translate('name'),
      dataKey: 'name',
      flexGrow: 1,
    },
    {
      label: intl.translate('versions'),
      dataKey: 'versions',
      renderer: versions =>
        versions.map((version, index) => (
          <VersionLabel key={`version_${index}`} active={version.active}>
            {version.version}
          </VersionLabel>
        )),
      flexGrow: 1,
    },
  ];

  const environmentsColumn = [
    {
      label: intl.translate('name'),
      dataKey: 'name',
    },
    {
      label: intl.translate('description'),
      dataKey: 'description',
    },
    {
      label: intl.translate('solutions'),
      dataKey: 'solutions',
      renderer: (solutions, environment) => {
        const isEnvironmentPreparing = environment.isPreparing;
        const deployedSolutions = environment.solutions;
        const solutionsList =
          deployedSolutions &&
          deployedSolutions.map((deployedSolution, idx) => {
            return (
              <span
                key={idx}
              >{`${deployedSolution.name}(v.${deployedSolution.version})`}</span>
            );
          });

        return (
          <EnvironmentSolutionContainer>
            <Button
              size="smaller"
              text={intl.translate('add')}
              outlined
              onClick={() => {
                setSelectedEnvironment(environment.name);
                setisAddSolutionModalOpen(true);
              }}
            />
            <SolutionLinks>{solutionsList}</SolutionLinks>
            {isEnvironmentPreparing && (
              <LoaderContainer>
                <Loader size="small"></Loader>
                {intl.translate('preparing_environemnt', {
                  envName: environment.name,
                })}
              </LoaderContainer>
            )}
          </EnvironmentSolutionContainer>
        );
      },
      flexGrow: 1,
    },
  ];

  const sortedSolutions =
    sortSelector(solutions, solutionSortBy, solutionSortDirection) ?? [];

  const sortedEnvironments =
    sortSelector(environments, envSortBy, envSortDirection) ?? [];

  const firstSolution = sortedSolutions?.[0]?.name ?? '';
  const firstVersion = sortedSolutions?.[0]?.versions?.[0]?.version ?? '';

  const initialValues = {
    solution: { label: firstSolution, value: firstSolution },
    version: { label: firstVersion, value: firstVersion },
  };

  const validationSchema = {
    solution: yup
      .object()
      .shape({
        label: yup.string().required(),
        value: yup.string().required(),
      })
      .required(),
    version: yup
      .object()
      .shape({
        label: yup.string().required(),
        value: yup.string().required(),
      })
      .required(),
  };

  const isSolutionReady = sortedSolutions.length > 0;

  return (
    <>
      <PageContainer>
        <BreadcrumbContainer>
          <Breadcrumb
            activeColor={theme.brand.secondary}
            paths={[
              <BreadcrumbLabel title={intl.translate('solutions')}>
                {intl.translate('solutions')}
              </BreadcrumbLabel>,
            ]}
          />
        </BreadcrumbContainer>
        <TableContainer>
          <EnvironmentHeader>
            <PageSubtitle>{intl.translate('environments')}</PageSubtitle>
            <Button
              text={intl.translate('create_new_environment')}
              onClick={() => history.push('/solutions/create-environment')}
              icon={<i className="fas fa-plus" />}
            />
          </EnvironmentHeader>

          <Table
            list={sortedEnvironments}
            columns={environmentsColumn}
            disableHeader={false}
            headerHeight={40}
            rowHeight={40}
            sortBy={envSortBy}
            sortDirection={envSortDirection}
            onSort={onSort(setEnvSortBy, setEnvSortDirection)}
            onRowClick={() => {}}
            noRowsRenderer={() => (
              <NoRowsRenderer content={intl.translate('no_data_available')} />
            )}
          />
        </TableContainer>

        <TableContainer>
          <PageSubtitle>{intl.translate('available_solutions')}</PageSubtitle>
          <Table
            list={sortedSolutions}
            columns={solutionColumns}
            disableHeader={false}
            headerHeight={40}
            rowHeight={40}
            sortBy={solutionSortBy}
            sortDirection={solutionSortDirection}
            onSort={onSort(setSolutionSortBy, setSolutionSortDirection)}
            onRowClick={() => {}}
            noRowsRenderer={() => (
              <NoRowsRenderer content={intl.translate('no_data_available')} />
            )}
          />
        </TableContainer>
      </PageContainer>

      <Modal
        close={() => {
          setisAddSolutionModalOpen(false);
          setSelectedEnvironment('');
        }}
        isOpen={isAddSolutionModalOpen}
        title={intl.translate('add_solution_to_environment', {
          environment: selectedEnvironment,
        })}
      >
        {isSolutionReady ? (
          <Formik
            initialValues={initialValues}
            validationSchema={validationSchema}
            onSubmit={values => {
              dispatch(prepareEnvironmentAction(selectedEnvironment, values));
              setisAddSolutionModalOpen(false);
            }}
          >
            {formikProps => {
              const { setFieldValue, values } = formikProps;

              const handleSelectChange = field => selectedObj => {
                setFieldValue(field, selectedObj ? selectedObj : '');
              };

              const solutionsSelectOptions = sortedSolutions.map(solution => ({
                label: solution.name,
                value: solution.name,
              }));

              const selectedSolutionVersions =
                sortedSolutions.find(
                  solution => solution.name === values.solution.value,
                )?.versions ?? [];

              const selectedSolutionVersionsOptions = selectedSolutionVersions.map(
                solutionVersion => ({
                  label: solutionVersion.version,
                  value: solutionVersion.version,
                }),
              );

              return (
                <ModalBody>
                  <Form>
                    <FormStyle>
                      <SelectContainer>
                        <Input
                          type="select"
                          name="solutions"
                          label={intl.translate('solution')}
                          options={solutionsSelectOptions}
                          placeholder={intl.translate('select_a_type')}
                          noOptionsMessage={() => intl.translate('no_results')}
                          onChange={handleSelectChange('solution')}
                          value={values.solution}
                        />
                        <Input
                          type="select"
                          name="version"
                          label={intl.translate('version_env')}
                          options={selectedSolutionVersionsOptions}
                          placeholder={intl.translate('select_a_type')}
                          noOptionsMessage={() => intl.translate('no_results')}
                          onChange={handleSelectChange('version')}
                          value={values.version}
                        />
                      </SelectContainer>

                      <ActionContainer>
                        <Button
                          outlined
                          text={intl.translate('cancel')}
                          onClick={() => {
                            setisAddSolutionModalOpen(false);
                            setSelectedEnvironment('');
                          }}
                        />
                        <Button
                          text={intl.translate('add_solution')}
                          type="submit"
                        />
                      </ActionContainer>
                    </FormStyle>
                  </Form>
                </ModalBody>
              );
            }}
          </Formik>
        ) : (
          <Loader size="large">{intl.translate('import_solution_hint')}</Loader>
        )}
      </Modal>
    </>
  );
};

export default SolutionsList;
