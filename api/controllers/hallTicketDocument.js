// Hall ticket PDF, built entirely with @react-pdf/renderer.
//
// We moved off pdf-lib (which stamped data onto a flat template image) because
// pdf-lib cannot shape complex Malayalam — conjunct clusters like "അന്നാസ്"
// and "പരീക്ഷാ കേന്ദ്രം" came out congested/boxed. @react-pdf/renderer has a
// real text-shaping engine, so every bit of Malayalam (headings, instructions
// and the student's exam name) renders correctly. The whole ticket — logo,
// seal, signature, title, table, instructions — is drawn here from scratch, so
// there is no longer any template PDF dependency.
const path = require("path");
const fs = require("fs");
const React = require("react");
const { Document, Page, View, Text, Image, StyleSheet, Font, renderToBuffer } = require("@react-pdf/renderer");

const e = React.createElement;
const ASSETS = path.join(__dirname, "hallTicketAssets");

Font.register({ family: "Malayalam", src: path.join(ASSETS, "NotoSansMalayalam-Regular.ttf") });
// Keep long Malayalam words from being force-broken mid-cluster.
Font.registerHyphenationCallback((word) => [word]);

// react-pdf running in Node treats a bare filesystem path in Image `src` as a
// URL and fails to fetch it. Embedding the JPEGs as base64 data URIs is the
// reliable way to ship local images in a headless render.
const dataUri = (file) => `data:image/jpeg;base64,${fs.readFileSync(path.join(ASSETS, file)).toString("base64")}`;
const LOGO = dataUri("logo.jpg");
const SEAL = dataUri("seal.jpg");
const SIGN = dataUri("signature.jpg");

// Fixed exam schedule shown on every ticket (was baked into the old template).
const EXAM_DATE = "2026 August 02";
const EXAM_TIME = "10am to 11.30am";

const ROWS = [
  { en: "REGISTER NUMBER", ml: "രജിസ്റ്റർ നമ്പർ" },
  { en: "NAME OF STUDENT", ml: "പഠിതാവിന്റെ പേര്" },
  { en: "DISTRICT & AREA", ml: "ജില്ല & ഏരിയ" },
  { en: "EXAM CENTRE", ml: "പരീക്ഷാ കേന്ദ്രം" },
  { en: "NAME OF EXAM", ml: "പരീക്ഷയുടെ പേര്" },
];

const INSTRUCTIONS = [
  "പരീക്ഷ ആരംഭിക്കുന്നതിന്റെ 15 മിനിറ്റ് മുമ്പ് പഠിതാക്കൾ പരീക്ഷാകേന്ദ്രത്തിൽ എത്തേണ്ടതാണ്.",
  "ആൻസർ ഷീറ്റിൽ രജിസ്റ്റർ നമ്പർ മാത്രമാണ് എഴുതേണ്ടത്.",
  "പരീക്ഷ ഒബ്ജക്റ്റീവ് ടൈപ്പ് ആയതിനാൽ ഓപ്ഷൻ ടിക്ക് ചെയ്യുന്നതിന് ആവശ്യമായ പേന, പെൻസിൽ, ഇറേസർ എന്നിവ കരുതേണ്ടതാണ്",
];

// Page/sheet chrome: an A4 page holding two ticket halves stacked, with a
// dashed cut line between them.
const styles = StyleSheet.create({
  sheetPage: { fontSize: 11, color: "#000" },
  ticketHalf: { height: "50%", paddingHorizontal: 26, paddingTop: 18, paddingBottom: 10 },
  cutLine: { borderTopWidth: 1, borderTopColor: "#999", borderStyle: "dashed", marginHorizontal: 20 },
});

