import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getDatasets, getDates } from "../api/netcdf";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [datasets, setDatasets] = useState([]);           // [{database, variable, url}]
  const [selectedDataset, setSelectedDataset] = useState(""); // DatabaseStore string
  const [availableDates, setAvailableDates] = useState([]);   // ["YYYY-MM-DD", ...]
  const [selectedYM, setSelectedYM] = useState("");           // "YYYY-MM" (UI month)

  // load datasets on mount
  useEffect(() => {
    (async () => {
      const list = await getDatasets();
      setDatasets(list);
      if (list.length && !selectedDataset) {
        setSelectedDataset(list[0].database);
      }
    })().catch(console.error);
  }, []);

  // when dataset changes, load dates and default YM
  useEffect(() => {
    if (!selectedDataset) return;
    (async () => {
      const dates = await getDates(selectedDataset);
      setAvailableDates(dates);
      const first = dates?.[0];
      if (first) setSelectedYM(first.slice(0, 7)); // YYYY-MM from first date
    })().catch(console.error);
  }, [selectedDataset]);

  const value = useMemo(() => ({
    datasets,
    selectedDataset, setSelectedDataset,
    availableDates,
    selectedYM, setSelectedYM
  }), [datasets, selectedDataset, availableDates, selectedYM]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
