import styled from "styled-components";
import { appTheme } from "../../../project/brand/project";

export const FooterText = styled.footer`
  display: flex;
  align-items: flex-end;
  margin-top: auto;
  padding: 0;
`;

export const QuoteCard = styled.div`
  position: relative;
  overflow: hidden;
  width: 100%;
  border-radius: 16px;
  padding: 18px 16px;
  background: linear-gradient(135deg, ${appTheme.primary.dark} 0%, ${appTheme.primary.base} 100%);
  color: ${appTheme.text.white};
  svg {
    position: absolute;
    right: -10px;
    bottom: -10px;
    width: 76px;
    height: 76px;
    opacity: 0.18;
  }
  p.quote {
    position: relative;
    margin: 0 0 10px 0;
    font-size: 13px;
    line-height: 1.5;
    font-style: italic;
  }
  p.ref {
    position: relative;
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    opacity: 0.85;
  }
`;

export const Nav = styled.nav`
  display: flex;
  flex-direction: column;
  color: ${(props) => props.theme.secForeground};

  a {
    text-decoration: none;
    padding: 0.5em 1em;
    color: ${(props) => props.theme.secForeground};
    text-transform: uppercase;
    height: 30px;
    display: flex;
    justify-content: left;
    align-items: center;
  }
  a:hover {
    background: rgb(2, 0, 36);
    background: linear-gradient(102deg, rgba(2, 0, 36, 1) 0%, rgba(25, 138, 214, 1) 0%, rgba(8, 34, 95, 0) 83%);
    box-shadow: rgb(0 0 0 / 16%) -1px 0px 4px;
  }
  a svg {
    margin-right: 10px;
  }
`;
