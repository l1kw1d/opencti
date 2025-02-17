import React, { Component } from 'react';
import * as PropTypes from 'prop-types';
import { graphql, createFragmentContainer } from 'react-relay';
import { Formik, Form, Field } from 'formik';
import withStyles from '@mui/styles/withStyles';
import {
  assoc,
  compose,
  map,
  pathOr,
  pipe,
  pick,
  difference,
  head,
  split,
} from 'ramda';
import * as Yup from 'yup';
import * as R from 'ramda';
import inject18n from '../../../../components/i18n';
import TextField from '../../../../components/TextField';
import { SubscriptionFocus } from '../../../../components/Subscription';
import { commitMutation } from '../../../../relay/environment';
import CreatedByField from '../../common/form/CreatedByField';
import ObjectMarkingField from '../../common/form/ObjectMarkingField';
import MarkDownField from '../../../../components/MarkDownField';
import {
  convertCreatedBy,
  convertMarkings,
  convertStatus,
} from '../../../../utils/edition';
import StatusField from '../../common/form/StatusField';
import { adaptFieldValue } from '../../../../utils/String';
import CommitMessage from '../../common/form/CommitMessage';

const styles = (theme) => ({
  drawerPaper: {
    minHeight: '100vh',
    width: '50%',
    position: 'fixed',
    overflow: 'hidden',

    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    padding: '30px 30px 30px 30px',
  },
  createButton: {
    position: 'fixed',
    bottom: 30,
    right: 30,
  },
  importButton: {
    position: 'absolute',
    top: 30,
    right: 30,
  },
});

const courseOfActionMutationFieldPatch = graphql`
  mutation CourseOfActionEditionOverviewFieldPatchMutation(
    $id: ID!
    $input: [EditInput]!
    $commitMessage: String
    $references: [String]
  ) {
    courseOfActionEdit(id: $id) {
      fieldPatch(
        input: $input
        commitMessage: $commitMessage
        references: $references
      ) {
        ...CourseOfActionEditionOverview_courseOfAction
        ...CourseOfAction_courseOfAction
      }
    }
  }
`;

export const courseOfActionEditionOverviewFocus = graphql`
  mutation CourseOfActionEditionOverviewFocusMutation(
    $id: ID!
    $input: EditContext!
  ) {
    courseOfActionEdit(id: $id) {
      contextPatch(input: $input) {
        id
      }
    }
  }
`;

const courseOfActionMutationRelationAdd = graphql`
  mutation CourseOfActionEditionOverviewRelationAddMutation(
    $id: ID!
    $input: StixMetaRelationshipAddInput
  ) {
    courseOfActionEdit(id: $id) {
      relationAdd(input: $input) {
        from {
          ...CourseOfActionEditionOverview_courseOfAction
        }
      }
    }
  }
`;

const courseOfActionMutationRelationDelete = graphql`
  mutation CourseOfActionEditionOverviewRelationDeleteMutation(
    $id: ID!
    $toId: StixRef!
    $relationship_type: String!
  ) {
    courseOfActionEdit(id: $id) {
      relationDelete(toId: $toId, relationship_type: $relationship_type) {
        ...CourseOfActionEditionOverview_courseOfAction
      }
    }
  }
`;

const courseOfActionValidation = (t) => Yup.object().shape({
  name: Yup.string().required(t('This field is required')),
  description: Yup.string()
    .min(3, t('The value is too short'))
    .max(5000, t('The value is too long'))
    .required(t('This field is required')),
  x_opencti_threat_hunting: Yup.string().nullable(),
  x_opencti_log_sources: Yup.string().nullable(),
  references: Yup.array().required(t('This field is required')),
  x_opencti_workflow_id: Yup.object(),
  x_mitre_id: Yup.string().nullable(),
});

class CourseOfActionEditionOverviewComponent extends Component {
  handleChangeFocus(name) {
    commitMutation({
      mutation: courseOfActionEditionOverviewFocus,
      variables: {
        id: this.props.courseOfAction.id,
        input: {
          focusOn: name,
        },
      },
    });
  }

