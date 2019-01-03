import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Route, Redirect } from 'react-router-dom';
import { QueryRenderer } from 'react-relay';
import graphql from 'babel-plugin-relay/macro';
import { withStyles } from '@material-ui/core/styles';
import environment from '../relay/environment';
import { ConnectedIntlProvider } from '../components/AppIntlProvider';
import { ConnectedDocumentTitle } from '../components/AppDocumentTitle';
import TopBar from './components/nav/TopBar';
import LeftBar from './components/nav/LeftBar';
import Dashboard from './components/Dashboard';
import ThreatActors from './components/ThreatActors';
import IntrusionSets from './components/IntrusionSets';
import Malwares from './components/Malwares';
import RootMalware from './components/malware/Root';
import Reports from './components/Reports';
import RootReport from './components/report/Root';
import Settings from './components/Settings';
import Users from './components/Users';
import Groups from './components/Groups';
import MarkingDefinitions from './components/MarkingDefinitions';
import KillChainPhases from './components/KillChainPhases';

const styles = theme => ({
  container: {
    flexGrow: 1,
    zIndex: 1,
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
  },
  content: {
    flexGrow: 1,
    backgroundColor: theme.palette.background.default,
    padding: '24px 24px 24px 84px',
    minWidth: 0,
  },
  message: {
    display: 'flex',
    alignItems: 'center',
  },
  messageIcon: {
    marginRight: theme.spacing.unit,
  },
  toolbar: theme.mixins.toolbar,
});

const rootQuery = graphql`
    query RootQuery {
        me {
            ...AppIntlProvider_me
            ...TopBar_me
        }
        settings {
            ...AppIntlProvider_settings
            ...AppDocumentTitle_settings
        }
    }
`;

class Root extends Component {
  render() {
    const { classes } = this.props;
    const paddingRight = 24;

    return (
      <QueryRenderer
        environment={environment}
        query={rootQuery}
        variables={{}}
        render={({ props }) => (
          <ConnectedIntlProvider me={props && props.me ? props.me : null} settings={props && props.settings ? props.settings : null}>
            <ConnectedDocumentTitle settings={props && props.settings ? props.settings : null}>
              <div className={classes.root}>
                <TopBar me={props && props.me ? props.me : null}/>
                <LeftBar/>
                <main className={classes.content} style={{ paddingRight }}>
                  <div className={classes.toolbar}/>
                  <Route exact path='/dashboard' component={Dashboard}/>
                  <Route exact path='/dashboard/knowledge' render={() => (
                    <Redirect to='/dashboard/knowledge/threat_actors'/>
                  )}/>
                  <Route exact path='/dashboard/knowledge/threat_actors' component={ThreatActors}/>
                  <Route exact path='/dashboard/knowledge/intrusion_sets' component={IntrusionSets}/>
                  <Route exact path='/dashboard/knowledge/malwares' component={Malwares}/>
                  <Route path='/dashboard/knowledge/malwares/:malwareId' render={routeProps => <RootMalware {...routeProps} me={props && props.me ? props.me : null}/>}/>
                  <Route exact path='/dashboard/reports' render={() => (
                    <Redirect to='/dashboard/reports/all'/>
                  )}/>
                  <Route exact path='/dashboard/reports/all' component={Reports}/>
                  <Route path='/dashboard/reports/all/:reportId' render={routeProps => <RootReport {...routeProps} me={props && props.me ? props.me : null}/>}/>
                  <Route exact path='/dashboard/settings' component={Settings}/>
                  <Route exact path='/dashboard/settings/users' component={Users}/>
                  <Route exact path='/dashboard/settings/groups' component={Groups}/>
                  <Route exact path='/dashboard/settings/marking' component={MarkingDefinitions}/>
                  <Route exact path='/dashboard/settings/killchains' component={KillChainPhases}/>
                </main>
              </div>
            </ConnectedDocumentTitle>
          </ConnectedIntlProvider>
        )}
      />
    );
  }
}

Root.propTypes = {
  classes: PropTypes.object,
  location: PropTypes.object,
};

export default withStyles(styles)(Root);
