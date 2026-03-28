const escapeCsvCell = (value) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, "\"\"")}"`;
  return text;
};

export const toCsv = (headers, rows) => {
  const headerRow = headers.map(escapeCsvCell).join(",");
  const dataRows = rows.map((row) => row.map(escapeCsvCell).join(","));
  return [headerRow, ...dataRows].join("\n");
};

const escapePdfText = (value) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

export const buildSimplePdf = (lines) => {
  const safeLines = (Array.isArray(lines) ? lines : [String(lines || "")]).slice(0, 45);
  const streamLines = ["BT", "/F1 12 Tf", "14 TL", "50 800 Td"];

  safeLines.forEach((line, index) => {
    if (index > 0) streamLines.push("T*");
    streamLines.push(`(${escapePdfText(line)}) Tj`);
  });
  streamLines.push("ET");

  const stream = streamLines.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];

  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((content, index) => {
    offsets.push(Buffer.byteLength(body, "utf8"));
    body += `${index + 1} 0 obj\n${content}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(body, "utf8");
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  body += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(body, "utf8");
};

const buildPdfWithFonts = (stream, fonts = ["Helvetica"]) => {
  const fontObjects = fonts.map((fontName) => `<< /Type /Font /Subtype /Type1 /BaseFont /${fontName} >>`);
  const fontEntries = fontObjects
    .map((_, index) => `/F${index + 1} ${5 + index} 0 R`)
    .join(" ");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << ${fontEntries} >> >> >>`,
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    ...fontObjects
  ];

  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((content, index) => {
    offsets.push(Buffer.byteLength(body, "utf8"));
    body += `${index + 1} 0 obj\n${content}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(body, "utf8");
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  body += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(body, "utf8");
};

const buildPdfWithFontsMultiPage = (pageStreams, fonts = ["Helvetica"]) => {
  const safeStreams = (Array.isArray(pageStreams) ? pageStreams : [String(pageStreams || "")]).filter(Boolean);
  const pageCount = safeStreams.length || 1;
  const fontObjects = fonts.map((fontName) => `<< /Type /Font /Subtype /Type1 /BaseFont /${fontName} >>`);
  const fontStartId = 3 + (pageCount * 2);
  const fontEntries = fontObjects
    .map((_, index) => `/F${index + 1} ${fontStartId + index} 0 R`)
    .join(" ");

  const pageObjectIds = Array.from({ length: pageCount }, (_, index) => 3 + (index * 2));
  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(" ");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`
  ];

  safeStreams.forEach((stream, index) => {
    const pageObjId = 3 + (index * 2);
    const contentObjId = pageObjId + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentObjId} 0 R /Resources << /Font << ${fontEntries} >> >> >>`
    );
    objects.push(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
  });

  objects.push(...fontObjects);

  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((content, index) => {
    offsets.push(Buffer.byteLength(body, "utf8"));
    body += `${index + 1} 0 obj\n${content}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(body, "utf8");
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  body += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(body, "utf8");
};

const limitText = (text, max = 46) => {
  const raw = String(text ?? "");
  return raw.length > max ? `${raw.slice(0, max - 3)}...` : raw;
};

export const buildStudentReportCardPdf = (data) => {
  const pageWidth = 595;
  const pageHeight = 842;
  const commands = [];
  const toPdfY = (top) => pageHeight - top;
  const safe = (value) => escapePdfText(value);

  const textTop = (value, x, top, { font = "F1", size = 10, align = "left", color = [0, 0, 0] } = {}) => {
    const text = safe(value);
    const widthApprox = String(value ?? "").length * size * 0.5;
    const xPos = align === "center" ? x - (widthApprox / 2) : align === "right" ? x - widthApprox : x;
    const yPos = toPdfY(top);
    commands.push(`${color[0]} ${color[1]} ${color[2]} rg`);
    commands.push(`BT /${font} ${size} Tf 1 0 0 1 ${xPos.toFixed(2)} ${yPos.toFixed(2)} Tm (${text}) Tj ET`);
  };

  const rectTop = (x, top, w, h, mode = "S", stroke = [0.55, 0.55, 0.55], fill = null, lineWidth = 1) => {
    const y = pageHeight - top - h;
    commands.push(`${lineWidth} w`);
    commands.push(`${stroke[0]} ${stroke[1]} ${stroke[2]} RG`);
    if (fill) commands.push(`${fill[0]} ${fill[1]} ${fill[2]} rg`);
    commands.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${mode}`);
  };

  const lineTop = (x1, top1, x2, top2, stroke = [0.55, 0.55, 0.55], lineWidth = 1) => {
    commands.push(`${lineWidth} w`);
    commands.push(`${stroke[0]} ${stroke[1]} ${stroke[2]} RG`);
    commands.push(`${x1.toFixed(2)} ${toPdfY(top1).toFixed(2)} m ${x2.toFixed(2)} ${toPdfY(top2).toFixed(2)} l S`);
  };

  const schoolName = limitText(data.schoolName || "Little Flower Matric Hr.Sec.School", 58);
  const schoolAddress = limitText(data.schoolAddress || "Sathyamangalam-638401", 58);
  const subjects = Array.isArray(data.subjects) ? data.subjects : [];
  const normalizedSubjects = subjects.map((row) => {
    const marks = Number(row.marks ?? 0);
    const totalMarks = Number(row.totalMarks ?? 100);
    const percentage = Number(row.percentage ?? (totalMarks ? (marks / totalMarks) * 100 : 0));
    return {
      subject: row.subject || row.name || "",
      marks: Number(marks.toFixed(1)),
      totalMarks: Number(totalMarks.toFixed(1)),
      percentage: Number(percentage.toFixed(1)),
      grade: row.grade || row.q1 || "-"
    };
  });
  const paddedRows = [...normalizedSubjects];
  while (paddedRows.length < 7) paddedRows.push({ subject: "", marks: "", totalMarks: "", percentage: "", grade: "" });
  const shownRows = paddedRows.slice(0, 8);

  rectTop(24, 20, 547, 802, "S", [0.45, 0.45, 0.45], null, 1.2);

  textTop(schoolName, pageWidth / 2, 55, { font: "F2", size: 16, align: "center", color: [0.12, 0.12, 0.12] });
  textTop(schoolAddress, pageWidth / 2, 78, { font: "F1", size: 11, align: "center", color: [0.3, 0.3, 0.3] });
  textTop("STUDENT REPORT CARD", pageWidth / 2, 117, { font: "F2", size: 34, align: "center", color: [0.2, 0.22, 0.25] });
  textTop(`Student ID: ${data.studentId || "-"}`, pageWidth / 2, 138, { font: "F1", size: 10, align: "center", color: [0.45, 0.45, 0.45] });

  const infoX = 44;
  const infoTop = 150;
  const infoW = 507;
  const infoH = 110;
  const halfW = infoW / 2;
  const infoRowH = infoH / 4;
  rectTop(infoX, infoTop, infoW, infoH);
  lineTop(infoX + halfW, infoTop, infoX + halfW, infoTop + infoH);
  lineTop(infoX, infoTop + infoRowH, infoX + infoW, infoTop + infoRowH);
  lineTop(infoX, infoTop + infoRowH * 2, infoX + infoW, infoTop + infoRowH * 2);
  lineTop(infoX, infoTop + infoRowH * 3, infoX + infoW, infoTop + infoRowH * 3);

  textTop("NAME:", infoX + 12, infoTop + 24, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
  textTop(limitText(data.studentName || "-", 34), infoX + 72, infoTop + 24, { font: "F1", size: 11 });
  textTop("SCHOOL YEAR:", infoX + halfW + 12, infoTop + 24, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
  textTop(data.schoolYear || "-", infoX + halfW + 104, infoTop + 24, { font: "F1", size: 11 });

  textTop("GRADE:", infoX + 12, infoTop + 52, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
  textTop(limitText(data.grade || "-", 28), infoX + 72, infoTop + 52, { font: "F1", size: 11 });
  textTop("TERM:", infoX + halfW + 12, infoTop + 52, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
  textTop(data.term || "-", infoX + halfW + 104, infoTop + 52, { font: "F1", size: 11 });

  textTop("ROLL NO:", infoX + 12, infoTop + 80, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
  textTop(data.rollNo || "-", infoX + 72, infoTop + 80, { font: "F1", size: 11 });
  textTop("DATE:", infoX + halfW + 12, infoTop + 80, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
  textTop(data.date || "-", infoX + halfW + 104, infoTop + 80, { font: "F1", size: 11 });

  textTop("TEACHER:", infoX + 12, infoTop + 106, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
  textTop(limitText(data.teacher || "-", 30), infoX + 82, infoTop + 106, { font: "F1", size: 11 });
  textTop("PARENT:", infoX + halfW + 12, infoTop + 106, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
  textTop(limitText(data.parentName || "-", 26), infoX + halfW + 80, infoTop + 106, { font: "F1", size: 11 });

  const tableX = 44;
  const tableTop = 278;
  const tableW = 507;
  const headerH = 34;
  const rowH = 28;
  const colSubject = 185;
  const colMarks = 70;
  const colTotal = 70;
  const colPct = 82;
  const colGrade = tableW - colSubject - colMarks - colTotal - colPct;

  rectTop(tableX, tableTop, tableW, headerH, "B", [0.22, 0.25, 0.3], [0.22, 0.25, 0.3]);
  lineTop(tableX + colSubject, tableTop, tableX + colSubject, tableTop + headerH, [0.85, 0.85, 0.85]);
  lineTop(tableX + colSubject + colMarks, tableTop, tableX + colSubject + colMarks, tableTop + headerH, [0.85, 0.85, 0.85]);
  lineTop(tableX + colSubject + colMarks + colTotal, tableTop, tableX + colSubject + colMarks + colTotal, tableTop + headerH, [0.85, 0.85, 0.85]);
  lineTop(tableX + colSubject + colMarks + colTotal + colPct, tableTop, tableX + colSubject + colMarks + colTotal + colPct, tableTop + headerH, [0.85, 0.85, 0.85]);

  textTop("SUBJECT", tableX + (colSubject / 2), tableTop + 22, { font: "F2", size: 11, align: "center", color: [1, 1, 1] });
  textTop("MARKS", tableX + colSubject + (colMarks / 2), tableTop + 22, { font: "F2", size: 11, align: "center", color: [1, 1, 1] });
  textTop("TOTAL", tableX + colSubject + colMarks + (colTotal / 2), tableTop + 22, { font: "F2", size: 11, align: "center", color: [1, 1, 1] });
  textTop("PERCENTAGE", tableX + colSubject + colMarks + colTotal + (colPct / 2), tableTop + 22, { font: "F2", size: 11, align: "center", color: [1, 1, 1] });
  textTop("GRADE", tableX + colSubject + colMarks + colTotal + colPct + (colGrade / 2), tableTop + 22, { font: "F2", size: 11, align: "center", color: [1, 1, 1] });

  shownRows.forEach((row, index) => {
    const top = tableTop + headerH + (index * rowH);
    rectTop(tableX, top, tableW, rowH, "S", [0.55, 0.55, 0.55], null, 0.9);
    lineTop(tableX + colSubject, top, tableX + colSubject, top + rowH);
    lineTop(tableX + colSubject + colMarks, top, tableX + colSubject + colMarks, top + rowH);
    lineTop(tableX + colSubject + colMarks + colTotal, top, tableX + colSubject + colMarks + colTotal, top + rowH);
    lineTop(tableX + colSubject + colMarks + colTotal + colPct, top, tableX + colSubject + colMarks + colTotal + colPct, top + rowH);

    textTop(limitText(row.subject || "", 24), tableX + (colSubject / 2), top + 18, { font: "F2", size: 10, align: "center", color: [0.2, 0.2, 0.2] });
    textTop(String(row.marks ?? ""), tableX + colSubject + (colMarks / 2), top + 18, { font: "F2", size: 10, align: "center", color: [0.2, 0.2, 0.2] });
    textTop(String(row.totalMarks ?? ""), tableX + colSubject + colMarks + (colTotal / 2), top + 18, { font: "F2", size: 10, align: "center", color: [0.2, 0.2, 0.2] });
    textTop(row.percentage !== "" ? `${row.percentage}%` : "", tableX + colSubject + colMarks + colTotal + (colPct / 2), top + 18, { font: "F2", size: 10, align: "center", color: [0.2, 0.2, 0.2] });
    textTop(row.grade || "", tableX + colSubject + colMarks + colTotal + colPct + (colGrade / 2), top + 18, { font: "F2", size: 10, align: "center", color: [0.2, 0.2, 0.2] });
  });

  const tableBottomTop = tableTop + headerH + (shownRows.length * rowH);
  const metricsTop = tableBottomTop + 18;
  const metricsW = 507;
  const metricsH = 84;
  const metricsX = 44;
  rectTop(metricsX, metricsTop, metricsW, metricsH);
  lineTop(metricsX + (metricsW / 2), metricsTop, metricsX + (metricsW / 2), metricsTop + metricsH);
  lineTop(metricsX, metricsTop + (metricsH / 3), metricsX + metricsW, metricsTop + (metricsH / 3));
  lineTop(metricsX, metricsTop + (metricsH / 3) * 2, metricsX + metricsW, metricsTop + (metricsH / 3) * 2);

  textTop(`ABSENCES: ${data.absences ?? 0}`, metricsX + 12, metricsTop + 20, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
  textTop(`TARDIES: ${data.tardies ?? 0}`, metricsX + (metricsW / 2) + 12, metricsTop + 20, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
  textTop(`PENALTIES: ${data.penalties ?? 0}`, metricsX + 12, metricsTop + 48, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
  textTop(`ATTENDANCE: ${Number(data.attendance || 0).toFixed(1)}%`, metricsX + (metricsW / 2) + 12, metricsTop + 48, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
  textTop(`FEES PENDING: Rs ${Number(data.feesPending || 0).toFixed(0)}`, metricsX + 12, metricsTop + 76, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
  textTop(`ASSIGNMENTS: ${data.assignmentsCompleted ?? 0}/${data.assignmentsTotal ?? 0}`, metricsX + (metricsW / 2) + 12, metricsTop + 76, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });

  const remarksTop = metricsTop + metricsH + 10;
  rectTop(44, remarksTop, 507, 48, "S", [0.6, 0.6, 0.6], [0.97, 0.97, 0.97], 0.9);
  textTop("ACTION REQUIRED:", 56, remarksTop + 17, { font: "F2", size: 10, color: [0.35, 0.35, 0.35] });
  textTop(limitText(data.actionRequired || "Keep up the good work!", 92), 150, remarksTop + 17, { font: "F1", size: 10, color: [0.2, 0.2, 0.2] });

  const summaryTop = remarksTop + 53;
  rectTop(44, summaryTop, 507, 42, "S", [0.6, 0.6, 0.6], [0.98, 0.98, 0.98], 0.9);
  textTop("ACADEMIC SUMMARY:", 56, summaryTop + 17, { font: "F2", size: 10, color: [0.35, 0.35, 0.35] });
  textTop(
    limitText(
      data.remarks || `Overall ${Number(data.overallPercentage || 0).toFixed(1)}% with ${Number(data.attendance || 0).toFixed(1)}% attendance.`,
      90
    ),
    56,
    summaryTop + 34,
    { font: "F1", size: 10, color: [0.2, 0.2, 0.2] }
  );

  const signatureTop = summaryTop + 65;
  const signLineY = signatureTop;
  const signLabelY = signatureTop + 18;

  lineTop(78, signLineY, 208, signLineY, [0.3, 0.3, 0.3], 1.1);
  lineTop(232, signLineY, 362, signLineY, [0.3, 0.3, 0.3], 1.1);
  lineTop(386, signLineY, 516, signLineY, [0.3, 0.3, 0.3], 1.1);

  textTop("Class Teacher Signature", 143, signLabelY, { font: "F1", size: 10, align: "center", color: [0.35, 0.35, 0.35] });
  textTop("Parent Signature", 297, signLabelY, { font: "F1", size: 10, align: "center", color: [0.35, 0.35, 0.35] });
  textTop("Principal Signature", 451, signLabelY, { font: "F1", size: 10, align: "center", color: [0.35, 0.35, 0.35] });

  textTop(schoolAddress, pageWidth / 2, 812, { font: "F1", size: 10, align: "center", color: [0.45, 0.45, 0.45] });

  const stream = commands.join("\n");
  return buildPdfWithFonts(stream, ["Helvetica", "Helvetica-Bold"]);
};

export const buildClassReportCardPdf = (data) => {
  const pageWidth = 595;
  const pageHeight = 842;
  const rows = Array.isArray(data.students) ? data.students : [];
  const pageStreams = [];

  const drawPage = ({ pageRows, pageNumber, totalPages, includeFooter, continuation }) => {
    const commands = [];
    const toPdfY = (top) => pageHeight - top;
    const safe = (value) => escapePdfText(value);

    const textTop = (value, x, top, { font = "F1", size = 10, align = "left", color = [0, 0, 0] } = {}) => {
      const text = safe(value);
      const widthApprox = String(value ?? "").length * size * 0.5;
      const xPos = align === "center" ? x - (widthApprox / 2) : align === "right" ? x - widthApprox : x;
      const yPos = toPdfY(top);
      commands.push(`${color[0]} ${color[1]} ${color[2]} rg`);
      commands.push(`BT /${font} ${size} Tf 1 0 0 1 ${xPos.toFixed(2)} ${yPos.toFixed(2)} Tm (${text}) Tj ET`);
    };

    const rectTop = (x, top, w, h, mode = "S", stroke = [0.55, 0.55, 0.55], fill = null, lineWidth = 1) => {
      const y = pageHeight - top - h;
      commands.push(`${lineWidth} w`);
      commands.push(`${stroke[0]} ${stroke[1]} ${stroke[2]} RG`);
      if (fill) commands.push(`${fill[0]} ${fill[1]} ${fill[2]} rg`);
      commands.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${mode}`);
    };

    const lineTop = (x1, top1, x2, top2, stroke = [0.55, 0.55, 0.55], lineWidth = 1) => {
      commands.push(`${lineWidth} w`);
      commands.push(`${stroke[0]} ${stroke[1]} ${stroke[2]} RG`);
      commands.push(`${x1.toFixed(2)} ${toPdfY(top1).toFixed(2)} m ${x2.toFixed(2)} ${toPdfY(top2).toFixed(2)} l S`);
    };

    rectTop(24, 20, 547, 802, "S", [0.45, 0.45, 0.45], null, 1.2);
    textTop(limitText(data.schoolName || "Little Flower Matric Hr.Sec.School", 58), pageWidth / 2, 55, { font: "F2", size: 16, align: "center", color: [0.12, 0.12, 0.12] });
    textTop(limitText(data.schoolAddress || "Sathyamangalam-638401", 58), pageWidth / 2, 78, { font: "F1", size: 11, align: "center", color: [0.3, 0.3, 0.3] });
    textTop(continuation ? "CLASS PERFORMANCE REPORT CARD (CONTINUED)" : "CLASS PERFORMANCE REPORT CARD", pageWidth / 2, 117, { font: "F2", size: continuation ? 21 : 20, align: "center", color: [0.2, 0.22, 0.25] });
    textTop(`Class ${data.classNum}-${data.section} | ${data.exam}`, pageWidth / 2, 140, { font: "F1", size: 11, align: "center", color: [0.45, 0.45, 0.45] });
    textTop(`Page ${pageNumber}/${totalPages}`, 551, 140, { font: "F1", size: 9, align: "right", color: [0.5, 0.5, 0.5] });

    let tableTop = 170;
    if (!continuation) {
      const infoX = 44;
      const infoTop = 160;
      const infoW = 507;
      const infoH = 84;
      const halfW = infoW / 2;
      rectTop(infoX, infoTop, infoW, infoH);
      lineTop(infoX + halfW, infoTop, infoX + halfW, infoTop + infoH);
      lineTop(infoX, infoTop + 28, infoX + infoW, infoTop + 28);
      lineTop(infoX, infoTop + 56, infoX + infoW, infoTop + 56);
      textTop("CLASS TEACHER:", infoX + 12, infoTop + 20, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
      textTop(limitText(data.teacherName || "-", 24), infoX + 138, infoTop + 20, { font: "F1", size: 11 });
      textTop("EXAM:", infoX + halfW + 12, infoTop + 20, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
      textTop(limitText(data.exam || "-", 18), infoX + halfW + 78, infoTop + 20, { font: "F1", size: 11 });
      textTop("CLASS AVERAGE:", infoX + 12, infoTop + 48, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
      textTop(`${Number(data.overallPercentage || 0).toFixed(1)}%`, infoX + 138, infoTop + 48, { font: "F1", size: 11 });
      textTop("ATTENDANCE:", infoX + halfW + 12, infoTop + 48, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
      textTop(`${Number(data.overallAttendance || 0).toFixed(1)}%`, infoX + halfW + 110, infoTop + 48, { font: "F1", size: 11 });
      textTop("TOTAL STUDENTS:", infoX + 12, infoTop + 76, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
      textTop(String(data.totalStudents || 0), infoX + 138, infoTop + 76, { font: "F1", size: 11 });
      textTop("DRAWBACKS:", infoX + halfW + 12, infoTop + 76, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
      textTop(String(data.totalDrawbacks || 0), infoX + halfW + 110, infoTop + 76, { font: "F1", size: 11 });
      tableTop = 262;
    }

    const tableX = 44;
    const tableW = 507;
    const headerH = 30;
    const rowH = 23;
    const colRoll = 80;
    const colName = 165;
    const colAvg = 72;
    const colAttendance = 72;
    const colStatus = 58;
    const colDraw = 60;

    rectTop(tableX, tableTop, tableW, headerH, "B", [0.22, 0.25, 0.3], [0.22, 0.25, 0.3]);
    const split1 = tableX + colRoll;
    const split2 = split1 + colName;
    const split3 = split2 + colAvg;
    const split4 = split3 + colAttendance;
    const split5 = split4 + colStatus;
    [split1, split2, split3, split4, split5].forEach((x) => lineTop(x, tableTop, x, tableTop + headerH, [0.85, 0.85, 0.85]));
    textTop("ROLL NO", tableX + colRoll / 2, tableTop + 19, { font: "F2", size: 9, align: "center", color: [1, 1, 1] });
    textTop("NAME", split1 + colName / 2, tableTop + 19, { font: "F2", size: 9, align: "center", color: [1, 1, 1] });
    textTop("AVG %", split2 + colAvg / 2, tableTop + 19, { font: "F2", size: 9, align: "center", color: [1, 1, 1] });
    textTop("ATT %", split3 + colAttendance / 2, tableTop + 19, { font: "F2", size: 9, align: "center", color: [1, 1, 1] });
    textTop("STATUS", split4 + colStatus / 2, tableTop + 19, { font: "F2", size: 9, align: "center", color: [1, 1, 1] });
    textTop("DRAW", split5 + colDraw / 2, tableTop + 19, { font: "F2", size: 9, align: "center", color: [1, 1, 1] });

    pageRows.forEach((row, index) => {
      const top = tableTop + headerH + index * rowH;
      rectTop(tableX, top, tableW, rowH, "S", [0.55, 0.55, 0.55], null, 0.8);
      [split1, split2, split3, split4, split5].forEach((x) => lineTop(x, top, x, top + rowH));
      textTop(limitText(row.rollNo || row.studentId || "-", 10), tableX + colRoll / 2, top + 16, { font: "F1", size: 8.5, align: "center" });
      textTop(limitText(row.name || "-", 20), split1 + 4, top + 16, { font: "F1", size: 8.5 });
      textTop(`${Number(row.average || row.percentage || 0).toFixed(1)}`, split2 + colAvg / 2, top + 16, { font: "F1", size: 8.5, align: "center" });
      textTop(`${Number(row.attendance || 0).toFixed(1)}`, split3 + colAttendance / 2, top + 16, { font: "F1", size: 8.5, align: "center" });
      textTop(limitText(row.status || "-", 8), split4 + colStatus / 2, top + 16, { font: "F1", size: 8.5, align: "center" });
      textTop(String(row.drawbacks ?? 0), split5 + colDraw / 2, top + 16, { font: "F1", size: 8.5, align: "center" });
    });

    const tableEndTop = tableTop + headerH + (pageRows.length * rowH);
    if (!includeFooter) {
      textTop("Continued on next page...", 551, 790, { font: "F1", size: 10, align: "right", color: [0.45, 0.45, 0.45] });
      textTop(limitText(data.schoolAddress || "Sathyamangalam-638401", 58), pageWidth / 2, 812, { font: "F1", size: 10, align: "center", color: [0.45, 0.45, 0.45] });
      return commands.join("\n");
    }

    const metricsTop = tableEndTop + 16;
    rectTop(44, metricsTop, 507, 62);
    lineTop(44 + 253.5, metricsTop, 44 + 253.5, metricsTop + 62);
    lineTop(44, metricsTop + 31, 551, metricsTop + 31);
    textTop(`EXCELLENT: ${data.excellentCount || 0}`, 56, metricsTop + 20, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
    textTop(`GOOD: ${data.goodCount || 0}`, 311, metricsTop + 20, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
    textTop(`AVERAGE: ${data.averageCount || 0}`, 56, metricsTop + 50, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
    textTop(`WEAK: ${data.weakCount || 0}`, 311, metricsTop + 50, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });

    const insightTop = metricsTop + 72;
    rectTop(44, insightTop, 507, 48, "S", [0.6, 0.6, 0.6], [0.97, 0.97, 0.97], 0.9);
    textTop("KEY INSIGHTS:", 56, insightTop + 17, { font: "F2", size: 10, color: [0.35, 0.35, 0.35] });
    textTop(limitText(data.insight || "Class performance summary generated from latest faculty entries.", 92), 56, insightTop + 36, { font: "F1", size: 10, color: [0.2, 0.2, 0.2] });

    const signatureTop = insightTop + 74;
    lineTop(78, signatureTop, 208, signatureTop, [0.3, 0.3, 0.3], 1.1);
    lineTop(232, signatureTop, 362, signatureTop, [0.3, 0.3, 0.3], 1.1);
    lineTop(386, signatureTop, 516, signatureTop, [0.3, 0.3, 0.3], 1.1);
    textTop("Class Teacher Signature", 143, signatureTop + 18, { font: "F1", size: 10, align: "center", color: [0.35, 0.35, 0.35] });
    textTop("HOD Signature", 297, signatureTop + 18, { font: "F1", size: 10, align: "center", color: [0.35, 0.35, 0.35] });
    textTop("Principal Signature", 451, signatureTop + 18, { font: "F1", size: 10, align: "center", color: [0.35, 0.35, 0.35] });
    textTop(limitText(data.schoolAddress || "Sathyamangalam-638401", 58), pageWidth / 2, 812, { font: "F1", size: 10, align: "center", color: [0.45, 0.45, 0.45] });

    return commands.join("\n");
  };

  const firstPageRowsCap = 20;
  const normalPageRowsCap = 26;
  const lastPageRowsCap = 13;
  const remaining = [...rows];
  const chunks = [];

  if (remaining.length <= lastPageRowsCap) {
    chunks.push({ rows: remaining.splice(0), continuation: false, includeFooter: true });
  } else {
    const firstTake = Math.min(firstPageRowsCap, Math.max(1, remaining.length - lastPageRowsCap));
    chunks.push({ rows: remaining.splice(0, firstTake), continuation: false, includeFooter: false });
    while (remaining.length > lastPageRowsCap) {
      const take = Math.min(normalPageRowsCap, Math.max(1, remaining.length - lastPageRowsCap));
      chunks.push({ rows: remaining.splice(0, take), continuation: true, includeFooter: false });
    }
    chunks.push({ rows: remaining.splice(0), continuation: true, includeFooter: true });
  }

  const totalPages = chunks.length;
  chunks.forEach((chunk, index) => {
    pageStreams.push(
      drawPage({
        pageRows: chunk.rows,
        pageNumber: index + 1,
        totalPages,
        includeFooter: chunk.includeFooter,
        continuation: chunk.continuation
      })
    );
  });

  return buildPdfWithFontsMultiPage(pageStreams, ["Helvetica", "Helvetica-Bold"]);
};

export const buildAdminOverallReportPdf = (data) => {
  const pageWidth = 595;
  const pageHeight = 842;
  const rows = Array.isArray(data.examRows) ? data.examRows : [];
  const pageStreams = [];

  const drawPage = ({ pageRows, pageNumber, totalPages, includeFooter, continuation }) => {
    const commands = [];
    const toPdfY = (top) => pageHeight - top;
    const safe = (value) => escapePdfText(value);

    const textTop = (value, x, top, { font = "F1", size = 10, align = "left", color = [0, 0, 0] } = {}) => {
      const text = safe(value);
      const widthApprox = String(value ?? "").length * size * 0.5;
      const xPos = align === "center" ? x - (widthApprox / 2) : align === "right" ? x - widthApprox : x;
      const yPos = toPdfY(top);
      commands.push(`${color[0]} ${color[1]} ${color[2]} rg`);
      commands.push(`BT /${font} ${size} Tf 1 0 0 1 ${xPos.toFixed(2)} ${yPos.toFixed(2)} Tm (${text}) Tj ET`);
    };

    const rectTop = (x, top, w, h, mode = "S", stroke = [0.55, 0.55, 0.55], fill = null, lineWidth = 1) => {
      const y = pageHeight - top - h;
      commands.push(`${lineWidth} w`);
      commands.push(`${stroke[0]} ${stroke[1]} ${stroke[2]} RG`);
      if (fill) commands.push(`${fill[0]} ${fill[1]} ${fill[2]} rg`);
      commands.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${mode}`);
    };

    const lineTop = (x1, top1, x2, top2, stroke = [0.55, 0.55, 0.55], lineWidth = 1) => {
      commands.push(`${lineWidth} w`);
      commands.push(`${stroke[0]} ${stroke[1]} ${stroke[2]} RG`);
      commands.push(`${x1.toFixed(2)} ${toPdfY(top1).toFixed(2)} m ${x2.toFixed(2)} ${toPdfY(top2).toFixed(2)} l S`);
    };

    rectTop(24, 20, 547, 802, "S", [0.45, 0.45, 0.45], null, 1.2);
    textTop(limitText(data.schoolName || "Little Flower Matric Hr.Sec.School", 58), pageWidth / 2, 55, { font: "F2", size: 16, align: "center", color: [0.12, 0.12, 0.12] });
    textTop(limitText(data.schoolAddress || "Sathyamangalam-638401", 58), pageWidth / 2, 78, { font: "F1", size: 11, align: "center", color: [0.3, 0.3, 0.3] });
    textTop(continuation ? "ADMIN OVERALL REPORT CARD (CONTINUED)" : "ADMIN OVERALL REPORT CARD", pageWidth / 2, 117, { font: "F2", size: continuation ? 18 : 20, align: "center", color: [0.2, 0.22, 0.25] });
    textTop(`Academic Year ${data.year || "-"}`, pageWidth / 2, 140, { font: "F1", size: 11, align: "center", color: [0.45, 0.45, 0.45] });
    textTop(`Page ${pageNumber}/${totalPages}`, 551, 140, { font: "F1", size: 9, align: "right", color: [0.5, 0.5, 0.5] });

    let tableTop = 170;
    if (!continuation) {
      const infoX = 44;
      const infoTop = 160;
      const infoW = 507;
      const infoH = 84;
      const halfW = infoW / 2;
      rectTop(infoX, infoTop, infoW, infoH);
      lineTop(infoX + halfW, infoTop, infoX + halfW, infoTop + infoH);
      lineTop(infoX, infoTop + 28, infoX + infoW, infoTop + 28);
      lineTop(infoX, infoTop + 56, infoX + infoW, infoTop + 56);
      textTop("TOTAL REPORTS:", infoX + 12, infoTop + 20, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
      textTop(String(data.totalReports || 0), infoX + 134, infoTop + 20, { font: "F1", size: 11 });
      textTop("TOTAL STUDENTS:", infoX + halfW + 12, infoTop + 20, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
      textTop(String(data.totalStudents || 0), infoX + halfW + 142, infoTop + 20, { font: "F1", size: 11 });
      textTop("OVERALL AVG %:", infoX + 12, infoTop + 48, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
      textTop(`${Number(data.averagePercentage || 0).toFixed(1)}%`, infoX + 134, infoTop + 48, { font: "F1", size: 11 });
      textTop("OVERALL ATT %:", infoX + halfW + 12, infoTop + 48, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
      textTop(`${Number(data.averageAttendance || 0).toFixed(1)}%`, infoX + halfW + 142, infoTop + 48, { font: "F1", size: 11 });
      textTop("BEST EXAM:", infoX + 12, infoTop + 76, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
      textTop(limitText(data.bestExam || "-", 22), infoX + 134, infoTop + 76, { font: "F1", size: 11 });
      textTop("NEEDS SUPPORT:", infoX + halfW + 12, infoTop + 76, { font: "F2", size: 10, color: [0.45, 0.45, 0.45] });
      textTop(limitText(data.supportExam || "-", 20), infoX + halfW + 142, infoTop + 76, { font: "F1", size: 11 });
      tableTop = 262;
    }

    const tableX = 44;
    const tableW = 507;
    const headerH = 30;
    const rowH = 23;
    const cols = [142, 42, 40, 52, 52, 42, 42, 52, 43];
    const starts = [tableX];
    cols.forEach((w) => starts.push(starts[starts.length - 1] + w));

    rectTop(tableX, tableTop, tableW, headerH, "B", [0.22, 0.25, 0.3], [0.22, 0.25, 0.3]);
    starts.slice(1, -1).forEach((x) => lineTop(x, tableTop, x, tableTop + headerH, [0.85, 0.85, 0.85]));
    const headers = ["EXAM", "TERM", "YEAR", "STUD", "AVG%", "ATT%", "PASS%", "TOP", "SUPPORT"];
    headers.forEach((head, idx) => {
      textTop(head, starts[idx] + cols[idx] / 2, tableTop + 19, { font: "F2", size: 8.5, align: "center", color: [1, 1, 1] });
    });

    pageRows.forEach((row, index) => {
      const top = tableTop + headerH + index * rowH;
      rectTop(tableX, top, tableW, rowH, "S", [0.55, 0.55, 0.55], null, 0.8);
      starts.slice(1, -1).forEach((x) => lineTop(x, top, x, top + rowH));
      const vals = [
        limitText(row.exam || "-", 24),
        limitText(row.term || "-", 8),
        String(row.year || "-"),
        String(row.totalStudents ?? 0),
        Number(row.averagePercentage || 0).toFixed(1),
        Number(row.averageAttendance || 0).toFixed(1),
        Number(row.passPercentage || 0).toFixed(1),
        String(row.topPerformers ?? 0),
        String(row.needsImprovement ?? 0)
      ];
      vals.forEach((val, idx) => {
        textTop(val, starts[idx] + cols[idx] / 2, top + 16, { font: "F1", size: idx === 0 ? 8.5 : 8.2, align: "center" });
      });
    });

    const tableEndTop = tableTop + headerH + pageRows.length * rowH;
    if (!includeFooter) {
      textTop("Continued on next page...", 551, 790, { font: "F1", size: 10, align: "right", color: [0.45, 0.45, 0.45] });
      textTop(limitText(data.schoolAddress || "Sathyamangalam-638401", 58), pageWidth / 2, 812, { font: "F1", size: 10, align: "center", color: [0.45, 0.45, 0.45] });
      return commands.join("\n");
    }

    const summaryTop = tableEndTop + 16;
    rectTop(44, summaryTop, 507, 74, "S", [0.6, 0.6, 0.6], [0.97, 0.97, 0.97], 0.9);
    textTop("ADMIN EXECUTIVE SUMMARY:", 56, summaryTop + 18, { font: "F2", size: 10, color: [0.35, 0.35, 0.35] });
    textTop(
      limitText(
        `School-wide average is ${Number(data.averagePercentage || 0).toFixed(1)}% with ${Number(data.averageAttendance || 0).toFixed(1)}% attendance across ${Number(data.totalReports || 0)} report(s). Best performing exam: ${data.bestExam || "-"}. Highest support need identified in: ${data.supportExam || "-"}.`,
        118
      ),
      56,
      summaryTop + 40,
      { font: "F1", size: 10, color: [0.2, 0.2, 0.2] }
    );

    const signatureTop = summaryTop + 96;
    lineTop(78, signatureTop, 208, signatureTop, [0.3, 0.3, 0.3], 1.1);
    lineTop(232, signatureTop, 362, signatureTop, [0.3, 0.3, 0.3], 1.1);
    lineTop(386, signatureTop, 516, signatureTop, [0.3, 0.3, 0.3], 1.1);
    textTop("Academic Coordinator", 143, signatureTop + 18, { font: "F1", size: 10, align: "center", color: [0.35, 0.35, 0.35] });
    textTop("Admin Signature", 297, signatureTop + 18, { font: "F1", size: 10, align: "center", color: [0.35, 0.35, 0.35] });
    textTop("Principal Signature", 451, signatureTop + 18, { font: "F1", size: 10, align: "center", color: [0.35, 0.35, 0.35] });
    textTop(limitText(data.schoolAddress || "Sathyamangalam-638401", 58), pageWidth / 2, 812, { font: "F1", size: 10, align: "center", color: [0.45, 0.45, 0.45] });

    return commands.join("\n");
  };

  const firstPageCap = 20;
  const normalPageCap = 25;
  const lastPageCap = 12;
  const remaining = [...rows];
  const chunks = [];

  if (remaining.length <= lastPageCap) {
    chunks.push({ rows: remaining.splice(0), continuation: false, includeFooter: true });
  } else {
    const firstTake = Math.min(firstPageCap, Math.max(1, remaining.length - lastPageCap));
    chunks.push({ rows: remaining.splice(0, firstTake), continuation: false, includeFooter: false });
    while (remaining.length > lastPageCap) {
      const take = Math.min(normalPageCap, Math.max(1, remaining.length - lastPageCap));
      chunks.push({ rows: remaining.splice(0, take), continuation: true, includeFooter: false });
    }
    chunks.push({ rows: remaining.splice(0), continuation: true, includeFooter: true });
  }

  const totalPages = chunks.length;
  chunks.forEach((chunk, index) => {
    pageStreams.push(
      drawPage({
        pageRows: chunk.rows,
        pageNumber: index + 1,
        totalPages,
        includeFooter: chunk.includeFooter,
        continuation: chunk.continuation
      })
    );
  });

  return buildPdfWithFontsMultiPage(pageStreams, ["Helvetica", "Helvetica-Bold"]);
};

export const createDownloadPayload = ({ filename, mimeType, buffer }) => ({
  filename,
  mimeType,
  contentBase64: Buffer.from(buffer).toString("base64")
});
