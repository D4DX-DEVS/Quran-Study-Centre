import styled from "styled-components";
import { appTheme } from "../../../project/brand/project";
export const Titles = styled.div`
  font-size: 14px;
  font-weight: bold;
  display: flex;
  flex-direction: column;
  gap: 5px;
`;
export const Summary = styled.div`
  font-size: 12px;
  color: grey;
`;
export const DashboardSection = styled.div`
  margin: 30px;
  display: grid;
  width: 100%;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, 250px);
  height: auto;
  align-content: flex-start;
  @media screen and (max-width: 560px) {
    grid-template-columns: auto;
    width: auto;
  }
`;

export const Tile = styled.div`
  padding: 20px;
  gap: 14px;
  border-radius: 16px;
  border: 1px solid ${appTheme.stroke.soft};
  background: ${appTheme.bg.white};
  display: flex;
  align-items: center;
`;

export const TitleBox = styled.div`
  margin-top: 0;
  display: flex;
  justify-content: baseline;
  flex-direction: column;
  gap: 6px;
`;
export const TitleHead = styled.span`
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
  letter-spacing: 0.02em;
  text-align: left;
  color: ${appTheme.text.sub};

  &.info {
    color: Blue;
  }
`;

export const Count = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: ${appTheme.text.main};
`;

export const IconWrapper = styled.div`
  height: 44px;
  width: 44px;
  border-radius: 12px;
  display: flex;
  align-self: center;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${appTheme.primary.lightest};
  color: ${appTheme.primary.base};
  svg {
    width: 20px;
    height: 20px;
  }
`;
export const TileContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  @media (max-width: 1024px) and (min-width: 641px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (max-width: 640px) {
    grid-template-columns: repeat(1, 1fr);
  }
`;
