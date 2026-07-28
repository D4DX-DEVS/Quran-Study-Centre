import React from "react";
import { BookOpen } from "lucide-react";
import { FooterText, QuoteCard } from "./styels";

const Footer = () => {
  return (
    <FooterText>
      <QuoteCard className="sidebar-quote">
        <BookOpen strokeWidth={1.5} />
        <p className="quote">"And We have certainly made the Quran easy for remembrance"</p>
        <p className="ref">(Quran 54:17)</p>
      </QuoteCard>
    </FooterText>
  );
};

export default Footer;
