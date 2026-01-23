// src/component/Dataset.js

export class Dataset {
  constructor({
    Name,
    FullName,
    Dataset_ID,
    DatabaseStore,
    OriginalLocation,
    StartDate,
    EndDate,
    Units,
    DefaultLevel
  }) {
    this.Name = Name;
    this.FullName = FullName;
    this.Dataset_ID = Dataset_ID;
    this.DatabaseStore = DatabaseStore;
    this.OriginalLocation = OriginalLocation;
    this.StartDate = StartDate;
    this.EndDate = EndDate;
    this.Units = Units;
    this.DefaultLevel = DefaultLevel;
  }
}
