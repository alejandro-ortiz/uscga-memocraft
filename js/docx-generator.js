/**
 * Generates a USCG memorandum DOCX file.
 * 
 * Body Format:
 * Array of objects: { level: 0-6, text: string }
 * 
 * Levels:
 * 0: 1., 2., 3. (text wrap)
 * 1: a., b., c. (tabbed)
 * 2+: (1), (a), (i), (aa), (aaa)
 */

export async function generateMemo(options) {
  const {
    logoPath = 'logo.gif',
    unit,           // Multi-line string for unit info (e.g., "Commandant\nUnited States Coast Guard")
    contact,        // Multi-line string for contact block
    ssic,           // SSIC/Serial number
    date,           // Date string (e.g., "01 Jan 2024")
    from,           // From line (multi-line, tabs will align continuation)
    to,             // To line (multi-line)
    thru = null,    // Optional thru chain (multi-line)
    subject,        // Subject line
    ref = null,     // Optional reference (multi-line for multiple refs)
    body,           // Array of { level: number, text: string }
    enclosure = null,   // Optional enclosure text
    dist = null,        // Optional distribution
    copy = null,        // Optional copy
    blindCopy = null    // Optional blind copy
  } = options;

  // Load logo
  const logoResponse = await fetch(logoPath);
  if (!logoResponse.ok) {
    throw new Error(`Could not load ${logoPath} - make sure it is in the same folder`);
  }
  const logoArrayBuffer = await logoResponse.arrayBuffer();
  const logoImageData = new Uint8Array(logoArrayBuffer);

  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    AlignmentType,
    ImageRun,
    TabStopType,
    TableLayoutType,
    HeightRule,
    LevelFormat,
    Header,
    Footer,
    LineRuleType,
    PageNumber
  } = docx;

  // ============================================
  // HELPER: Create paragraphs with tab alignment
  // ============================================
  function createTabbedParagraphs(prefix, text, prefixTabCount = 1) {
    const lines = text.split('\n').filter(line => line.trim());  // Filter out empty lines
    const paragraphs = [];
    const tabPrefix = '\t'.repeat(prefixTabCount);

    lines.forEach((line, index) => {
      if (index === 0) {
        // First line includes the prefix (e.g., "From:\t")
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: `${prefix}\t${line}` })]
          })
        );
      } else {
        // Continuation lines are tab-aligned
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: `${tabPrefix}${line}` })]
          })
        );
      }
    });

    return paragraphs;
  }

  // ============================================
  // HELPER: Create unit info paragraphs (8pt Arial)
  // ============================================
  function createUnitParagraphs(text) {
    return text.split('\n').map(line =>
      new Paragraph({
        spacing: { line: 160, lineRule: "exact" },
        children: [
          new TextRun({ text: line, font: "Arial", size: 16 })  // 8pt
        ]
      })
    );
  }

  // ============================================
  // HELPER: Create contact paragraphs (8pt Arial)
  // ============================================
  function createContactParagraphs(text) {
    return text.split('\n').map(line =>
      new Paragraph({
        spacing: { line: 160, lineRule: "exact" },
        children: [
          new TextRun({ text: line, font: "Arial", size: 16 })  // 8pt
        ]
      })
    );
  }

  // ============================================
  // HELPER: Create body paragraphs with proper numbering
  // ============================================
  function createBodyParagraphs(bodyItems) {
    const paragraphs = [];
    const isSinglePara = bodyItems.length === 1;

    bodyItems.forEach((item, index) => {
      const isLast = index === bodyItems.length - 1;

      // Level-0 basic paragraphs: two spaces after the number, per the manual's
      // "period and double space." Deeper levels are tab-aligned by the numbering.
      // Bulleted lines get no double space (the bullet is their marker).
      const runText = (!isSinglePara && item.level === 0 && !item.bullet) ? '  ' + item.text : item.text;
      const paraOptions = {
        spacing: { after: isLast ? 0 : 240 },  // No after spacing on last item
        children: [
          new TextRun({ text: runText })
        ]
      };

      // Only apply numbering if there is more than one paragraph
      if (!isSinglePara) {
        paraOptions.numbering = {
          reference: item.bullet ? "cg-memo-bullets" : "cg-memo-numbering",
          level: item.level
        };
      }

      paragraphs.push(new Paragraph(paraOptions));
    });

    return paragraphs;
  }

  // ============================================
  // COAST GUARD MEMO NUMBERING FORMAT
  // ============================================
  const numberingConfig = {
    config: [{
      reference: "cg-memo-numbering",
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 0, firstLine: 0 } } },
          suffix: "nothing"
        },
        {
          level: 1,
          format: LevelFormat.LOWER_LETTER,
          text: "%2.",
          alignment: AlignmentType.RIGHT,
          style: { paragraph: { indent: { left: 607, hanging: 100 } } },
          suffix: "tab"
        },
        {
          level: 2,
          format: LevelFormat.DECIMAL,
          text: "(%3)",
          alignment: AlignmentType.RIGHT,
          style: { paragraph: { indent: { left: 1103, hanging: 100 } } },
          suffix: "tab"
        },
        {
          level: 3,
          format: LevelFormat.LOWER_LETTER,
          text: "(%4)",
          alignment: AlignmentType.RIGHT,
          style: { paragraph: { indent: { left: 1557, hanging: 100 } } },
          suffix: "tab"
        },
        {
          level: 4,
          format: LevelFormat.LOWER_ROMAN,
          text: "(%5)",
          alignment: AlignmentType.RIGHT,
          style: { paragraph: { indent: { left: 2103, hanging: 100 } } },
          suffix: "tab"
        },
        {
          level: 5,
          format: LevelFormat.LOWER_LETTER,
          text: "(%6%6.)",
          alignment: AlignmentType.RIGHT,
          style: { paragraph: { indent: { left: 2607, hanging: 100 } } },
          suffix: "tab"
        },
        {
          level: 6,
          format: LevelFormat.LOWER_LETTER,
          text: "(%7%7%7)",
          alignment: AlignmentType.RIGHT,
          style: { paragraph: { indent: { left: 3203, hanging: 100 } } },
          suffix: "tab"
        }
      ]
    }]
  };

  // Bullet variant: same indents/alignment as the numbered levels, but a "•"
  // marker instead of a number (manual allows bullets for subparagraphs). Built
  // from the numbered levels so the two stay in lockstep.
  numberingConfig.config.push({
    reference: "cg-memo-bullets",
    levels: numberingConfig.config[0].levels.map(lv => ({
      ...lv,
      format: LevelFormat.BULLET,
      text: "•",
      suffix: "tab"
    }))
  });

  // Build document children array
  const docChildren = [];

  // ============================================
  // HEADER TABLE (3 columns, 2 rows, no borders)
  // Row 1: Logo, Unit Info, Contact Block
  // Row 2: Empty, Empty, SSIC/Date
  // ============================================
  docChildren.push(
    new Table({
      width: { size: 10188, type: WidthType.DXA },
      indent: { size: -180, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE }
      },
      rows: [
        // Row 1: Logo, Unit, Contact
        new TableRow({
          height: { value: 980, rule: HeightRule.ATLEAST },
          children: [
            // Column 1: Logo
            new TableCell({
              width: { size: 3888, type: WidthType.DXA },
              margins: { top: 0, bottom: 0, left: 137, right: 108 },
              children: [
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: logoImageData,
                      transformation: { width: 192, height: 59 },
                      type: "gif"
                    })
                  ]
                })
              ]
            }),
            // Column 2: Unit Info
            new TableCell({
              width: { size: 2970, type: WidthType.DXA },
              margins: { top: 0, bottom: 0, left: 108, right: 108 },
              children: createUnitParagraphs(unit)
            }),
            // Column 3: Contact Block
            new TableCell({
              width: { size: 3330, type: WidthType.DXA },
              margins: { top: 0, bottom: 0, left: 108, right: 108 },
              children: createContactParagraphs(contact)
            })
          ]
        }),
        // Row 2: Empty, Empty, SSIC/Date
        new TableRow({
          children: [
            // Column 1: Empty
            new TableCell({
              width: { size: 3888, type: WidthType.DXA },
              margins: { top: 0, bottom: 0, left: 108, right: 108 },
              children: [new Paragraph({ children: [] })]
            }),
            // Column 2: Empty
            new TableCell({
              width: { size: 2970, type: WidthType.DXA },
              margins: { top: 0, bottom: 0, left: 108, right: 108 },
              children: [new Paragraph({ children: [] })]
            }),
            // Column 3: SSIC and Date
            new TableCell({
              width: { size: 3330, type: WidthType.DXA },
              margins: { top: 0, bottom: 0, left: 108, right: 108 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: ssic })]
                }),
                new Paragraph({
                  children: [new TextRun({ text: date })]
                })
              ]
            })
          ]
        })
      ]
    })
  );

  // ============================================
  // MEMORANDUM TITLE
  // ============================================
  docChildren.push(
    new Paragraph({
      children: [
        new TextRun({ text: "MEMORANDUM", bold: true, size: 32 })  // 16pt
      ]
    })
  );

  // Two blank lines after MEMORANDUM
  docChildren.push(new Paragraph({ children: [] }));
  docChildren.push(new Paragraph({ children: [] }));

  // ============================================
  // FROM LINE
  // ============================================
  docChildren.push(...createTabbedParagraphs("From:", from));
  docChildren.push(new Paragraph({ children: [] }));

  // ============================================
  // TO LINE
  // ============================================
  docChildren.push(...createTabbedParagraphs("To:", to));

  // ============================================
  // THRU LINE (optional)
  // ============================================
  if (thru) {
    docChildren.push(...createTabbedParagraphs("Thru:", thru));
  }
  docChildren.push(new Paragraph({ children: [] }));

  // ============================================
  // SUBJ LINE
  // ============================================
  docChildren.push(
    new Paragraph({
      children: [new TextRun({ text: `Subj:\t${subject}` })]
    })
  );
  docChildren.push(new Paragraph({ children: [] }));

  // ============================================
  // REF LINE (optional)
  // ============================================
  if (ref) {
    const refLines = ref.split('\n');
    refLines.forEach((line, index) => {
      if (index === 0) {
        docChildren.push(
          new Paragraph({
            children: [new TextRun({ text: `Ref:\t${line}` })]
          })
        );
      } else {
        docChildren.push(
          new Paragraph({
            children: [new TextRun({ text: `\t${line}` })]
          })
        );
      }
    });
    docChildren.push(new Paragraph({ children: [] }));
  }

  // ============================================
  // BODY PARAGRAPHS WITH PROPER CG NUMBERING
  // ============================================
  docChildren.push(...createBodyParagraphs(body));

  // Empty lines before #
  docChildren.push(new Paragraph({ children: [] }));
  docChildren.push(new Paragraph({ children: [] }));

  // ============================================
  // CENTERED # SYMBOL
  // ============================================
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "#" })]
    })
  );

  // ============================================
  // FOOTER SECTIONS (after #): Encl, Dist, Copy, Blind Copy
  // ============================================
  const footerItems = [];
  // "Enclosures:" per the CGA Sample Memo. tabs:2 keeps continuation lines
  // aligned under the text (the label is as wide as "Blind Copy:").
  if (enclosure) footerItems.push({ label: 'Enclosures:', text: enclosure, tabs: 2 });
  if (dist) footerItems.push({ label: 'Dist:', text: dist, tabs: 1 });
  if (copy) footerItems.push({ label: 'Copy:', text: copy, tabs: 1 });
  if (blindCopy) footerItems.push({ label: 'Blind Copy:', text: blindCopy, tabs: 2 });

  // Add two blank lines after # only if there are footer items
  if (footerItems.length > 0) {
    docChildren.push(new Paragraph({ children: [] }));
    docChildren.push(new Paragraph({ children: [] }));
  }

  footerItems.forEach((item, itemIdx) => {
    docChildren.push(...createTabbedParagraphs(item.label, item.text, item.tabs));

    // Add blank paragraph between footer items, but NOT after the last one
    if (itemIdx < footerItems.length - 1) {
      docChildren.push(new Paragraph({ children: [] }));
    }
  });

  // ============================================
  // CREATE DOCUMENT
  // ============================================
  const doc = new Document({
    numbering: numberingConfig,
    styles: {
      default: {
        document: {
          run: {
            font: "Times New Roman",
            size: 24  // 12pt in half-points
          },
          paragraph: {
            spacing: {
              after: 0,
              line: 240,
              lineRule: "auto"
            }
          }
        }
      }
    },
    sections: [{
      properties: {
        titlePage: true,
        page: {
          size: { width: 12240, height: 15840 },  // 8.5" x 11"
          margin: {
            top: 1440,
            right: 1440,
            bottom: 1440,
            left: 1440,
            header: 720,
            footer: 720
          }
        }
      },
      headers: {
        first: new Header({
          children: [
            new Paragraph({
              children: [new TextRun({ text: " ", font: "Times New Roman", size: 22 })],
              spacing: { after: 0, line: 240, lineRule: LineRuleType.EXACT }
            }),
            new Paragraph({
              children: [new TextRun({ text: " ", font: "Times New Roman", size: 22 })],
              spacing: { after: 0, line: 240, lineRule: LineRuleType.EXACT }
            }),
            new Paragraph({
              children: [new TextRun({ text: " ", font: "Times New Roman", size: 22 })],
              spacing: { after: 0, line: 240, lineRule: LineRuleType.EXACT }
            })
          ]
        }),
        default: new Header({
          children: [
            // Header table for pages 2+: Subj on the left, SSIC+date on the right.
            // FIXED layout + explicit column widths lock the SSIC/date column so
            // it lands under the page-1 letterhead SSIC column (≈6786 twips from
            // the margin) regardless of how long the subject line is. (Auto layout
            // let the Subj cell shrink to its content and drift the date.)
            new Table({
              width: { size: 9360, type: WidthType.DXA },
              indent: { size: 0, type: WidthType.DXA },
              layout: TableLayoutType.FIXED,
              columnWidths: [6786, 2574],
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE },
                insideVertical: { style: BorderStyle.NONE }
              },
              rows: [
                // Row 1: Subject | SSIC & Date
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 6786, type: WidthType.DXA },
                      margins: { left: 0, right: 0, top: 0, bottom: 0 },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: `Subj: ${subject}`, size: 24 })
                          ]
                        })
                      ]
                    }),
                    new TableCell({
                      width: { size: 2574, type: WidthType.DXA },
                      margins: { left: 0, right: 0, top: 0, bottom: 0 },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: ssic, size: 24 })
                          ]
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({ text: date, size: 24 })
                          ]
                        })
                      ]
                    })
                  ]
                })
              ]
            }),
            new Paragraph({ children: [] })
          ]
        })
      },
      footers: {
        first: new Footer({
          children: [new Paragraph({ children: [] })]  // Empty footer for first page
        }),
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  children: [PageNumber.CURRENT]
                })
              ]
            })
          ]
        })
      },
      children: docChildren
    }]
  });

  // Generate blob
  const blob = await Packer.toBlob(doc);
  return blob;
}

/**
 * Helper function to download the generated memo
 */
export async function downloadMemo(options, filename = 'memo.docx') {
  const blob = await generateMemo(options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