// The ticket itself: compact enough that a full ticket fits within half of
// an A4 page (every ticket is printed two-up — see printPage below).
const sheetStyles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  logo: { width: 112, height: 43, objectFit: "contain" },
  titleCol: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  titleMl: { fontFamily: "Malayalam", fontSize: 14, textAlign: "center" },
  subTitleMl: { fontFamily: "Malayalam", fontSize: 11, textAlign: "center", marginTop: 1 },
  banner: { backgroundColor: "#000", borderRadius: 11, paddingVertical: 3, paddingHorizontal: 16, marginTop: 4 },
  bannerText: { fontFamily: "Malayalam", fontSize: 14, color: "#fff", textAlign: "center" },
  dateBox: { borderWidth: 1, borderColor: "#000", padding: 4, width: 112, alignItems: "center" },
  dateHead: { fontFamily: "Helvetica-Bold", fontSize: 7.5, textAlign: "center", textDecoration: "underline", marginBottom: 2 },
  dateLine: { fontSize: 7.5, textAlign: "center" },

  table: { borderWidth: 1, borderColor: "#000" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#000" },
  rowLast: { flexDirection: "row" },
  labelCell: { width: "34%", borderRightWidth: 1, borderRightColor: "#000", paddingVertical: 4, paddingHorizontal: 7, justifyContent: "center" },
  valueCell: { flex: 1, paddingVertical: 4, paddingHorizontal: 10, justifyContent: "center" },
  labelEn: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  labelMl: { fontFamily: "Malayalam", fontSize: 9.5, marginTop: 1 },
  valueEn: { fontFamily: "Helvetica", fontSize: 12.5 },
  valueMl: { fontFamily: "Malayalam", fontSize: 11, lineHeight: 1.3 },

  instrWrap: { flexDirection: "row", marginTop: 8 },
  instrCol: { flex: 1, paddingRight: 10 },
  instrHead: { fontFamily: "Malayalam", fontSize: 11, color: "#c00000", textDecoration: "underline", marginBottom: 4 },
  instrItem: { flexDirection: "row", marginBottom: 3 },
  instrNum: { width: 14, fontSize: 9.5 },
  instrText: { fontFamily: "Malayalam", fontSize: 9.5, flex: 1, lineHeight: 1.3 },
  signCol: { width: 168, flexDirection: "row", alignItems: "flex-start", justifyContent: "center" },
  seal: { width: 64, height: 64, objectFit: "contain" },
  signInner: { width: 92, alignItems: "center" },
  sign: { width: 58, height: 56, objectFit: "contain" },
  caption: { fontFamily: "Malayalam", fontSize: 8, textAlign: "center", marginTop: 2 },
});

const isMalayalam = (s) => /[ഀ-ൿ]/.test(s || "");

// react-pdf's line-breaker sometimes wraps mid-conjunct in Malayalam,
// orphaning a virama (്) onto the next line (e.g. "ചെയ്യുന്നതിന" / "് ...").
// Rendering each word as its own nested <Text> forces every break to land on
// a real word boundary, which sidesteps the bug without touching the text.
const wrapText = (s) => {
  const words = (s || "").split(" ");
  return words.map((w, i) => e(Text, { key: i }, i < words.length - 1 ? w + " " : w));
};

const valueText = (v, st) => {
  if (!v) return e(Text, { style: st.valueEn }, "");
  return isMalayalam(v)
    ? e(Text, { style: st.valueMl }, ...wrapText(v))
    : e(Text, { style: st.valueEn }, v);
};

// The ticket content (header + table + instructions), without a Page wrapper,
// styled with sheetStyles so it fits within half of an A4 page.
const ticketBody = ({ regno, name, district, examCentre, examName }, key, st = sheetStyles) =>
  e(
    View,
    { key },
    // ---- Header: logo | title + banner | date box ----
    e(
      View,
      { style: st.header },
      e(Image, { src: LOGO, style: st.logo }),
      e(
        View,
        { style: st.titleCol },
        e(Text, { style: st.titleMl }, "ഖുർആൻ സ്റ്റഡി സെന്റർ കേരള"),
        e(Text, { style: st.subTitleMl }, "വാർഷിക പരീക്ഷ 2026"),
        e(View, { style: st.banner }, e(Text, { style: st.bannerText }, "ഹാൾ ടിക്കറ്റ്"))
      ),
      e(
        View,
        { style: st.dateBox },
        e(Text, { style: st.dateHead }, "Date & Time of Exam"),
        e(Text, { style: st.dateLine }, EXAM_DATE),
        e(Text, { style: st.dateLine }, EXAM_TIME)
      )
    ),

    // ---- Details table ----
    e(
      View,
      { style: st.table },
      ...ROWS.map((r, i) => {
        const last = i === ROWS.length - 1;
        const values = [regno, name, district, examCentre, examName];
        return e(
          View,
          { key: i, style: last ? st.rowLast : st.row },
          e(
            View,
            { style: st.labelCell },
            e(Text, { style: st.labelEn }, r.en),
            e(Text, { style: st.labelMl }, r.ml)
          ),
          e(View, { style: st.valueCell }, valueText(values[i], st))
        );
      })
    ),

    // ---- Instructions + seal/signature ----
    e(
      View,
      { style: st.instrWrap },
      e(
        View,
        { style: st.instrCol },
        e(Text, { style: st.instrHead }, "നിർദേശങ്ങൾ"),
        ...INSTRUCTIONS.map((t, i) =>
          e(
            View,
            { key: i, style: st.instrItem },
            e(Text, { style: st.instrNum }, `${i + 1}.`),
            e(Text, { style: st.instrText }, ...wrapText(t))
          )
        )
      ),
      e(
        View,
        { style: st.signCol },
        e(Image, { src: SEAL, style: st.seal }),
        e(
          View,
          { style: st.signInner },
          e(Image, { src: SIGN, style: st.sign }),
          e(Text, { style: st.caption }, "കൺട്രോളർ ഓഫ് എക്സാമിനേഷൻ")
        )
      )
    )
  );

