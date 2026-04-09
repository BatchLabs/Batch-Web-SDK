import { ProfileAttributeType, ProfileNativeAttributeType } from "com.batch.shared/profile/profile-data-types";

export enum ProfileDataOperation {
  SetAttribute = "SET_ATTRIBUTE",
  RemoveAttribute = "REMOVE_ATTRIBUTE",
  AddToArray = "ADD_TO_ARRAY",
  RemoveFromArray = "REMOVE_FROM_ARRAY",
  SetLanguage = "SET_LANGUAGE",
  SetRegion = "SET_REGION",
  SetEmail = "SET_EMAIL",
  SetEmailMarketingSubscriptionState = "SET_EMAIL_MARKETING_SUBSCRIPTION_STATE",
  SetTopicPreferences = "SET_TOPIC_PREFERENCES",
  AddToTopicPreferences = "ADD_TO_TOPIC_PREFERENCES",
  RemoveFromTopicPreferences = "REMOVE_FROM_TOPIC_PREFERENCES",
}

type SetAttributeOperation = {
  operation: ProfileDataOperation.SetAttribute;
  key: string;
  value: string | number | boolean | Set<string>;
  type: ProfileAttributeType;
};

type RemoveAttributeOperation = {
  operation: ProfileDataOperation.RemoveAttribute;
  key: string;
};

type PutInAttributeOperation = {
  operation: ProfileDataOperation.AddToArray;
  key: string;
  value: Array<string>;
};

type RemoveInAttributeOperation = {
  operation: ProfileDataOperation.RemoveFromArray;
  key: string;
  value: Array<string>;
};

type SetLanguageOperation = {
  operation: ProfileDataOperation.SetLanguage;
  key: ProfileNativeAttributeType.LANGUAGE;
  value: string | null;
};
type SetRegionOperation = {
  operation: ProfileDataOperation.SetRegion;
  key: ProfileNativeAttributeType.REGION;
  value: string | null;
};

type SetEmailOperation = {
  operation: ProfileDataOperation.SetEmail;
  key: ProfileNativeAttributeType.EMAIL;
  value: string | null;
};

type SetEmailMarketingSubscriptionStateOperation = {
  operation: ProfileDataOperation.SetEmailMarketingSubscriptionState;
  key: ProfileNativeAttributeType.EMAIL_MARKETING;
  value: string;
};

type SetTopicPreferencesOperation = {
  operation: ProfileDataOperation.SetTopicPreferences;
  key: ProfileNativeAttributeType.TOPIC_PREFERENCES;
  value: Array<string> | null;
};

type AddToTopicPreferencesOperation = {
  operation: ProfileDataOperation.AddToTopicPreferences;
  key: ProfileNativeAttributeType.TOPIC_PREFERENCES;
  value: Array<string>;
};

type RemoveFromTopicPreferencesOperation = {
  operation: ProfileDataOperation.RemoveFromTopicPreferences;
  key: ProfileNativeAttributeType.TOPIC_PREFERENCES;
  value: Array<string>;
};

export type IProfileNativeOperations =
  | SetLanguageOperation
  | SetRegionOperation
  | SetEmailOperation
  | SetEmailMarketingSubscriptionStateOperation
  | SetTopicPreferencesOperation
  | AddToTopicPreferencesOperation
  | RemoveFromTopicPreferencesOperation;

export type IProfileOperation =
  | RemoveAttributeOperation
  | SetAttributeOperation
  | PutInAttributeOperation
  | RemoveInAttributeOperation
  | IProfileNativeOperations;