  onSubmit(values, { setSubmitting }) {
    const commitMessage = values.message;
    const references = R.pluck('value', values.references || []);
    const inputValues = R.pipe(
      R.dissoc('message'),
      R.dissoc('references'),
      R.assoc('x_opencti_workflow_id', values.x_opencti_workflow_id?.value),
      R.assoc('createdBy', values.createdBy?.value),
      R.assoc('objectMarking', R.pluck('value', values.objectMarking)),
      R.toPairs,
      R.map((n) => ({
        key: n[0],
        value: adaptFieldValue(n[1]),
      })),
    )(values);
    commitMutation({
      mutation: courseOfActionMutationFieldPatch,
      variables: {
        id: this.props.courseOfAction.id,
        input: inputValues,
        commitMessage:
          commitMessage && commitMessage.length > 0 ? commitMessage : null,
        references,
      },
      setSubmitting,
      onCompleted: () => {
        setSubmitting(false);
        this.props.handleClose();
      },
    });
  }

  handleSubmitField(name, value) {
    if (!this.props.enableReferences) {
      let finalValue = value;
      if (name === 'x_opencti_log_sources') {
        finalValue = split('\n', value);
      }
      if (name === 'x_opencti_workflow_id') {
        finalValue = value.value;
      }
      courseOfActionValidation(this.props.t)
        .validateAt(name, { [name]: value })
        .then(() => {
          commitMutation({
            mutation: courseOfActionMutationFieldPatch,
            variables: {
              id: this.props.courseOfAction.id,
              input: { key: name, value: finalValue ?? '' },
            },
          });
        })
        .catch(() => false);
    }
  }

  handleChangeCreatedBy(name, value) {
    if (!this.props.enableReferences) {
      commitMutation({
        mutation: courseOfActionMutationFieldPatch,
        variables: {
          id: this.props.courseOfAction.id,
          input: { key: 'createdBy', value: value.value || '' },
        },
      });
    }
  }

  handleChangeObjectMarking(name, values) {
    if (!this.props.enableReferences) {
      const { courseOfAction } = this.props;
      const currentMarkingDefinitions = pipe(
        pathOr([], ['objectMarking', 'edges']),
        map((n) => ({
          label: n.node.definition,
          value: n.node.id,
        })),
      )(courseOfAction);

      const added = difference(values, currentMarkingDefinitions);
      const removed = difference(currentMarkingDefinitions, values);

      if (added.length > 0) {
        commitMutation({
          mutation: courseOfActionMutationRelationAdd,
          variables: {
            id: this.props.courseOfAction.id,
            input: {
              toId: head(added).value,
              relationship_type: 'object-marking',
            },
          },
        });
      }

      if (removed.length > 0) {
        commitMutation({
          mutation: courseOfActionMutationRelationDelete,
          variables: {
            id: this.props.courseOfAction.id,
            toId: head(removed).value,
            relationship_type: 'object-marking',
          },
        });
      }
    }
  }

