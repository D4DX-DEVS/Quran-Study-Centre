import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  table: {
    display: "table",
    width: "100%",
    borderStyle: "solid",
    borderColor: "#c7ccd6",
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    marginTop: 6,
  },
  tr: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#c7ccd6",
    borderTopWidth: 0,
  },
  th: {
    padding: 5,
    fontSize: 8,
    fontWeight: 700,
    textAlign: "left",
    borderRightWidth: 1,
    borderRightColor: "#c7ccd6",
    backgroundColor: "#f4f6fa",
  },
  td: {
    padding: 5,
    fontSize: 8,
    textAlign: "left",
    borderRightWidth: 1,
    borderRightColor: "#c7ccd6",
  },
  colExam: { width: "40%" },
  colFrom: { width: "22%" },
  colTo: { width: "20%" },
  colCount: { width: "18%", textAlign: "right" },
  emptyRow: {
    padding: 8,
    fontSize: 8,
    color: "#7a8291",
    textAlign: "center",
  },
});

// Exam-wise register-number-range table used inside the Exam Center Sticker
// PDF. `exams` is already sorted by configured exam order (ExamType.sortOrder)
// by the backend aggregation — this component just renders it.
const StickerTable = ({ exams = [] }) => (
  <View style={styles.table}>
    <View style={styles.tr}>
      <View style={[styles.th, styles.colExam]}>
        <Text>Exam Name</Text>
      </View>
      <View style={[styles.th, styles.colFrom]}>
        <Text>Register No. From</Text>
      </View>
      <View style={[styles.th, styles.colTo]}>
        <Text>Register No. To</Text>
      </View>
      <View style={[styles.th, styles.colCount, { borderRightWidth: 0 }]}>
        <Text>Students</Text>
      </View>
    </View>
    {exams.map((exam, index) => (
      <View style={styles.tr} key={`${exam.examName}-${index}`}>
        <View style={[styles.td, styles.colExam]}>
          <Text>{exam.examName}</Text>
        </View>
        <View style={[styles.td, styles.colFrom]}>
          <Text>{exam.regnoFrom}</Text>
        </View>
        <View style={[styles.td, styles.colTo]}>
          <Text>{exam.regnoTo}</Text>
        </View>
        <View style={[styles.td, styles.colCount, { borderRightWidth: 0 }]}>
          <Text>{exam.studentCount}</Text>
        </View>
      </View>
    ))}
    {exams.length === 0 && (
      <View style={styles.tr}>
        <Text style={styles.emptyRow}>No exam-wise data available</Text>
      </View>
    )}
  </View>
);

export default StickerTable;