// Renders one A4 page holding two ticket halves (top/bottom) with a dashed
// cut line between them. `bottomProps` defaults to the same student as
// `topProps`, which is what a single student's own download uses — one A4
// page, their ticket printed twice, so cutting the sheet gives them a spare.
const printPage = (topProps, bottomProps, key) =>
  e(
    Page,
    { key, size: "A4", style: styles.sheetPage, wrap: false },
    e(View, { style: styles.ticketHalf, wrap: false }, ticketBody(topProps, "t0", sheetStyles)),
    e(View, { style: styles.cutLine }),
    bottomProps
      ? e(View, { style: styles.ticketHalf, wrap: false }, ticketBody(bottomProps, "t1", sheetStyles))
      : e(View, { style: styles.ticketHalf })
  );

// A single student's hall ticket: ONE copy, on a full A4 page, with the
// ticket itself kept at the compact (half-A4) size and placed in the top
// half — the bottom half stays blank. The page is deliberately full A4, not
// a custom half-height size: printers apply "fit to page" to whatever paper
// they're loaded with, so a smaller custom page size gets scaled UP to fill
// the physical A4 sheet, stretching the ticket oversized (that's what
// happened when this was a half-height page). Matching the page to the
// actual A4 paper means no scaling happens, so the ticket prints at its
// designed compact size instead of being blown up.
const HallTicketDoc = (props) =>
  e(
    Document,
    { title: `Hall Ticket - ${props.regno || ""}`, author: "Quran Study Centre Kerala" },
    e(
      Page,
      { size: "A4", style: { fontSize: 11, color: "#000", paddingHorizontal: 26, paddingTop: 24 } },
      ticketBody(props, "p0", sheetStyles)
    )
  );

// Two-up print sheet: A4 pages, each holding two DIFFERENT students' tickets
// stacked vertically with a dashed cut line between them. `propsList` is an
// array of buildProps() results; pages are filled two per sheet in order.
const HallTicketSheetDoc = ({ propsList }) => {
  const pages = [];
  for (let i = 0; i < propsList.length; i += 2) {
    const pair = propsList.slice(i, i + 2);
    pages.push(printPage(pair[0], pair[1], i));
  }
  return e(Document, { title: "Hall Tickets - Print Sheet", author: "Quran Study Centre Kerala" }, ...pages);
};

// Collapse hard line breaks / tabs / repeated spaces into single spaces so the
// text flows and react-pdf can wrap it to fit the cell. Some exam-name records
// carry an embedded "\n" and double spaces (e.g. "...മുതൽ\nസൂറ അന്നാസ്  വരെ"),
// which otherwise force an ugly mid-sentence break.
// Collapse whitespace, trim, and uppercase. toUpperCase leaves Malayalam
// unchanged (that script is caseless), so only the Latin parts of a value —
// e.g. the "Preliminary I:" prefix on the exam name — are affected.
const cleanText = (v) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim().toUpperCase());

// Join non-empty parts with ", " (e.g. "ALAPPUZHA, CHERTHALA").
const joinParts = (...parts) => parts.map(cleanText).filter(Boolean).join(", ");

// Normalize a populated examRegistration doc into the flat props the document
// needs, mirroring the field fallbacks the old pdf-lib renderer used.
const buildProps = (user) => ({
  regno: cleanText(user.regno) || "NIL",
  name: cleanText(user.nameOfApplicant) || "NIL",
  // "District & Area" row shows both, comma separated.
  district: joinParts(user.district?.district, user.area?.area) || "NIL",
  examCentre:
    cleanText(
      user.assignedExamCenter?.nameOfCenter ||
        user.examCenter?.centerName ||
        user.outsideExamCenter?.centerName ||
        user.centerRegistration?.nameOfCenter
    ) || "NIL",
  examName: cleanText(user.nameOfExamAppearingNow?.examType) || "NIL",
});

// Renders one student's hall ticket and returns the PDF as a Buffer.
const renderHallTicketPdf = async (user) => {
  const props = buildProps(user);
  return renderToBuffer(e(HallTicketDoc, props));
};

// Renders a two-up print sheet (2 students per A4 page) for a list of students.
const renderHallTicketSheet = async (users) => {
  const propsList = users.map(buildProps);
  return renderToBuffer(e(HallTicketSheetDoc, { propsList }));
};

module.exports = { renderHallTicketPdf, renderHallTicketSheet, HallTicketDoc, buildProps };
