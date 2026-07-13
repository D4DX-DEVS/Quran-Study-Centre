import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { logo } from "../../../../images";
import { projectSettings } from "../../brand/project";
import StickerTable from "./StickerTable";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    padding: 16,
  },
  card: {
    flex: 1,
    borderWidth: 1.2,
    borderColor: "#b7bec9",
    borderRadius: 10,
    padding: 16,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    alignItems: "center",
    borderBottomWidth: 0.75,
    borderBottomColor: "#dde1e8",
    paddingBottom: 8,
    marginBottom: 10,
  },
  logo: {
    width: 42,
    height: 42,
    marginBottom: 4,
    objectFit: "contain",
  },
  orgName: {
    fontSize: 11,
    fontWeight: 700,
    color: "#13284a",
    textAlign: "center",
  },
  docTitle: {
    fontSize: 8,
    color: "#6d7f9e",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heading: {
    fontSize: 16,
    fontWeight: 700,
    color: "#13284a",
    textAlign: "center",
    marginBottom: 8,
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    marginBottom: 10,
  },
  detailItem: {
    fontSize: 8.5,
    color: "#3d4a63",
  },
  detailLabel: {
    color: "#8994a8",
  },
  totalBox: {
    borderWidth: 1,
    borderColor: "#c7ccd6",
    borderRadius: 8,
    backgroundColor: "#f4f6fa",
    paddingVertical: 8,
    marginBottom: 6,
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 9,
    color: "#3d4a63",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 700,
    color: "#13284a",
    marginTop: 2,
  },
  footer: {
    marginTop: "auto",
    paddingTop: 8,
    borderTopWidth: 0.75,
    borderTopColor: "#dde1e8",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7.5,
    color: "#8994a8",
  },
  warningBox: {
    borderWidth: 1,
    borderColor: "#f3c3bc",
    backgroundColor: "#fff5f4",
    borderRadius: 8,
    padding: 6,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 7.5,
    color: "#b42318",
    textAlign: "center",
  },
});

const formatDate = (date) =>
  date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

// One printable A5 sticker for a single exam center. `sticker` is the shape
// returned by GET /api/v1/exam-center-stickers/:examCenterId (or one item of
// /list) — see api/controllers/examCenterStickers.js#buildStickerResponse.
const StickerDocument = ({ sticker, generatedAt }) => {
  const generatedDate = generatedAt || new Date();

  return (
    <Document author={projectSettings.title} subject="Exam Center Sticker" title={`${sticker?.examCenterName || "Exam Center"} - Sticker`}>
      <Page size="A5" orientation="portrait" style={styles.page}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Image src={logo} style={styles.logo} />
            <Text style={styles.orgName}>{projectSettings.title}</Text>
            <Text style={styles.docTitle}>Exam Center Sticker</Text>
          </View>

          <Text style={styles.heading}>{sticker?.examCenterName || ""}</Text>

          <View style={styles.detailsRow}>
            <Text style={styles.detailItem}>
              <Text style={styles.detailLabel}>District: </Text>
              {sticker?.district || "-"}
            </Text>
            <Text style={styles.detailItem}>
              <Text style={styles.detailLabel}>Area: </Text>
              {sticker?.area || "-"}
            </Text>
            <Text style={styles.detailItem}>
              <Text style={styles.detailLabel}>Generated: </Text>
              {formatDate(generatedDate)}
            </Text>
          </View>

          {sticker?.hasIncompleteRegno && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>Attendance Register numbers have not been generated for this Exam Center.</Text>
            </View>
          )}

          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total Students</Text>
            <Text style={styles.totalValue}>{sticker?.totalStudents ?? 0}</Text>
          </View>

          <StickerTable exams={sticker?.exams || []} />

          <View style={styles.footer}>
            <Text style={styles.footerText}>{formatDate(generatedDate)}</Text>
            <Text style={styles.footerText}>
              {sticker?.district || "-"} / {sticker?.area || "-"}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default StickerDocument;
