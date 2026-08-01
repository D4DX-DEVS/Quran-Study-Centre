import styled from "styled-components";
import { appTheme } from "../../../project/brand/project";

export const PageFooterBar = styled.footer`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  width: 100%;
  padding: 20px 32px;
  box-sizing: border-box;
  background: ${appTheme.bg.white};
  border-top: 1px solid ${appTheme.stroke.soft};

  .copyright,
  .credit {
    margin: 0;
    color: ${appTheme.primary.base};
    font-size: 13px;
  }

  @media screen and (max-width: 600px) {
    flex-direction: column;
    gap: 8px;
    text-align: center;
    padding: 16px 20px;
  }
`;
