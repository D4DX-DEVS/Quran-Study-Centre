import React, { useEffect, useState, useMemo, useCallback, memo } from "react";
import { LayoutDashboard } from "lucide-react";
import { GetIcon } from "../../../../icons";
import { ElementContainer, Select } from "../../elements";
import { Count, IconWrapper, Tile, TileContainer, TitleBox, TitleHead } from "./styles";
import { getData } from "../../../../backend/api";
import EmptyState from "../emptystate";
// import { SubPageHeader } from "../../input/heading";

// The dashboard summary endpoint has no branch for every role and can leave the request pending
// indefinitely; this guard makes sure the UI always settles into loaded/empty instead of spinning forever.
const FETCH_TIMEOUT_MS = 8000;
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve([]), ms))]);

const HighlightCards = memo(
  ({
    title = "No Title Found",
    description = "",
    dataType = "API",
    filterType = "JSON",
    parents = {},
    filters = [
      { id: 1, value: "January" },
      { id: 2, value: "February" },
      { id: 3, value: "March" },
    ],
    dataItem = "dashboard",
    hideFilter = true,
  }) => {
    const [filterItems, setFilterItems] = useState(filters);
    const [mainData, setMainData] = useState([]);
    const [filter, setFilter] = useState("");
    const [dataLoaded, setDataLoaded] = useState(false);

    const fetchData = useCallback(async (api, params) => {
      try {
        const response = await withTimeout(getData(params, api), FETCH_TIMEOUT_MS);
        if (response.status === 200) {
          return response.data;
        } else {
          return [];
        }
      } catch (error) {
        console.error(`Error fetching data from ${api}:`, error);
        return [];
      }
    }, []);

    useEffect(() => {
      const fetchMainData = async () => {
        if (dataType === "API" && !dataLoaded) {
          const data = await fetchData(dataItem, filter ? { ...parents, filter } : parents);
          setMainData(data);
          setDataLoaded(true);
        }
      };
      fetchMainData();
    }, [dataItem, dataType, filter, parents, fetchData, dataLoaded]);

    useEffect(() => {
      const fetchFilterItems = async () => {
        if (filterType === "API" && !dataLoaded) {
          const data = await fetchData(filters);
          setFilterItems(data);
          setDataLoaded(true);
        }
      };
      fetchFilterItems();
    }, [filters, filterType, fetchData, dataLoaded]);

    const renderedTiles = useMemo(() => {
      return mainData?.slice(0, 4).map((item, index) => (
        <Tile key={index}>
          <IconWrapper style={item.background || item.color ? { background: item.background, color: item.color } : undefined}>
            <GetIcon icon={item.icon} />
          </IconWrapper>
          <TitleBox>
            <TitleHead>{item.title}</TitleHead>
            <Count>{item.count}</Count>
          </TitleBox>
        </Tile>
      ));
    }, [mainData]);

    const handleFilterSelect = useCallback(
      (item) => {
        setFilter(item.id ?? "");
        setDataLoaded(false);
      },
      [setFilter, setDataLoaded]
    );

    return (
      <ElementContainer className="tiles column">
        {/* <SubPageHeader line={true} title={title} description={description} /> */}
        {!hideFilter && <Select label="Month" align="right small" value={filter} selectApi={filterItems} onSelect={handleFilterSelect} />}

        {!dataLoaded ? (
          <TileContainer>
            {Array.from({ length: 4 }).map((_, index) => (
              <Tile key={index} className="animate-pulse">
                <IconWrapper />
                <TitleBox>
                  <div className="h-3 w-16 rounded bg-bg-weak" />
                  <div className="h-5 w-10 rounded bg-bg-weak" />
                </TitleBox>
              </Tile>
            ))}
          </TileContainer>
        ) : mainData?.length > 0 ? (
          <TileContainer>{renderedTiles}</TileContainer>
        ) : (
          <EmptyState icon={LayoutDashboard} title="No summary data available" description="Key counts will appear here once available." />
        )}
      </ElementContainer>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.title === nextProps.title && prevProps.description === nextProps.description && prevProps.dataType === nextProps.dataType && prevProps.filterType === nextProps.filterType && JSON.stringify(prevProps.parents) === JSON.stringify(nextProps.parents) && JSON.stringify(prevProps.filters) === JSON.stringify(nextProps.filters) && prevProps.dataItem === nextProps.dataItem && prevProps.hideFilter === nextProps.hideFilter;
  }
);

export default HighlightCards;
