export type ParsedLine = {
  value: string;
  actions: {
    namespace: string;
    key: string;
    value: string;
  }[];
};
