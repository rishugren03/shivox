export interface RawFetchedJob {
  externalId: string;
  title: string;
  description: string;
  location?: string;
  url: string;
  postedAt?: Date;
  rawJson: any;
}
