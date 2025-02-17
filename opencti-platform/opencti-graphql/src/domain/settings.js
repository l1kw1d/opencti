import { getHeapStatistics } from 'v8';
import nconf from 'nconf';
import * as R from 'ramda';
import { createEntity, loadEntity, updateAttribute } from '../database/middleware';
import conf, { BUS_TOPICS, getBaseUrl, PLATFORM_VERSION } from '../config/conf';
import { delEditContext, getClusterInstances, getRedisVersion, notify, setEditContext } from '../database/redis';
import { isRuntimeSortEnable, searchEngineVersion } from '../database/engine';
import { getRabbitMQVersion } from '../database/rabbitmq';
import { ENTITY_TYPE_SETTINGS } from '../schema/internalObject';
import { isUserHasCapability, SETTINGS_SET_ACCESSES, SYSTEM_USER } from '../utils/access';
import { storeLoadById } from '../database/middleware-loader';
import { PROVIDERS } from '../config/providers';

export const getMemoryStatistics = () => {
  return { ...process.memoryUsage(), ...getHeapStatistics() };
};

const getModules = (clusterConfig) => {
  const allManagers = clusterConfig.map((i) => i.managers).flat();
  const groupManagersById = R.groupBy((manager) => manager.id, allManagers);
  return Object.entries(groupManagersById).map(([id, managers]) => ({
    id,
    enable: managers.reduce((acc, m) => acc || m.enable, false),
    running: managers.reduce((acc, m) => acc || m.running, false),
  }));
};

const getPlatformClusterInfo = (clusterConfig) => {
  return {
    instances_number: clusterConfig.length
  };
};

export const getApplicationInfo = (context) => ({
  version: PLATFORM_VERSION,
  memory: getMemoryStatistics(),
  dependencies: [
    { name: 'Search engine', version: searchEngineVersion().then((v) => `${v.distribution || 'elk'} - ${v.number}`) },
    { name: 'RabbitMQ', version: getRabbitMQVersion(context) },
    { name: 'Redis', version: getRedisVersion() },
  ],
  debugStats: {}, // Lazy loaded
});

export const getSettings = async (context) => {
  const platformSettings = await loadEntity(context, SYSTEM_USER, [ENTITY_TYPE_SETTINGS]);
  const instancesConfig = await getClusterInstances();
  return {
    ...platformSettings,
    platform_url: getBaseUrl(context.req),
    platform_providers: PROVIDERS,
    platform_cluster: getPlatformClusterInfo(instancesConfig),
    platform_modules: getModules(instancesConfig),
    platform_reference_attachment: conf.get('app:reference_attachment'),
    platform_map_tile_server_dark: nconf.get('app:map_tile_server_dark'),
    platform_map_tile_server_light: nconf.get('app:map_tile_server_light'),
    platform_feature_flags: [
      { id: 'RUNTIME_SORTING', enable: isRuntimeSortEnable() },
    ],
  };
};

export const addSettings = async (context, user, settings) => {
  const created = await createEntity(context, user, settings, ENTITY_TYPE_SETTINGS);
  return notify(BUS_TOPICS.Settings.ADDED_TOPIC, created, user);
};

export const settingsCleanContext = (context, user, settingsId) => {
  delEditContext(user, settingsId);
  return storeLoadById(context, user, settingsId, ENTITY_TYPE_SETTINGS).then((settings) => notify(BUS_TOPICS.Settings.EDIT_TOPIC, settings, user));
};

export const settingsEditContext = (context, user, settingsId, input) => {
  setEditContext(user, settingsId, input);
  return storeLoadById(context, user, settingsId, ENTITY_TYPE_SETTINGS).then((settings) => notify(BUS_TOPICS.Settings.EDIT_TOPIC, settings, user));
};

export const settingsEditField = async (context, user, settingsId, input) => {
  const hasSetAccessCapability = isUserHasCapability(user, SETTINGS_SET_ACCESSES);
  const data = hasSetAccessCapability ? input : input.filter((i) => i.key !== 'platform_organization' || 'otp_mandatory');
  const { element } = await updateAttribute(context, user, settingsId, ENTITY_TYPE_SETTINGS, data);
  return notify(BUS_TOPICS.Settings.EDIT_TOPIC, element, user);
};
