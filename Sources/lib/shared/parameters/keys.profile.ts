// ParameterKeys maps human-readable keys to their shortened version
export enum ProfileKeys {
  InstallationID = "di",
  CustomIdentifier = "cus",
  UserRegion = "ure",
  UserLanguage = "ula",
  UserProfileVersion = "upv",
  Subscription = "subscription",
  Subscribed = "subscribed",
  LastConfiguration = "lastconfig",
  Probation = "outOfProbation",
  // Old probation status, which is set to true when actually out of probation
  // We renamed the key to be more explicit
  LegacyProbation = "probation",
}