  render() {
    const { t, courseOfAction, context, enableReferences } = this.props;
    const createdBy = convertCreatedBy(courseOfAction);
    const objectMarking = convertMarkings(courseOfAction);
    const status = convertStatus(t, courseOfAction);
    const initialValues = pipe(
      assoc('createdBy', createdBy),
      assoc('objectMarking', objectMarking),
      assoc('x_opencti_workflow_id', status),
      pick([
        'name',
        'description',
        'x_mitre_id',
        'x_opencti_threat_hunting',
        'x_opencti_log_sources',
        'createdBy',
        'objectMarking',
        'x_opencti_workflow_id',
        'x_mitre_id',
      ]),
    )(courseOfAction);
    return (
      <Formik
        enableReinitialize={true}
        initialValues={initialValues}
        validationSchema={courseOfActionValidation(t)}
        onSubmit={this.onSubmit.bind(this)}
      >
        {({
          submitForm,
          isSubmitting,
          validateForm,
          setFieldValue,
          values,
        }) => (
          <Form style={{ margin: '20px 0 20px 0' }}>
            <Field
              component={TextField}
              variant="standard"
              name="name"
              label={t('Name')}
              fullWidth={true}
              onFocus={this.handleChangeFocus.bind(this)}
              onSubmit={this.handleSubmitField.bind(this)}
              helperText={
                <SubscriptionFocus context={context} fieldName="name" />
              }
            />
            <Field
              component={TextField}
              variant="standard"
              name="x_mitre_id"
              label={t('External ID')}
              fullWidth={true}
              style={{ marginTop: 20 }}
              onFocus={this.handleChangeFocus.bind(this)}
              onSubmit={this.handleSubmitField.bind(this)}
              helperText={
                <SubscriptionFocus context={context} fieldName="x_mitre_id" />
              }
            />
            <Field
              component={MarkDownField}
              name="description"
              label={t('Description')}
              fullWidth={true}
              multiline={true}
              rows="4"
              style={{ marginTop: 20 }}
              onFocus={this.handleChangeFocus.bind(this)}
              onSubmit={this.handleSubmitField.bind(this)}
              helperText={
                <SubscriptionFocus context={context} fieldName="description" />
              }
            />
            <Field
              component={MarkDownField}
              name="x_opencti_threat_hunting"
              label={t('Threat hunting techniques')}
              fullWidth={true}
              multiline={true}
              rows="4"
              style={{ marginTop: 20 }}
              onFocus={this.handleChangeFocus.bind(this)}
              onSubmit={this.handleSubmitField.bind(this)}
              helperText={
                <SubscriptionFocus
                  context={context}
                  fieldName="x_opencti_threat_hunting"
                />
              }
            />
            <Field
              component={TextField}
              variant="standard"
              name="x_opencti_log_sources"
              label={t('Log sources (1 / line)')}
              fullWidth={true}
              multiline={true}
              rows="4"
              style={{ marginTop: 20 }}
              onFocus={this.handleChangeFocus.bind(this)}
              onSubmit={this.handleSubmitField.bind(this)}
              helperText={
                <SubscriptionFocus
                  context={context}
                  fieldName="x_opencti_log_sources"
                />
              }
            />
            {courseOfAction.workflowEnabled && (
              <StatusField
                name="x_opencti_workflow_id"
                type="Course-Of-Action"
                onFocus={this.handleChangeFocus.bind(this)}
                onChange={this.handleSubmitField.bind(this)}
                setFieldValue={setFieldValue}
                style={{ marginTop: 20 }}
                helpertext={
                  <SubscriptionFocus
                    context={context}
                    fieldName="x_opencti_workflow_id"
                  />
                }
              />
            )}
            <CreatedByField
              name="createdBy"
              style={{ marginTop: 20, width: '100%' }}
              setFieldValue={setFieldValue}
              helpertext={
                <SubscriptionFocus context={context} fieldName="createdBy" />
              }
              onChange={this.handleChangeCreatedBy.bind(this)}
            />
            <ObjectMarkingField
              name="objectMarking"
              style={{ marginTop: 20, width: '100%' }}
              helpertext={
                <SubscriptionFocus
                  context={context}
                  fieldname="objectMarking"
                />
              }
              onChange={this.handleChangeObjectMarking.bind(this)}
            />
            {enableReferences && (
              <CommitMessage
                submitForm={submitForm}
                disabled={isSubmitting}
                validateForm={validateForm}
                setFieldValue={setFieldValue}
                values={values}
                id={courseOfAction.id}
              />
            )}
          </Form>
        )}
      </Formik>
    );
  }
}

CourseOfActionEditionOverviewComponent.propTypes = {
  classes: PropTypes.object,
  theme: PropTypes.object,
  t: PropTypes.func,
  courseOfAction: PropTypes.object,
  context: PropTypes.array,
  enableReferences: PropTypes.bool,
};

const CourseOfActionEditionOverview = createFragmentContainer(
  CourseOfActionEditionOverviewComponent,
  {
    courseOfAction: graphql`
      fragment CourseOfActionEditionOverview_courseOfAction on CourseOfAction {
        id
        name
        description
        x_opencti_threat_hunting
        x_opencti_log_sources
        x_mitre_id
        createdBy {
          ... on Identity {
            id
            name
            entity_type
          }
        }
        objectMarking {
          edges {
            node {
              id
              definition_type
              definition
              x_opencti_order
              x_opencti_color
            }
          }
        }
        status {
          id
          order
          template {
            name
            color
          }
        }
        workflowEnabled
      }
    `,
  },
);

export default compose(
  inject18n,
  withStyles(styles, { withTheme: true }),
)(CourseOfActionEditionOverview);
