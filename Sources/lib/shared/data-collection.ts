/**
 * Json representation of the data collection related configuration
 */
type DataCollectionModel = {
  geoip: boolean;
};

/**
 * Internal representation of the DataCollection
 */
export type InternalDataCollection = {
  geoIP: boolean;
};

/**
 * DataCollection by default when omitted in sdk setup
 */
const defaultDataCollection: InternalDataCollection = {
  geoIP: false,
};

/**
 * Fill data collection configuration with default values for omitted fields
 * @param dataCollection
 */
export function fillDefaultDataCollectionConfiguration(
  dataCollection?: BatchSDK.ISDKDefaultDataCollectionConfiguration
): InternalDataCollection {
  return {
    ...defaultDataCollection,
    ...dataCollection,
  };
}

/**
 * Convert an InternalDataCollection into a DataCollectionModel.
 * @param dataCollection data collection to serialize
 */
export function serializeDataCollectionConfig(dataCollection: InternalDataCollection): DataCollectionModel {
  return {
    geoip: dataCollection.geoIP,
  };
}
